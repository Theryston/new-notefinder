/** A Meilisearch server and the master key that may do anything on it. */
export type MeilisearchAdmin = { url: string; masterKey: string };

export type MeilisearchReply = {
  status: number;
  json: Record<string, unknown>;
};

/**
 * One request to Meilisearch's HTTP API with the master key, for what the
 * e2e setup does around the service: creating keys, emptying indexes,
 * reading what it stored. The service itself never gets the master key.
 */
export const meilisearchRequest = async (
  server: MeilisearchAdmin,
  method: string,
  path: string,
  body?: unknown,
): Promise<MeilisearchReply> => {
  const response = await fetch(`${server.url}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${server.masterKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>),
  };
};
