/** True while the user is typing in a text field, so plan shortcuts must stand aside. */
export function isTypingTarget(e?: Event | null): boolean {
  const els = [e?.target, typeof document !== "undefined" ? document.activeElement : null];
  for (const el of els) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
      const type = (el as HTMLInputElement).type;
      if (!["button", "checkbox", "radio", "range", "submit", "reset", "file", "color", "image"].includes(type)) return true;
    }
  }
  return false;
}
