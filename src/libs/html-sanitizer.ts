import DOMPurify from "dompurify";

/**
 * Keep form context needed by the AI workflow while removing executable or
 * unrelated markup at the shared prompt-generation boundary.
 */
export function sanitizeFormHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "style", "noscript", "template", "iframe", "object", "embed"],
    FORBID_ATTR: ["style", "srcdoc"],
  });
}
