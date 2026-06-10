"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 정렬 가능한 표 공용 훅 — 클릭으로 단일 정렬, Shift+클릭으로 다중 우선순위 정렬.
 * 숫자·문자열·날짜(ISO 문자열)·불리언 비교를 지원하며 null/undefined는 항상 마지막.
 */
export type SortDir = "asc" | "desc";
export type SortValue = string | number | boolean | null | undefined;
export type SortSpec = { key: string; dir: SortDir };

export type SortColumn<T> = {
  key: string;
  /** 행에서 비교값 추출 */
  value: (row: T) => SortValue;
  /** 첫 클릭 시 방향 (수치형은 desc가 자연스럽다) */
  firstDir?: SortDir;
};

function compareValues(a: SortValue, b: SortValue, dir: SortDir) {
  const aNull = a === null || a === undefined || (typeof a === "number" && Number.isNaN(a));
  const bNull = b === null || b === undefined || (typeof b === "number" && Number.isNaN(b));
  if (aNull && bNull) return 0;
  if (aNull) return 1; // null은 방향과 무관하게 항상 뒤로
  if (bNull) return -1;
  let result = 0;
  if (typeof a === "number" && typeof b === "number") result = a - b;
  else if (typeof a === "boolean" && typeof b === "boolean") result = Number(a) - Number(b);
  else result = String(a).localeCompare(String(b), "ko");
  return dir === "asc" ? result : -result;
}

export function useSortable<T>(rows: T[], columns: SortColumn<T>[], initial: SortSpec[] = []) {
  const [specs, setSpecs] = useState<SortSpec[]>(initial);
  // 사용자가 직접 정렬을 만진 적이 있는지 — 기본 정렬(발간일 등)은 사용자 의도가 아니므로
  // 첫 Shift+클릭이 기본 정렬 '밑에' 깔려 아무 변화도 안 보이는 문제를 막는다.
  const [touched, setTouched] = useState(initial.length === 0);
  const byKey = useMemo(() => new Map(columns.map((col) => [col.key, col])), [columns]);

  const toggle = (key: string, multi: boolean) => {
    const firstDir = byKey.get(key)?.firstDir ?? "asc";
    setTouched(true);
    setSpecs((prev) => {
      const existing = prev.find((spec) => spec.key === key);
      if (!multi || (!touched && !existing)) {
        if (multi && !touched && !existing) return [{ key, dir: firstDir }]; // 첫 Shift+클릭: 기본 정렬을 대체해 1순위로
        // 단일 정렬: 첫 클릭 기본 방향 → 반대 방향 → 해제
        if (!existing || prev.length > 1) return [{ key, dir: existing?.dir ?? firstDir }];
        if (existing.dir === firstDir) return [{ key, dir: firstDir === "asc" ? "desc" : "asc" }];
        return [];
      }
      // Shift+클릭: 기존 우선순위 유지한 채 추가/방향 전환/해제
      if (!existing) return [...prev, { key, dir: firstDir }];
      if (existing.dir === firstDir) return prev.map((spec) => (spec.key === key ? { key, dir: firstDir === "asc" ? ("desc" as const) : ("asc" as const) } : spec));
      return prev.filter((spec) => spec.key !== key);
    });
  };

  const sorted = useMemo(() => {
    if (!specs.length) return rows;
    const active = specs.map((spec) => ({ spec, col: byKey.get(spec.key) })).filter((item) => item.col);
    if (!active.length) return rows;
    return [...rows].sort((a, b) => {
      for (const { spec, col } of active) {
        const result = compareValues(col!.value(a), col!.value(b), spec.dir);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [rows, specs, byKey]);

  return { sorted, specs, toggle, clear: () => setSpecs([]) };
}

export type SortState = { specs: SortSpec[]; toggle: (key: string, multi: boolean) => void };

/** 정렬 가능한 <th> — 방향 화살표와 다중 정렬 우선순위 배지를 그린다 */
export function SortableTh({
  sortKey,
  sort,
  children,
  align = "left",
  className,
  title,
}: {
  sortKey: string;
  sort: SortState;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  const index = sort.specs.findIndex((spec) => spec.key === sortKey);
  const active = index >= 0 ? sort.specs[index] : null;
  const multi = sort.specs.length > 1;
  return (
    <th
      scope="col"
      aria-sort={active ? (active.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("sortable-th px-0 py-0 font-semibold", className)}
      title={title ?? "클릭: 정렬 · Shift+클릭: 다중 정렬"}
    >
      <button
        type="button"
        onClick={(event) => sort.toggle(sortKey, event.shiftKey)}
        onMouseDown={(event) => {
          // Shift+클릭이 브라우저 텍스트 선택을 끌고 다니는 것을 차단
          if (event.shiftKey) event.preventDefault();
        }}
        className={cn(
          "flex w-full select-none items-center gap-1 px-3 py-2.5",
          align === "right" ? "justify-end text-right" : "justify-start text-left",
          active && "text-foreground",
        )}
      >
        <span>{children}</span>
        <span aria-hidden="true" className={cn("text-[9px] leading-none", active ? "text-stamp" : "opacity-35")}>
          {active ? (active.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
        {active && multi && (
          <span
            aria-hidden="true"
            className="tnum inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-stamp text-[8px] font-black leading-none text-background"
          >
            {index + 1}
          </span>
        )}
      </button>
    </th>
  );
}
