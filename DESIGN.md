# NoteFinder design system

The visual language of NoteFinder. It applies to the web app today and to the
mobile app later. Tokens live in `apps/web/app/globals.css`: when you change a
value, change this file in the same PR.

This file is the source of truth: every rule needed to build UI is written
here, with no external reference to look up.

## Direction

**Soft, friendly and polished**, in the family of Stripe and Clerk: surfaces
that float on soft shadows, generous pill-shaped controls, calm zinc neutrals
and one loud brand color. Two extra registers sit on top of that base:

- **Featured moments are vibrant** (Spotify Wrapped): big orange blocks with
  large, heavy type. Use them only for editorial/featured content (a
  highlighted track, a campaign, a streak milestone), at most one per screen.
- **Floating layers are glass** (Raycast, macOS): header, player bar, menus,
  popovers and toasts are translucent with a background blur.

Everything else stays quiet so the music (cover art) and the notes carry the
page.

### What makes it not look generic

- One brand color, used on purpose. No gradients on buttons or text, no
  purple/blue "AI" gradients, no glow effects.
- Real content in every mock: covers, song names, vocal ranges (`E2–A4`).
  Never lorem ipsum.
- Figtree with tight tracking on headings (not Inter).
- Hierarchy by size and weight, not by boxes: don't wrap every block in a
  bordered card.
- No emoji as icons or section markers.
- Left-aligned layouts. Center only short, standalone moments (empty states,
  auth screens).

## Theme

Light and dark are **equal citizens**. The first visit follows the OS
(`prefers-color-scheme`, `defaultTheme="system"` in `next-themes`); the user
can override it. Every screen is designed and reviewed in both themes. Never
invert one theme to get the other: use the tokens.

## Color

All values are OKLCH tokens in `globals.css`; use them through Tailwind
(`bg-primary`, `text-muted-foreground`, …). Raw hex values in components are
not allowed.

### Brand

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#FA4900` · `oklch(0.655 0.222 36.5)`, both themes | Primary buttons, play buttons, the current note, active states, links, focus ring, logo |
| `primary-foreground` | white | Text and icons on `primary` |

`#FA4900` is fixed: never lighten, darken or tint it to create "brand
shades". For tinted backgrounds use opacity (`bg-primary/10`,
`bg-primary/15`).

**Text on orange is white.** White on `#FA4900` is 3.5:1, which meets WCAG AA
only for large or bold text, so:

- Text on an orange fill is at least `text-sm font-semibold` (buttons already
  are). Never put regular-weight small text on orange.
- Orange text on the background (`text-primary`) is for short, semibold
  labels and links, never for paragraphs.
- Error, validation and other must-read text never relies on orange.

### Neutrals: zinc (cool)

A barely perceptible blue bias (hue ~286) that makes the orange feel warmer
by contrast.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#FFFFFF` | `#09090B` | Page |
| `surface` | `#FAFAFB` | `#131316` | Sunken areas: sidebars, section bands, the timeline frame |
| `card` | `#FFFFFF` | `#131316` | Cards (light cards separate by shadow, dark ones by tone) |
| `popover` | `#FFFFFF` | `#1C1C21` | Solid fallback for floating layers (they use `glass`) |
| `secondary` / `muted` | `#F3F3F5` | `#1C1C21` | Secondary buttons, chips, skeletons, input fills |
| `accent` | `#F3F3F5` | `#27272D` | Hover/selected rows and menu items |
| `border` / `input` | `#E4E4E8` | white 9% / 12% | Hairlines and inputs |
| `foreground` | `#09090B` | `#FAFAFA` | Text |
| `muted-foreground` | `#71717A` | `#A1A1AA` | Secondary text, metadata, placeholders |

### Status

| Token | Use |
| --- | --- |
| `success` | Confirmations; **pitch hit** on the timeline |
| `warning` | Warnings; **pitch near** (within a semitone) |
| `destructive` | Errors, destructive actions; **pitch miss** |

