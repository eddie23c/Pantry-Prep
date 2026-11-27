import { describe, expect, it } from "vitest";
import { feedbackLink } from "./feedback";

describe("feedback link", () => {
  it("opens email with the note and version when an address is set", () => {
    const url = feedbackLink("  Scan missed soup ", "0.1.0", { email: "hello@example.com", issues: "https://x/issues/new" });
    expect(url.startsWith("mailto:hello@example.com?subject=Pantry%20Prep%20feedback&body=")).toBe(true);
    expect(decodeURIComponent(url.split("body=")[1])).toBe("Scan missed soup\n\n(Pantry Prep 0.1.0)");
  });
  it("falls back to a GitHub issue", () => {
    const url = feedbackLink("Hi", "0.1.0", { email: "", issues: "https://x/issues/new" });
    expect(url.startsWith("https://x/issues/new?title=Pantry%20Prep%20feedback&body=Hi")).toBe(true);
  });
});
