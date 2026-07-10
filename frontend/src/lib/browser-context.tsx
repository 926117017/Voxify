"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  inputValue: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isHome: boolean;
}

interface BrowserContextType {
  browserTabs: BrowserTab[];
  activeTabId: string;
  activeBrowserTab: BrowserTab;
  isElectron: boolean;
  contentAreaRef: React.RefObject<HTMLDivElement | null>;
  updateBrowserTab: (id: string, patch: Partial<BrowserTab>) => void;
  addBrowserTab: () => void;
  addTabAndNavigate: (url: string) => void;
  closeBrowserTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  navigateTo: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  getBounds: () => { x: number; y: number; width: number; height: number };
  showView: () => void;
  hideView: () => void;
}

const BrowserCtx = createContext<BrowserContextType | null>(null);

export const useBrowser = () => useContext(BrowserCtx);

function tryGetHostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export function BrowserProvider({ children }: { children: ReactNode }) {
  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>(() => [
    { id: "tab-1", title: "新标签页", url: "about:home", inputValue: "", isLoading: false, canGoBack: false, canGoForward: false, isHome: true },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const tabIdCounter = useRef(1);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);

  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  const activeBrowserTab = browserTabs.find((t) => t.id === activeTabId) || browserTabs[0];

  const updateBrowserTab = useCallback((id: string, patch: Partial<BrowserTab>) => {
    setBrowserTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const getBounds = useCallback(() => {
    const el = contentAreaRef.current;
    if (!el) return { x: 0, y: 0, width: 800, height: 600 };
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  }, []);

  const addBrowserTab = useCallback(() => {
    tabIdCounter.current++;
    const id = `tab-${tabIdCounter.current}`;
    const newTab: BrowserTab = {
      id, title: "新标签页", url: "about:home", inputValue: "",
      isLoading: false, canGoBack: false, canGoForward: false, isHome: true,
    };
    setBrowserTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    if (isElectron) window.electronAPI!.browser.create(id);
  }, [isElectron]);

  const addTabAndNavigate = useCallback((targetUrl: string) => {
    let finalUrl = targetUrl.trim();
    if (!finalUrl) return;
    const isUrl = /^https?:\/\//i.test(finalUrl) || /^[\w-]+(\.[\w-]+)+/.test(finalUrl);
    if (isUrl) {
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    } else {
      finalUrl = `https://www.bing.com/search?q=${encodeURIComponent(finalUrl)}`;
    }

    tabIdCounter.current++;
    const id = `tab-${tabIdCounter.current}`;
    const newTab: BrowserTab = {
      id, title: tryGetHostname(finalUrl) || finalUrl, url: finalUrl, inputValue: finalUrl,
      isLoading: false, canGoBack: false, canGoForward: false, isHome: false,
    };
    setBrowserTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
    if (isElectron) {
      window.electronAPI!.browser.create(id);
      window.electronAPI!.browser.navigate(id, finalUrl);
      setTimeout(() => {
        const bounds = getBounds();
        window.electronAPI!.browser.setActive(id, bounds);
      }, 50);
    }
  }, [isElectron, getBounds]);

  const closeBrowserTab = useCallback((id: string) => {
    if (isElectron) window.electronAPI!.browser.destroy(id);
    setBrowserTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        tabIdCounter.current++;
        const newTab: BrowserTab = {
          id: `tab-${tabIdCounter.current}`, title: "新标签页", url: "about:home", inputValue: "",
          isLoading: false, canGoBack: false, canGoForward: false, isHome: true,
        };
        setActiveTabId(newTab.id);
        if (isElectron) window.electronAPI!.browser.create(newTab.id);
        return [newTab];
      }
      if (id === activeTabId) {
        const idx = prev.findIndex((t) => t.id === id);
        const newActive = prev[idx + 1] || prev[idx - 1];
        if (newActive) setActiveTabId(newActive.id);
      }
      return next;
    });
  }, [activeTabId, isElectron]);

  const navigateTo = useCallback((targetUrl: string) => {
    let finalUrl = targetUrl.trim();
    if (!finalUrl) return;
    if (finalUrl === "about:home") {
      updateBrowserTab(activeTabId, { url: "about:home", inputValue: "", title: "新标签页", isHome: true });
      if (isElectron) window.electronAPI!.browser.hideAll();
      return;
    }
    const isUrl = /^https?:\/\//i.test(finalUrl) || /^[\w-]+(\.[\w-]+)+/.test(finalUrl);
    if (isUrl) {
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
    } else {
      finalUrl = `https://www.bing.com/search?q=${encodeURIComponent(finalUrl)}`;
    }
    updateBrowserTab(activeTabId, { url: finalUrl, inputValue: finalUrl, title: tryGetHostname(finalUrl) || finalUrl, isHome: false });
    if (isElectron) {
      window.electronAPI!.browser.navigate(activeTabId, finalUrl);
      setTimeout(() => {
        const bounds = getBounds();
        window.electronAPI!.browser.setActive(activeTabId, bounds);
      }, 50);
    }
  }, [activeTabId, isElectron, updateBrowserTab, getBounds]);

  const goBack = useCallback(() => {
    if (!isElectron || activeBrowserTab.isHome) return;
    window.electronAPI!.browser.back(activeTabId);
  }, [activeTabId, activeBrowserTab.isHome, isElectron]);

  const goForward = useCallback(() => {
    if (!isElectron) return;
    if (activeBrowserTab.isHome) return;
    if (!activeBrowserTab.canGoForward) return;
    window.electronAPI!.browser.forward(activeTabId);
  }, [activeTabId, activeBrowserTab.isHome, activeBrowserTab.canGoForward, isElectron]);

  const reload = useCallback(() => {
    if (isElectron) window.electronAPI!.browser.reload(activeTabId);
  }, [activeTabId, isElectron]);

  const showView = useCallback(() => {
    if (!isElectron) return;
    if (activeBrowserTab.isHome) {
      window.electronAPI!.browser.hideAll();
    } else {
      const bounds = getBounds();
      window.electronAPI!.browser.setActive(activeTabId, bounds);
    }
  }, [isElectron, activeTabId, activeBrowserTab.isHome, getBounds]);

  const hideView = useCallback(() => {
    if (isElectron) window.electronAPI!.browser.hideAll();
  }, [isElectron]);

  // IPC event listeners - stay alive as long as the provider is alive
  useEffect(() => {
    if (!isElectron) return;
    const api = window.electronAPI!.browser;

    const h1 = api.on('browser-title-changed', ({ tabId, title }: any) => {
      updateBrowserTab(tabId, { title });
    });
    const h2 = api.on('browser-url-changed', ({ tabId, url }: any) => {
      updateBrowserTab(tabId, { url, inputValue: url, isHome: url === 'about:home' });
    });
    const h3 = api.on('browser-loading-start', ({ tabId }: any) => {
      updateBrowserTab(tabId, { isLoading: true });
    });
    const h4 = api.on('browser-loading-stop', ({ tabId }: any) => {
      updateBrowserTab(tabId, { isLoading: false });
    });
    const h5 = api.on('browser-nav-state', ({ tabId, canGoBack, canGoForward }: any) => {
      updateBrowserTab(tabId, { canGoBack, canGoForward });
    });
    const h6 = api.on('browser-back-exhausted', ({ tabId }: any) => {
      updateBrowserTab(tabId, { url: "about:home", inputValue: "", title: "新标签页", isHome: true });
    });

    return () => {
      api.off('browser-title-changed', h1);
      api.off('browser-url-changed', h2);
      api.off('browser-loading-start', h3);
      api.off('browser-loading-stop', h4);
      api.off('browser-nav-state', h5);
      api.off('browser-back-exhausted', h6);
    };
  }, [isElectron, updateBrowserTab]);

  return (
    <BrowserCtx.Provider value={{
      browserTabs, activeTabId, activeBrowserTab, isElectron, contentAreaRef,
      updateBrowserTab, addBrowserTab, addTabAndNavigate, closeBrowserTab, setActiveTabId,
      navigateTo, goBack, goForward, reload, getBounds, showView, hideView,
    }}>
      {children}
    </BrowserCtx.Provider>
  );
}
