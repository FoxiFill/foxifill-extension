import { PageDetector } from "../libs/clipboard";
import { Messaging } from "../libs/messaging";
import { applyFieldMappings, undoFillSnapshot } from "./form-fill";
import { AIResponse, FieldMapping, FillSnapshot, FormData, FormField, Message } from "../libs/types";

/**
 * Content script for FoxiFill extension
 * Handles form detection, field processing, and auto-filling
 */

console.log("FoxiFill content script loaded");

// Listen for messages from background script
Messaging.onMessage((message: Message, _sender, sendResponse) => {
  try {
    switch (message.type) {
      case "CAPTURE_FORM":
        handleFormCapture(message.payload)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Indicates async response

      case "FILL_FORM":
        handleFormFill(message.payload?.aiResponse)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Indicates async response

      case "APPLY_FIELD_MAPPINGS":
        handleApplyFieldMappings(message.payload?.mappings)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }));
        return true;

      case "UNDO_LAST_FILL":
        handleUndoLastFill(message.payload?.snapshot)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }));
        return true;

      case "HANDLE_FLOATING_ICON_CLICK":
        handleFloatingIconClick()
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Indicates async response

      case "PASTE_CONTENT":
        handleAIModelPaste(true) // Manual paste
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Indicates async response

      case "TOGGLE_FLOATING_ICON": {
        const { show } = message.payload || {};
        toggleFloatingIcon(show);
        sendResponse({ success: true });
        return true;
      }

      case "SHOW_TOAST": {
        const { message: toastMessage } = message.payload || {};
        if (toastMessage) {
          console.log("Toast message (suppressed):", toastMessage);
        }
        sendResponse({ success: true });
        return true;
      }

      case "STATE_UPDATE":
        // Acknowledge state updates without forwarding them back to the background script.
        console.log("Content script received STATE_UPDATE:", message.payload);
        sendResponse({ success: true });
        return true;

      case "WORKFLOW_STATE_UPDATE":
        sendResponse({ success: true });
        return true;

      default:
        sendResponse({ error: "Unknown message type" });
    }
  } catch (error) {
    console.error("Content script error:", error);
    sendResponse({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * Handle floating icon click based on page type
 */
async function handleFloatingIconClick(): Promise<any> {
  const pageType = PageDetector.getPageType();

  try {
    switch (pageType) {
      case "form": {
        const response = await Messaging.sendToBackground({
          type: "CAPTURE_FORM",
        });
        if (response && response.success) {
          await openAIModel();
          return { success: true, action: "captured_and_opened_ai_model" };
        } else {
          throw new Error("Failed to capture form data");
        }
      }

      case "chatgpt":
      case "deepseek":
        await handleAIModelPaste(true); // Manual paste via floating icon
        return { success: true, action: `pasted_to_${pageType}` };

      default:
        return { success: true, action: "generic_notification" };
    }
  } catch (error) {
    console.error("Error handling floating icon click:", error);
    throw error;
  }
}

/**
 * Open AI Model
 */
async function openAIModel(): Promise<void> {
  await Messaging.sendToBackground({
    type: "OPEN_MODEL",
  });
}

/**
 * Handle paste to AI Model
 */
async function handleAIModelPaste(isManualPaste = false): Promise<void> {
  try {
    if (!chrome.runtime?.id) {
      throw new Error("Extension context invalidated. Please reload the page.");
    }

    const clipboardData = await chrome.storage.local.get("clipboardData");
    if (!clipboardData.clipboardData) {
      throw new Error("No content to paste. Please capture a form first.");
    }

    console.log("Retrieved clipboard data:", clipboardData.clipboardData.substring(0, 200) + "...");

    // 如果是手动粘贴，清除自动粘贴状态，确保能够重新粘贴
    if (isManualPaste) {
      await chrome.storage.local.remove("autoPasteStatus");
      console.log("Manual paste: cleared auto-paste status to allow re-paste");

      // 手动粘贴时，确保图片数据也被正确恢复
      const imageData = await chrome.storage.local.get("clipboardImage");
      if (imageData.clipboardImage) {
        console.log("Manual paste: restoring image to clipboard...");
        await restoreImageToClipboard(imageData.clipboardImage);

        // 等待图片恢复完成
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } else {
      // 自动粘贴时，也恢复图片数据
      const imageData = await chrome.storage.local.get("clipboardImage");
      if (imageData.clipboardImage) {
        console.log("Auto paste: restoring image to clipboard...");
        await restoreImageToClipboard(imageData.clipboardImage);
      }
    }

    const inputSelectors = [
      '[data-testid="composer-textarea"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="消息"]',
      'textarea[placeholder*="Send a message"]',
      'div[contenteditable="true"]',
      "textarea",
      "#prompt-textarea",
    ];

    let inputElement: HTMLTextAreaElement | HTMLDivElement | null = null;

    for (const selector of inputSelectors) {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        inputElement = element as HTMLTextAreaElement | HTMLDivElement;
        break;
      }
    }

    if (!inputElement) {
      await navigator.clipboard.writeText(clipboardData.clipboardData);
      console.log("Content copied to clipboard. Please paste manually.");
      return;
    }

    inputElement.focus();

    if (inputElement.tagName === "TEXTAREA") {
      const textarea = inputElement as HTMLTextAreaElement;
      textarea.value = clipboardData.clipboardData;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (inputElement.contentEditable === "true") {
      const div = inputElement as HTMLDivElement;
      div.textContent = clipboardData.clipboardData;
      div.dispatchEvent(new Event("input", { bubbles: true }));
      div.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
    });
    inputElement.dispatchEvent(inputEvent);

    // 手动粘贴时，给更多时间让文本稳定，然后尝试粘贴图片
    const waitTime = isManualPaste ? 1200 : 800;
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    try {
      await autopasteImage(inputElement);
      const successMessage = isManualPaste ? "Text and image pasted successfully!" : "Text pasted successfully! Image should paste automatically in 2 seconds.";
      console.log(successMessage);
    } catch (imageError) {
      console.warn("Failed to auto-paste image:", imageError);
      const fallbackMessage = isManualPaste
        ? "Text pasted successfully! Please manually paste the screenshot using Cmd+V."
        : "Text pasted successfully! Please manually paste the screenshot using Cmd+V.";
      console.log(fallbackMessage);
    }

    // 如果是手动粘贴，也更新粘贴状态，防止页面刷新后自动粘贴
    if (isManualPaste) {
      let currentDataHash = "";
      try {
        if (clipboardData.clipboardData) {
          currentDataHash = clipboardData.clipboardData.length.toString() + "_" + clipboardData.clipboardData.substring(0, 10) + "_" + clipboardData.clipboardData.substring(-10);
        }
      } catch {
        currentDataHash = clipboardData.clipboardData?.length?.toString() || "";
      }

      if (currentDataHash) {
        await chrome.storage.local.set({
          autoPasteStatus: {
            lastPastedHash: currentDataHash,
            lastPastedTime: Date.now(),
          },
        });
      }
    }
  } catch (error) {
    console.error("Error in handleChatGPTPaste:", error);
    console.log("Failed to paste content. Please try again.");
  }
}

/**
 * Restore image from storage to clipboard
 */
async function restoreImageToClipboard(base64Image: string): Promise<void> {
  try {
    // 转换base64为Blob
    const byteCharacters = atob(base64Image.split(",")[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/png" });

    // 复制到剪贴板
    const clipboardItem = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([clipboardItem]);
    console.log("Image restored to clipboard from storage");
  } catch (error) {
    console.error("Failed to restore image to clipboard:", error);
  }
}

/**
 * Automatically paste image from clipboard using multiple methods
 */
async function autopasteImage(inputElement: HTMLElement): Promise<void> {
  try {
    // 等待一段时间让文本内容稳定
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("Starting auto-paste image process...");

    // 确保窗口和文档获得焦点
    window.focus();
    document.body.focus();

    // 确保输入框获得焦点
    inputElement.focus();
    inputElement.click();

    // 等待焦点确认
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 检查文档是否有焦点
    if (!document.hasFocus()) {
      console.log("Document doesn't have focus, using keyboard simulation only");
      await simulateKeyboardPaste(inputElement);
      return;
    }

    // 方法1：尝试直接从Clipboard API读取并粘贴图片
    try {
      const clipboardItems = await navigator.clipboard.read();
      console.log("Clipboard items found:", clipboardItems.length);

      for (const item of clipboardItems) {
        console.log("Clipboard item types:", item.types);

        // 检查是否有图片
        const imageTypes = item.types.filter((type) => type.startsWith("image/"));
        if (imageTypes.length > 0) {
          const imageType = imageTypes[0];
          const blob = await item.getType(imageType);
          console.log("Found image in clipboard:", imageType, blob.size, "bytes");

          // 创建一个包含图片的ClipboardEvent
          const dataTransfer = new DataTransfer();
          const file = new File([blob], "screenshot.png", { type: imageType });
          dataTransfer.items.add(file);

          const pasteEvent = new ClipboardEvent("paste", {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true,
          });

          inputElement.dispatchEvent(pasteEvent);
          console.log("Dispatched paste event with image data");
          return;
        }
      }
    } catch (clipboardError) {
      console.log("Direct clipboard access failed:", clipboardError);
    }

    // 方法2：使用键盘模拟作为备用方案
    await simulateKeyboardPaste(inputElement);
    console.log("Auto-paste image attempts completed");
  } catch (error) {
    console.error("Error auto-pasting image:", error);
    throw error;
  }
}

/**
 * Simulate keyboard paste more accurately
 */
async function simulateKeyboardPaste(inputElement: HTMLElement): Promise<void> {
  console.log("Using keyboard simulation for image paste...");

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  // 确保元素有焦点
  inputElement.focus();

  // 创建更真实的键盘事件序列
  const keydownEvent = new KeyboardEvent("keydown", {
    key: "v",
    keyCode: 86,
    code: "KeyV",
    ctrlKey: !isMac,
    metaKey: isMac,
    bubbles: true,
    cancelable: true,
  });

  const keyupEvent = new KeyboardEvent("keyup", {
    key: "v",
    keyCode: 86,
    code: "KeyV",
    ctrlKey: !isMac,
    metaKey: isMac,
    bubbles: true,
    cancelable: true,
  });

  // 按下键
  inputElement.dispatchEvent(keydownEvent);
  document.dispatchEvent(keydownEvent);

  await new Promise((resolve) => setTimeout(resolve, 50));

  // 释放键
  inputElement.dispatchEvent(keyupEvent);
  document.dispatchEvent(keyupEvent);

  await new Promise((resolve) => setTimeout(resolve, 100));

  // 触发paste事件
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
  });

  inputElement.dispatchEvent(pasteEvent);
  document.dispatchEvent(pasteEvent);
}

/**
 * Handle form capture with full page screenshot
 */
async function handleFormCapture(options: { takeFullPageScreenshot?: boolean } = {}): Promise<any> {
  try {
    const fields = findFormFields();

    if (fields.length === 0) {
      throw new Error("No form fields found on this page");
    }

    addUniqueIds(fields);
    // 只获取 body 部分的 HTML，减少数据大小
    const html = document.body.outerHTML;

    let screenshot = "";
    if (options.takeFullPageScreenshot) {
      screenshot = await takeFullPageScreenshot();
    }

    const formData: FormData = {
      url: window.location.href,
      html,
      screenshot,
      fields,
      timestamp: Date.now(),
    };

    console.log(`Captured ${fields.length} form fields with full page screenshot`);

    // 设置允许自动粘贴的标志位
    await chrome.storage.local.set({
      formCaptureStatus: {
        allowAutoPaste: true,
        captureTime: Date.now(),
        formDataHash: formData.timestamp.toString(),
      },
    });
    console.log("FoxiFill: Set form capture status - auto-paste allowed");

    return { success: true, formData };
  } catch (error) {
    console.error("Error capturing form:", error);
    throw error;
  }
}

/**
 * Handle form filling with AI response
 */
async function handleFormFill(aiResponse: AIResponse): Promise<any> {
  try {
    if (!aiResponse || aiResponse.foxifill_status !== "completed") {
      throw new Error("Invalid AI response");
    }

    const { foxifill_status: _foxifillStatus, ...fieldValues } = aiResponse;
    const mappings: FieldMapping[] = Object.entries(fieldValues).map(([fieldId, value]) => ({
      id: `legacy_${fieldId}`,
      responseKey: fieldId,
      responseValue: value,
      fieldId,
      selector: `#${fieldId}`,
      matchType: "field_id",
      status: "matched",
      confidence: 1,
      enabled: true,
    }));

    const result = applyFieldMappings(mappings);

    console.log(`Filled ${result.filledCount} fields successfully`);

    return {
      success: result.success,
      filledCount: result.filledCount,
      errors: result.errors.length > 0 ? result.errors : undefined,
      snapshot: result.snapshot,
    };
  } catch (error) {
    console.error("Error filling form:", error);
    throw error;
  }
}

async function handleApplyFieldMappings(mappings: FieldMapping[]): Promise<any> {
  const result = applyFieldMappings(mappings || []);

  return {
    success: result.success,
    filledCount: result.filledCount,
    errors: result.errors,
    snapshot: result.snapshot,
  };
}

async function handleUndoLastFill(snapshot?: FillSnapshot): Promise<any> {
  const result = undoFillSnapshot(snapshot);

  return {
    success: result.success,
    restoredCount: result.restoredCount,
    errors: result.errors,
  };
}

/**
 * Find all form fields on the page
 */
function findFormFields(): FormField[] {
  const fields: FormField[] = [];
  const selectors = ['input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])', "select", "textarea"];

  selectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector) as NodeListOf<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

    elements.forEach((element, _index) => {
      if (!isElementVisible(element)) {
        return;
      }

      const field: FormField = {
        id: "",
        originalId: element.id || undefined,
        name: element.name || undefined,
        type: element.type || element.tagName.toLowerCase(),
        label: getFieldLabel(element),
        placeholder: (element as HTMLInputElement).placeholder || undefined,
        ariaLabel: element.getAttribute("aria-label") || undefined,
        value: (element as HTMLInputElement).value || undefined,
        selector: generateSelector(element),
        element,
      };

      fields.push(field);
    });
  });

  return fields;
}

