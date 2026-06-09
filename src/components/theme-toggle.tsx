"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const modes = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, resolvedTheme, setMode } = useTheme();
  return (
    <div className={cn("inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-subtle))] p-1", className)} aria-label={`Theme mode. Current effective theme is ${resolvedTheme}.`}>
      {modes.map((item) => {
        const Icon = item.icon;
        const active = mode === item.value;
        return (
          <Button
            key={item.value}
            type="button"
            variant={active ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode(item.value)}
            aria-pressed={active}
            aria-label={`Use ${item.label} theme`}
            className={cn("h-8 px-3", active && "shadow-none")}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
