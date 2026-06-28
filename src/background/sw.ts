import { getModelById } from "../libs/config";
import { parseAIResponseText } from "../libs/ai-parser";
import { buildFieldMappings, getEnabledMappings } from "../libs/mapping";
import { Messaging } from "../libs/messaging";
import { storage } from "../libs/storage";
import { FieldMapping, FillSnapshot, FormData, Message, ParsedAIResponse, WorkflowErrorCode, WorkflowState } from "../libs/types";
import { createIdleWorkflowState, createWorkflowState } from "../libs/workflow";

/**
 * Background service worker for FoxiFill extension
 */

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("FoxiFill extension installed");
  createContextMenu();
  storage.saveWorkflowState(createIdleWorkflowState()).catch(() => {
    // Ignore init failure and allow runtime recovery.
  });
});

async function broadcastWorkflowState(state: WorkflowState): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "WORKFLOW_STATE_UPDATE",
        payload: state,
      });
    } catch {
      // Ignore tabs without content script.
    }
  }

  try {
    chrome.runtime.sendMessage({
      type: "WORKFLOW_STATE_UPDATE",
      payload: state,
    });
  } catch {
    // Ignore popup runtime errors when popup is not open.
  }
}

async function setWorkflowState(status: WorkflowState["status"], options?: { errorCode?: WorkflowErrorCode; errorMessage?: string }) {
  const state = createWorkflowState(status, options);
  await storage.saveWorkflowState(state);
  await broadcastWorkflowState(state);
}

// Create context menu items
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "foxifill-main",
      title: "FoxiFill Auto Fill",
      contexts: ["page", "frame"],
    });

    chrome.contextMenus.create({
      id: "foxifill-capture",
      title: "Capture Form and Open AI Model",
      contexts: ["page", "frame"],
      parentId: "foxifill-main",
    });

    chrome.contextMenus.create({
      id: "foxifill-paste",
      title: "Paste Form Data",
      contexts: ["page", "frame"],
      parentId: "foxifill-main",
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  try {
    switch (info.menuItemId) {
      case "foxifill-main":
        await handleFloatingIconClick(tab.id);
        break;
      case "foxifill-capture":
        await setWorkflowState("capturing");
        await handleCaptureForm(tab.id);
        await setWorkflowState("prompt_ready");
        await handleOpenModel();
        break;
      case "foxifill-paste": {
        const response = await Messaging.sendToContent(tab.id, {
          type: "PASTE_CONTENT",
        });
        if (!response.success) {
          console.error("Paste failed:", response.error);
        }
        break;
      }
    }
  } catch (error) {
    console.error("Context menu operation failed:", error);
  }
});

