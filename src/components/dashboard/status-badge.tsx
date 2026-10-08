import type { GameStatus } from "@/types";

export function StatusBadge({ status }: { status: GameStatus }) {
  if (status === "live")
    return (
      <span className="font-bold text-flag">
        <span className="pulse mr-1 inline-block h-2 w-2 rounded-full bg-flag" />Live
      </span>
    );
  if (status === "final") return <span className="text-muted">Final</span>;
  return <span className="font-medium text-brand">Up next</span>;
}