/**
 * Add unique IDs to form fields
 */
function addUniqueIds(fields: FormField[]): void {
  fields.forEach((field, index) => {
    const element = field.element;
    if (!element) return;

    if (element.id) {
      field.id = element.id;
      return;
    }

    const uniqueId = `foxifill_field_${index}`;
    element.id = uniqueId;
    field.id = uniqueId;
  });
}

/**
 * Get label text for a form field
 */
function getFieldLabel(element: Element): string | undefined {
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label?.textContent) {
      return label.textContent.trim();
    }
  }

  const parentLabel = element.closest("label");
  if (parentLabel?.textContent) {
    return parentLabel.textContent.trim();
  }

  const previousElement = element.previousElementSibling;
  if (previousElement?.textContent) {
    return previousElement.textContent.trim();
  }

  return undefined;
}

/**
 * Generate CSS selector for an element
 */
function generateSelector(element: Element): string {
  const parts: string[] = [];

  if (element.id) {
    return `#${element.id}`;
  }

  if (element.className) {
    const classes = element.className.split(" ").filter((c) => c.trim());
    if (classes.length > 0) {
      parts.push(`.${classes.join(".")}`);
    }
  }

  if (element.getAttribute("name")) {
    parts.push(`[name="${element.getAttribute("name")}"]`);
  }

  const tagName = element.tagName.toLowerCase();
  if (parts.length === 0) {
    return tagName;
  }

  return `${tagName}${parts.join("")}`;
}

