# ccusage-gui-for-mac

语言：[English](README.md) | [简体中文](README.zh-CN.md)

`ccusage-gui-for-mac` 是一款 macOS 桌面端 `ccusage` 可视化工具，用图表直观展示 Token 消耗数据，并支持按会话拆解用量明细。应用基于 Tauri、React、TypeScript 和 Vite 构建。

## 功能

- 通过 `ccusage --help` 动态发现支持的 AI 工具。
- 支持在设置中选择启用的 AI 工具。
- 支持时间范围筛选：当天、最近 1/3/7/15/30 天。
- 顶部汇总卡片展示输入 Token、输出 Token、缓存 Token 和预估成本。
- 每日趋势图和模型 Token 用量图，模型图支持在输入、输出、缓存指标之间切换。
- 会话表格支持按 session id 搜索，并可按最后活跃时间、输入 Token、输出 Token 排序。
- 支持跟随 macOS 系统浅色/深色主题。
- 首次运行时，如果检测到 Node.js v20+ 但未安装 `ccusage`，应用会提示安装。

## 环境要求

- Node.js v20 或更高版本。
- Rust/Cargo，用于 Tauri 桌面端构建。
- 可选：全局安装 `ccusage`。应用也可以提示执行：

```bash
npm install -g ccusage
```

## 开发

```bash
npm install
npm run dev
```

Vite 前端开发地址为 `http://127.0.0.1:1420/`。纯浏览器开发会使用模拟数据；真实的 `ccusage` 命令集成通过 Tauri shell 执行。

运行桌面应用：

```bash
npm run tauri dev
```

构建前端：

```bash
npm run build
```

构建 macOS 应用：

```bash
npm run tauri build
```

构建可安装的 macOS 包：

```bash
npm run package:mac -- --target aarch64
npm run package:mac -- --target x86_64
npm run package:mac -- --target universal
```

如果构建 Intel 或 universal 包时缺少 Rust target，可以先安装：

```bash
rustup target add x86_64-apple-darwin
```

## 测试

```bash
npm test
```

Rust 命令层单元测试位于 `src-tauri/src/lib.rs`，安装 Rust 后可执行：

```bash
cd src-tauri
cargo test
```
