import { FieldMapping, FormData, FormField, ParsedAIResponse } from "./types";

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function includesNormalized(haystack: string, needle: string): boolean {
  if (!haystack || !needle) {
    return false;
  }

  return haystack.includes(needle) || needle.includes(haystack);
}

function scoreField(key: string, field: FormField): { score: number; matchType: FieldMapping["matchType"] } {
  const normalizedKey = normalizeText(key);

  if (!normalizedKey) {
    return { score: 0, matchType: "unmatched" };
  }

  if (normalizeText(field.id) === normalizedKey) {
    return { score: 1, matchType: "field_id" };
  }

  if (normalizeText(field.label) === normalizedKey) {
    return { score: 0.95, matchType: "label" };
  }

  if (normalizeText(field.name) === normalizedKey) {
    return { score: 0.9, matchType: "name" };
  }

  if (normalizeText(field.placeholder) === normalizedKey) {
    return { score: 0.85, matchType: "placeholder" };
  }

  if (normalizeText(field.ariaLabel) === normalizedKey) {
    return { score: 0.8, matchType: "aria_label" };
  }

  if (includesNormalized(normalizeText(field.label), normalizedKey)) {
    return { score: 0.72, matchType: "fuzzy" };
  }

  if (includesNormalized(normalizeText(field.name), normalizedKey)) {
    return { score: 0.68, matchType: "fuzzy" };
  }

  if (includesNormalized(normalizeText(field.placeholder), normalizedKey)) {
    return { score: 0.64, matchType: "fuzzy" };
  }

  if (includesNormalized(normalizeText(field.ariaLabel), normalizedKey)) {
    return { score: 0.6, matchType: "fuzzy" };
  }

  return { score: 0, matchType: "unmatched" };
}

function createUnmatchedMapping(responseKey: string, responseValue: string): FieldMapping {
  return {
    id: `mapping_${responseKey}`,
    responseKey,
    responseValue,
    matchType: "unmatched",
    status: "unmatched",
    confidence: 0,
    enabled: false,
  };
}

export function buildFieldMappings(formData: FormData | undefined, parsed: ParsedAIResponse | undefined): FieldMapping[] {
  if (!formData || !parsed) {
    return [];
  }

  return Object.entries(parsed.values).map(([responseKey, responseValue]) => {
    const scored = formData.fields
      .map((field) => {
        const result = scoreField(responseKey, field);
        return {
          field,
          score: result.score,
          matchType: result.matchType,
        };
      })
      .sort((first, second) => second.score - first.score);

    const best = scored[0];

    if (!best || best.score <= 0) {
      return createUnmatchedMapping(responseKey, responseValue);
    }

    const secondBest = scored[1];
    const isConflict = !!secondBest && Math.abs(best.score - secondBest.score) < 0.03 && best.score < 0.9;

    return {
      id: `mapping_${best.field.id}_${responseKey}`,
      responseKey,
      responseValue,
      fieldId: best.field.id,
      selector: best.field.selector,
      fieldName: best.field.name,
      fieldLabel: best.field.label,
      fieldPlaceholder: best.field.placeholder,
      fieldAriaLabel: best.field.ariaLabel,
      matchType: best.matchType,
      status: isConflict ? "conflict" : "matched",
      confidence: Number(best.score.toFixed(2)),
      enabled: !isConflict,
    };
  });
}

export function getEnabledMappings(mappings: FieldMapping[] = []): FieldMapping[] {
  return mappings.filter((mapping) => mapping.enabled && mapping.status !== "unmatched");
}