/**
 * Check if element is visible
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

// AI processing page whitelist
const AI_PROCESSING_WHITELIST = ["chatgpt.com", "chat.openai.com", "chat.deepseek.com", "deepseek.com", "claude.ai", "bard.google.com", "copilot.microsoft.com", "poe.com"];

/**
 * Check if current page is an AI processing page
 */
function isAIProcessingPage(): boolean {
  const currentURL = window.location.href.toLowerCase();
  return AI_PROCESSING_WHITELIST.some((domain) => currentURL.includes(domain));
}

/**
 * Create floating icon for form pages
 */
function createFloatingIcon(): void {
  console.log("FoxiFill: Creating floating icon...");

  if (document.getElementById("foxifill-floating-icon")) {
    console.log("FoxiFill: Floating icon already exists");
    return;
  }

  const icon = document.createElement("div");
  icon.id = "foxifill-floating-icon";

  const logoImg = document.createElement("img");
  try {
    if (chrome.runtime?.id) {
      logoImg.src = chrome.runtime.getURL("icons/icon48.png");
    } else {
      console.log("FoxiFill: Extension context invalidated, using fallback icon");
      logoImg.style.cssText = "width: 32px; height: 32px; display: block; background-color: #F67B26; border-radius: 50%;";
    }
  } catch (error) {
    console.log("FoxiFill: Error getting icon URL, using fallback:", error);
    logoImg.style.cssText = "width: 32px; height: 32px; display: block; background-color: #F67B26; border-radius: 50%;";
  }
  logoImg.style.cssText = "width: 32px; height: 32px; display: block;";

  icon.appendChild(logoImg);

  // 根据页面类型调整图标位置
  const pageType = PageDetector.getPageType();
  let iconPosition = { top: "60px", right: "60px" };

  if (pageType === "deepseek") {
    // DeepSeek 页面通常有 textarea 在底部，需要调整位置
    iconPosition = { top: "20px", right: "20px" };
  } else if (pageType === "chatgpt") {
    // ChatGPT 页面的默认位置
    iconPosition = { top: "60px", right: "60px" };
  }

  Object.assign(icon.style, {
    position: "fixed",
    top: iconPosition.top,
    right: iconPosition.right,
    width: "50px",
    height: "50px",
    backgroundColor: "#F67B26",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    zIndex: "9999999",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    transition: "all 0.3s ease",
    userSelect: "none",
  });

  // 拖拽功能
  let isDragging = false;
  let startX: number, startY: number, startLeft: number, startTop: number;
  let hasMoved = false; // 标记是否发生了移动
  const DRAG_THRESHOLD = 5; // 拖拽阈值，移动超过5像素才算拖拽

  icon.addEventListener("mousedown", (e) => {
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;

    // 获取当前实际位置
    const rect = icon.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    // 清除 right 属性，设置为 left/top 定位
    icon.style.right = "auto";
    icon.style.left = startLeft + "px";
    icon.style.top = startTop + "px";

    icon.style.cursor = "grabbing";
    icon.style.transition = "none";

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // 检查是否移动超过阈值
    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
      hasMoved = true;
    }

    const newLeft = startLeft + deltaX;
    const newTop = startTop + deltaY;

    // 限制在视窗范围内
    const maxLeft = window.innerWidth - 50;
    const maxTop = window.innerHeight - 50;

    icon.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + "px";
    icon.style.top = Math.max(0, Math.min(newTop, maxTop)) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      icon.style.cursor = "grab";
      icon.style.transition = "all 0.3s ease";

      // 只有真正移动了才保存位置
      if (hasMoved) {
        // 保存位置到 storage
        const position = {
          left: icon.style.left,
          top: icon.style.top,
        };
        chrome.storage.local.set({ "foxifill-floating-icon-position": position });
      }
    }
  });

  // 悬停效果
  icon.addEventListener("mouseenter", () => {
    if (!isDragging) {
      icon.style.transform = "scale(1.1)";
      icon.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.2)";
    }
  });

  icon.addEventListener("mouseleave", () => {
    if (!isDragging) {
      icon.style.transform = "scale(1)";
      icon.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    }
  });

  // 点击事件 - 根据页面类型处理
  icon.addEventListener("click", async (e) => {
    // 如果正在拖拽或者已经移动过，不触发点击事件
    if (isDragging || hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    console.log("FoxiFill: Floating icon clicked");
    try {
      if (!chrome.runtime?.id) {
        console.log("Extension needs to be reloaded. Please refresh the page.");
        return;
      }

      const response = await Messaging.sendToBackground({
        type: "HANDLE_FLOATING_ICON_CLICK",
      });

      if (response.success) {
        console.log("FoxiFill: Floating icon click handled:", response.action);
      } else {
        console.error("FoxiFill: Failed to handle floating icon click:", response.error);

        console.log("Operation failed: " + response.error);
      }
    } catch (error) {
      console.error("FoxiFill: Error handling floating icon click:", error);

      if (error instanceof Error && error.message.includes("Extension context invalidated")) {
        console.log("Extension needs to be reloaded. Please refresh the page.");
      } else {
        console.log("Operation failed.");
      }
    }
  });

  document.body.appendChild(icon);

  // 恢复保存的位置
  chrome.storage.local.get("foxifill-floating-icon-position", (result) => {
    if (result["foxifill-floating-icon-position"]) {
      const position = result["foxifill-floating-icon-position"];
      icon.style.right = "auto"; // 清除 right 属性
      icon.style.left = position.left;
      icon.style.top = position.top;
    }
  });

  console.log("FoxiFill: Floating icon created and added to page");
}

