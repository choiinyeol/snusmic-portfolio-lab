"use client";

import { useEffect, useState } from "react";

/**
 * 숫자 카운트업 — react-bits-lite에서 분리.
 * 그 모듈은 framer-motion을 최상단에서 import해서, CountUp 하나 때문에
 * 홈 번들에 모션 라이브러리 전체가 끌려왔다. 이 파일은 rAF만 쓴다.
 */
export function CountUp({ value, suffix = "", prefix = "", className }: { value: number; suffix?: string; prefix?: string; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const duration = 1100;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={className}>{prefix}{Math.round(display).toLocaleString("ko-KR")}{suffix}</span>;
}