Status colors are never decorative and never replace the brand color.

### Charts

`chart-1` is the brand orange, `chart-2`…`chart-4` are teal, slate blue and
amber, `chart-5` is neutral. Put the series that matters in `chart-1` and
keep the rest quiet.

## Typography

**Figtree** for everything (headings and UI), loaded with `next/font`
(`--font-sans`). **Geist Mono** (`--font-mono`) for note names (`C#4`),
times, vocal ranges and other data that must line up. Use
`tabular-nums` on every number that changes in place (timers, counters).

| Role | Tailwind | Size / line | Weight | Tracking |
| --- | --- | --- | --- | --- |
| Display (featured blocks, hero) | `text-5xl md:text-6xl` | 48–60 / 1.0 | `font-extrabold` (800) | `tracking-tighter` |
| H1 (page title, track name) | `text-4xl` | 36 / 1.1 | `font-extrabold` (800) | `tracking-tight` |
| H2 (section) | `text-2xl` | 24 / 1.2 | `font-bold` (700) | `tracking-tight` |
| H3 (card title, dialog title) | `text-lg` | 18 / 1.3 | `font-semibold` (600) | normal |
| Body | `text-base` | 16 / 1.5 | `font-normal` | normal |
| UI / small body | `text-sm` | 14 / 1.4 | `font-medium` | normal |
| Caption / metadata | `text-xs` | 12 / 1.4 | `font-medium`, `text-muted-foreground` | normal |
| Overline | `text-xs uppercase` | 12 | `font-semibold` | `tracking-wider` |

- Headings get `text-wrap: balance` (set globally for `h1`–`h4`).
- Keep paragraphs under ~65 characters (`max-w-prose`).
- Don't use weights below 400. Don't use more than three sizes in one
  component.

## Brand mark

- The symbol is `components/logo-mark.tsx` (`currentColor`, orange by
  default). On orange fills it is white; on photos, white.
- The wordmark is **NoteFinder** (capital N and F), Figtree `font-bold`,
  `tracking-tight`, placed to the right of the symbol with a gap of ~0.3× the
  symbol size. The symbol is ~1.15× the wordmark's font size.
- Compact contexts (favicon, app icon, tight mobile header) use the symbol
  alone.
- App icons live in `apps/web/app/` and are the symbol drawn from
  `logo-mark.tsx`: `icon.svg` and `favicon.ico` (16/32/48) are the orange
  symbol on a transparent background; `apple-icon.png` (180×180) is the white
  symbol on a full-bleed `#FA4900` square (iOS rounds the corners itself).
  If the symbol changes, regenerate all three.

## Shape

Controls are **pills**; surfaces are **very rounded**.

| Element | Radius |
| --- | --- |
| Buttons, inputs, selects, search, chips, badges, tabs, segmented controls, toggles | `rounded-full` |
| Cards, dialogs, sheets, featured blocks | `rounded-2xl` (24px) |
| Popovers, menus, toasts, tooltips-with-content | `rounded-xl` (20px) |
| Items inside a menu/popover | `rounded-lg` (16px) with 4px menu padding, so corners stay concentric |
| Cover art ≥ 96px | `rounded-xl` (20px) |
| Cover art 48–95px | `rounded-md` (12px) |
| Cover art < 48px | `rounded-sm` (8px) |
| Avatars | `rounded-full` |

Nested corners: inner radius = outer radius − padding.

## Elevation and surfaces

- **Cards float** on soft, layered shadows: `shadow-sm` at rest,
  `shadow-md` on hover for interactive cards. In light mode cards have no
  visible border (the shadow includes a 1px hairline ring); in dark mode they
  separate by tone (`bg-card` on `bg-background`).
- **Floating layers are glass**: add the `glass` utility (translucent
  `--glass` fill, 20px blur, hairline border, top highlight, `shadow-lg`) to
  the header, the player/controls bar, dropdown menus, popovers, toasts and
  the command palette. Content under glass must stay readable: never put
  glass over glass.
