/**
 * Clipboard utility functions
 */
export class Clipboard {
  /**
   * Write text to clipboard (content script version)
   */
  static async writeText(text: string): Promise<void> {
    try {
      // 在 content script 中使用 document.execCommand 作为后备方案
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 后备方案：使用 document.execCommand
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error("Failed to copy text using execCommand");
        }
      }
    } catch (error) {
      console.error("Failed to write to clipboard:", error);
      throw error;
    }
  }

  /**
   * Read text from clipboard
   */
  static async readText(): Promise<string> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      } else {
        throw new Error("Clipboard read not supported in this context");
      }
    } catch (error) {
      console.error("Failed to read from clipboard:", error);
      throw error;
    }
  }

  /**
   * Write image to clipboard (for screenshots)
   */
  static async writeImage(dataUrl: string): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        throw new Error("Image clipboard write not supported in this context");
      }
    } catch (error) {
      console.error("Failed to write image to clipboard:", error);
      throw error;
    }
  }

  /**
   * Check if clipboard API is available
   */
  static isAvailable(): boolean {
    return "clipboard" in navigator;
  }
}

/**
 * Page type detection utilities
 */
export class PageDetector {
  /**
   * Check if current page is a form page
   */
  static isFormPage(): boolean {
    const formElements = document.querySelectorAll("form, input, select, textarea");
    return formElements.length > 0;
  }

  /**
   * Check if current page is ChatGPT
   */
  static isChatGPT(): boolean {
    return isHostOrSubdomain(window.location.hostname, "chatgpt.com") || isHostOrSubdomain(window.location.hostname, "chat.openai.com");
  }

  /**
   * Check if current page is DeepSeek
   */
  static isDeepSeek(): boolean {
    return isHostOrSubdomain(window.location.hostname, "deepseek.com");
  }

  /**
   * Check if current page is an AI model page
   */
  static isAIModelPage(): boolean {
    return this.isChatGPT() || this.isDeepSeek();
  }

  /**
   * Get page type
   */
  static getPageType(): "form" | "chatgpt" | "deepseek" | "other" {
    if (this.isChatGPT()) {
      return "chatgpt";
    } else if (this.isDeepSeek()) {
      return "deepseek";
    } else if (this.isFormPage()) {
      return "form";
    } else {
      return "other";
    }
  }
}

export function isHostOrSubdomain(hostname: string, allowedDomain: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  const normalizedDomain = allowedDomain.toLowerCase().replace(/\.$/, "");

  return normalizedHostname === normalizedDomain || normalizedHostname.endsWith(`.${normalizedDomain}`);
}
