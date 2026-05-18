'use client';

import { useEffect, useRef } from 'react';

/** Trap keyboard focus inside `containerRef` while `active` is true. Records the
 * previously-focused element on activation, restores focus on deactivation, and
 * routes Escape through `onEscape` so a dialog/drawer can implement the standard
 * WAI-ARIA close pattern. */
export function useFocusTrap<T extends HTMLElement>(active: boolean, onEscape?: () => void) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('aria-hidden'));

    // Move focus into the trap on activation; fall back to the container itself
    // (it carries tabIndex=-1 here) when nothing inside is keyboard-reachable.
    requestAnimationFrame(() => {
      const first = focusables()[0] ?? container;
      first.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Only restore focus if the previously-focused element is still in the DOM —
      // route changes or re-renders may have unmounted it, and .focus() on a
      // detached node silently no-ops but cannot bring it back.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, onEscape]);

  return containerRef;
}
