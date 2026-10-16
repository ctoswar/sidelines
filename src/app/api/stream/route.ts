// Realtime stream.
//
//   GET /api/stream — Server-Sent Events; one frame per published topic.
//
// Mutation routes (results, announcements, registrations, crew, schedule)
// publish to the in-process bus in server/realtime.ts after a successful
// write; this handler forwards each topic to every connected browser as a
// named SSE event. The frames are data-free — clients refetch through the
// normal JSON endpoints, so authorization stays entirely in those endpoints
// and this stream can stay public.
//
// A comment frame every 25s keeps proxies and the OS from reaping an idle
// connection; the abort listener tears the subscription down when the client
// navigates away. One process serves the app (Next standalone on the Pi), so
// the bus is this process — a multi-process deployment would move it to
// LISTEN/NOTIFY or Redis.

import { subscribe } from "@/server/realtime";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (frame: string) => {
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          /* connection already gone - the abort listener cleans up */
        }
      };

      // retry: tells EventSource how fast to reconnect after a drop.
      send("retry: 3000\n\n");
      send(`event: hello\ndata: {}\n\n`);

      unsubscribe = subscribe((topic) => {
        send(`event: ${topic}\ndata: {}\n\n`);
      });

      heartbeat = setInterval(() => send(": hb\n\n"), HEARTBEAT_MS);

      const teardown = () => {
        if (heartbeat !== null) clearInterval(heartbeat);
        heartbeat = null;
        unsubscribe?.();
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", teardown);
    },
    cancel() {
      if (heartbeat !== null) clearInterval(heartbeat);
      heartbeat = null;
      unsubscribe?.();
      unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell nginx and friends not to buffer the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