/**
 * Create AI processing floating icon
 */
function createAIProcessingFloatingIcon(): void {
  console.log("FoxiFill: Creating AI processing floating icon...");

  if (document.getElementById("foxifill-ai-floating-icon")) {
    console.log("FoxiFill: AI processing floating icon already exists");
    return;
  }

  const icon = document.createElement("div");
  icon.id = "foxifill-ai-floating-icon";

  const logoImg = document.createElement("img");
  try {
    if (chrome.runtime?.id) {
      logoImg.src = chrome.runtime.getURL("icons/icon48.png");
    } else {
      console.log("FoxiFill: Extension context invalidated, using fallback icon");
      logoImg.style.cssText = "width: 32px; height: 32px; display: block; background-color: #F67B26; border-radius: 50%;";
    }
  } catch (error) {
    console.log("FoxiFill: Error getting icon URL, using fallback:", error);
    logoImg.style.cssText = "width: 32px; height: 32px; display: block; background-color: #F67B26; border-radius: 50%;";
  }
  logoImg.style.cssText = "width: 32px; height: 32px; display: block;";

  icon.appendChild(logoImg);

  let iconStyle: Partial<CSSStyleDeclaration>;
  if (PageDetector.isAIModelPage()) {
    // 查找输入框或textarea
    const inputElement =
      document.querySelector("textarea") ||
      document.querySelector('[data-testid="composer-textarea"]') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("input[type='text']");

    if (inputElement) {
      const rect = inputElement.getBoundingClientRect();
      // 定位在输入框的右下角，添加左侧padding
      iconStyle = {
        position: "fixed",
        top: `${Math.max(rect.bottom - 50, 20)}px`, // 右下角，稍微向上偏移
        left: `${Math.max(rect.right + 15, 70)}px`, // 右侧，添加15px的左侧padding
      };
    } else {
      // 如果找不到输入框，尝试使用容器定位
      const inputContainer = document.querySelector("form") || document.querySelector('[data-testid="composer-parent"]') || document.querySelector("main");
      if (inputContainer) {
        const rect = inputContainer.getBoundingClientRect();
        iconStyle = {
          position: "fixed",
          top: `${Math.max(rect.bottom - 60, 20)}px`,
          left: `${Math.max(rect.right + 15, 70)}px`,
        };
      } else {
        iconStyle = {
          position: "fixed",
          top: "60px",
          left: "70px", // 添加左侧padding
        };
      }
    }
  } else {
    iconStyle = {
      position: "fixed",
      top: "60px",
      right: "60px",
    };
  }

  Object.assign(icon.style, {
    ...iconStyle,
    width: "50px",
    height: "50px",
    backgroundColor: "#F67B26",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    zIndex: "9999999",
    boxShadow: "0 4px 12px rgba(246, 123, 38, 0.3)",
    transition: "all 0.3s ease",
    userSelect: "none",
  });

  // 拖拽功能
  let isDragging = false;
  let startX: number, startY: number, startLeft: number, startTop: number;
  let isUserDragged = false; // 标记用户是否手动拖拽过
  let hasMoved = false; // 标记是否发生了移动
  const DRAG_THRESHOLD = 5; // 拖拽阈值，移动超过5像素才算拖拽

  icon.addEventListener("mousedown", (e) => {
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;

    // 获取当前实际位置
    const rect = icon.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    // 清除 right 属性，设置为 left/top 定位
    icon.style.right = "auto";
    icon.style.left = startLeft + "px";
    icon.style.top = startTop + "px";

    icon.style.cursor = "grabbing";
    icon.style.transition = "none";

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // 检查是否移动超过阈值
    if (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD) {
      hasMoved = true;
    }

    const newLeft = startLeft + deltaX;
    const newTop = startTop + deltaY;

    // 限制在视窗范围内
    const maxLeft = window.innerWidth - 50;
    const maxTop = window.innerHeight - 50;

    icon.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + "px";
    icon.style.top = Math.max(0, Math.min(newTop, maxTop)) + "px";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      icon.style.cursor = "grab";
      icon.style.transition = "all 0.3s ease";

      // 只有真正移动了才标记为拖拽并保存位置
      if (hasMoved) {
        isUserDragged = true; // 标记用户已手动拖拽

        // 保存位置到 storage
        const position = {
          left: icon.style.left,
          top: icon.style.top,
          isUserDragged: true,
        };
        chrome.storage.local.set({ "foxifill-ai-floating-icon-position": position });
      }
    }
  });

  // 悬停效果
  icon.addEventListener("mouseenter", () => {
    if (!isDragging) {
      icon.style.transform = "scale(1.1)";
      icon.style.boxShadow = "0 6px 20px rgba(246, 123, 38, 0.4)";
    }
  });

  icon.addEventListener("mouseleave", () => {
    if (!isDragging) {
      icon.style.transform = "scale(1)";
      icon.style.boxShadow = "0 4px 12px rgba(246, 123, 38, 0.3)";
    }
  });

  // 点击事件 - 根据页面类型处理
  icon.addEventListener("click", async (e) => {
    // 如果正在拖拽或者已经移动过，不触发点击事件
    if (isDragging || hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    try {
      if (!chrome.runtime?.id) {
        console.log("Extension needs to be reloaded. Please refresh the page.");
        return;
      }

      const response = await Messaging.sendToBackground({
        type: "HANDLE_FLOATING_ICON_CLICK",
      });

      if (response.success) {
        console.log("Floating icon click handled:", response.action);
      } else {
        console.error("Failed to handle floating icon click:", response.error);
        console.log("Operation failed.");
      }
    } catch (error) {
      console.error("Error handling floating icon click:", error);

      if (error instanceof Error && error.message.includes("Extension context invalidated")) {
        console.log("Extension needs to be reloaded. Please refresh the page.");
      } else {
        console.log("Operation failed.");
      }
    }
  });

  document.body.appendChild(icon);

  // 恢复保存的位置
  chrome.storage.local.get("foxifill-ai-floating-icon-position", (result) => {
    if (result["foxifill-ai-floating-icon-position"]) {
      const position = result["foxifill-ai-floating-icon-position"];
      icon.style.right = "auto"; // 清除 right 属性
      icon.style.left = position.left;
      icon.style.top = position.top;

      // 如果用户之前拖拽过，标记为已拖拽
      if (position.isUserDragged) {
        isUserDragged = true;
      }
    }
  });

  // 自动位置调整功能 - 只在用户未手动拖拽时启用
  if (PageDetector.isAIModelPage()) {
    const updateIconPosition = () => {
      // 如果用户手动拖拽过，不进行自动位置调整
      if (isUserDragged) {
        return;
      }

      // 首先尝试找到输入框
      const inputElement =
        document.querySelector("textarea") ||
        document.querySelector('[data-testid="composer-textarea"]') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector("input[type='text']");

      if (inputElement && icon.parentNode) {
        const rect = inputElement.getBoundingClientRect();
        const newTop = Math.max(rect.bottom - 50, 20);
        const newLeft = Math.max(rect.right + 15, 70);

        const currentTop = parseInt(icon.style.top) || 0;
        const currentLeft = parseInt(icon.style.left) || 0;

        if (Math.abs(newTop - currentTop) > 10 || Math.abs(newLeft - currentLeft) > 10) {
          icon.style.top = `${newTop}px`;
          icon.style.left = `${newLeft}px`;
        }
      } else {
        // 如果找不到输入框，尝试使用容器
        const inputContainer = document.querySelector("form") || document.querySelector('[data-testid="composer-parent"]') || document.querySelector("main");

        if (inputContainer && icon.parentNode) {
          const rect = inputContainer.getBoundingClientRect();
          const newTop = Math.max(rect.bottom - 60, 20);
          const newLeft = Math.max(rect.right + 15, 70);

          const currentTop = parseInt(icon.style.top) || 0;
          const currentLeft = parseInt(icon.style.left) || 0;

          if (Math.abs(newTop - currentTop) > 10 || Math.abs(newLeft - currentLeft) > 10) {
            icon.style.top = `${newTop}px`;
            icon.style.left = `${newLeft}px`;
          }
        }
      }
    };

    updateIconPosition();

    window.addEventListener("scroll", updateIconPosition, { passive: true });
    window.addEventListener("resize", updateIconPosition, { passive: true });

    const observer = new MutationObserver(updateIconPosition);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setInterval(updateIconPosition, 2000);
  }

  console.log("FoxiFill: AI processing floating icon created and added to page");
}

