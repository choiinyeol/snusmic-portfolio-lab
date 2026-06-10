"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "아카이브" },
  { href: "/clubs", label: "학회별 성적표" },
  { href: "/strategy", label: "모멘텀 전략" },
];

/** 공용 내비게이션 — 잉크 밑줄과 현재 위치 표시. 헤더·마스트헤드 공용 */
export function SiteNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn("flex items-center gap-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] sm:gap-5 sm:text-xs sm:tracking-[0.16em]", className)}
      aria-label="사이트 내비게이션"
    >
      {LINKS.map((link) => {
        const current = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className="nav-link" aria-current={current ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
