/** 테마 토큰을 실제 색으로 — 캔버스 차트는 CSS 변수를 직접 못 읽는다 */
export function cssHsl(variable: string, alpha?: number) {
  if (typeof window === "undefined") return "#888888";
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!value) return "#888888";
  return alpha !== undefined ? `hsl(${value} / ${alpha})` : `hsl(${value})`;
}

/** 차트 캔버스용 모노 폰트 패밀리 — 런타임에 CSS 변수를 풀어서 넘긴다 */
export function chartMonoFamily() {
  if (typeof window === "undefined") return "ui-monospace, monospace";
  const mono = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim();
  return mono ? `${mono}, ui-monospace, monospace` : "ui-monospace, monospace";
}
