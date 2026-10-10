import { LoadingScreen } from "@/components/ui/loading-screen";

/**
 * Nested inside the player layout, so the sidebar shell and identity stay on
 * screen while the page behind it swaps — this covers every /player route.
 */
export default function Loading() {
  return <LoadingScreen label="Opening your workspace" />;
}
