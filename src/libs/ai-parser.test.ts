import { describe, expect, it } from "vitest";
import { parseAIResponseText } from "./ai-parser";

describe("parseAIResponseText", () => {
  it("parses a fenced response and normalizes primitive values", () => {
    const result = parseAIResponseText(`Result:\n\`\`\`json\n{"foxifill_status":"completed","name":"Ada","age":36,"active":true}\n\`\`\``);

    expect(result).toMatchObject({
      success: true,
      data: {
        values: { name: "Ada", age: "36", active: "true" },
      },
    });
  });

  it("handles braces and escaped quotes inside JSON strings", () => {
    const payload = JSON.stringify({ foxifill_status: "completed", bio: 'Builds {reliable} "tools"' });
    const result = parseAIResponseText(`Use ${payload} now.`);

    expect(result.data?.values.bio).toBe('Builds {reliable} "tools"');
  });

  it("rejects payloads without an explicit completed status", () => {
    expect(parseAIResponseText('{"foxifill_status":"pending","name":"Ada"}')).toEqual({
      success: false,
      error: "No valid AI JSON payload found",
    });
  });
});
