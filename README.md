# ccusage-gui-for-mac

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

Mac desktop dashboard for `ccusage` token usage. The app is built with Tauri, React, TypeScript, and Vite.

## Features

- Dynamic AI tool discovery from `ccusage --help`.
- User settings for active AI tools.
- Time range presets: today, last 1/3/7/15/30 days.
- Summary cards for input, output, cache, total tokens, and estimated cost.
- Daily trend and model token usage charts with input/output/cache metric switching.
- Session table with session id search and sorting by last active, input tokens, and output tokens.
- macOS light/dark theme via system color scheme.
- First-run `ccusage` install prompt when Node.js v20+ exists and `ccusage` is missing.

## Requirements

- Node.js v20 or newer.
- Rust/Cargo for Tauri desktop builds.
- Optional: `ccusage` installed globally. The app can prompt to run:

```bash
npm install -g ccusage
```

## Development

```bash
npm install
npm run dev
```

The Vite UI is available at `http://127.0.0.1:1420/`. Browser-only development uses mock data; the real `ccusage` command integration runs through the Tauri shell.

Run the desktop app:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Build the Mac app:

```bash
npm run tauri build
```

Build installable macOS packages:

```bash
npm run package:mac -- --target aarch64
npm run package:mac -- --target x86_64
npm run package:mac -- --target universal
```

## Tests

```bash
npm test
```

Rust command-layer unit tests are included in `src-tauri/src/lib.rs` and run with Cargo once Rust is installed:

```bash
cd src-tauri
cargo test
```
