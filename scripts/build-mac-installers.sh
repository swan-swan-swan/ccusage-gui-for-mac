#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUESTED_TARGET="${MAC_PACKAGE_TARGET:-host}"
DRY_RUN=false

cd "$ROOT_DIR"
APP_VERSION="$(node -p 'require("./package.json").version')"
APP_IDENTIFIER="$(node -p 'require("./src-tauri/tauri.conf.json").identifier')"

usage() {
  cat <<'USAGE'
Usage: scripts/build-mac-installers.sh [--target host|aarch64|arm64|x86_64|intel|universal] [--dry-run]

Examples:
  scripts/build-mac-installers.sh --target aarch64
  scripts/build-mac-installers.sh --target x86_64
  MAC_PACKAGE_TARGET=universal scripts/build-mac-installers.sh
USAGE
}

create_applications_shortcut() {
  local target_dir="$1"

  rm -f "$target_dir/Applications"
  if osascript - "$target_dir" >/dev/null 2>&1 <<'APPLESCRIPT'
on run argv
  set dmgFolderPath to item 1 of argv
  tell application "Finder"
    make new alias file at (POSIX file dmgFolderPath as alias) to (POSIX file "/Applications" as alias) with properties {name:"Applications"}
  end tell
end run
APPLESCRIPT
  then
    return
  fi

  echo "Warning: failed to create a Finder Applications alias; falling back to a symlink." >&2
  rm -f "$target_dir/Applications"
  ln -s /Applications "$target_dir/Applications"
}

apply_applications_shortcut_icon() {
  local shortcut_path="$1"
  local icon_path="/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ApplicationsFolderIcon.icns"

  if [[ ! -f "$icon_path" ]]; then
    echo "Warning: Applications folder icon not found: $icon_path" >&2
    return
  fi

  if ! command -v swift >/dev/null 2>&1; then
    echo "Warning: swift was not found; the DMG Applications shortcut may use a generic icon." >&2
    return
  fi

  if ! swift -e 'import AppKit
let iconPath = CommandLine.arguments[1]
let filePath = CommandLine.arguments[2]
guard let icon = NSImage(contentsOfFile: iconPath) else { exit(2) }
exit(NSWorkspace.shared.setIcon(icon, forFile: filePath, options: []) ? 0 : 1)' "$icon_path" "$shortcut_path" >/dev/null 2>&1
  then
    echo "Warning: failed to apply the Applications shortcut icon." >&2
  fi
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
DMG_STAGING_DIR="$BUNDLE_ROOT/dmg-stage"
DMG_STAGED_APP="$DMG_STAGING_DIR/CCusage GUI.app"
PKG_COMPONENT_DIR="$BUNDLE_ROOT/pkg-component"
PKG_COMPONENT_PATH="$PKG_COMPONENT_DIR/ccusage-gui_${APP_VERSION}_${PACKAGE_ARCH}-component.pkg"
PKG_ROOT_DIR="$BUNDLE_ROOT/pkg-stage-root"
PKG_ROOT_APP="$PKG_ROOT_DIR/Applications/CCusage GUI.app"
PKG_PRODUCT_DIR="$BUNDLE_ROOT/pkg-product"
PKG_RESOURCES_DIR="$PKG_PRODUCT_DIR/resources"
PKG_COMPONENT_PLIST_PATH="$PKG_PRODUCT_DIR/component.plist"
PKG_DISTRIBUTION_PATH="$PKG_PRODUCT_DIR/Distribution.xml"
PKG_CONCLUSION_PATH="$PKG_RESOURCES_DIR/conclusion.html"
PKG_COMPONENT_IDENTIFIER="${APP_IDENTIFIER}.component"
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
rm -rf "$DMG_STAGING_DIR" "$PKG_COMPONENT_DIR" "$PKG_ROOT_DIR" "$PKG_PRODUCT_DIR"

mkdir -p "$DMG_STAGING_DIR" "$PKG_COMPONENT_DIR" "$PKG_ROOT_DIR/Applications" "$PKG_RESOURCES_DIR"
ditto "$APP_PATH" "$DMG_STAGED_APP"
create_applications_shortcut "$DMG_STAGING_DIR"
apply_applications_shortcut_icon "$DMG_STAGING_DIR/Applications"
ditto "$APP_PATH" "$PKG_ROOT_APP"

hdiutil create -volname "CCusage GUI" -srcfolder "$DMG_STAGING_DIR" -ov -format UDZO "$DMG_PATH"

cat > "$PKG_COMPONENT_PLIST_PATH" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
  <dict>
    <key>BundleHasStrictIdentifier</key>
    <true/>
    <key>BundleIsRelocatable</key>
    <false/>
    <key>BundleIsVersionChecked</key>
    <false/>
    <key>BundleOverwriteAction</key>
    <string>upgrade</string>
    <key>RootRelativeBundlePath</key>
    <string>Applications/CCusage GUI.app</string>
  </dict>
</array>
</plist>
EOF

pkgbuild \
  --root "$PKG_ROOT_DIR" \
  --install-location / \
  --component-plist "$PKG_COMPONENT_PLIST_PATH" \
  --identifier "$PKG_COMPONENT_IDENTIFIER" \
  --version "$APP_VERSION" \
  "$PKG_COMPONENT_PATH"

cat > "$PKG_DISTRIBUTION_PATH" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="1">
  <title>CCusage GUI</title>
  <options customize="never" require-scripts="false"/>
  <conclusion file="conclusion.html"/>
  <choices-outline>
    <line choice="default"/>
  </choices-outline>
  <choice id="default" title="CCusage GUI">
    <pkg-ref id="$PKG_COMPONENT_IDENTIFIER"/>
  </choice>
  <pkg-ref id="$PKG_COMPONENT_IDENTIFIER" version="$APP_VERSION" onConclusion="none">$(basename "$PKG_COMPONENT_PATH")</pkg-ref>
</installer-gui-script>
EOF

cat > "$PKG_CONCLUSION_PATH" <<'EOF'
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font: 13px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <h1>CCusage GUI is installed</h1>
    <p>Open it from Launchpad, or choose Finder &gt; Applications and double-click CCusage GUI.</p>
  </body>
</html>
EOF

productbuild \
  --distribution "$PKG_DISTRIBUTION_PATH" \
  --resources "$PKG_RESOURCES_DIR" \
  --package-path "$PKG_COMPONENT_DIR" \
  "$PKG_PATH"

echo "Created:"
echo "$APP_PATH"
echo "$DMG_PATH"
echo "$PKG_PATH"
