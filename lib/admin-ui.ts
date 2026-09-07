const emojiSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function emojiTokens(value: string) {
  return Array.from(emojiSegmenter.segment(value.normalize("NFC")), ({ segment }) => segment)
    .filter((segment) => segment.trim().length > 0);
}

export function normalizeEmojiSequence(value: string) {
  return emojiTokens(value).join("  ");
}

export function puzzleListReturnUrl(returnTo: string, puzzleNumber: number) {
  const [path] = returnTo.split("#", 1);
  return `${path || "/admin/"}#puzzle-${puzzleNumber}`;
}

export function dismissAdminKeyboard() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input, textarea, select, [contenteditable='true']")) active.blur();
}

export function dismissKeyboardForAdminAction(target: EventTarget | null) {
  if (target instanceof Element && target.closest("button, a, select, [role='button']")) dismissAdminKeyboard();
}
