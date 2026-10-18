/**
 * The slots of the layout: each `NFSLOT_*` token in the source below is
 * replaced at render time, in one pass, with an escaped value or trusted
 * markup. The pattern and the type in `email-layout.ts` derive from this list.
 */
export const EMAIL_LAYOUT_SLOTS = [
  'LANG',
  'SUBJECT',
  'PREHEADER',
  'ICON_URL',
  'OVERLINE',
  'TITLE',
  'FEATURED_DETAILS',
  'BODY',
  'FOOTER',
] as const;

/**
 * The MJML source of every email: a featured block (logo, overline, display
 * title, and for track emails the track's details) over a quiet body and
 * footer. It is compiled once at module load
 * (see `email-layout.ts`).
 *
 * Colors are the DESIGN.md tokens in hex: email clients have no CSS variables,
 * and emails stay light (no auto dark mode).
 *
 * Fonts: MJML imports a Google font only when the compiled source names it in
 * a `font-family`. The code pill is injected after compile, so Geist Mono is
 * imported by hand in the head. The stack has no Roboto, which MJML would
 * otherwise import on its own.
 */
export const EMAIL_LAYOUT_MJML = `<mjml lang="NFSLOT_LANG">
  <mj-head>
    <mj-title>NFSLOT_SUBJECT</mj-title>
    <mj-preview>NFSLOT_PREHEADER</mj-preview>
    <mj-font name="Figtree" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&amp;display=swap" />
    <mj-raw><link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&amp;display=swap);</style></mj-raw>
    <mj-attributes>
      <mj-all font-family="Figtree, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif" />
      <mj-text color="#09090B" font-size="16px" line-height="1.5" padding="0" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#FFFFFF" width="600px">
    <mj-wrapper padding="24px">
      <mj-section background-color="#FA4900" border-radius="24px" padding="28px">
        <mj-column>
          <mj-text color="#FFFFFF" font-size="19px" font-weight="700" letter-spacing="-0.02em" padding="0">
            <img src="NFSLOT_ICON_URL" width="24" height="24" alt="" style="display:inline-block;vertical-align:middle;margin-right:7px;border:0;" />NoteFinder
          </mj-text>
          <mj-text color="#FFFFFF" font-size="12px" font-weight="600" letter-spacing="0.05em" padding="40px 0 0">
            <span style="text-transform:uppercase;">NFSLOT_OVERLINE</span>
          </mj-text>
          <mj-text color="#FFFFFF" font-size="48px" line-height="1" font-weight="800" letter-spacing="-0.05em" padding="8px 0 0">
            <h1 style="margin:0;font-size:48px;line-height:1;font-weight:800;letter-spacing:-0.05em;max-width:9ch;">NFSLOT_TITLE</h1>NFSLOT_FEATURED_DETAILS
          </mj-text>
        </mj-column>
      </mj-section>
      <mj-section padding="28px 8px 0">
        <mj-column>
          <mj-text>NFSLOT_BODY</mj-text>
        </mj-column>
      </mj-section>
      <mj-section padding="0 8px">
        <mj-column>
          <mj-text color="#71717A" font-size="12px" padding="0">
            <div style="margin-top:40px;padding-top:20px;">NFSLOT_FOOTER</div>
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-wrapper>
  </mj-body>
</mjml>`;
