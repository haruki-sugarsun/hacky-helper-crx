import { describe, expect, it } from "vitest";
import "./session-metadata";

if (
  typeof CSSStyleSheet !== "undefined" &&
  !CSSStyleSheet.prototype.replaceSync
) {
  Object.defineProperty(CSSStyleSheet.prototype, "replaceSync", {
    value: () => undefined,
  });
}

describe("SessionMetadataComponent", () => {
  it("renders a session summary when one is provided", () => {
    const element = document.createElement("session-metadata");
    element.setAttribute("summary", "Frontend documentation");

    const summary = element.shadowRoot?.querySelector(".summary");

    expect(summary?.textContent).toBe("Summary: Frontend documentation");
  });

  it("leaves the summary empty when it is not provided", () => {
    const element = document.createElement("session-metadata");

    const summary = element.shadowRoot?.querySelector(".summary");

    expect(summary?.textContent).toBe("");
  });
});
