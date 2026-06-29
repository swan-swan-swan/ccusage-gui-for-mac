import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appCss = readFileSync(new URL("./App.css", import.meta.url), "utf8");

describe("App chart CSS", () => {
  it("keeps generated Recharts hover cursor SVG invisible", () => {
    expect(appCss).toContain(".recharts-tooltip-cursor");
    expect(appCss).toMatch(/\.recharts-tooltip-cursor[\s\S]*display:\s*none\s*!important/);
    expect(appCss).toMatch(/\.recharts-tooltip-cursor[\s\S]*fill:\s*transparent\s*!important/);
    expect(appCss).toMatch(/\.recharts-tooltip-cursor[\s\S]*fill-opacity:\s*0\s*!important/);
  });

  it("keeps the Recharts default tooltip on the app theme", () => {
    expect(appCss).toContain(".recharts-default-tooltip");
    expect(appCss).toMatch(/\.recharts-default-tooltip[\s\S]*background:\s*var\(--surface\)\s*!important/);
    expect(appCss).toMatch(/\.recharts-default-tooltip[\s\S]*border:\s*1px solid var\(--border\)\s*!important/);
    expect(appCss).toMatch(/\.recharts-default-tooltip[\s\S]*color:\s*var\(--text\)\s*!important/);
  });
});