- Dialogs and sheets are solid (`bg-popover` / `bg-card`) with `shadow-xl`
  and a dimmed backdrop (`bg-black/40`, `backdrop-blur-sm`).
- Page backgrounds are **plain** (`bg-background`). No glows, meshes, noise or
  dot grids behind content. Color comes from covers and featured blocks.

Shadow scale: `shadow-xs` (inputs, pressed), `shadow-sm` (cards),
`shadow-md` (card hover, sticky elements), `shadow-lg` (glass layers),
`shadow-xl` (dialogs).

## Spacing and density

**Spacious.** NoteFinder is used with one hand while singing, often on a
phone, so targets are large and lists breathe.

- 4px base grid (Tailwind's default scale). Prefer `gap-*` on flex/grid
  parents over margins.
- Minimum touch target 40px (`h-10`); list rows are at least 56px tall with
  48px covers.
- Page gutter: `px-4` on mobile, `px-6` from `md`, content max width
  `max-w-7xl`. The header bar, the page content and the footer share one
  column (`components/container.tsx`) so their edges line up; a page never
  adds its own horizontal padding.
- Vertical rhythm between page sections: `gap-12` (mobile `gap-10`).
- Card padding `p-4`, dialogs `p-6`.

| Control | Height |
| --- | --- |
| Button `xs` / `sm` / `default` / `lg` | 28 / 32 / 40 / 48 px |
| Icon button | same sizes, square |
| Input, select, search | 40px (`h-10`), `px-4` |

## Components

### Buttons

- `default`: flat `bg-primary`, white semibold text, hover `bg-primary/90`.
  One primary button per view region.
- `secondary`: `bg-secondary`, for the second action (Favorite, Share).
- `ghost`: toolbars and tertiary actions. `outline` only on busy
  backgrounds.
- The round **play button** is a `size="icon-lg"` `default` button with a
  filled play icon.
- No gradients, glows or inner shadows on buttons.

### Inputs

The field is a **pill group**: a `rounded-full` `bg-muted` pill (40px, `px-4`,
transparent border at rest) that holds the native input plus optional
adornments **inside** it, so the focus ring wraps all of it:

- A **start** slot for a 16px icon in `text-muted-foreground` (search, mail)
  or a short prefix (`@` on usernames). Only add one when it helps to
  recognize the field.
- An **end** slot for a hint or a control: the `⌘K` keycap on search, the
  show/hide toggle on passwords.
- Focus is `border-ring` + `ring-3 ring-ring/50` on the pill, only for
  keyboard-style focus on the input itself. There is no hover border, no
  shadow and no fill change.
- Invalid is `border-destructive` + `ring-3 ring-destructive/20`, set by
  `aria-invalid`. The error below the field is `text-xs` destructive with a
  14px alert icon; the label keeps its color.

Labels sit above the field in `text-[0.8125rem] font-semibold`.

The **`⌘K` keycap** is a `rounded-xs` (6px) box with a hairline border,
`bg-background`, Geist Mono 11px, the Lucide `Command` icon plus `K`. It is
the same on every platform (Ctrl+K works too), so it needs no platform check.

### Detail rows

Values the user can see but not edit on that screen (username, email, a
password that leads to its own flow) are **rows of text, not inputs**: a
pill that looks editable and isn't is noise. Group them in one card
(`rounded-2xl bg-card shadow-sm`, rows divided by `divide-border`), each row at
least 56px tall: the label (`text-[0.8125rem] font-semibold`) on the left,
the value or one action (an orange link) on the right and, only when it
explains something, a `text-xs` muted caption under both. Below `sm`, a row
whose value is long text (an email) stacks the value under the label; a row
whose right side is a short action stays on one line. Editable fields stay
outside the card, in their own titled section (`text-lg font-semibold`) with
the button that saves them at its end.

Account pages use the whole `Container` column, never a narrow centered one:
one column up to `md`, and from `lg` two equal columns with the editable
section on the left and the detail card on the right, top-aligned.

### Segmented control

A pill track (`bg-muted`, 3px padding, 2px gap) with 30px-tall options. The
pressed one is a `bg-background` thumb with `shadow-sm` and `text-foreground`;
the rest are `text-muted-foreground`. Icon-only options (theme: sun, monitor,
moon) are 16px icons with `px-2`, and their track is airier (`gap-3.5`, 14px between options); text options (language: `EN`, `PT`) are
`text-[0.8125rem] font-semibold` with `px-2.5`. It carries the visible
state, so never use orange for it.

### Site header

One floating glass pill (`glass`, `rounded-full`, `p-1.5`, `max-w-7xl`)
with only what a visitor needs, in this order: the logo and wordmark, the
search field (up to `max-w-105`, with the `⌘K` keycap from `md`), then pushed
to the right the theme toggle (a segmented control of icons, from `md`) and **one**
primary `sm` button: "Sign in" for visitors, the avatar for signed-in users.
No "Sign up" button (it is one link away on the sign-in page), no overflow
"…" menu and no other links. The wordmark appears from `sm`; below `md` the
search collapses to an icon button that expands over the bar.

### Site footer

The quiet end of every site page, `max-w-7xl`, `py-10`: the "Terms of use"
link on the left and the language segmented control (`EN` | `PT`) on the
right. Below `md` it stacks (terms, then the controls) and also holds the
theme toggle, which the header drops there to stay minimal. Language and
terms live here instead of in a menu.

### Track cards

- **Default: cover grid** (Spotify): seven per row on desktop
  (`grid-cols-2 sm:3 md:4 lg:6 xl:7`), square cover (`aspect-square w-full
  h-auto`), title (`text-sm font-semibold`, 1 line, truncated), artist
  (`text-xs text-muted-foreground`). On hover the card gets `bg-accent`
  and a round orange play button (`size-8`) slides up over the cover's
  bottom-right corner. The hover and the play badge exist with or without
  a link; without a `trackId` the card is a static `group` and only the
  play `button` (`aria-label` "Play/ Tocar {title}") focuses.
- **Missing cover: geometric placeholder**: never a music icon. A
  deterministic curated palette (`--c1` dark, `--c2` vivid, `--c3` light,
  by Recording id, 6 sets) plus one shape per set: dark disc, light band,
  hollow square, ring, diagonal stripes, offset disc. Real covers still
  render as photos; the hex palettes stand in for artwork only, like the
  photos they replace.
- **Featured lists: cover with overlay**: the cover fills the card
  (`aspect-[3/4]`), title and artist sit on a bottom gradient
  (`from-black/80`), vocal range in a small glass chip at the top. Only for
  curated/featured rails, never for search results.
- Lists that need data (search, profiles on desktop) may use rows with the
  same cover, title and artist plus the range and duration in mono.

### Featured blocks

Solid `bg-primary`, white text, `rounded-2xl`, display type, a single white
or black pill CTA. Optional oversized geometric shape (circle/ring) in
`white/10`–`black/15` as the only decoration. One per screen at most.

The artist and album page headers are featured blocks too (they are the
page's one block): the visual (initials circle or cover, lifted with
`shadow-xl`, the cover tilted `rotate-3`) sits on the right, the title in
display type and the info lines (`font-semibold`, white) on the left, genre
chips as outlined white pills, and one `black/15` ring behind the visual.

The Processing page header is the same block, with the ring doing work: the
decorative ring becomes a **progress ring** around the cover (a `black/15`
track and a white arc, no decoration ring on top), with the percentage in a
`bg-background` pill badge (Geist Mono, `tabular-nums`) on its corner. Above
the title, an overline names the step (`Processing · step 3 of 5`); below the
credit, the steps are `h-8` pills (`text-sm font-semibold`): done
`black/15` with a check, current solid white with orange text and a spinner,
failed `black/40` with an ×, pending outlined white. Pills show a short name
and carry the full one for screen readers.

### Menus, popovers, toasts

`glass`, `rounded-xl`, 4px padding, items `rounded-lg` `px-3 py-2` with an
icon at 16px, hover `bg-accent` (in glass: `bg-foreground/10`).

## Note timeline

The core of the product. It has two modes, with the same geometry (time on
x, one lane per semitone on y, playhead fixed at ~40% of the width):

### Listen mode (only viewing the notes): piano-roll

- A mini keyboard on the left (`timeline-key` / `timeline-key-sharp`),
  sharp-key lanes shaded with `surface`, faint vertical beat lines
  (`border`).
- Notes are rectangles `rounded-[3px]`: upcoming in `timeline-note` at 80%,
  current at 100%, past in `timeline-note-past`.
- The note name is written inside the bar (Geist Mono, 9–10px, white) when
  the bar is wide enough.

### Sing mode (mic on): lanes with feedback

- Every lane is labeled with its note name on the left (mono).
- Upcoming notes: `bg-muted` with a `muted-foreground` hairline; current
  note: `primary`.
- Once a note is sung it turns `pitch-hit` (green), `pitch-near` (amber) or
  `pitch-miss` (red) according to accuracy.
- The user's voice is a 2px `timeline-pitch` line with round caps; gaps
  where there is no voiced pitch are left empty (never interpolated).

Both modes: draw on `<canvas>` with `requestAnimationFrame` (never React
re-renders per frame). Colors come from the CSS tokens (read once with
`getComputedStyle` and again when the theme changes). The current note name
is also shown in the timeline header (mono, `text-primary`). In landscape
fullscreen, hide every chrome element except the glass controls bar.

## Motion

**Subtle springs**: things respond physically but briefly.

| Use | Duration | Easing |
| --- | --- | --- |
| Color/opacity changes (hover, focus) | 150ms | `ease-out` |
| Press (`active:scale-[0.97]`), toggles | 200ms | `ease-spring` |
| Card hover lift (`-translate-y-0.5` + `shadow-md`) | 250ms | `ease-spring` |
| Popover/menu enter | 200ms fade + 4px slide / scale from 0.96 | `ease-out-soft` |
| Popover/menu exit | 150ms fade | `ease-out` |
| Favorite toggle | `animate-pop` | `ease-spring` |

- Animate only `transform` and `opacity` (and colors).
- Nothing loops except loading indicators and the live timeline.
- `prefers-reduced-motion: reduce` collapses every duration (set globally).

## Icons

**Lucide**, stroke width **1.75**, `size-5` (20px) in UI, `size-4` inside
small buttons, `size-6` in the mobile tab bar.

- The stroke width is set globally (`svg.lucide` in `globals.css`); don't
  pass `strokeWidth` per icon.
- **Active navigation items are filled** (the same Lucide icon with
  `fill-current`) plus `text-foreground`; inactive items are outlined
  `text-muted-foreground`. State is shown by shape, not by orange.
- Play and pause are always filled.
- Icons never replace text for primary actions without an accessible label.

## Accessibility

- Visible focus on every interactive element: `ring-3 ring-ring/50` (orange).
- Text contrast ≥ 4.5:1 except the documented white-on-orange case (bold or
  large only).
- Pitch feedback never relies on color alone: the timeline header also shows
  the current note and a textual score.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## Checklist for new UI

- [ ] Works and looks intentional in light **and** dark.
- [ ] Uses tokens only (no hex, no arbitrary colors).
- [ ] Controls are pills, surfaces `rounded-2xl`, floating layers `glass`.
- [ ] Orange is used for the one primary action or the current state, not
      decoration.
- [ ] Touch targets ≥ 40px; mobile layout checked at 360px width.
- [ ] Motion is subtle and uses the easing tokens.
- [ ] Every user-visible string comes from i18n.
