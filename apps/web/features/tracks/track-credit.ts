// The credit text moved to lib/ so features outside tracks can share it. This
// path stays so the tracks imports and their existing test keep working.
// biome-ignore lint/performance/noBarrelFile: a one-name re-export that keeps the old path alive, the rest lives in lib/track-credit.ts.
export { creditText } from '@/lib/track-credit';
