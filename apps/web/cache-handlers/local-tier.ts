import type { StoredEntry } from './stored-entry.ts';

/** Byte-bounded LRU of fully buffered entries (the in-process tier). */
export class LocalTier {
  readonly #entries = new Map<string, { entry: StoredEntry; size: number }>();
  readonly #maxBytes: number;
  #bytes = 0;

  constructor(maxBytes: number) {
    this.#maxBytes = maxBytes;
  }

  get(key: string): StoredEntry | undefined {
    const item = this.#entries.get(key);
    if (!item) return undefined;
    // Re-insert to mark it as the most recently used.
    this.#entries.delete(key);
    this.#entries.set(key, item);
    return item.entry;
  }

  set(key: string, entry: StoredEntry): void {
    this.delete(key);
    const size = entry.value.byteLength + key.length;
    if (size > this.#maxBytes) return;
    this.#entries.set(key, { entry, size });
    this.#bytes += size;
    for (const [oldestKey] of this.#entries) {
      if (this.#bytes <= this.#maxBytes) break;
      this.delete(oldestKey);
    }
  }

  delete(key: string): void {
    const item = this.#entries.get(key);
    if (!item) return;
    this.#entries.delete(key);
    this.#bytes -= item.size;
  }
}
