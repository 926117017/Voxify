# Voxify 声语

长文本转语音桌面应用。支持中文普通话、粤语、台湾国语等多种语音合成，基于 edge-tts + FFmpeg 后端，Next.js 前端，Electron 桌面壳。

## 架构

```
backend/         FastAPI + edge-tts + FFmpeg
  app/
    main.py         入口, CORS
    routers/
      voices.py     GET /voices — 语音列表 (仅 zh-*)
      generate.py   POST /generate — 提交合成任务
                    GET /task/{id} — 轮询进度
      download.py   GET /download/{filename} — 下载 MP3

frontend/        Next.js (static export) + Electron
  src/
    app/
      page.tsx         主页面 (三栏布局)
      settings/page.tsx  设置页
      providers.tsx    主题/Header
      globals.css      颜色方案/过渡
    lib/
      api.ts           API 客户端
      history.ts       localStorage 历史记录
      settings.ts      设置持久化
    components/ui/     shadcn 组件
  electron/
    main.js           Electron 入口, 静态服务器, 后端管理
    preload.js        IPC 桥接
  public/
    favicon.svg       波形 SVG 图标
```

## 技术栈

| 层 | 技术 |
|---|---|
| 语音合成 | edge-tts (Python WebSocket → Azure TTS) |
| 音频拼接 | FFmpeg |
| 后端框架 | FastAPI + uvicorn |
| 前端框架 | Next.js 16 (static export) |
| 桌面壳 | Electron 43 |
| 构建 | electron-builder (NSIS/MSI) |
| 动画 | Framer Motion |
| 图标 | Lucide |
| 主题 | CSS `@property` 自定义变量过渡 |

## 开发

### 前置要求

- Python ≥ 3.10
- Node.js ≥ 20
- FFmpeg (在 PATH 中可用)
- 可选: edge-tts (pip install edge-tts)

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

# 终端 2: 启动前端开发服务器
cd frontend
npm run dev

# 终端 3: 启动 Electron (加载 dev server)
cd frontend
npm run electron:dev
```

### 构建安装包

```bash
cd frontend
npm run dist
```

输出: `frontend/release/Voxify Setup 0.1.0.exe`

构建过程:
1. `scripts/gen-icon.js` — SVG 转 ICO
2. `next build` — 静态导出到 `out/`
3. `electron-builder --win nsis` — 打包 NSIS 安装器

构建时自动设置 `ELECTRON_MIRROR`/`ELECTRON_BUILDER_BINARIES_MIRROR` 为 npmmirror 镜像，并清除 `HTTP_PROXY`/`HTTPS_PROXY`。

### 直接运行 Electron (生产模式)

```bash
cd frontend
npm run build   # 先构建静态文件
npm run electron  # 启动 Electron (内部 HTTP 服务器 + 后端自动启动)
```

## 功能

- **语音列表** — 仅显示 zh-CN / zh-HK / zh-TW 语音，带中文名称和性格标签，支持搜索和筛选
- **文本编辑** — 自动统计字符/段落/预计时长，支持 .txt 导入
- **参数调节** — 语速 (-50%~+50%) / 音量 / 音调
- **长文本分割** — 按句号/问号/感叹号分割，合并为 ≤200 字符段落
- **逐段生成 + 重试** — 每段独立 edge-tts 请求，最多 10 次重试 (指数退避 1s–30s)
- **FFmpeg 拼接** — 异步合并所有段落 MP3
- **音频播放** — 播放/暂停/进度条/下载
- **语音试听** — Web Speech API 即时预览 (无需后端)
- **历史记录** — 自动保存最近 50 条到 localStorage，点击恢复
- **深色/浅色主题** — 平滑 CSS 过渡，无闪烁
- **设置页** — 版本信息、GitHub 链接、检查更新

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8866` | 后端 API 地址 |

## 常见问题

### "No audio was received"

由系统代理 (`HTTP_PROXY`/`HTTPS_PROXY`) 或子进程隔离引起。后端和构建脚本均会清除代理环境变量。

### 边缘语音缺少

edge-tts 7.2.8 仅返回 14 个 zh-* 语音，许多新语音 (如晓晓多风格) 尚未在 Azure TTS Edge 模块中公开。

### Chinese 字符显示异常

不要用 PowerShell `Invoke-RestMethod` 测试 API — 它会被 `ConvertTo-Json` 破坏中文。使用 Python `requests` 或前端直接调用。

## 项目约定

- 默认监听 `127.0.0.1:8866`
- `.npmrc` 配置 npmmirror 镜像
- 构建时通过 `scripts/build.js` 设置 electron 镜像
- React 19 + Tailwind CSS 4 + shadcn