// Handle messages from content scripts and popup
Messaging.onMessage((message: Message, sender, sendResponse) => {
  if (!message || typeof message !== "object" || !message.type) {
    console.error("Invalid message structure:", message);
    sendResponse({ error: "Invalid message structure" });
    return false;
  }

  const handleAsync = async () => {
    try {
      switch (message.type) {
        case "CAPTURE_FORM": {
          const captureTabId = message.payload?.tabId || sender.tab?.id;
          await setWorkflowState("capturing");
          await handleCaptureForm(captureTabId);
          await setWorkflowState("prompt_ready");
          return { success: true };
        }

        case "OPEN_CHATGPT":
          await handleOpenChatGPT();
          return { success: true };

        case "OPEN_MODEL":
          await handleOpenModel();
          return { success: true };

        case "CAPTURE_VISIBLE_TAB": {
          const dataUrl = await chrome.tabs.captureVisibleTab({
            format: "png",
            quality: 90,
          });
          return { success: true, dataUrl };
        }

        case "AI_RESPONSE":
          await handleAIResponse(message.payload);
          return { success: true };

        case "STATE_UPDATE":
        case "WORKFLOW_STATE_UPDATE":
          return { success: true };

        case "GET_WORKFLOW_STATE":
          return {
            success: true,
            workflowState: (await storage.getWorkflowState()) || createIdleWorkflowState(),
            formData: await storage.getFormData(),
            parsedAIResponse: await storage.getParsedAIResponse(),
            fieldMappings: await storage.getFieldMappings(),
            lastFillSnapshot: await storage.getLastFillSnapshot(),
          };

        case "PARSE_AI_RESPONSE":
          return await handleParseAIResponse(message.payload?.text);

        case "PREVIEW_FIELD_MAPPINGS":
          return await handlePreviewFieldMappings();

        case "APPLY_FIELD_MAPPINGS":
          return await handleApplyFieldMappings(message.payload?.mappings);

        case "UNDO_LAST_FILL":
          return await handleUndoLastFill();

        case "HANDLE_FLOATING_ICON_CLICK": {
          const result = await handleFloatingIconClick(sender.tab?.id);
          return result;
        }

        default:
          console.error("Unknown message type:", message.type);
          return { error: `Unknown message type: ${message.type}` };
      }
    } catch (error) {
      console.error("Background script error:", error);
      await setWorkflowState("error", {
        errorCode: "UNKNOWN",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      return { error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  handleAsync()
    .then(sendResponse)
    .catch((error) => {
      console.error("Async handler error:", error);
      sendResponse({ error: error instanceof Error ? error.message : "Unknown error" });
    });

  return true; // Indicates async response
});

/**
 * Handle form capture
 */
async function handleCaptureForm(tabId?: number) {
  if (!tabId) {
    throw new Error("No active tab");
  }

  try {
    const response = await Messaging.sendToContent(tabId, {
      type: "CAPTURE_FORM",
      payload: { takeFullPageScreenshot: true },
    });

    if (response.success && response.formData) {
      const formData: FormData = response.formData;
      await storage.saveFormData(formData);
      await storage.saveParsedAIResponse(undefined);
      await storage.saveFieldMappings(undefined);
      await storage.saveLastFillSnapshot(undefined);

      const promptText = generatePromptText(formData.html);
      await storage.save("clipboardData", promptText);

      if (formData.screenshot) {
        await copyImageToClipboard(formData.screenshot);
      }

      console.log("Form capture completed");
    } else {
      throw new Error("Form capture failed");
    }
  } catch (error) {
    console.error("Form capture error:", error);
    throw error;
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
 * Generate prompt text
 */
function generatePromptText(html: string): string {
  // 清理HTML，移除script和style标签
  const cleanedHtml = cleanHtml(html);

  return `You are an intelligent form filling assistant. Please analyze the provided HTML to extract form fields and generate appropriate filling suggestions.

<INSTRUCTIONS>
1. Identify all form fields (inputs, selects, textareas, etc.).
2. For each field, generate realistic sample values based on its type, label, and surrounding context.
3. Return a JSON object where keys are the unique field IDs and values are the suggested entries.
4. Append "foxifill_status": "completed" to the JSON to indicate completion.
5. For radio buttons and checkboxes, provide appropriate boolean or specific option values.
6. For select dropdowns, choose one valid option from the available list.
7. Ensure all suggestions are realistic and contextually appropriate.
8. Derive content from context in this order of priority: current chat → current project → personal memory/documentation.
9. Suggested values use HTML matched language.
</INSTRUCTIONS>

<HTML_SOURCE>
${cleanedHtml}
</HTML_SOURCE>

<JSON_RESULT>
{
  "field_id_1": "suggested_value_1",
  "field_id_2": "suggested_value_2",
  "foxifill_status": "completed"
</JSON_RESULT>

`;
}

/**
 * Copy image to clipboard
 */
async function copyImageToClipboard(base64Image: string): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].id) {
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (imageData: string) => {
          try {
            const byteCharacters = atob(imageData.split(",")[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "image/png" });

            const clipboardItem = new ClipboardItem({ "image/png": blob });
            navigator.clipboard
              .write([clipboardItem])
              .then(() => console.log("Image copied to clipboard"))
              .catch((error) => console.error("Failed to copy image:", error));
          } catch (error) {
            console.error("Failed to process image:", error);
          }
        },
        args: [base64Image],
      });
    }
  } catch (error) {
    console.error("Failed to copy image to clipboard:", error);
    throw error;
  }
}

/**
 * Open ChatGPT
 */
async function handleOpenChatGPT() {
  try {
    const settings = await storage.getSettings();
    const chatgptUrl = settings?.chatgptUrl || "https://chatgpt.com/";

    const existingTabs = await chrome.tabs.query({
      url: ["*://chatgpt.com/*", "*://chat.openai.com/*"],
    });

    if (existingTabs.length > 0) {
      const tab = existingTabs[0];
      if (tab.id) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      }
    } else {
      await chrome.tabs.create({ url: chatgptUrl, active: true });
    }
  } catch (error) {
    console.error("Failed to open ChatGPT:", error);
    throw error;
  }
}