/**
 * Toggle floating icon visibility
 */
function toggleFloatingIcon(show: boolean): void {
  const floatingIcon = document.getElementById("foxifill-floating-icon") || document.getElementById("foxifill-ai-floating-icon");

  if (floatingIcon) {
    if (show) {
      floatingIcon.style.display = "flex";
    } else {
      floatingIcon.style.display = "none";
    }
  }
}

/**
 * Check if page has form fields and show floating icon if needed
 */
async function checkAndShowFloatingIcon(): Promise<void> {
  if (!chrome.runtime?.id) {
    console.log("FoxiFill: Extension context invalidated, skipping floating icon check");
    return;
  }

  try {
    console.log("FoxiFill: Checking if floating icon should be shown...");

    let showFloatingIcon = true;

    try {
      if (chrome.runtime?.id) {
        const result = await chrome.storage.local.get("settings");
        if (result && result.settings) {
          showFloatingIcon = result.settings.showFloatingIcon !== false;
        }
      }
    } catch (error) {
      console.log("FoxiFill: Failed to get settings, using default (show: true):", error);
      showFloatingIcon = true;
    }

    console.log("FoxiFill: Show floating icon setting:", showFloatingIcon);

    if (!showFloatingIcon) {
      console.log("FoxiFill: Floating icon disabled in settings");
      return;
    }

    if (!chrome.runtime?.id) {
      console.log("FoxiFill: Extension context invalidated before creating icon");
      return;
    }

    const isAIPage = isAIProcessingPage();
    console.log("FoxiFill: Is AI processing page:", isAIPage, "URL:", window.location.href);

    if (isAIPage) {
      console.log("FoxiFill: Creating AI processing floating icon");
      createAIProcessingFloatingIcon();
      return;
    }

    const formFields = document.querySelectorAll("input, select, textarea");
    console.log("FoxiFill: Found form fields:", formFields.length);

    if (formFields.length > 0) {
      console.log("FoxiFill: Creating regular floating icon");
      createFloatingIcon();
    } else {
      console.log("FoxiFill: No form fields found, not showing floating icon");
    }
  } catch (error) {
    console.error("FoxiFill: Error checking floating icon settings:", error);

    if (error instanceof Error && error.message.includes("Extension context invalidated")) {
      console.log("FoxiFill: Extension context invalidated, cannot create floating icon");
      return;
    }

    try {
      if (chrome.runtime?.id) {
        const isAIPage = isAIProcessingPage();
        if (isAIPage) {
          console.log("FoxiFill: Error occurred, creating AI processing floating icon as fallback");
          createAIProcessingFloatingIcon();
        } else {
          const formFields = document.querySelectorAll("input, select, textarea");
          if (formFields.length > 0) {
            console.log("FoxiFill: Error occurred, creating regular floating icon as fallback");
            createFloatingIcon();
          }
        }
      }
    } catch (fallbackError) {
      console.log("FoxiFill: Fallback also failed:", fallbackError);
    }
  }
}

