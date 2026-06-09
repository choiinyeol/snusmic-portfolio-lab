import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatPrice(value: number | null | undefined, market?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const maximumFractionDigits = market === "KR" ? 0 : 2;
  const prefix = market === "US" ? "$" : "";
  const suffix = market === "KR" ? "원" : "";
  return `${prefix}${value.toLocaleString("ko-KR", { maximumFractionDigits })}${suffix}`;
}
