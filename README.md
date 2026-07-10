# Voxify 声语

长文本转语音桌面应用。支持中文普通话、粤语、台湾国语等多种语音合成，基于 edge-tts + FFmpeg 后端，Next.js 前端，Electron 桌面壳。

## 截图

| 语音合成 | 内置浏览器 |
|---------|-----------|
| ![语音合成](https://raw.githubusercontent.com/926117017/Voxify/master/screenshots/tts.png) | ![内置浏览器](https://raw.githubusercontent.com/926117017/Voxify/master/screenshots/browser.png) |

## 架构

```
backend/          FastAPI + edge-tts + FFmpeg
  app/
    main.py         入口, CORS
    routers/
      voices.py     GET /voices — 语音列表 (仅 zh-*)
      generate.py   POST /generate — 提交合成任务
                    GET /task/{id} — 轮询进度
      download.py   GET /download/{filename} — 下载 MP3

frontend/         Next.js (static export) + Electron
  src/
    app/
      page.tsx              TTS 主页面 (语音列表 + 文本编辑 + 生成面板)
      browser/page.tsx      内置浏览器 (标签页 + 导航 + 快捷链接)
      history/page.tsx      浏览器历史记录页面
      settings/page.tsx     设置页 (版本 + GitHub)
      providers.tsx         主题/Header/BrowserProvider 全局上下文
      globals.css           颜色方案 + CSS 变量过渡
    lib/
      api.ts                API 客户端
      browser-context.tsx   浏览器全局状态 (标签页、IPC 事件、导航)
      voices.ts             硬编码 14 个中文语音 (6 男 + 8 女)
      favorites.ts          收藏语音持久化 (localStorage)
      defaultVoice.ts       默认语音持久化 (localStorage)
      history.ts            TTS 生成记录持久化 (localStorage)
      settings.ts           设置持久化
      utils.ts              cn() 工具函数
    components/ui/          shadcn 组件
    types/
      electron.d.ts         Electron API 类型定义
  electron/
    main.js           Electron 入口, WebContentsView 管理, 协议拦截, 静态服务器
    preload.js        IPC 桥接
  public/
    edge-voices/      14 个 MP3 试听样本
    favicon.svg       波形 SVG 图标
    app-icon.ico      应用图标
```

## 技术栈

| 层 | 技术 |
|---|---|
| 语音合成 | edge-tts (Python WebSocket → Azure TTS) |
| 音频拼接 | FFmpeg |
| 后端框架 | FastAPI + uvicorn |
| 前端框架 | Next.js 16 (static export) + React 19 |
| 桌面壳 | Electron 43 (WebContentsView) |
| 构建 | electron-builder (NSIS/MSI) |
| 动画 | Framer Motion |
| 图标 | Lucide |
| 组件 | shadcn/ui |
| 样式 | Tailwind CSS 4 |

## 功能

### 语音合成

- **14 个中文语音** — 6 男 (云希/云健/云龙/云扬/云夏/云哲) + 8 女 (晓晓/晓艺/晓甄/晓佳/晓妮/晓雯/晓贝/晓雨)
- **多语言** — 普通话 (zh-CN)、粤语 (zh-HK)、台湾国语 (zh-TW)
- **语音筛选** — 按语言、性别筛选，支持搜索
- **收藏语音** — 星标收藏，收藏的语音置顶
- **默认语音** — 双击设为默认，下次打开自动选中
- **语音试听** — 列表直接播放 MP3 样本预览

### 文本编辑

- **字符/段落/时长统计** — 实时显示字符数、预估段落、预计时长
- **导入 .txt** — 支持从文件导入文本
- **长文本分割** — 按句号/问号/感叹号分割，合并为 ≤200 字符段落

### 生成与播放

- **参数调节** — 语速 (-50%~+50%) / 音量 (-50%~+50%) / 音调 (-20~+20Hz)
- **逐段生成 + 重试** — 每段独立 edge-tts 请求，最多 10 次重试 (指数退避 1s–30s)
- **FFmpeg 拼接** — 异步合并所有段落 MP3
- **音频播放** — 播放/暂停/进度条/下载
- **生成记录** — 自动保存最近 50 条，点击恢复

### 内置浏览器 (Electron)

- **多标签页** — 创建/关闭/切换标签页
- **导航** — 前进/后退/刷新，支持 WebContentsView 历史
- **地址栏** — 输入网址或关键词搜索 (Bing)
- **快捷链接** — 首页内置番茄达人中心、抖音、百度、B站
- **浏览器历史记录** — 通过导航事件自动记录，独立历史页面，点击新开标签页
- **自定义协议拦截** — 静默吞掉 bytedance/douyin 等自定义协议，阻止 Windows 弹窗

### 主题

- **深色/浅色切换** — 无闪烁即时切换

## 开发

### 前置要求

- Python ≥ 3.10
- Node.js ≥ 20
- FFmpeg (在 PATH 中可用)

### 安装

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 运行开发模式

```bash
# 终端 1: 启动后端
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8866

# 终端 2: 启动前端 + Electron
cd frontend
npm run electron:dev
```

### 构建安装包

```bash
cd frontend
npm run dist
```

输出: `frontend/release/Voxify Setup 0.1.0.exe`

### 直接运行 Electron (生产模式)

```bash
cd frontend
npm run build    # 先构建静态文件
npm run electron # 启动 Electron
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8866` | 后端 API 地址 |

## 常见问题

### "No audio was received"

由系统代理 (`HTTP_PROXY`/`HTTPS_PROXY`) 或子进程隔离引起。后端和构建脚本均会清除代理环境变量。

### 边缘语音缺少

edge-tts 仅返回有限的 zh-* 语音，许多新语音 (如晓晓多风格) 尚未在 Azure TTS Edge 模块中公开。

### Chinese 字符显示异常

不要用 PowerShell `Invoke-RestMethod` 测试 API — 它会被 `ConvertTo-Json` 破坏中文。使用 Python `requests` 或前端直接调用。

## License

MIT
