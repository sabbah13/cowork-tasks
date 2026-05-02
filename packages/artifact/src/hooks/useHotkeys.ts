import { useEffect, useRef } from 'react';

export interface HotkeyContext {
  /** Id of the card the pointer is currently hovering, or null. */
  hoveredId: string | null;
  /** Id of the card whose detail panel is open, or null. */
  selectedId: string | null;
  /** True if any popup (label/owner/help/inline-add form) is open. */
  popupOpen: boolean;
  /** True if any input/textarea/contenteditable is focused. */
  inputFocused: boolean;
}

export interface HotkeyHandlers {
  onOpenHovered: () => void;
  onArchiveHovered: () => void;
  onOpenLabelsForHovered: () => void;
  onOpenOwnerForHovered: () => void;
  onSetDueForHovered: () => void;
  onToggleLabelByIndex: (cardId: string | null, index: number) => void;
  onFocusSearch: () => void;
  onNewTaskInInbox: () => void;
  onToggleShowArchived: () => void;
  onShowHelp: () => void;
  onCloseTopPopup: () => boolean; // returns true if it consumed Esc
  onArchiveSelected: () => void;
  onSetDueSelected: () => void;
  onToggleLabelsSelected: () => void;
  onToggleOwnerSelected: () => void;
  onEditTitleSelected: () => void;
  onAssignSelfSelected: () => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Trello-style global hotkeys. Layout-independent: uses `event.code`
 * (KeyA, KeyC, ...) so QWERTY / Dvorak / Colemak users all hit the same
 * physical key. Numbers use `Digit0`-`Digit9`.
 */
export function useHotkeys(ctx: HotkeyContext, handlers: HotkeyHandlers): void {
  const ctxRef = useRef(ctx);
  const handlersRef = useRef(handlers);
  ctxRef.current = ctx;
  handlersRef.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = ctxRef.current;
      const h = handlersRef.current;
      const inputs = isInputFocused() || c.inputFocused;

      // Esc - cascading close (popups → modal → search). Always wins,
      // even when an input is focused.
      if (e.key === 'Escape') {
        const consumed = h.onCloseTopPopup();
        if (consumed) {
          e.preventDefault();
        }
        return;
      }

      // ? - help dialog. Shift+/ for layout-independent.
      if (e.shiftKey && e.code === 'Slash' && !inputs) {
        e.preventDefault();
        h.onShowHelp();
        return;
      }

      if (inputs) return;

      // === Hover-card shortcuts (no modal open) ===
      if (c.hoveredId && !c.selectedId && !c.popupOpen) {
        if (e.code === 'KeyE' || e.key === 'Enter') {
          e.preventDefault();
          h.onOpenHovered();
          return;
        }
        if (e.code === 'KeyC') {
          e.preventDefault();
          h.onArchiveHovered();
          return;
        }
        if (e.code === 'KeyL') {
          e.preventDefault();
          h.onOpenLabelsForHovered();
          return;
        }
        if (e.code === 'KeyM') {
          e.preventDefault();
          h.onOpenOwnerForHovered();
          return;
        }
        if (e.code === 'KeyD') {
          e.preventDefault();
          h.onSetDueForHovered();
          return;
        }
        const digitMatch = /^Digit([0-9])$/.exec(e.code);
        if (digitMatch) {
          e.preventDefault();
          const d = Number.parseInt(digitMatch[1]!, 10);
          // 1-9 = labels[0..8]; 0 = labels[9]
          const idx = d === 0 ? 9 : d - 1;
          h.onToggleLabelByIndex(c.hoveredId, idx);
          return;
        }
      }

      // === Modal shortcuts ===
      if (c.selectedId) {
        if (e.code === 'KeyT') {
          e.preventDefault();
          h.onEditTitleSelected();
          return;
        }
        if (e.code === 'KeyC') {
          e.preventDefault();
          h.onArchiveSelected();
          return;
        }
        if (e.code === 'KeyD') {
          e.preventDefault();
          h.onSetDueSelected();
          return;
        }
        if (e.code === 'KeyL') {
          e.preventDefault();
          h.onToggleLabelsSelected();
          return;
        }
        if (e.code === 'KeyM') {
          e.preventDefault();
          h.onToggleOwnerSelected();
          return;
        }
        if (e.code === 'Space') {
          e.preventDefault();
          h.onAssignSelfSelected();
          return;
        }
        const digitMatch = /^Digit([0-9])$/.exec(e.code);
        if (digitMatch) {
          e.preventDefault();
          const d = Number.parseInt(digitMatch[1]!, 10);
          const idx = d === 0 ? 9 : d - 1;
          h.onToggleLabelByIndex(c.selectedId, idx);
          return;
        }
      }

      // === Board shortcuts (nothing focused) ===
      if (!c.selectedId && !c.popupOpen) {
        if (e.code === 'Slash') {
          e.preventDefault();
          h.onFocusSearch();
          return;
        }
        if (e.code === 'KeyN') {
          e.preventDefault();
          h.onNewTaskInInbox();
          return;
        }
        if (e.code === 'KeyA') {
          e.preventDefault();
          h.onToggleShowArchived();
          return;
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