/**
 * Open selected AI model
 */
async function handleOpenModel() {
  try {
    const settings = await storage.getSettings();
    const selectedModelId = settings?.selectedModel || "chatgpt";
    const selectedModel = getModelById(selectedModelId);

    if (!selectedModel) {
      throw new Error(`Model not found: ${selectedModelId}`);
    }

    if (!selectedModel.enabled) {
      throw new Error(`Model is not enabled: ${selectedModel.name}`);
    }

    // Get domain patterns for the selected model
    const domainPatterns = getModelDomainPatterns(selectedModelId);

    const existingTabs = await chrome.tabs.query({
      url: domainPatterns,
    });

    if (existingTabs.length > 0) {
      const tab = existingTabs[0];
      if (tab.id) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      }
    } else {
      await chrome.tabs.create({ url: selectedModel.url, active: true });
    }

    await setWorkflowState("waiting_ai");
  } catch (error) {
    console.error("Failed to open AI model:", error);
    throw error;
  }
}

/**
 * Get domain patterns for a model
 */
function getModelDomainPatterns(modelId: string): string[] {
  switch (modelId) {
    case "chatgpt":
      return ["*://chatgpt.com/*", "*://chat.openai.com/*"];
    case "deepseek":
      return ["*://chat.deepseek.com/*", "*://deepseek.com/*"];
    case "gemini":
      return ["*://gemini.google.com/*", "*://bard.google.com/*"];
    case "qwen":
      return ["*://qwen.chat/*", "*://tongyi.aliyun.com/*"];
    case "doubao":
      return ["*://www.doubao.com/*", "*://doubao.com/*"];
    default:
      return ["*://chatgpt.com/*", "*://chat.openai.com/*"];
  }
}

/**
 * Handle floating icon click
 */
async function handleFloatingIconClick(tabId?: number) {
  if (!tabId) {
    throw new Error("No active tab");
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      throw new Error("Unable to get current tab info");
    }

    const currentURL = tab.url.toLowerCase();
    const settings = await storage.getSettings();
    const selectedModelId = settings?.selectedModel || "chatgpt";
    const domainPatterns = getModelDomainPatterns(selectedModelId);
    const isAIProcessingPage = domainPatterns.some((pattern) => {
      const domain = pattern.replace("*://", "").replace("/*", "");
      return currentURL.includes(domain);
    });

    if (isAIProcessingPage) {
      const response = await Messaging.sendToContent(tabId, {
        type: "PASTE_CONTENT",
      });

      if (!response.success) {
        throw new Error(response.error || "Paste failed");
      }

      return { success: true, action: "pasted_to_ai_page" };
    } else {
      await setWorkflowState("capturing");
      await handleCaptureForm(tabId);
      await setWorkflowState("prompt_ready");
      await handleOpenModel();
      return { success: true, action: "captured_and_opened_ai_model" };
    }
  } catch (error) {
    console.error("Failed to handle floating icon click:", error);
    throw error;
  }
}

/**
 * Handle AI response
 */
async function handleAIResponse(aiResponse: any) {
  try {
    const inputText = typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse);
    const parsedResult = parseAIResponseText(inputText);

    if (!parsedResult.success || !parsedResult.data) {
      await setWorkflowState("error", {
        errorCode: "AI_JSON_INVALID",
        errorMessage: parsedResult.error || "Invalid AI response",
      });
      throw new Error(parsedResult.error || "Invalid AI response");
    }

    await prepareReviewData(parsedResult.data);
    return {
      success: true,
    };
  } catch (error) {
    console.error("FoxiFill: AI response processing error:", error);
    throw error;
  }
}

