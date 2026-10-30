import { useEffect, useRef, useState } from "react";

/**
 * Animates from the previously displayed value to `target`.
 * Only ever displays real values — it just eases between them.
 */
export function useCountUp(target: number, duration = 700, enabled = true): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduceMotion =
      !enabled ||
      document.body.classList.contains("ragentis-no-animations") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = fromRef.current;

    if (reduceMotion || from === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = target;
    };
  }, [target, duration, enabled]);

  return value;
}
