import { describe, expect, it } from "vitest";
import { sanitizePlainText } from "./sanitize.js";

describe("sanitizePlainText", () => {
  it("escapes HTML and trims", () => {
    expect(sanitizePlainText(`  <b>hi</b>  `, 100)).toBe("&lt;b&gt;hi&lt;/b&gt;");
  });

  it("respects max length after trim", () => {
    expect(sanitizePlainText("abcdef", 3)).toBe("abc");
  });
});
