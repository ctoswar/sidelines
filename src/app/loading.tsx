import { LoadingScreen } from "@/components/ui/loading-screen";

/** Catch-all fallback for every route without a more specific `loading.tsx` below it. */
export default function Loading() {
  return <LoadingScreen label="Loading Sidelines" />;
}
