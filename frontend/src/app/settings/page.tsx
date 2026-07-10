"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Globe,
  Package,
  RefreshCw,
} from "lucide-react";

const APP_VERSION = "0.1.0";
const GITHUB_URL = "https://github.com/926117017/Voxify";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-medium text-foreground">设置</h1>
        </div>

        {/* About */}
        <Card className="rounded-2xl border-border">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Package className="w-4 h-4 text-muted-foreground" />
              关于
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">版本</span>
              <span className="text-sm text-foreground font-mono tabular-nums">v{APP_VERSION}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">GitHub</span>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Globe className="w-4 h-4" />
                Voxify
              </a>
            </div>

            <div className="pt-1">
              <a
                href={`${GITHUB_URL}/releases`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl border-border text-xs gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  检查更新
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
