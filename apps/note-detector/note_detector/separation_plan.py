"""The pure half of the vocal separation: where the chunks go and how their
outputs are blended back into one signal.

The Mel-Band RoFormer model sees a fixed `chunk_size` of samples at a time.
A song is cut into chunks that overlap by `overlap` (4 means each sample is
seen by four chunks, a hop of a quarter chunk), the model runs on each, and
the outputs are cross-faded with a window that is low at a chunk's edges,
where the model is least reliable, and high in its middle.
"""

from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class ChunkPlan:
    """Where each chunk starts and how long the zero-padded signal is."""

    chunk_size: int
    starts: tuple[int, ...]
    padded_length: int


def plan_chunks(total_samples: int, chunk_size: int, overlap: int) -> ChunkPlan:
    """Cuts `total_samples` into chunks that overlap by a factor of `overlap`.

    The last chunk is padded with silence so every sample, the tail included,
    is covered by a full chunk. A signal shorter than one chunk is a single
    padded chunk.
    """
    if total_samples <= 0:
        raise ValueError("there is no audio to separate")
    if chunk_size <= 0 or overlap <= 0 or chunk_size % overlap != 0:
        raise ValueError("chunk size must be a positive multiple of overlap")

    hop = chunk_size // overlap
    starts = [0]
    while starts[-1] + chunk_size < total_samples:
        starts.append(starts[-1] + hop)
    return ChunkPlan(
        chunk_size=chunk_size,
        starts=tuple(starts),
        padded_length=starts[-1] + chunk_size,
    )


def overlap_weights(chunk_size: int) -> np.ndarray:
    """A triangular window, strictly positive so no sample ever has weight 0.

    Sampled at the middle of each step, so the first and last values are
    `1 / chunk_size` rather than 0: the first and last samples of a song are
    seen by one chunk only and must still be reconstructed.
    """
    position = (np.arange(chunk_size) + 0.5) / chunk_size
    return (1.0 - np.abs(2.0 * position - 1.0)).astype(np.float32)


class OverlapAdd:
    """Blends chunk outputs into one signal, one chunk at a time.

    Streaming, so a long song never holds every chunk output in memory. The
    result is the weighted average of the chunks covering each sample.
    """

    def __init__(self, plan: ChunkPlan, channels: int) -> None:
        self._plan = plan
        self._weights = overlap_weights(plan.chunk_size)
        self._signal = np.zeros((channels, plan.padded_length), np.float32)
        self._weight_sum = np.zeros(plan.padded_length, np.float32)

    def add(self, start: int, chunk: np.ndarray) -> None:
        end = start + self._plan.chunk_size
        self._signal[:, start:end] += chunk * self._weights
        self._weight_sum[start:end] += self._weights

    def result(self, total_samples: int) -> np.ndarray:
        blended = self._signal / self._weight_sum
        return blended[:, :total_samples]


def chunk_batches(
    audio: np.ndarray, plan: ChunkPlan, batch_size: int
) -> Iterator[tuple[tuple[int, ...], np.ndarray]]:
    """The chunks of `audio` (channels, samples) in batches for the model.

    Yields each batch's chunk starts and the stacked chunks, `(batch,
    channels, chunk_size)`. The tail is padded with silence to the plan's
    length; the last batch may be smaller.
    """
    padded = np.pad(audio, ((0, 0), (0, plan.padded_length - audio.shape[1])))
    for first in range(0, len(plan.starts), batch_size):
        starts = plan.starts[first : first + batch_size]
        chunks = [padded[:, s : s + plan.chunk_size] for s in starts]
        yield starts, np.stack(chunks)
