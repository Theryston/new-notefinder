/** A cache entry with its value fully buffered, as both tiers store it. */
export type StoredEntry = {
  value: Uint8Array;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
};

export async function readStream(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export function toStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // A copy, so a consumer can never mutate the cached bytes.
      controller.enqueue(bytes.slice());
      controller.close();
    },
  });
}

// JSON has no Infinity: a non-finite duration is stored as null.
const encodeDuration = (value: number) =>
  Number.isFinite(value) ? value : null;
const decodeDuration = (value: unknown) =>
  typeof value === 'number' ? value : Number.POSITIVE_INFINITY;

/** `[u32 meta length][meta JSON][raw bytes]`: no base64 inflation. */
export function serialize(entry: StoredEntry): Buffer {
  const meta = Buffer.from(
    JSON.stringify({
      tags: entry.tags,
      stale: encodeDuration(entry.stale),
      timestamp: entry.timestamp,
      expire: encodeDuration(entry.expire),
      revalidate: encodeDuration(entry.revalidate),
    }),
  );
  const header = Buffer.alloc(4);
  header.writeUInt32BE(meta.byteLength);
  return Buffer.concat([header, meta, entry.value]);
}

export function deserialize(buffer: Buffer): StoredEntry | undefined {
  if (buffer.byteLength < 4) return undefined;
  const metaLength = buffer.readUInt32BE(0);
  if (4 + metaLength > buffer.byteLength) return undefined;
  const meta: unknown = JSON.parse(
    buffer.subarray(4, 4 + metaLength).toString(),
  );
  if (
    typeof meta !== 'object' ||
    meta === null ||
    !('tags' in meta) ||
    !Array.isArray(meta.tags) ||
    !meta.tags.every((tag) => typeof tag === 'string') ||
    !('timestamp' in meta) ||
    typeof meta.timestamp !== 'number' ||
    !('stale' in meta) ||
    !('expire' in meta) ||
    !('revalidate' in meta)
  ) {
    return undefined;
  }
  return {
    // Copy out of the (possibly pooled) response buffer.
    value: new Uint8Array(buffer.subarray(4 + metaLength)),
    tags: meta.tags,
    stale: decodeDuration(meta.stale),
    timestamp: meta.timestamp,
    expire: decodeDuration(meta.expire),
    revalidate: decodeDuration(meta.revalidate),
  };
}