// Initialize floating icon when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    try {
      if (chrome.runtime?.id) {
        checkAndShowFloatingIcon();
      }
    } catch (error) {
      console.log("FoxiFill: Error during DOMContentLoaded initialization:", error);
    }
  });
} else {
  try {
    if (chrome.runtime?.id) {
      checkAndShowFloatingIcon();
    }
  } catch (error) {
    console.log("FoxiFill: Error during immediate initialization:", error);
  }
}

console.log("FoxiFill content script initialization complete");

// AI模型页面自动粘贴检测
if (isAIProcessingPage()) {
  console.log("FoxiFill: Detected AI processing page, setting up auto-paste monitoring");
  setupAIModelAutoPaste();
}

/**
 * Setup AI Model auto-paste monitoring
 */
function setupAIModelAutoPaste(): void {
  console.log("FoxiFill: Setting up AI Model auto-paste monitoring");

  let lastCheckedValue = "";
  let autoPasteTriggered = false;
  let lastClipboardData = ""; // 记录上次粘贴的数据，防止重复粘贴

  const checkAndAutoPaste = async () => {
    try {
      // 检查扩展上下文是否有效
      if (!chrome.runtime?.id) {
        return;
      }

      // 查找输入框
      const inputSelectors = [
        '[data-testid="composer-textarea"]',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="Send a message"]',
        'div[contenteditable="true"]',
        "textarea",
        "#prompt-textarea",
      ];

      let inputElement: HTMLTextAreaElement | HTMLDivElement | null = null;

      for (const selector of inputSelectors) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
          inputElement = element as HTMLTextAreaElement | HTMLDivElement;
          break;
        }
      }

      if (!inputElement) {
        return;
      }

      // 获取当前输入框内容
      let currentValue = "";
      if (inputElement.tagName === "TEXTAREA") {
        currentValue = (inputElement as HTMLTextAreaElement).value || "";
      } else if (inputElement.contentEditable === "true") {
        currentValue = (inputElement as HTMLDivElement).textContent || "";
      }

      // 检查自动粘贴设置
      const settingsData = await chrome.storage.local.get("settings");
      const settings = settingsData.settings || {};
      const autoPasteEnabled = settings.autoPasteOnChatGPT === true; // 只有明确设置为 true 才启用

      if (!autoPasteEnabled) {
        return; // 自动粘贴功能已禁用
      }

      // 检查是否有剪贴板数据
      const clipboardData = await chrome.storage.local.get("clipboardData");

      if (!clipboardData.clipboardData) {
        return;
      }

      // 检查是否已经粘贴过这份数据（防止刷新页面后重复粘贴）
      const autoPasteStatus = await chrome.storage.local.get("autoPasteStatus");

      // 安全地生成数据哈希，避免btoa()编码错误
      let currentDataHash = "";
      try {
        if (clipboardData.clipboardData) {
          // 使用简单的字符串哈希算法替代btoa
          currentDataHash = clipboardData.clipboardData.length.toString() + "_" + clipboardData.clipboardData.substring(0, 10) + "_" + clipboardData.clipboardData.substring(-10);
        }
      } catch (error) {
        console.warn("FoxiFill: Error generating data hash:", error);
        currentDataHash = clipboardData.clipboardData?.length?.toString() || "";
      }

      if (autoPasteStatus.autoPasteStatus?.lastPastedHash === currentDataHash && currentDataHash) {
        return; // 这份数据已经粘贴过了
      }

      // 检查是否允许自动粘贴（只有在用户主动捕获表单后才允许）
      const formCaptureStatus = await chrome.storage.local.get("formCaptureStatus");
      const allowAutoPaste = formCaptureStatus.formCaptureStatus?.allowAutoPaste === true;

      if (!allowAutoPaste) {
        console.log("FoxiFill: Auto-paste not allowed - no recent form capture");
        return; // 不允许自动粘贴，因为没有最近的表单捕获
      }

      // 防止重复粘贴相同的数据
      if (clipboardData.clipboardData === lastClipboardData && autoPasteTriggered) {
        return;
      }

      // 如果输入框为空且有剪贴板数据且还没有触发过自动粘贴
      if (currentValue.trim() === "" && clipboardData.clipboardData && !autoPasteTriggered) {
        autoPasteTriggered = true;
        lastClipboardData = clipboardData.clipboardData;

        console.log("FoxiFill: Triggering auto-paste after form capture");

        // 触发自动粘贴
        try {
          await handleAIModelPaste(false); // 明确标记为自动粘贴

          // 保存粘贴状态，防止页面刷新后重复粘贴
          await chrome.storage.local.set({
            autoPasteStatus: {
              lastPastedHash: currentDataHash,
              lastPastedTime: Date.now(),
            },
          });

          // 自动粘贴完成后，清除允许自动粘贴的标志
          await chrome.storage.local.remove("formCaptureStatus");
          console.log("FoxiFill: Auto-paste completed, cleared form capture status");
        } catch (error) {
          console.error("FoxiFill: Auto-paste failed:", error);
          autoPasteTriggered = false; // 允许重试
          lastClipboardData = ""; // 重置，允许重试
        }
      }

      // 如果输入框不为空，重置自动粘贴标志（除非刚刚完成粘贴）
      if (currentValue.trim() !== "" && currentValue !== lastCheckedValue) {
        // 延迟重置，避免在粘贴过程中被重置
        setTimeout(() => {
          if (currentValue.trim() !== "") {
            autoPasteTriggered = false;
            lastClipboardData = "";
            console.log("FoxiFill: Reset auto-paste flags due to input change");
          }
        }, 2000);
      }

      lastCheckedValue = currentValue;
    } catch (error) {
      console.error("FoxiFill: Error in auto-paste check:", error);
    }
  };

  // 监听输入框变化
  const observer = new MutationObserver(() => {
    checkAndAutoPaste();
  });

  // 定期检查
  const interval = setInterval(checkAndAutoPaste, 1000);

  // 页面卸载时清理
  window.addEventListener("beforeunload", () => {
    clearInterval(interval);
    observer.disconnect();
  });

  // 初始检查
  setTimeout(checkAndAutoPaste, 1000);
}

