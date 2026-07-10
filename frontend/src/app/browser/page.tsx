"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBrowser } from "@/lib/browser-context";
import {
  Search,
  Plus,
  X,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Clock,
} from "lucide-react";

function QuickLink({
  url,
  title,
  icon,
  onClick,
}: {
  url: string;
  title: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 w-[80px] p-3 rounded-xl hover:bg-muted transition-colors group"
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate w-full text-center">{title}</span>
    </button>
  );
}

function tryGetHostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export default function BrowserPage() {
  return (
    <Suspense>
      <BrowserContent />
    </Suspense>
  );
}

function BrowserContent() {
  const router = useRouter();
  const ctx = useBrowser();

  if (!ctx) return null;

  const {
    browserTabs, activeTabId, activeBrowserTab, contentAreaRef,
    updateBrowserTab, addBrowserTab, closeBrowserTab, setActiveTabId,
    navigateTo, goBack, goForward, reload, showView, hideView,
  } = ctx;

  // Show BrowserView when this page is active
  useEffect(() => {
    showView();
  }, [activeTabId, activeBrowserTab.isHome, showView]);

  // Hide BrowserView when navigating away (unmount)
  useEffect(() => {
    return () => {
      hideView();
    };
  }, [hideView]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") navigateTo(activeBrowserTab.inputValue);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Bar + Toolbar */}
      <div className="h-10 shrink-0 flex items-center gap-1 px-2 bg-background overflow-x-auto">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={goBack}
          disabled={activeBrowserTab.isHome}
        >
          <ArrowLeft className={`w-4 h-4 ${activeBrowserTab.isHome ? "text-muted-foreground/40" : ""}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={goForward}
          disabled={activeBrowserTab.isHome || !activeBrowserTab.canGoForward}
        >
          <ArrowRight className={`w-4 h-4 ${(activeBrowserTab.isHome || !activeBrowserTab.canGoForward) ? "text-muted-foreground/40" : ""}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={reload}
          disabled={activeBrowserTab.isHome}
        >
          <RefreshCw className={`w-4 h-4 ${activeBrowserTab.isLoading ? "animate-spin" : ""} ${activeBrowserTab.isHome ? "text-muted-foreground/40" : ""}`} />
        </Button>
        <div className="w-px h-5 bg-border shrink-0 mx-1" />
        {browserTabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 h-8 px-3 rounded-lg cursor-pointer shrink-0 w-[150px] group text-xs transition-colors ${
              tab.id === activeTabId
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            {!tab.isHome ? (
              <img
                src={`https://favicon.im/${tryGetHostname(tab.url)}`}
                className="w-4 h-4 shrink-0 rounded-sm"
                alt=""
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            )}
            <span className="flex-1 min-w-0 truncate">{tab.title}</span>
            <button
              className="w-5 h-5 rounded flex items-center justify-center shrink-0 hover:bg-muted-foreground/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                closeBrowserTab(tab.id);
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          onClick={addBrowserTab}
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={activeBrowserTab.inputValue}
            onChange={(e) => updateBrowserTab(activeTabId, { inputValue: e.target.value })}
            onKeyDown={handleKeyDown}
            className="h-8 pl-8 pr-10 text-xs rounded-full bg-muted/50 border-transparent focus:border-border focus:bg-background"
            placeholder="搜索或输入网址..."
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => router.push("/history")}
            title="历史记录"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Browser Content Area */}
      <div ref={contentAreaRef} className="flex-1 min-h-0 relative bg-background">
        {activeBrowserTab.isHome && (
          <div className="h-full flex flex-col items-center justify-center gap-8 p-8">
            <div className="flex flex-col items-center gap-3">
              <svg viewBox="0 0 32 32" className="w-10 h-10 text-muted-foreground/60" xmlns="http://www.w3.org/2000/svg" fill="none">
                <path d="M8 16C8 16 10 10 12 10C14 10 14 16 16 16C18 16 18 10 20 10C22 10 24 16 24 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M8 20C8 20 10 14 12 14C14 14 14 20 16 20C18 20 18 14 20 14C22 14 24 20 24 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
              </svg>
              <h1 className="text-base text-muted-foreground">Voxify</h1>
            </div>
            <div className="flex gap-3">
              <QuickLink
                url="https://kol.fanqieopen.com"
                title="番茄达人中心"
                icon="🍅"
                onClick={() => navigateTo("https://kol.fanqieopen.com")}
              />
              <QuickLink
                url="https://www.douyin.com"
                title="抖音"
                icon="🎵"
                onClick={() => navigateTo("https://www.douyin.com")}
              />
              <QuickLink
                url="https://www.baidu.com"
                title="百度"
                icon="🔍"
                onClick={() => navigateTo("https://www.baidu.com")}
              />
              <QuickLink
                url="https://www.bilibili.com"
                title="B站"
                icon="📺"
                onClick={() => navigateTo("https://www.bilibili.com")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
