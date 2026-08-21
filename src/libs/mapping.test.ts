import { describe, expect, it } from "vitest";
import { buildFieldMappings, getEnabledMappings } from "./mapping";
import { FormData, ParsedAIResponse } from "./types";

const formData: FormData = {
  url: "https://example.com/form",
  html: "<form></form>",
  screenshot: "",
  timestamp: 1,
  fields: [
    { id: "full-name", type: "text", label: "Full Name", name: "name", selector: "#full-name" },
    { id: "email", type: "email", label: "Email address", name: "email", selector: "#email" },
  ],
};

function response(values: Record<string, string>): ParsedAIResponse {
  return { foxifill_status: "completed", values, raw: { foxifill_status: "completed", ...values } };
}

describe("buildFieldMappings", () => {
  it("prefers exact field ids and labels", () => {
    const mappings = buildFieldMappings(formData, response({ "full-name": "Ada Lovelace", "Email address": "ada@example.com" }));

    expect(mappings).toMatchObject([
      { fieldId: "full-name", matchType: "field_id", status: "matched", enabled: true },
      { fieldId: "email", matchType: "label", status: "matched", enabled: true },
    ]);
  });

  it("keeps unmatched values disabled", () => {
    const mappings = buildFieldMappings(formData, response({ portfolio: "https://example.com" }));

    expect(mappings[0]).toMatchObject({ status: "unmatched", confidence: 0, enabled: false });
    expect(getEnabledMappings(mappings)).toEqual([]);
  });
});
