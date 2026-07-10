interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserAPI {
  create: (tabId: string) => void;
  destroy: (tabId: string) => void;
  navigate: (tabId: string, url: string) => void;
  back: (tabId: string) => void;
  forward: (tabId: string) => void;
  reload: (tabId: string) => void;
  setActive: (tabId: string, bounds: BrowserBounds) => void;
  hideAll: () => void;
  resize: (tabId: string, bounds: BrowserBounds) => void;
  getHistory: () => Promise<Array<{ url: string; title: string; lastVisitTime: number }>>;
  on: (event: string, callback: (data: any) => void) => any;
  off: (event: string, handler: any) => void;
}

interface ElectronAPI {
  platform: string;
  selectFolder: () => Promise<string | null>;
  browser: BrowserAPI;
}

interface Window {
  electronAPI?: ElectronAPI;
}
