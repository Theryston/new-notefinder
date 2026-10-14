"""Mel-Band RoFormer, inference only. See NOTICE and LICENSE in this directory."""

import torch
from einops import rearrange, reduce, repeat
from rotary_embedding_torch import RotaryEmbedding
from torch import nn
from torch.nn import Module, ModuleList, functional

from note_detector.mel_filters import mel_filter_bank
from note_detector.separation_config import (
    AUDIO_CHANNELS,
    MelBandRoformerConfig,
)

class RMSNorm(Module):
    def __init__(self, dim: int) -> None:
        super().__init__()
        self.scale = dim**0.5
        self.gamma = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return functional.normalize(x, dim=-1) * self.scale * self.gamma


class FeedForward(Module):
    def __init__(self, dim: int, mult: int = 4) -> None:
        super().__init__()
        dim_inner = int(dim * mult)
        # The indices are the checkpoint's keys: keep the (no-op) dropouts.
        self.net = nn.Sequential(
            RMSNorm(dim),
            nn.Linear(dim, dim_inner),
            nn.GELU(),
            nn.Dropout(0.0),
            nn.Linear(dim_inner, dim),
            nn.Dropout(0.0),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class Attention(Module):
    def __init__(
        self,
        dim: int,
        heads: int,
        dim_head: int,
        rotary_embed: RotaryEmbedding,
    ) -> None:
        super().__init__()
        self.heads = heads
        dim_inner = heads * dim_head
        self.rotary_embed = rotary_embed
        self.norm = RMSNorm(dim)
        self.to_qkv = nn.Linear(dim, dim_inner * 3, bias=False)
        self.to_gates = nn.Linear(dim, heads)
        self.to_out = nn.Sequential(
            nn.Linear(dim_inner, dim, bias=False),
            nn.Dropout(0.0),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.norm(x)
        q, k, v = rearrange(
            self.to_qkv(x), "b n (qkv h d) -> qkv b h n d", qkv=3, h=self.heads
        )
        q = self.rotary_embed.rotate_queries_or_keys(q)
        k = self.rotary_embed.rotate_queries_or_keys(k)
        out = functional.scaled_dot_product_attention(q, k, v)

        gates = self.to_gates(x)
        out = out * rearrange(gates, "b n h -> b h n 1").sigmoid()
        out = rearrange(out, "b h n d -> b n (h d)")
        return self.to_out(out)


class Transformer(Module):
    def __init__(
        self,
        dim: int,
        depth: int,
        attention: tuple[int, int, RotaryEmbedding],
    ) -> None:
        super().__init__()
        heads, dim_head, rotary_embed = attention
        self.layers = ModuleList([])
        for _ in range(depth):
            self.layers.append(
                ModuleList(
                    [
                        Attention(dim, heads, dim_head, rotary_embed),
                        FeedForward(dim),
                    ]
                )
            )
        self.norm = RMSNorm(dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for attn, ff in self.layers:
            x = attn(x) + x
            x = ff(x) + x
        return self.norm(x)


class BandSplit(Module):
    def __init__(self, dim: int, dim_inputs: tuple[int, ...]) -> None:
        super().__init__()
        self.dim_inputs = dim_inputs
        self.to_features = ModuleList([])
        for dim_in in dim_inputs:
            self.to_features.append(
                nn.Sequential(RMSNorm(dim_in), nn.Linear(dim_in, dim))
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        pieces = x.split(self.dim_inputs, dim=-1)
        outs = [
            to_feature(piece)
            for piece, to_feature in zip(pieces, self.to_features, strict=True)
        ]
        return torch.stack(outs, dim=-2)


def _mlp(
    dim_in: int, dim_out: int, dim_hidden: int, depth: int
) -> nn.Sequential:
    net: list[Module] = []
    dims = (dim_in, *((dim_hidden,) * depth), dim_out)
    pairs = list(zip(dims[:-1], dims[1:], strict=True))
    for index, (layer_in, layer_out) in enumerate(pairs):
        net.append(nn.Linear(layer_in, layer_out))
        if index < len(pairs) - 1:
            net.append(nn.Tanh())
    return nn.Sequential(*net)


class MaskEstimator(Module):
    def __init__(
        self,
        dim: int,
        dim_inputs: tuple[int, ...],
        depth: int,
        mlp_expansion_factor: int,
    ) -> None:
        super().__init__()
        self.dim_inputs = dim_inputs
        self.to_freqs = ModuleList([])
        dim_hidden = dim * mlp_expansion_factor
        for dim_in in dim_inputs:
            self.to_freqs.append(
                nn.Sequential(
                    _mlp(dim, dim_in * 2, dim_hidden, depth),
                    nn.GLU(dim=-1),
                )
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        bands = x.unbind(dim=-2)
        outs = [
            mlp(band) for band, mlp in zip(bands, self.to_freqs, strict=True)
        ]
        return torch.cat(outs, dim=-1)


def _mel_band_membership(config: MelBandRoformerConfig) -> torch.Tensor:
    """Which STFT bins each mel band covers (binary, as in the paper)."""
    bank = torch.from_numpy(
        mel_filter_bank(
            config.sample_rate, config.stft_n_fft, config.num_bands
        )
    )
    # The filter bank skips the first bin and can end at 0.0 on some
    # systems; force both so every bin belongs to a band.
    bank[0][0] = 1.0
    bank[-1, -1] = 1.0
    membership = bank > 0
    if not membership.any(dim=0).all():
        raise ValueError("every frequency must be covered by a band")
    return membership


class MelBandRoformer(Module):
    def __init__(self, config: MelBandRoformerConfig) -> None:
        super().__init__()
        self.config = config
        self.layers = ModuleList([])
        self._build_transformers(config)

        self.stft_kwargs = {
            "n_fft": config.stft_n_fft,
            "hop_length": config.stft_hop_length,
            "win_length": config.stft_win_length,
            "normalized": False,
        }
        self._register_band_buffers(_mel_band_membership(config))

        per_band = tuple(
            2 * count * AUDIO_CHANNELS
            for count in self.num_freqs_per_band.tolist()
        )
        self.band_split = BandSplit(dim=config.dim, dim_inputs=per_band)
        self.mask_estimators = nn.ModuleList(
            [
                MaskEstimator(
                    dim=config.dim,
                    dim_inputs=per_band,
                    depth=config.mask_estimator_depth,
                    mlp_expansion_factor=config.mlp_expansion_factor,
                )
            ]
        )

    def _build_transformers(self, config: MelBandRoformerConfig) -> None:
        # One rotary embedding per axis, shared by every layer.
        time_rotary = RotaryEmbedding(dim=config.dim_head)
        freq_rotary = RotaryEmbedding(dim=config.dim_head)
        for _ in range(config.depth):
            self.layers.append(
                nn.ModuleList(
                    [
                        Transformer(
                            config.dim,
                            config.time_transformer_depth,
                            (config.heads, config.dim_head, time_rotary),
                        ),
                        Transformer(
                            config.dim,
                            config.freq_transformer_depth,
                            (config.heads, config.dim_head, freq_rotary),
                        ),
                    ]
                )
            )

    def _register_band_buffers(self, membership: torch.Tensor) -> None:
        bins = repeat(
            torch.arange(membership.shape[1]), "f -> b f", b=membership.shape[0]
        )
        freq_indices = bins[membership]
        freq_indices = repeat(freq_indices, "f -> f s", s=AUDIO_CHANNELS)
        freq_indices = freq_indices * AUDIO_CHANNELS + torch.arange(
            AUDIO_CHANNELS
        )
        freq_indices = rearrange(freq_indices, "f s -> (f s)")

        # Derived from the config, not part of the checkpoint.
        self.register_buffer("freq_indices", freq_indices, persistent=False)
        self.register_buffer(
            "num_freqs_per_band",
            reduce(membership, "b f -> b", "sum"),
            persistent=False,
        )
        self.register_buffer(
            "num_bands_per_freq",
            reduce(membership, "b f -> f", "sum"),
            persistent=False,
        )

    def forward(self, raw_audio: torch.Tensor) -> torch.Tensor:
        """`(batch, 2, samples)` in, the separated `(batch, 2, samples)` out."""
        batch, channels, length = raw_audio.shape
        if channels != AUDIO_CHANNELS:
            raise ValueError("the model separates stereo audio")
        window = torch.hann_window(
            self.config.stft_win_length, device=raw_audio.device
        )

        stft_repr = self._stft(raw_audio, window)
        features = self._band_features(stft_repr, batch)
        features = self._transform(self.band_split(features))
        masks = self._averaged_masks(features, stft_repr)

        separated = torch.view_as_complex(stft_repr.contiguous()) * masks
        return self._istft(separated, window, length)

    def _stft(
        self, raw_audio: torch.Tensor, window: torch.Tensor
    ) -> torch.Tensor:
        flat = rearrange(raw_audio, "b s t -> (b s) t")
        stft = torch.view_as_real(
            torch.stft(
                flat, **self.stft_kwargs, window=window, return_complex=True
            )
        )
        stft = rearrange(stft, "(b s) f t c -> b s f t c", s=AUDIO_CHANNELS)
        # Stereo merges into the frequency axis, frequency leading.
        return rearrange(stft, "b s f t c -> b (f s) t c")

    def _band_features(
        self, stft_repr: torch.Tensor, batch: int
    ) -> torch.Tensor:
        batch_arange = torch.arange(batch, device=stft_repr.device)[..., None]
        x = stft_repr[batch_arange, self.freq_indices]
        return rearrange(x, "b f t c -> b t (f c)")

    def _transform(self, x: torch.Tensor) -> torch.Tensor:
        """Axial attention: along time for each band, then along bands."""
        batch = x.shape[0]
        for time_transformer, freq_transformer in self.layers:
            x = rearrange(x, "b t f d -> (b f) t d")
            x = time_transformer(x)
            x = rearrange(x, "(b f) t d -> (b t) f d", b=batch)
            x = freq_transformer(x)
            x = rearrange(x, "(b t) f d -> b t f d", b=batch)
        return x

    def _averaged_masks(
        self, features: torch.Tensor, stft_repr: torch.Tensor
    ) -> torch.Tensor:
        batch = stft_repr.shape[0]
        masks = self.mask_estimators[0](features)
        masks = rearrange(masks, "b t (f c) -> b f t c", c=2)
        masks = torch.view_as_complex(masks.contiguous())

        # A bin in several bands gets the average of their estimates.
        complex_repr = torch.view_as_complex(stft_repr.contiguous())
        scatter_indices = repeat(
            self.freq_indices, "f -> b f t", b=batch, t=complex_repr.shape[-1]
        )
        summed = torch.zeros_like(complex_repr).scatter_add_(
            1, scatter_indices, masks.to(complex_repr.dtype)
        )
        denom = repeat(
            self.num_bands_per_freq, "f -> (f r) 1", r=AUDIO_CHANNELS
        )
        return summed / denom.clamp(min=1e-8)

    def _istft(
        self, stft_repr: torch.Tensor, window: torch.Tensor, length: int
    ) -> torch.Tensor:
        stft_repr = rearrange(
            stft_repr, "b (f s) t -> (b s) f t", s=AUDIO_CHANNELS
        )
        # Drop the DC component.
        stft_repr[:, 0] = 0.0
        audio = torch.istft(
            stft_repr,
            **self.stft_kwargs,
            window=window,
            return_complex=False,
            length=length,
        )
        return rearrange(audio, "(b s) t -> b s t", s=AUDIO_CHANNELS)
