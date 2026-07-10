"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sun, Moon, Settings, ArrowLeft } from "lucide-react";
import { BrowserProvider } from "@/lib/browser-context";

type Theme = "dark" | "light";

const ThemeCtx = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "dark", setTheme: () => {} });

export const useTheme = () => useContext(ThemeCtx);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname === "/settings";

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const t = stored || "dark";
    setTheme(t);
    applyTheme(t);
    setMounted(true);
    setIsElectron(!!window.electronAPI);
  }, []);

  const doSetTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    localStorage.setItem("theme", t);
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme: doSetTheme }}>
      <BrowserProvider>
        <Header
          mounted={mounted}
          isSettings={isSettings}
          isElectron={isElectron}
          pathname={pathname}
          router={router}
        />
        {children}
      </BrowserProvider>
    </ThemeCtx.Provider>
  );
}

function Header({
  mounted,
  isSettings,
  isElectron,
  pathname,
  router,
}: {
  mounted: boolean;
  isSettings: boolean;
  isElectron: boolean;
  pathname: string;
  router: ReturnType<typeof useRouter>;
}) {
  const tabs = [
    { path: "/", label: "语音合成" },
    ...(isElectron ? [{ path: "/browser", label: "浏览器" }] : []),
  ];

  return (
    <header className="h-[60px] shrink-0 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        {isSettings ? (
          <button
            onClick={() => router.push("/")}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : null}
        <div className="w-7 h-7">
          <svg viewBox="0 0 32 32" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none">
            <rect width="32" height="32" rx="8" fill="#0f0f0f"/>
            <path d="M8 16C8 16 10 10 12 10C14 10 14 16 16 16C18 16 18 10 20 10C22 10 24 16 24 16" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M8 20C8 20 10 14 12 14C14 14 14 20 16 20C18 20 18 14 20 14C22 14 24 20 24 20" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>
        <span className="text-sm font-medium text-foreground">Voxify</span>
        {!isSettings && mounted && (
          <div className="flex items-center gap-1 ml-2">
            {tabs.map((tab) => (
              <button
                key={tab.path}
                className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                  pathname === tab.path
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                onClick={() => router.push(tab.path)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {mounted && <ThemeToggle />}
        {!isSettings && mounted && (
          <button
            onClick={() => router.push("/settings")}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
