"use client";

import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2200);
  }, []);

  const node = msg ? (
    <p role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-md bg-field px-5 py-3 text-sm text-white shadow-lg">
      {msg}
    </p>
  ) : null;

  return { show, node };
}
