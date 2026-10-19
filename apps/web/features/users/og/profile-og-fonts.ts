import { readFile } from 'node:fs/promises';

import 'server-only';

/**
 * The site's typeface (Figtree, see `app/[locale]/layout.tsx`) at the weights
 * the card uses. The image renderer only ships a regular Noto Sans, so without
 * these files every weight, including the bold name, is drawn as regular.
 * Static instances (not the variable font) because the renderer picks one
 * file per weight. Read once and kept: the files never change.
 */
const FONT_FILES = [
  { weight: 600, file: 'figtree-semibold.ttf' },
  { weight: 700, file: 'figtree-bold.ttf' },
  { weight: 800, file: 'figtree-extrabold.ttf' },
] as const;

type ProfileOgFont = {
  name: string;
  data: Buffer;
  style: 'normal';
  weight: 600 | 700 | 800;
};

let fonts: Promise<ProfileOgFont[]> | undefined;

export function loadProfileOgFonts(): Promise<ProfileOgFont[]> {
  fonts ??= Promise.all(
    FONT_FILES.map(async ({ weight, file }) => ({
      name: 'Figtree',
      data: await readFile(new URL(`./fonts/${file}`, import.meta.url)),
      style: 'normal' as const,
      weight,
    })),
  );
  return fonts;
}
