const KEY = "voxify-favorites";

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function toggleFavorite(id: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  localStorage.setItem(KEY, JSON.stringify([...next]));
  return next;
}