/**
 * Take full page screenshot using scrolling and stitching
 */
async function takeFullPageScreenshot(): Promise<string> {
  try {
    console.log("Starting simple full page screenshot capture...");

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    const body = document.body;
    const html = document.documentElement;

    const pageWidth = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
    const pageHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);

    console.log(`Page dimensions: ${pageWidth}x${pageHeight}`);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not create canvas context");
    }

    const maxDimension = 8192;
    const scaleFactor = Math.min(1, maxDimension / Math.max(pageWidth, pageHeight));

    canvas.width = Math.floor(pageWidth * scaleFactor);
    canvas.height = Math.floor(pageHeight * scaleFactor);

    console.log(`Canvas size: ${canvas.width}x${canvas.height} (scale: ${scaleFactor})`);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const cols = Math.ceil(pageWidth / viewportWidth);
    const rows = Math.ceil(pageHeight / viewportHeight);

    console.log(`Taking ${rows}x${cols} screenshots...`);

    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 500));

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const scrollX = col * viewportWidth;
        const scrollY = row * viewportHeight;

        window.scrollTo(scrollX, scrollY);
        await new Promise((resolve) => setTimeout(resolve, 300));

        try {
          if (!chrome.runtime?.id) {
            throw new Error("Extension context invalidated");
          }

          const screenshot = await new Promise<string>((resolve, reject) => {
            try {
              chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" }, (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                  resolve(response.dataUrl);
                } else {
                  reject(new Error("Failed to capture"));
                }
              });
            } catch (error) {
              reject(error);
            }
          });

          // 验证截图数据
          if (!screenshot || !screenshot.startsWith("data:image/")) {
            console.warn(`Invalid screenshot data for tile ${row},${col}`);
            continue;
          }

          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Image load timeout for tile ${row},${col}`));
            }, 5000);

            img.onload = () => {
              clearTimeout(timeout);
              try {
                // 验证图片尺寸
                if (img.width === 0 || img.height === 0) {
                  throw new Error(`Invalid image dimensions: ${img.width}x${img.height}`);
                }

                const destX = col * viewportWidth * scaleFactor;
                const destY = row * viewportHeight * scaleFactor;
                const destWidth = Math.min(viewportWidth * scaleFactor, canvas.width - destX);
                const destHeight = Math.min(viewportHeight * scaleFactor, canvas.height - destY);

                ctx.drawImage(img, 0, 0, img.width, img.height, destX, destY, destWidth, destHeight);
                console.log(`Drew tile ${row},${col} at ${destX},${destY} (${img.width}x${img.height})`);
                resolve();
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            };

            img.onerror = (event) => {
              clearTimeout(timeout);
              console.error(`Image load error for tile ${row},${col}:`, event);
              reject(new Error(`Failed to load image for tile ${row},${col}`));
            };

            img.src = screenshot;
          });
        } catch (error) {
          console.warn(`Failed to capture tile ${row},${col}:`, error);
        }
      }
    }

    window.scrollTo(originalScrollX, originalScrollY);

    const result = canvas.toDataURL("image/png", 0.9);
    console.log(`Full page screenshot complete. Size: ${result.length} bytes`);

    return result;
  } catch (error) {
    console.error("Error in full page screenshot:", error);

    return new Promise<string>((resolve, reject) => {
      try {
        if (!chrome.runtime?.id) {
          reject(new Error("Extension context invalidated"));
          return;
        }

        chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            console.log("Used fallback visible area capture");
            resolve(response.dataUrl);
          } else {
            reject(new Error("All screenshot methods failed"));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
