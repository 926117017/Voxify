export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8866";

export interface Voice {
  name: string;
  display_name: string;
  locale: string;
  gender: string;
  language: string;
  chinese_name: string;
  personality: string;
}

export interface GenerateResponse {
  task_id: string;
  status: string;
}

export interface TaskStatus {
  status: string;
  progress: number;
  total: number;
  download_url: string | null;
  error?: string;
}

export async function fetchVoices(): Promise<Voice[]> {
  const res = await fetch(`${API_BASE}/voices`);
  if (!res.ok) throw new Error("Failed to fetch voices");
  const data = await res.json();
  return data.voices;
}

export async function submitGeneration(params: {
  text: string;
  voice: string;
  rate: string;
  volume: string;
  pitch: string;
}): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to submit generation");
  return res.json();
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const res = await fetch(`${API_BASE}/task/${taskId}`);
  if (!res.ok) throw new Error("Failed to get task status");
  return res.json();
}

export function getDownloadUrl(filename: string): string {
  return `${API_BASE}/download/${filename}`;
}
