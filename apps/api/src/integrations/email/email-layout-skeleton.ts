/**
 * The MJML source of every email: a featured block (logo, overline, display
 * title) over a quiet body and footer. It is compiled once at module load
 * (see `email-layout.ts`); each `NFSLOT_*` token is replaced at render time,
 * in one pass, with escaped text or trusted markup, so a value can never be
 * mistaken for a slot.
 *
 * Colors are the DESIGN.md tokens in hex: email clients have no CSS variables,
 * and emails stay light (no auto dark mode).
 */
export const EMAIL_LAYOUT_MJML = `<mjml lang="NFSLOT_LANG">
  <mj-head>
    <mj-title>NFSLOT_SUBJECT</mj-title>
    <mj-preview>NFSLOT_PREHEADER</mj-preview>
    <mj-font name="Figtree" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&amp;display=swap" />
    <mj-font name="Geist Mono" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&amp;display=swap" />
    <mj-attributes>
      <mj-all font-family="Figtree, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#09090B" font-size="16px" line-height="1.5" padding="0" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#FFFFFF" width="600px">
    <mj-wrapper padding="24px">
      <mj-section background-color="#FA4900" border-radius="24px" padding="28px">
        <mj-column>
          <mj-text color="#FFFFFF" font-size="19px" font-weight="700" letter-spacing="-0.02em" padding="0">
            <span style="display:inline-block;vertical-align:middle;margin-right:7px;"><svg width="22" height="22" viewBox="0 0 1000 1000" fill="none" aria-hidden="true"><path d="M375 552.083C265.694 552.083 177.083 640.692 177.083 750C177.083 859.308 265.694 947.917 375 947.917C484.308 947.917 572.917 859.308 572.917 750C572.917 640.692 484.308 552.083 375 552.083Z" fill="#fff"/><path fill-rule="evenodd" clip-rule="evenodd" d="M541.667 52.0834C558.925 52.0834 572.917 66.0746 572.917 83.3334C572.917 204.146 670.854 302.083 791.667 302.083C808.925 302.083 822.917 316.075 822.917 333.333C822.917 350.592 808.925 364.583 791.667 364.583C636.338 364.583 510.417 238.663 510.417 83.3334C510.417 66.0746 524.408 52.0834 541.667 52.0834Z" fill="#fff"/><path opacity="0.5" d="M510.417 605.662V83.3333C510.417 150.311 533.829 211.821 572.917 260.125V750C572.917 693.079 548.888 641.767 510.417 605.662Z" fill="#fff"/></svg></span>NoteFinder
          </mj-text>
          <mj-text color="#FFFFFF" font-size="13px" font-weight="600" letter-spacing="0.08em" padding="40px 0 0">
            <span style="text-transform:uppercase;">NFSLOT_OVERLINE</span>
          </mj-text>
          <mj-text color="#FFFFFF" font-size="48px" line-height="1" font-weight="800" letter-spacing="-0.045em" padding="8px 0 0">
            <h1 style="margin:0;font-size:48px;line-height:1;font-weight:800;letter-spacing:-0.045em;max-width:9ch;">NFSLOT_TITLE</h1>
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
          <mj-text color="#71717A" font-size="12px" padding="40px 0 0">NFSLOT_FOOTER</mj-text>
        </mj-column>
      </mj-section>
    </mj-wrapper>
  </mj-body>
</mjml>`;
