import { useEffect, useRef, type RefObject } from "react";
import { Platform } from "react-native";

const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Web modal keyboard behaviour: move focus into the dialog on open, keep
 * Tab/Shift+Tab inside it, close on Escape, and return focus to whatever
 * opened it. (react-native-web's Modal lets Tab escape to the page.)
 */
export function useDialogFocus(
  dialogRef: RefObject<unknown>,
  open: boolean,
  onClose: () => void,
): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (Platform.OS !== "web" || !open || typeof document === "undefined") return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = () => dialogRef.current as HTMLElement | null;
    const focusables = () =>
      Array.from(dialog()?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.getAttribute("aria-hidden") !== "true",
      );

    const frame = requestAnimationFrame(() => focusables()[0]?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && !!dialog()?.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      if (opener?.isConnected) opener.focus();
    };
  }, [dialogRef, open]);
}
