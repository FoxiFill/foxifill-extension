import { ParsedAIResponse } from "./types";

interface ParseResult {
  success: boolean;
  data?: ParsedAIResponse;
  error?: string;
}

function collectJsonCandidates(text: string): string[] {
  const candidates: string[] = [];

  const fencedBlocks = Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi));
  for (const match of fencedBlocks) {
    const block = match[1]?.trim();
    if (block) {
      candidates.push(block);
    }
  }

  const stack: number[] = [];
  let start = -1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "{") {
      if (stack.length === 0) {
        start = index;
      }
      stack.push(index);
      continue;
    }

    if (char === "}") {
      if (stack.length === 0) {
        continue;
      }

      stack.pop();
      if (stack.length === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    candidates.unshift(trimmed);
  }

  return Array.from(new Set(candidates));
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function normalizeRecord(record: Record<string, unknown>): ParseResult {
  if (record.foxifill_status !== "completed") {
    return {
      success: false,
      error: "Missing or invalid foxifill_status=completed",
    };
  }

  const values: Record<string, string> = {};

  Object.entries(record).forEach(([key, value]) => {
    if (key === "foxifill_status") {
      return;
    }

    values[key] = normalizeValue(value);
  });

  return {
    success: true,
    data: {
      foxifill_status: "completed",
      values,
      raw: record,
    },
  };
}

export function parseAIResponseText(input: string): ParseResult {
  const candidates = collectJsonCandidates(input);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const record = toRecord(parsed);
      if (!record) {
        continue;
      }

      const normalized = normalizeRecord(record);
      if (normalized.success) {
        return normalized;
      }
    } catch {
      // Ignore invalid candidate and continue.
    }
  }

  return {
    success: false,
    error: "No valid AI JSON payload found",
  };
}
