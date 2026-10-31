import { describe, expect, it } from "vitest";
import { validateAIResponse, validateFormData } from "./schema";

describe("schema validation compatibility", () => {
  it("preserves complete AI responses and their string fields", () => {
    const input = { foxifill_status: "completed", name: "Alice", notes: "中文\nSecond line" };
    expect(validateAIResponse(input)).toEqual({ success: true, data: input });
  });

  it.each([null, {}, { foxifill_status: "pending" }, { foxifill_status: "completed", age: 42 }])(
    "reports invalid AI data without throwing for %j",
    (input) => {
      const result = validateAIResponse(input);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Invalid AI response format: .+/);
      expect(result.data).toBeUndefined();
    },
  );

  it("preserves valid forms, optional fields and field order", () => {
    const input = {
      url: "https://example.com/form",
      html: "<form></form>",
      screenshot: "",
      fields: [
        { id: "name", type: "text", selector: "#name", value: "Alice" },
        { id: "email", type: "email", selector: "#email" },
      ],
      timestamp: 1735689600000,
    };
    expect(validateFormData(input)).toEqual({ success: true, data: input });
  });

  it.each([null, {}, { url: "not a URL", fields: [] }])(
    "reports invalid forms without throwing for %j",
    (input) => {
      const result = validateFormData(input);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Invalid form data: .+/);
      expect(result.data).toBeUndefined();
    },
  );
});
