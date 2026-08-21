// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { sanitizeFormHtml } from "./html-sanitizer";

describe("sanitizeFormHtml", () => {
  it("removes executable markup and preserves useful form context", () => {
    const html = `
      <form id="profile" onsubmit="steal()">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" placeholder="name@example.com" onfocus="steal()">
        <script type="text/javascript">window.stolen = true</script>
        <style>body { display: none }</style>
      </form>
    `;

    const result = sanitizeFormHtml(html);

    expect(result).toContain('<form id="profile">');
    expect(result).toContain('<label for="email">Email</label>');
    expect(result).toContain('name="email"');
    expect(result).toContain('placeholder="name@example.com"');
    expect(result).not.toMatch(/script|style|onsubmit|onfocus|window\.stolen/i);
  });

  it("handles mixed-case and malformed dangerous tags", () => {
    const result = sanitizeFormHtml(
      '<form><ScRiPt data-value=">">attack()</ScRiPt><style media="all">attack-style</style><input name="safe"></form>',
    );

    expect(result).toContain('<input name="safe">');
    expect(result).not.toMatch(/attack|script|style/i);
  });
});
