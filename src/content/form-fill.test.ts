// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldMapping } from "../libs/types";
import { applyFieldMappings, undoFillSnapshot } from "./form-fill";

function mapping(overrides: Partial<FieldMapping>): FieldMapping {
  return {
    id: "mapping-name",
    responseKey: "name",
    responseValue: "Ada Lovelace",
    matchType: "name",
    status: "matched",
    confidence: 0.9,
    enabled: true,
    ...overrides,
  };
}

describe("form fill", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  it("fills fields with quoted attribute values without selector errors", () => {
    document.body.innerHTML = '<input name=\'applicant"name\' value="Before">';
    const input = document.querySelector("input") as HTMLInputElement;
    const inputEvents: string[] = [];
    input.addEventListener("input", () => inputEvents.push("input"));
    input.addEventListener("change", () => inputEvents.push("change"));

    const result = applyFieldMappings([mapping({ fieldName: 'applicant"name' })]);

    expect(result).toMatchObject({ success: true, filledCount: 1, errors: [] });
    expect(input.value).toBe("Ada Lovelace");
    expect(inputEvents).toEqual(["input", "change"]);
  });

  it("captures and restores the previous value", () => {
    document.body.innerHTML = '<label for="email">Email</label><input id="email" value="before@example.com">';
    const input = document.querySelector("input") as HTMLInputElement;
    const applied = applyFieldMappings([mapping({ fieldId: "email", responseValue: "after@example.com" })]);

    expect(input.value).toBe("after@example.com");
    expect(undoFillSnapshot(applied.snapshot)).toMatchObject({ success: true, restoredCount: 1, errors: [] });
    expect(input.value).toBe("before@example.com");
  });

  it("reports missing fields without stopping other mappings", () => {
    document.body.innerHTML = '<input id="email">';
    const result = applyFieldMappings([
      mapping({ id: "missing", responseKey: "missing", fieldId: "missing" }),
      mapping({ id: "email", responseKey: "email", fieldId: "email", responseValue: "ada@example.com" }),
    ]);

    expect(result.success).toBe(false);
    expect(result.filledCount).toBe(1);
    expect(result.errors).toEqual(["Unable to locate field for key: missing"]);
  });

  it("fills selects and matching radio values", () => {
    document.body.innerHTML = `
      <select id="country"><option value="us">United States</option><option value="gb">United Kingdom</option></select>
      <input id="plan-pro" type="radio" name="plan" value="pro">
    `;

    const result = applyFieldMappings([
      mapping({ id: "country", responseKey: "country", fieldId: "country", responseValue: "United Kingdom" }),
      mapping({ id: "plan", responseKey: "plan", fieldId: "plan-pro", responseValue: "pro" }),
    ]);

    expect(result).toMatchObject({ success: true, filledCount: 2, errors: [] });
    expect((document.querySelector("select") as HTMLSelectElement).value).toBe("gb");
    expect((document.querySelector("input") as HTMLInputElement).checked).toBe(true);
  });

  it("skips unsupported file inputs and continues filling", () => {
    document.body.innerHTML = '<input id="resume" type="file"><input id="email">';

    const result = applyFieldMappings([
      mapping({ id: "resume", responseKey: "resume", fieldId: "resume", responseValue: "/tmp/resume.pdf" }),
      mapping({ id: "email", responseKey: "email", fieldId: "email", responseValue: "ada@example.com" }),
    ]);

    expect(result.success).toBe(false);
    expect(result.filledCount).toBe(1);
    expect(result.errors).toEqual(["Unable to apply value for key: resume"]);
  });
});
