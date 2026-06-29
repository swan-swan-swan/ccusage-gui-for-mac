import { describe, expect, it } from "vitest";
import { getEnvironmentAction, parseNodeMajorVersion } from "./environment";
import type { EnvironmentStatus } from "./types";

describe("environment checks", () => {
  it("parses node major versions", () => {
    expect(parseNodeMajorVersion("v22.22.0")).toBe(22);
    expect(parseNodeMajorVersion("20.11.1")).toBe(20);
    expect(parseNodeMajorVersion("node missing")).toBeNull();
  });

  it("prompts installation when node is valid and ccusage is missing", () => {
    expect(
      getEnvironmentAction({
        nodeInstalled: true,
        nodeVersion: "v22.22.0",
        nodeMajor: 22,
        nodeMeetsRequirement: true,
        ccusageInstalled: false,
        ccusageVersion: null,
      }),
    ).toBe("install-ccusage");
  });

  it("blocks when node is missing or too old", () => {
    const base: EnvironmentStatus = {
      nodeInstalled: false,
      nodeVersion: null,
      nodeMajor: null,
      nodeMeetsRequirement: false,
      ccusageInstalled: false,
      ccusageVersion: null,
    };

    expect(getEnvironmentAction(base)).toBe("node-required");
    expect(
      getEnvironmentAction({
        ...base,
        nodeInstalled: true,
        nodeVersion: "v18.19.0",
        nodeMajor: 18,
      }),
    ).toBe("node-required");
  });

  it("is ready when both dependencies are available", () => {
    expect(
      getEnvironmentAction({
        nodeInstalled: true,
        nodeVersion: "v22.22.0",
        nodeMajor: 22,
        nodeMeetsRequirement: true,
        ccusageInstalled: true,
        ccusageVersion: "20.0.14",
      }),
    ).toBe("ready");
  });
});
