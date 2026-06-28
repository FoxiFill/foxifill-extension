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
    return window.location.hostname.includes("chatgpt.com") || window.location.hostname.includes("chat.openai.com");
  }

  /**
   * Check if current page is DeepSeek
   */
  static isDeepSeek(): boolean {
    return window.location.hostname.includes("chat.deepseek.com") || window.location.hostname.includes("deepseek.com");
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

/**
 * Clean HTML by removing script and style tags
 */
function cleanHtml(html: string): string {
  // 移除所有的 <script> 标签及其内容
  let cleanedHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // 移除所有的 <style> 标签及其内容
  cleanedHtml = cleanedHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  return cleanedHtml;
}

/**
 * Generate prompt for AI with form data (including screenshot)
 */
export function generatePrompt(html: string, screenshot: string): string {
  // 清理HTML，移除script和style标签
  const cleanedHtml = cleanHtml(html);

  const prompt = `你是一个表单填写助手。请分析我提供的网页HTML和截图，提取表单中的每个字段，并为这些字段生成合理的填写建议。

请按照以下要求：
1. 识别所有表单字段（input, select, textarea等）
2. 为每个字段生成合适的示例数据
3. 返回JSON格式，键是字段的唯一ID（我已经为每个表单元素添加了唯一ID），值是建议填写的内容
4. 最后添加 "foxifill_status": "completed" 表示处理完成

网页HTML（已处理，所有表单元素都有唯一ID）：
\`\`\`html
${cleanedHtml}
\`\`\`

截图数据（base64）：
${screenshot}

请返回JSON格式的结果：
{
  "field_id_1": "建议值1",
  "field_id_2": "建议值2",
  "foxifill_status": "completed"
}`;

  return prompt;
}
