/**
 * Pure wrap-around id stepper for arrow-key cycling through an ordered
 * list (media library items, visible devices). Shared so every cycling
 * hotkey wraps the same way instead of each callsite reinventing modulo
 * arithmetic.
 */
export function cycleId<T extends { id: string }>(
  items: readonly T[],
  currentId: string | null,
  dir: 1 | -1,
): string | null {
  const n = items.length;
  if (n === 0) return null;
  const at = items.findIndex((item) => item.id === currentId);
  // No current match (nothing selected, or a stale id) — step in from
  // outside the list: forward lands on the first item, back on the last.
  const from = at === -1 ? (dir === 1 ? -1 : 0) : at;
  return items[(from + dir + n) % n].id;
}
