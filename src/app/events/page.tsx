import { redirect } from "next/navigation";

// `/events` is a natural URL to type or link, but the event browser lives on
// the homepage. Send visitors there instead of a 404.
export default function EventsPage() {
  redirect("/");
}
