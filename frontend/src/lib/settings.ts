export interface AppSettings {
  outputDir: string;
  downloadDir: string;
}

const KEY = "voxify-settings";

const defaults: AppSettings = {
  outputDir: "",
  downloadDir: "",
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearCache(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem("voxify-history");
}
