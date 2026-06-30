import { execFile } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("../", import.meta.url));
const scriptPath = fileURLToPath(new URL("../scripts/build-mac-installers.sh", import.meta.url));

describe("mac installer build script", () => {
  function writeExecutable(path, contents) {
    writeFileSync(path, contents, { mode: 0o755 });
  }

  it("supports Intel macOS installer paths in dry-run mode", async () => {
    const fakeBinDir = mkdtempSync(join(tmpdir(), "ccusage-gui-package-test-"));
    writeExecutable(join(fakeBinDir, "npm"), "#!/bin/sh\necho fake npm should not run >&2\nexit 1\n");

    const { stdout } = await execFileAsync("bash", [scriptPath, "--dry-run", "--target", "x86_64"], {
      cwd: rootDir,
      env: {
        ...process.env,
        PATH: `${fakeBinDir}${delimiter}${process.env.PATH ?? ""}`,
      },
    });

    expect(stdout).toContain("target=x86_64-apple-darwin");
    expect(stdout).toContain("arch=x86_64");
    expect(stdout).toContain("bundle_root=src-tauri/target/x86_64-apple-darwin/release/bundle");
    expect(stdout).toContain("dmg_path=src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/ccusage-gui_1.1.0_x86_64.dmg");
    expect(stdout).toContain("pkg_path=src-tauri/target/x86_64-apple-darwin/release/bundle/pkg/ccusage-gui_1.1.0_x86_64.pkg");
    expect(stdout).toContain("build_command=npm run tauri -- build --target x86_64-apple-darwin");
  });

  it("builds DMG contents with the app and an Applications shortcut", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "ccusage-gui-package-root-"));
    const tempScriptDir = join(tempRoot, "scripts");
    const fakeBinDir = mkdtempSync(join(tmpdir(), "ccusage-gui-package-bin-"));

    mkdirSync(tempScriptDir, { recursive: true });
    mkdirSync(join(tempRoot, "src-tauri"), { recursive: true });
    copyFileSync(scriptPath, join(tempScriptDir, "build-mac-installers.sh"));
    writeFileSync(join(tempRoot, "package.json"), JSON.stringify({ version: "1.1.0" }));
    writeFileSync(join(tempRoot, "src-tauri", "tauri.conf.json"), JSON.stringify({ identifier: "com.youbi.ccusagegui" }));

    writeExecutable(
      join(fakeBinDir, "rustup"),
      `#!/bin/sh
if [ "$1" = "target" ] && [ "$2" = "list" ] && [ "$3" = "--installed" ]; then
  echo x86_64-apple-darwin
  exit 0
fi
exit 1
`,
    );

    writeExecutable(
      join(fakeBinDir, "npm"),
      `#!/bin/sh
mkdir -p "src-tauri/target/x86_64-apple-darwin/release/bundle/macos/CCusage GUI.app/Contents/MacOS"
touch "src-tauri/target/x86_64-apple-darwin/release/bundle/macos/CCusage GUI.app/Contents/MacOS/ccusage-gui-for-mac"
exit 0
`,
    );

    writeExecutable(
      join(fakeBinDir, "ditto"),
      `#!/bin/sh
mkdir -p "$2"
cp -R "$1/." "$2/"
exit 0
`,
    );

    writeExecutable(
      join(fakeBinDir, "osascript"),
      `#!/bin/sh
if [ "$1" != "-" ] || [ -z "$2" ]; then
  echo "osascript should receive the DMG staging path as an argument" >&2
  exit 42
fi
printf 'alias to /Applications\\n' > "$2/Applications"
exit 0
`,
    );

    writeExecutable(
      join(fakeBinDir, "swift"),
      `#!/bin/sh
last=""
for arg in "$@"; do
  last="$arg"
done
if [ ! -f "$last" ]; then
  echo "swift should receive the Applications alias path as its final argument" >&2
  exit 42
fi
printf '\\ncustom icon applied\\n' >> "$last"
exit 0
`,
    );

    writeExecutable(
      join(fakeBinDir, "hdiutil"),
      `#!/bin/sh
last=""
srcfolder=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-srcfolder" ]; then
    shift
    srcfolder="$1"
  fi
  last="$1"
  shift
done
if [ ! -d "$srcfolder/CCusage GUI.app" ]; then
  echo "missing app in DMG source: $srcfolder" >&2
  exit 42
fi
if [ ! -f "$srcfolder/Applications" ]; then
  echo "missing Applications Finder alias in DMG source: $srcfolder" >&2
  exit 42
fi
if [ -L "$srcfolder/Applications" ]; then
  echo "Applications shortcut should be a Finder alias, not a symlink" >&2
  exit 42
fi
if ! grep -q '/Applications' "$srcfolder/Applications"; then
  echo "Applications alias should point to /Applications" >&2
  exit 42
fi
if ! grep -q 'custom icon applied' "$srcfolder/Applications"; then
  echo "Applications alias should have a custom icon" >&2
  exit 42
fi
mkdir -p "$(dirname "$last")"
touch "$last"
exit 0
`,
    );

    writeExecutable(
      join(fakeBinDir, "pkgbuild"),
      `#!/bin/sh
last=""
root=""
install_location=""
component_plist=""
used_component=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --root)
      shift
      root="$1"
      ;;
    --install-location)
      shift
      install_location="$1"
      ;;
    --component)
      used_component=true
      shift
      ;;
    --component-plist)
      shift
      component_plist="$1"
      ;;
    *)
      last="$1"
      ;;
  esac
  shift
done
case "$last" in
  */pkg-component/*-component.pkg) ;;
  *)
    echo "pkgbuild should create a component package, got: $last" >&2
    exit 42
    ;;
esac
if [ "$used_component" = true ]; then
  echo "pkgbuild should use a fixed root payload, not --component" >&2
  exit 42
fi
if [ "$install_location" != "/" ]; then
  echo "pkgbuild should install the payload root at /, got: $install_location" >&2
  exit 42
fi
if [ ! -d "$root/Applications/CCusage GUI.app" ]; then
  echo "pkg root is missing Applications/CCusage GUI.app: $root" >&2
  exit 42
fi
if [ ! -f "$component_plist" ]; then
  echo "missing component plist: $component_plist" >&2
  exit 42
fi
if ! grep -A1 '<key>BundleIsRelocatable</key>' "$component_plist" | grep -q '<false/>'; then
  echo "component plist must disable bundle relocation" >&2
  exit 42
fi
mkdir -p "$(dirname "$last")"
touch "$last"
exit 0
`,
    );

    writeExecutable(
      join(fakeBinDir, "productbuild"),
      `#!/bin/sh
last=""
distribution=""
resources=""
package_path=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --distribution)
      shift
      distribution="$1"
      ;;
    --resources)
      shift
      resources="$1"
      ;;
    --package-path)
      shift
      package_path="$1"
      ;;
    *)
      last="$1"
      ;;
  esac
  shift
done
if [ ! -f "$distribution" ]; then
  echo "missing distribution: $distribution" >&2
  exit 42
fi
if ! grep -q '<conclusion file="conclusion.html"' "$distribution"; then
  echo "distribution is missing conclusion page" >&2
  exit 42
fi
if [ ! -f "$resources/conclusion.html" ]; then
  echo "missing conclusion resource" >&2
  exit 42
fi
if ! grep -q 'Applications' "$resources/conclusion.html"; then
  echo "conclusion should mention Applications" >&2
  exit 42
fi
if ! grep -q 'Launchpad' "$resources/conclusion.html"; then
  echo "conclusion should mention Launchpad" >&2
  exit 42
fi
if ! ls "$package_path"/*-component.pkg >/dev/null 2>&1; then
  echo "missing component package in package path: $package_path" >&2
  exit 42
fi
mkdir -p "$(dirname "$last")"
touch "$last"
exit 0
`,
    );

    const { stdout } = await execFileAsync("bash", [join(tempScriptDir, "build-mac-installers.sh"), "--target", "x86_64"], {
      cwd: tempRoot,
      env: {
        ...process.env,
        PATH: `${fakeBinDir}${delimiter}${process.env.PATH ?? ""}`,
      },
    });

    expect(stdout).toContain("Created:");
  }, 15000);
});
