import { create } from "zustand";
import { Messaging } from "../libs/messaging";
import { storage } from "../libs/storage";
import { FieldMapping, FillSnapshot, FormData, ParsedAIResponse, WorkflowState } from "../libs/types";
import { createIdleWorkflowState } from "../libs/workflow";

interface PopupSettings {
  selectedModel: string;
  showFloatingIcon: boolean;
  autoOpenChatGPT: boolean;
  autoPasteOnChatGPT: boolean;
}

interface ExtensionStore {
  settings: PopupSettings;
  workflowState: WorkflowState;
  currentFormData?: FormData;
  parsedAIResponse?: ParsedAIResponse;
  fieldMappings: FieldMapping[];
  lastFillSnapshot?: FillSnapshot;
  isBusy: boolean;
  error?: string;
  info?: string;

  initialize: () => Promise<void>;
  captureForm: () => Promise<void>;
  openModel: () => Promise<void>;
  readAIFromClipboard: () => Promise<void>;
  refreshMappings: () => Promise<void>;
  toggleMapping: (id: string, enabled: boolean) => Promise<void>;
  applyMappings: () => Promise<void>;
  undoLastFill: () => Promise<void>;
  updateSetting: (key: keyof PopupSettings, value: boolean | string) => Promise<void>;
  clearError: () => void;
}

const defaultSettings: PopupSettings = {
  selectedModel: "chatgpt",
  showFloatingIcon: true,
  autoOpenChatGPT: true,
  autoPasteOnChatGPT: true,
};

let messageListenerRegistered = false;

export const useExtensionStore = create<ExtensionStore>((set, get) => ({
  settings: defaultSettings,
  workflowState: createIdleWorkflowState(),
  fieldMappings: [],
  isBusy: false,

  initialize: async () => {
    set({ isBusy: true, error: undefined, info: undefined });

    try {
      const [settings, response] = await Promise.all([
        storage.getSettings(),
        Messaging.sendToBackground({
          type: "GET_WORKFLOW_STATE",
        }),
      ]);

      set({
        settings: {
          selectedModel: settings?.selectedModel ?? "chatgpt",
          showFloatingIcon: settings?.showFloatingIcon ?? true,
          autoOpenChatGPT: settings?.autoOpenChatGPT ?? true,
          autoPasteOnChatGPT: settings?.autoPasteOnChatGPT ?? true,
        },
        workflowState: response?.workflowState || createIdleWorkflowState(),
        currentFormData: response?.formData,
        parsedAIResponse: response?.parsedAIResponse,
        fieldMappings: response?.fieldMappings || [],
        lastFillSnapshot: response?.lastFillSnapshot,
      });

      if (!messageListenerRegistered) {
        chrome.runtime.onMessage.addListener((message) => {
          if (message?.type !== "WORKFLOW_STATE_UPDATE") {
            return;
          }

          useExtensionStore.setState((state) => ({
            ...state,
            workflowState: message.payload || state.workflowState,
          }));
        });
        messageListenerRegistered = true;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to initialize popup",
      });
    } finally {
      set({ isBusy: false });
    }
  },

  captureForm: async () => {
    set({ isBusy: true, error: undefined, info: undefined });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error("No active tab found");
      }

      const response = await Messaging.sendToBackground({
        type: "CAPTURE_FORM",
        payload: { tabId: tab.id },
      });

      if (!response?.success) {
        throw new Error(response?.error || "Capture failed");
      }

      const settings = get().settings;
      if (settings.autoOpenChatGPT) {
        await get().openModel();
      }

      await get().initialize();
      set({ info: "Form captured successfully" });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Capture failed" });
    } finally {
      set({ isBusy: false });
    }
  },

  openModel: async () => {
    try {
      const response = await Messaging.sendToBackground({
        type: "OPEN_MODEL",
      });
      if (!response?.success) {
        throw new Error(response?.error || "Unable to open AI model");
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unable to open AI model" });
      throw error;
    }
  },

  readAIFromClipboard: async () => {
    set({ isBusy: true, error: undefined, info: undefined });
    try {
      const text = await navigator.clipboard.readText();
      const response = await Messaging.sendToBackground({
        type: "PARSE_AI_RESPONSE",
        payload: { text },
      });

      if (!response?.success) {
        throw new Error(response?.error || "Unable to parse AI response");
      }

      set({
        parsedAIResponse: response.parsedAIResponse,
        fieldMappings: response.fieldMappings || [],
      });

      await get().initialize();
      set({ info: "AI response parsed. Review mappings before apply." });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to read AI response from clipboard" });
    } finally {
      set({ isBusy: false });
    }
  },

  refreshMappings: async () => {
    set({ isBusy: true, error: undefined });
    try {
      const response = await Messaging.sendToBackground({
        type: "PREVIEW_FIELD_MAPPINGS",
      });

      if (!response?.success) {
        throw new Error(response?.error || "Unable to rebuild mappings");
      }

      set({ fieldMappings: response.fieldMappings || [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unable to rebuild mappings" });
    } finally {
      set({ isBusy: false });
    }
  },

  toggleMapping: async (id: string, enabled: boolean) => {
    const updatedMappings = get().fieldMappings.map((mapping) => (mapping.id === id ? { ...mapping, enabled } : mapping));
    set({ fieldMappings: updatedMappings });
    await storage.saveFieldMappings(updatedMappings);
  },

  applyMappings: async () => {
    set({ isBusy: true, error: undefined, info: undefined });
    try {
      const response = await Messaging.sendToBackground({
        type: "APPLY_FIELD_MAPPINGS",
        payload: { mappings: get().fieldMappings },
      });

      if (!response?.success) {
        throw new Error(response?.error || "Failed to apply mappings");
      }

      await get().initialize();
      set({
        info: `Applied ${response.filledCount || 0} field(s) successfully`,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to apply mappings" });
    } finally {
      set({ isBusy: false });
    }
  },

  undoLastFill: async () => {
    set({ isBusy: true, error: undefined, info: undefined });
    try {
      const response = await Messaging.sendToBackground({
        type: "UNDO_LAST_FILL",
      });

      if (!response?.success) {
        throw new Error(response?.error || "Undo failed");
      }

      await get().initialize();
      set({
        info: `Restored ${response.restoredCount || 0} field(s)`,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Undo failed" });
    } finally {
      set({ isBusy: false });
    }
  },

  updateSetting: async (key: keyof PopupSettings, value: boolean | string) => {
    try {
      const settings = {
        ...get().settings,
        [key]: value,
      } as PopupSettings;

      set({ settings });
      await storage.saveSettings({
        ...settings,
        autoDetect: true,
        chatgptUrl: "https://chatgpt.com/",
      });

      if (key === "showFloatingIcon") {
        await Messaging.sendToAllTabs({
          type: "TOGGLE_FLOATING_ICON",
          payload: { show: value },
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to update settings" });
    }
  },

  clearError: () => {
    set({ error: undefined, info: undefined });
  },
}));
