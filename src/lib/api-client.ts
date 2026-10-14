// Shared fetch helper for the API client modules.
//
// Every client lib maps a route handler onto typed functions; this is the one
// place that turns a non-OK response into an Error carrying the server's
// message (the validators' field-level copy), so callers can surface it.

export async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message;
    throw new Error(message || `Request failed (${response.status}).`);
  }
  if (!body) throw new Error("The server sent an unexpected response.");
  return body;
}

export function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
