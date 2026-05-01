"use client";

import { useEffect, useRef, useState } from "react";

export function usePoll<T>(url: string | null, intervalMs = 1500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aborted = useRef(false);

  useEffect(() => {
    aborted.current = false;
    if (!url) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
        } else {
          const json = (await res.json()) as T;
          if (!aborted.current) {
            setData(json);
            setError(null);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!aborted.current) {
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    tick();

    return () => {
      aborted.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs]);

  return { data, error };
}
