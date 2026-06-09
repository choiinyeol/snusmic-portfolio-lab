"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Aurora({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <motion.div
        className="absolute -left-1/4 top-[-18rem] h-[42rem] w-[42rem] rounded-full bg-teal-400/25 blur-3xl"
        animate={{ x: [0, 140, 40, 0], y: [0, 70, 140, 0], scale: [1, 1.18, 0.92, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-14rem] top-[-10rem] h-[36rem] w-[36rem] rounded-full bg-fuchsia-500/25 blur-3xl"
        animate={{ x: [0, -90, -30, 0], y: [0, 120, 40, 0], scale: [1, 0.9, 1.24, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-18rem] left-1/4 h-[32rem] w-[48rem] rounded-full bg-indigo-500/18 blur-3xl"
        animate={{ x: [0, 120, -60, 0], opacity: [0.45, 0.72, 0.36, 0.45] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function BlurText({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={cn("inline-flex flex-wrap gap-x-3 gap-y-1", className)}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, y: 20, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: index * 0.045, duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

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

export function AnimatedContent({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Magnet({ children, className, strength = 0.18 }: { children: React.ReactNode; className?: string; strength?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 140, damping: 18 });
  const y = useSpring(my, { stiffness: 140, damping: 18 });
  const rotateX = useTransform(y, [-30, 30], [4, -4]);
  const rotateY = useTransform(x, [-30, 30], [-4, 4]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y, rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mx.set((event.clientX - rect.left - rect.width / 2) * strength);
        my.set((event.clientY - rect.top - rect.height / 2) * strength);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

export function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 34 - ((point - min) / span) * 30;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <svg viewBox="0 0 100 36" className="h-9 w-28 overflow-visible">
      <path d={path} fill="none" stroke={positive ? "hsl(var(--finance-positive))" : "hsl(var(--finance-negative))"} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
