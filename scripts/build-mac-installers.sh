#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUESTED_TARGET="${MAC_PACKAGE_TARGET:-host}"
DRY_RUN=false

cd "$ROOT_DIR"
APP_VERSION="$(node -p 'require("./package.json").version')"

usage() {
  cat <<'USAGE'
Usage: scripts/build-mac-installers.sh [--target host|aarch64|arm64|x86_64|intel|universal] [--dry-run]

Examples:
  scripts/build-mac-installers.sh --target aarch64
  scripts/build-mac-installers.sh --target x86_64
  MAC_PACKAGE_TARGET=universal scripts/build-mac-installers.sh
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --target)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --target" >&2
        usage >&2
        exit 1
      fi
      REQUESTED_TARGET="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    host|aarch64|arm64|x86_64|x64|intel|universal)
      REQUESTED_TARGET="$1"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

host_target() {
  case "$(uname -m)" in
    arm64|aarch64)
      echo "aarch64"
      ;;
    x86_64)
      echo "x86_64"
      ;;
    *)
      echo "Unsupported macOS architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
}

case "$REQUESTED_TARGET" in
  host)
    PACKAGE_ARCH="$(host_target)"
    ;;
  aarch64|arm64)
    PACKAGE_ARCH="aarch64"
    ;;
  x86_64|x64|intel)
    PACKAGE_ARCH="x86_64"
    ;;
  universal)
    PACKAGE_ARCH="universal"
    ;;
  *)
    echo "Unsupported target: $REQUESTED_TARGET" >&2
    usage >&2
    exit 1
    ;;
esac

case "$PACKAGE_ARCH" in
  aarch64)
    RUST_TARGET="aarch64-apple-darwin"
    REQUIRED_RUST_TARGETS=("aarch64-apple-darwin")
    ;;
  x86_64)
    RUST_TARGET="x86_64-apple-darwin"
    REQUIRED_RUST_TARGETS=("x86_64-apple-darwin")
    ;;
  universal)
    RUST_TARGET="universal-apple-darwin"
    REQUIRED_RUST_TARGETS=("aarch64-apple-darwin" "x86_64-apple-darwin")
    ;;
esac

BUNDLE_REL="src-tauri/target/${RUST_TARGET}/release/bundle"
BUNDLE_ROOT="$ROOT_DIR/$BUNDLE_REL"
MACOS_DIR="$BUNDLE_ROOT/macos"
APP_PATH="$MACOS_DIR/CCusage GUI.app"
DMG_DIR="$BUNDLE_ROOT/dmg"
PKG_DIR="$BUNDLE_ROOT/pkg"
DMG_REL="$BUNDLE_REL/dmg/ccusage-gui_${APP_VERSION}_${PACKAGE_ARCH}.dmg"
PKG_REL="$BUNDLE_REL/pkg/ccusage-gui_${APP_VERSION}_${PACKAGE_ARCH}.pkg"
DMG_PATH="$ROOT_DIR/$DMG_REL"
PKG_PATH="$ROOT_DIR/$PKG_REL"
BUILD_COMMAND=(npm run tauri -- build --target "$RUST_TARGET")

if [[ "$DRY_RUN" == true ]]; then
  echo "target=$RUST_TARGET"
  echo "arch=$PACKAGE_ARCH"
  echo "bundle_root=$BUNDLE_REL"
  echo "app_path=$BUNDLE_REL/macos/CCusage GUI.app"
  echo "dmg_path=$DMG_REL"
  echo "pkg_path=$PKG_REL"
  echo "build_command=${BUILD_COMMAND[*]}"
  exit 0
fi

for required_target in "${REQUIRED_RUST_TARGETS[@]}"; do
  if ! rustup target list --installed | grep -Fxq "$required_target"; then
    echo "Missing Rust target: $required_target" >&2
    echo "Run: rustup target add $required_target" >&2
    exit 1
  fi
done

rm -rf "$MACOS_DIR"
"${BUILD_COMMAND[@]}"

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH" >&2
  exit 1
fi

mkdir -p "$DMG_DIR" "$PKG_DIR"
rm -f "$DMG_PATH" "$PKG_PATH"

hdiutil create -volname "CCusage GUI" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
pkgbuild --component "$APP_PATH" --install-location /Applications "$PKG_PATH"

echo "Created:"
echo "$APP_PATH"
echo "$DMG_PATH"
echo "$PKG_PATH"
