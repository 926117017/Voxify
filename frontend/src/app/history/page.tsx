"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe, ArrowLeft } from "lucide-react";
import { useBrowser } from "@/lib/browser-context";

interface HistoryItem {
  url: string;
  title: string;
  lastVisitTime: number;
}

function tryGetHostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const browser = useBrowser();

  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }
    window.electronAPI!.browser.getHistory().then((data) => {
      setItems(data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [isElectron]);

  const handleClick = (item: HistoryItem) => {
    if (browser) {
      browser.addTabAndNavigate(item.url);
    }
    router.push("/browser");
  };

  if (!isElectron) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        浏览器历史记录仅在桌面客户端中可用
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-medium">浏览器历史记录</h2>
            {items.length > 0 && (
              <span className="text-xs text-muted-foreground">{items.length} 条记录</span>
            )}
          </div>
          {loading ? (
            <div className="text-center text-muted-foreground text-xs py-20">加载中...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-20">暂无浏览历史</div>
          ) : (
            <div className="space-y-1">
              {items.map((item, i) => (
                <div
                  key={`${item.url}-${i}`}
                  onClick={() => handleClick(item)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-muted transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <img
                      src={`https://favicon.im/${tryGetHostname(item.url)}`}
                      className="w-4 h-4 rounded-sm"
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                    <Globe className="w-4 h-4 text-muted-foreground hidden" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{item.title || item.url}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.url}</div>
                  </div>
                  {item.lastVisitTime > 0 && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(item.lastVisitTime).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
