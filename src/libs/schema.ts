import { z } from "zod";
import { parseAIResponseText } from "./ai-parser";

/**
 * Schema definitions for validating AI responses and form data
 */

// AI Response schema
export const AIResponseSchema = z
  .object({
    foxifill_status: z.literal("completed"),
  })
  .catchall(z.string()); // Allow any additional string fields

// Form field schema
export const FormFieldSchema = z.object({
  id: z.string(),
  originalId: z.string().optional(),
  name: z.string().optional(),
  type: z.string(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  ariaLabel: z.string().optional(),
  value: z.string().optional(),
  selector: z.string(),
});

// Form data schema
export const FormDataSchema = z.object({
  url: z.string().url(),
  html: z.string(),
  screenshot: z.string(),
  fields: z.array(FormFieldSchema),
  timestamp: z.number(),
});

// Extension state schema
export const ExtensionStateSchema = z.object({
  isCapturing: z.boolean(),
  isProcessing: z.boolean(),
  currentFormData: FormDataSchema.nullable(),
  lastAIResponse: AIResponseSchema.nullable(),
  error: z.string().nullable(),
});

// Settings schema
export const SettingsSchema = z.object({
  chatgptUrl: z.string().url(),
  autoDetect: z.boolean(),
});

/**
 * Validate AI response from ChatGPT
 */
export function validateAIResponse(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const parsed = AIResponseSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Invalid AI response format: ${error.errors.map((e) => e.message).join(", ")}`,
      };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

/**
 * Validate form data
 */
export function validateFormData(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const parsed = FormDataSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Invalid form data: ${error.errors.map((e) => e.message).join(", ")}`,
      };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

/**
 * Parse JSON safely with validation
 */
export function parseJSONSafely(jsonString: string): { success: boolean; data?: any; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON format",
    };
  }
}

/**
 * Extract JSON from text (useful for parsing AI responses that may have extra text)
 */
export function extractJSONFromText(text: string): { success: boolean; data?: any; error?: string } {
  const parsed = parseAIResponseText(text);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
    };
  }

  return {
    success: true,
    data: parsed.data?.raw,
  };
}
