"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  submitGeneration,
  getTaskStatus,
  API_BASE,
  type Voice,
  type TaskStatus,
} from "@/lib/api";
import { HARDCODED_VOICES } from "@/lib/voices";
import {
  loadHistory,
  saveHistory,
  removeHistory,
  clearHistory,
  type HistoryEntry,
} from "@/lib/history";
import { loadFavorites, toggleFavorite } from "@/lib/favorites";
import { loadDefaultVoice, saveDefaultVoice } from "@/lib/defaultVoice";
import {
  Upload,
  Download,
  Play,
  Pause,
  Search,
  Volume2,
  Mic,
  FileText,
  Clock,
  GitBranch,
  CheckCircle2,
  Trash2,
} from "lucide-react";

const LOCALE_MAP: Record<string, string> = {
  "zh-CN": "普通话",
  "zh-HK": "粤语",
  "zh-TW": "台湾国语",
};

function estimateSegments(text: string): number {
  if (!text.trim()) return 0;
  const cleaned = text.replace(/\.\.\./g, "。").replace(/…/g, "。");
  const sents = cleaned.split(/[。！？.!?\n]/).filter((s) => s.trim().length >= 2);
  let count = 0;
  let buf = "";
  for (const s of sents) {
    if (buf.length + s.length > 200) {
      count++;
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf) count++;
  return count;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [text, setText] = useState("");
  const [rate, setRate] = useState(0);
  const [volume, setVolume] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showVoiceList, setShowVoiceList] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [defaultVoice, setDefaultVoice] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const [hajimi, setHajimi] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastGenRef = useRef({ text: "", voice: "", rate: "+0%", volume: "+0%", pitch: "+0Hz", hajimi: false });

  useEffect(() => {
    setHistory(loadHistory());
    setFavorites(loadFavorites());
    setVoices(HARDCODED_VOICES);
    const saved = loadDefaultVoice();
    setDefaultVoice(saved);
    const defaultMatch = saved ? HARDCODED_VOICES.find((v) => v.name === saved) : null;
    setSelectedVoice(defaultMatch?.name || HARDCODED_VOICES[0]?.name || "");
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollTask = useCallback((taskId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getTaskStatus(taskId);
        setTaskStatus(status);
        if (status.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (status.download_url) {
            const url = `${API_BASE}${status.download_url}`;
            setAudioUrl(url);
            const v = voices.find((vi) => vi.name === lastGenRef.current.voice);
            const entry: HistoryEntry = {
              id: taskId,
              text: lastGenRef.current.text,
              voice: lastGenRef.current.voice,
              voiceName: v?.chinese_name || lastGenRef.current.voice,
              rate: lastGenRef.current.rate,
              volume: lastGenRef.current.volume,
              pitch: lastGenRef.current.pitch,
              downloadUrl: url,
              timestamp: Date.now(),
              duration: 0,
            };
            setHistory(saveHistory(entry));
          }
          setGenerating(false);
        } else if (status.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setGenerating(false);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setGenerating(false);
      }
    }, 1000);
  }, []);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setTaskStatus(null);
    setAudioUrl(null);
    setAudioDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    const rateStr = `${rate >= 0 ? "+" : ""}${rate}%`;
    const volumeStr = `${volume >= 0 ? "+" : ""}${volume}%`;
    const pitchStr = `${pitch >= 0 ? "+" : ""}${pitch}Hz`;
    lastGenRef.current = { text, voice: selectedVoice, rate: rateStr, volume: volumeStr, pitch: pitchStr, hajimi };
    try {
      const result = await submitGeneration({
        text,
        voice: selectedVoice,
        rate: rateStr,
        volume: volumeStr,
        pitch: pitchStr,
        hajimi,
      });
      setTaskStatus({
        status: "running",
        progress: 0,
        total: 0,
        download_url: null,
      });
      pollTask(result.task_id);
    } catch (err) {
      console.error(err);
      setGenerating(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
    };
    reader.readAsText(file);
  };

  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handlePreview = (voiceName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewPlaying === voiceName) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewPlaying(null);
      return;
    }
    previewAudioRef.current?.pause();
    const shortName = voiceName.replace(/^(zh-CN|zh-HK|zh-TW)-/, "").replace(/Neural$/i, "").toLowerCase();
    const audio = new Audio(`/edge-voices/${shortName}.mp3`);
    audio.onended = () => setPreviewPlaying(null);
    audio.onerror = () => setPreviewPlaying(null);
    audio.play().catch(() => setPreviewPlaying(null));
    previewAudioRef.current = audio;
    setPreviewPlaying(voiceName);
  };

  const filteredVoices = voices
    .filter((v) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.chinese_name.toLowerCase().includes(q) ||
        v.locale.toLowerCase().includes(q) ||
        v.personality.toLowerCase().includes(q);
      const matchesLanguage =
        languageFilter === "all" || v.language === languageFilter;
      const matchesGender =
        genderFilter === "all" || v.gender === genderFilter;
      return matchesSearch && matchesLanguage && matchesGender;
    })
    .sort((a, b) => {
      const fa = favorites.has(a.name);
      const fb = favorites.has(b.name);
      if (fa && !fb) return -1;
      if (!fa && fb) return 1;
      return 0;
    });

  const languages = Array.from(new Set(voices.map((v) => v.language))).sort();
  const segCount = estimateSegments(text);
  const estMinutes = Math.ceil(segCount * 6 / 60);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 overflow-y-auto lg:overflow-hidden">
        <audio
          ref={audioRef}
          src={audioUrl || undefined}
          onLoadedMetadata={handleAudioLoaded}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
        />

        {/* Voice List - Left */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:w-[260px] lg:shrink-0 flex flex-col gap-3 lg:max-h-full lg:overflow-hidden"
        >
          <button
            onClick={() => setShowVoiceList(!showVoiceList)}
            className="lg:hidden flex items-center justify-between w-full p-3 rounded-xl border border-border bg-card text-sm"
          >
            <span>{selectedVoice ? voices.find(v => v.name === selectedVoice)?.chinese_name || selectedVoice : "选择音色"}</span>
            <motion.svg
              animate={{ rotate: showVoiceList ? 180 : 0 }}
              className="w-4 h-4 text-muted-foreground"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </motion.svg>
          </button>
          <div className={`${showVoiceList ? "flex" : "hidden"} lg:flex flex-col gap-3 lg:flex-1 lg:min-h-0 lg:overflow-hidden`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="搜索语音..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-[44px] text-sm rounded-xl bg-background transition-none"
              />
            </div>
            <div className="flex gap-2">
              {["all", ...languages].slice(0, 4).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguageFilter(lang === languageFilter ? "all" : lang)}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${
                    lang === languageFilter
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {lang === "all" ? "全部" : (LOCALE_MAP[lang] || lang.toUpperCase())}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-1">
              {(["all", "Male", "Female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenderFilter(g === genderFilter ? "all" : g)}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${
                    g === genderFilter
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {g === "all" ? "全部" : g === "Male" ? "男" : "女"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredVoices.map((v) => (
                <motion.div
                  key={v.name}
                  className={`relative p-3 rounded-xl border cursor-pointer ${
                    v.name === selectedVoice
                      ? "bg-primary/10 border-primary/40"
                      : "bg-card border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setSelectedVoice(v.name)}
                  onDoubleClick={() => {
                    if (defaultVoice !== v.name) {
                      saveDefaultVoice(v.name);
                      setDefaultVoice(v.name);
                    }
                  }}
                  title={defaultVoice === v.name ? "当前默认" : "双击默认"}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFavorites(toggleFavorite(v.name, favorites));
                        }}
                        className={`w-5 h-5 flex items-center justify-center transition-colors ${
                          favorites.has(v.name)
                            ? "text-amber-400"
                            : "text-muted-foreground/30 hover:text-amber-400/60"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill={favorites.has(v.name) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <span className={`text-sm font-medium ${v.name === selectedVoice ? "text-primary" : "text-foreground"}`}>
                        {v.chinese_name}
                      </span>
                      {defaultVoice === v.name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary" title="当前默认">
                          默认
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handlePreview(v.name, e)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          previewPlaying === v.name
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {previewPlaying === v.name ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3 ml-0.5" />
                        )}
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        v.gender === "Male" ? "bg-blue-500/10 text-blue-400" : "bg-pink-500/10 text-pink-400"
                      }`}>
                        {v.gender === "Male" ? "男" : "女"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{LOCALE_MAP[v.locale] || v.locale}</span>
                    {v.personality && (
                      <>
                        <span>·</span>
                        <span>{v.personality}</span>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Text Editor - Center */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="flex-1 flex flex-col"
        >
          <Card className="flex-1 min-h-[300px] lg:min-h-0 flex flex-col rounded-2xl border-border overflow-hidden">
            <div className="flex-1 relative">
              <textarea
                className="absolute inset-0 w-full h-full resize-none bg-transparent p-4 lg:p-6 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/40 outline-none min-h-[240px] lg:min-h-0"
                placeholder="在此粘贴或输入文本..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="h-[44px] shrink-0 border-t border-border flex items-center justify-between px-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3" />
                  {text.length.toLocaleString()} 字符
                </span>
                <span className="flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3" />
                  {segCount} 段
                </span>
                {segCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    ≈ {estMinutes} 分钟
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="w-3 h-3" />
                导入 .txt
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleFileImport}
              />
            </div>
          </Card>
        </motion.div>

        {/* Generate Panel - Right */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="w-full lg:w-[340px] lg:shrink-0 flex flex-col gap-4 lg:max-h-full lg:min-h-0 overflow-y-auto"
        >
          <div className="flex flex-col gap-4">
            <Card className="rounded-2xl border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {selectedVoice
                        ? voices.find((v) => v.name === selectedVoice)?.chinese_name || selectedVoice
                        : "未选择"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {selectedVoice
                        ? (LOCALE_MAP[voices.find((v) => v.name === selectedVoice)?.locale || ""] || voices.find((v) => v.name === selectedVoice)?.locale || "")
                        : ""}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border">
              <CardContent className="p-5 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">语速</Label>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">{rate > 0 ? "+" : ""}{rate}%</span>
                  </div>
                  <Slider
                    min={-50}
                    max={50}
                    step={1}
                    value={[rate]}
                    onValueChange={(v) => setRate(typeof v === "number" ? v : v[0])}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">音量</Label>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">{volume > 0 ? "+" : ""}{volume}%</span>
                  </div>
                  <Slider
                    min={-50}
                    max={50}
                    step={1}
                    value={[volume]}
                    onValueChange={(v) => setVolume(typeof v === "number" ? v : v[0])}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">音调</Label>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">{pitch > 0 ? "+" : ""}{pitch}Hz</span>
                  </div>
                  <Slider
                    min={-20}
                    max={20}
                    step={1}
                    value={[pitch]}
                    onValueChange={(v) => setPitch(typeof v === "number" ? v : v[0])}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                </div>
              </CardContent>
            </Card>

            <button
              onClick={() => setHajimi(!hajimi)}
              className={`w-full h-11 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                hajimi
                  ? "bg-pink-500/15 border-pink-400/40 text-pink-400"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="text-base">🎀</span>
              哈吉咪 <span className="font-mono text-xs">{hajimi ? "ON" : "OFF"}</span>
            </button>

            <motion.div
              whileHover={text.trim() && !generating ? { scale: 1.01 } : undefined}
              transition={{ duration: 0.15 }}
            >
              <Button
                className="w-full h-12 text-sm font-medium rounded-xl"
                disabled={!text.trim() || generating}
                onClick={handleGenerate}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <motion.span
                      className="inline-block w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    生成中...
                  </span>
                ) : (
                  "生成语音"
                )}
              </Button>
            </motion.div>
          </div>

          {/* Progress */}
          <AnimatePresence>
            {taskStatus && taskStatus.total > 0 && taskStatus.status === "running" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="rounded-2xl border-border">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">生成进度</span>
                      <span className="text-muted-foreground font-mono tabular-nums">
                        {Math.round((taskStatus.progress / taskStatus.total) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(taskStatus.progress / taskStatus.total) * 100}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {taskStatus.progress} / {taskStatus.total} 段
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {taskStatus?.status === "running" && taskStatus.total === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground text-center py-2"
              >
                正在分割文本...
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {taskStatus?.status === "failed" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-destructive text-center py-2"
              >
                生成失败: {taskStatus.error || "未知错误"}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player */}
          <AnimatePresence>
            {audioUrl && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="rounded-2xl border-border">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span className="text-xs text-success font-medium">生成完成</span>
                      </div>
                      {audioDuration > 0 && (
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {formatTime(audioDuration)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePlay}
                        className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
                      >
                        {playing ? (
                          <Pause className="w-4 h-4 text-primary-foreground" />
                        ) : (
                          <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 h-10 rounded-xl bg-muted flex items-center px-3">
                        <Volume2 className="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0" />
                        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                          {audioDuration > 0 && (
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{
                                width: audioDuration > 0
                                  ? `${(currentTime / audioDuration) * 100}%`
                                  : "0%",
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = audioUrl;
                          a.download = "tts_output.mp3";
                          a.click();
                        }}
                        className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 生成记录 */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground">生成记录</h3>
                <button
                  onClick={() => { setHistory([]); clearHistory(); }}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  清除
                </button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => {
                      setText(h.text);
                      setSelectedVoice(h.voice);
                      setRate(parseInt(h.rate));
                      setVolume(parseInt(h.volume));
                      setPitch(parseInt(h.pitch));
                      setAudioUrl(h.downloadUrl);
                    }}
                    className="p-2.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted transition-colors text-left group relative"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistory(removeHistory(h.id));
                      }}
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                    <div className="text-[11px] text-foreground leading-relaxed line-clamp-2 mb-0.5 pr-4">{h.text}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{h.voiceName}</span>
                      <span>·</span>
                      <span>{new Date(h.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