async function prepareReviewData(parsedResponse: ParsedAIResponse): Promise<FieldMapping[]> {
  await storage.saveAIResponse(parsedResponse.raw as any);
  await storage.saveParsedAIResponse(parsedResponse);

  const formData = await storage.getFormData();
  if (!formData) {
    await setWorkflowState("error", {
      errorCode: "NO_FORM_DETECTED",
      errorMessage: "No captured form context found",
    });
    throw new Error("No captured form context found");
  }

  const mappings = buildFieldMappings(formData, parsedResponse);
  await storage.saveFieldMappings(mappings);
  await setWorkflowState("review_ready");
  return mappings;
}

async function handleParseAIResponse(text: string) {
  if (!text || !text.trim()) {
    await setWorkflowState("error", {
      errorCode: "AI_JSON_INVALID",
      errorMessage: "Clipboard is empty",
    });
    return {
      success: false,
      error: "Clipboard is empty",
    };
  }

  const parsedResult = parseAIResponseText(text);
  if (!parsedResult.success || !parsedResult.data) {
    await setWorkflowState("error", {
      errorCode: "AI_JSON_INVALID",
      errorMessage: parsedResult.error || "Unable to parse AI response",
    });
    return {
      success: false,
      error: parsedResult.error || "Unable to parse AI response",
    };
  }

  const mappings = await prepareReviewData(parsedResult.data);
  return {
    success: true,
    parsedAIResponse: parsedResult.data,
    fieldMappings: mappings,
  };
}

async function handlePreviewFieldMappings() {
  const formData = await storage.getFormData();
  const parsedAIResponse = await storage.getParsedAIResponse();
  const mappings = buildFieldMappings(formData, parsedAIResponse);
  await storage.saveFieldMappings(mappings);

  if (mappings.length > 0) {
    await setWorkflowState("review_ready");
  }

  return {
    success: true,
    fieldMappings: mappings,
  };
}

async function getFormTabId(): Promise<number> {
  const formData = await storage.getFormData();
  if (!formData) {
    throw new Error("No form data found");
  }

  const tabs = await chrome.tabs.query({ url: formData.url });
  if (tabs.length === 0 || !tabs[0].id) {
    throw new Error("Original form tab not found");
  }

  return tabs[0].id;
}

async function handleApplyFieldMappings(mappings?: FieldMapping[]) {
  const savedMappings = mappings && mappings.length > 0 ? mappings : (await storage.getFieldMappings()) || [];
  const enabledMappings = getEnabledMappings(savedMappings);

  if (enabledMappings.length === 0) {
    return {
      success: false,
      error: "No enabled mappings to apply",
    };
  }

  try {
    await setWorkflowState("applying");
    const formTabId = await getFormTabId();
    const response = await Messaging.sendToContent(formTabId, {
      type: "APPLY_FIELD_MAPPINGS",
      payload: { mappings: enabledMappings },
    });

    const snapshot = response?.snapshot as FillSnapshot | undefined;
    if (snapshot) {
      await storage.saveLastFillSnapshot(snapshot);
    }

    if (!response?.success) {
      await setWorkflowState("error", {
        errorCode: "FILL_APPLY_FAILED",
        errorMessage: response?.error || "Failed to apply mappings",
      });
      return {
        success: false,
        error: response?.error || "Failed to apply mappings",
        filledCount: response?.filledCount || 0,
        errors: response?.errors || [],
        snapshot,
      };
    }

    await setWorkflowState("done");

    return {
      success: true,
      filledCount: response.filledCount || 0,
      errors: response.errors || [],
      snapshot,
    };
  } catch (error) {
    await setWorkflowState("error", {
      errorCode: "FILL_APPLY_FAILED",
      errorMessage: error instanceof Error ? error.message : "Failed to apply mappings",
    });
    throw error;
  }
}

