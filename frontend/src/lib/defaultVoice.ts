const KEY = "voxify-default-voice";

export function loadDefaultVoice(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveDefaultVoice(voiceName: string): void {
  localStorage.setItem(KEY, voiceName);
}

export function clearDefaultVoice(): void {
  localStorage.removeItem(KEY);
}
