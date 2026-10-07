"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The display container's ref, its content-box size (ResizeObserver) and
 * the live devicePixelRatio.
 */
export function useHostArea() {
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setArea({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    const updateDpr = () => setDpr(window.devicePixelRatio || 1);
    updateDpr();
    // `resize` alone misses a DPR change with no size change — dragging
    // the window to a different-DPI monitor, most commonly. A
    // matchMedia query on the CURRENT ratio fires once that ratio no
    // longer matches; re-arm it on the new ratio each time so it keeps
    // tracking indefinitely, not just the first crossing.
    let mq: MediaQueryList | null = null;
    const onDprChange = () => {
      updateDpr();
      armDprWatch();
    };
    const armDprWatch = () => {
      mq?.removeEventListener("change", onDprChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener("change", onDprChange);
    };
    armDprWatch();
    window.addEventListener("resize", updateDpr);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateDpr);
      mq?.removeEventListener("change", onDprChange);
    };
  }, []);

  return { ref, area, dpr };
}
