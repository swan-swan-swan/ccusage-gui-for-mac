import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("../", import.meta.url));
const scriptPath = fileURLToPath(new URL("../scripts/build-mac-installers.sh", import.meta.url));

describe("mac installer build script", () => {
  it("supports Intel macOS installer paths in dry-run mode", async () => {
    const fakeBinDir = mkdtempSync(join(tmpdir(), "ccusage-gui-package-test-"));
    writeFileSync(join(fakeBinDir, "npm"), "#!/bin/sh\necho fake npm should not run >&2\nexit 1\n", { mode: 0o755 });

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
    expect(stdout).toContain("dmg_path=src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/ccusage-gui_1.0.0_x86_64.dmg");
    expect(stdout).toContain("pkg_path=src-tauri/target/x86_64-apple-darwin/release/bundle/pkg/ccusage-gui_1.0.0_x86_64.pkg");
    expect(stdout).toContain("build_command=npm run tauri -- build --target x86_64-apple-darwin");
  });
});
