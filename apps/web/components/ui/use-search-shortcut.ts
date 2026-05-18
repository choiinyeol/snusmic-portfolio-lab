'use client';

import { useEffect, useRef } from 'react';

/** Hotkey binding that focuses a search input on `/` and clears it on Escape
 * while focused. Avoids triggering when the user is already typing in another
 * editable field. */
export function useSearchShortcut(onClear?: () => void) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        if (inputRef.current && inputRef.current.value !== '') {
          onClear?.();
        } else {
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClear]);

  return inputRef;
}
