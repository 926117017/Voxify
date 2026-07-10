export interface HistoryEntry {
  id: string;
  text: string;
  voice: string;
  voiceName: string;
  rate: string;
  volume: string;
  pitch: string;
  downloadUrl: string;
  timestamp: number;
  duration: number;
}

const STORAGE_KEY = "tts_history";
const MAX_ITEMS = 50;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const list = loadHistory();
  list.unshift(entry);
  if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function removeHistory(id: string): HistoryEntry[] {
  const list = loadHistory().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