async function handleUndoLastFill() {
  try {
    const snapshot = await storage.getLastFillSnapshot();
    if (!snapshot) {
      return {
        success: false,
        error: "No fill snapshot available",
      };
    }

    const formTabId = await getFormTabId();
    const response = await Messaging.sendToContent(formTabId, {
      type: "UNDO_LAST_FILL",
      payload: { snapshot },
    });

    if (!response?.success) {
      await setWorkflowState("error", {
        errorCode: "UNDO_FAILED",
        errorMessage: response?.error || "Failed to undo fill",
      });
      return {
        success: false,
        error: response?.error || "Failed to undo fill",
      };
    }

    await storage.saveLastFillSnapshot(undefined);
    await setWorkflowState("done");

    return {
      success: true,
      restoredCount: response.restoredCount || 0,
      errors: response.errors || [],
    };
  } catch (error) {
    await setWorkflowState("error", {
      errorCode: "UNDO_FAILED",
      errorMessage: error instanceof Error ? error.message : "Failed to undo fill",
    });
    throw error;
  }
}

/**
 * Monitor AI model response script
 */
function monitorAIResponse(modelId: string = "chatgpt") {
  let lastResponse = "";

  // 内联的选择器获取函数
  function getModelSelectors(modelId: string): string[] {
    switch (modelId) {
      case "chatgpt":
        return ['[data-message-author-role="assistant"]', ".markdown", ".prose"];
      case "deepseek":
        return [
          ".md-code-block pre",
          "pre",
          ".ds-message-content",
          ".message-content",
          ".chat-message",
          ".markdown-body",
          ".response-content",
          ".text-content",
          'div[class*="message"]',
          'div[class*="content"]',
        ];
      default:
        return ['[data-message-author-role="assistant"]', ".message-content", ".response-content", ".ai-response", ".chat-message"];
    }
  }

  // 设置 DeepSeek 的 localStorage
  if (modelId === "deepseek") {
    try {
      localStorage.setItem("searchEnabled", JSON.stringify({ value: false, __version: "0" }));
      localStorage.setItem("thinkingEnabled", JSON.stringify({ value: false, __version: "2" }));
      console.log("DeepSeek localStorage settings applied");
    } catch (error) {
      console.error("Failed to set DeepSeek localStorage:", error);
    }
  }

  const observer = new MutationObserver(() => {
    // Try different selectors for different AI models
    const selectors = getModelSelectors(modelId);
    console.log(`FoxiFill: Checking for AI response using selectors for ${modelId}:`, selectors);

    let responseElements: NodeListOf<Element> | null = null;
    let usedSelector = "";
    for (const selector of selectors) {
      responseElements = document.querySelectorAll(selector);
      if (responseElements.length > 0) {
        usedSelector = selector;
        console.log(`FoxiFill: Found ${responseElements.length} elements with selector: ${selector}`);
        break;
      }
    }

    if (responseElements && responseElements.length > 0) {
      const latestResponse = responseElements[responseElements.length - 1];
      const responseText = latestResponse.textContent || "";

      console.log(`FoxiFill: Latest response text (${usedSelector}):`, responseText.substring(0, 200) + "...");

      if (responseText !== lastResponse && responseText.includes('"foxifill_status"') && responseText.includes('"completed"')) {
        lastResponse = responseText;
        console.log("FoxiFill: Found foxifill_status completed, processing...");

        try {
          chrome.runtime.sendMessage({
            type: "AI_RESPONSE",
            payload: responseText,
          });
        } catch (error) {
          console.error("FoxiFill: AI response parsing error:", error);
          console.log("FoxiFill: Raw response text:", responseText);
        }
      }
    } else {
      console.log(`FoxiFill: No response elements found with any selector for ${modelId}`);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log(`AI model response monitoring activated for ${modelId}`);
}

// Listen to AI model pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const settings = await storage.getSettings();
    const selectedModelId = settings?.selectedModel || "chatgpt";
    const domainPatterns = getModelDomainPatterns(selectedModelId);
    const isModelPage = domainPatterns.some((pattern) => {
      const domain = pattern.replace("*://", "").replace("/*", "");
      return tab.url?.includes(domain);
    });

    if (isModelPage) {
      const formData = await storage.getFormData();
      if (formData) {
        console.log(`FoxiFill: Injecting AI response monitor for ${selectedModelId} on tab ${tabId}`);
        await chrome.scripting.executeScript({
          target: { tabId },
          func: monitorAIResponse,
          args: [selectedModelId], // 传递模型ID
        });
      } else {
        console.log("FoxiFill: No form data found, skipping monitor injection");
      }
    }
  }
});
