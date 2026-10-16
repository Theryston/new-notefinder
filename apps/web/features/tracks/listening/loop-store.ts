'use client';

import { create } from 'zustand';

import type { LoopRange } from './listening-math';

export const useLoop = create<{ range: LoopRange | null }>(() => ({
  range: null,
}));
