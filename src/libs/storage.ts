import { STORAGE_SCHEMA_VERSION, createIdleWorkflowState } from "./workflow";
import { StorageData } from "./types";

/**
 * Storage utility for Chrome extension
 */
export class Storage {
  static async set(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key] || null);
        }
      });
    });
  }

  static async remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  static async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

async function ensureSchemaVersion(): Promise<void> {
  const schemaVersion = await Storage.get<number>("schemaVersion");

  if (schemaVersion === STORAGE_SCHEMA_VERSION) {
    return;
  }

  await Storage.set("schemaVersion", STORAGE_SCHEMA_VERSION);

  if (!schemaVersion) {
    await Storage.set("workflowState", createIdleWorkflowState());
  }
}

export const storage = {
  async get<T>(key: string): Promise<T | undefined> {
    await ensureSchemaVersion();
    return (await Storage.get<T>(key)) || undefined;
  },

  async save<T>(key: string, value: T | undefined): Promise<void> {
    await ensureSchemaVersion();
    if (value === undefined) {
      await Storage.remove(key);
    } else {
      await Storage.set(key, value);
    }
  },

  async saveFormData(formData: StorageData["formData"]) {
    await ensureSchemaVersion();
    await Storage.set("formData", formData);
  },

  async getFormData(): Promise<StorageData["formData"]> {
    await ensureSchemaVersion();
    return (await Storage.get("formData")) || undefined;
  },

  async saveAIResponse(response: StorageData["aiResponse"]) {
    await ensureSchemaVersion();
    await Storage.set("aiResponse", response);
  },

  async getAIResponse(): Promise<StorageData["aiResponse"]> {
    await ensureSchemaVersion();
    return (await Storage.get("aiResponse")) || undefined;
  },

  async saveParsedAIResponse(response: StorageData["parsedAIResponse"]) {
    await ensureSchemaVersion();
    if (response === undefined) {
      await Storage.remove("parsedAIResponse");
      return;
    }
    await Storage.set("parsedAIResponse", response);
  },

  async getParsedAIResponse(): Promise<StorageData["parsedAIResponse"]> {
    await ensureSchemaVersion();
    return (await Storage.get("parsedAIResponse")) || undefined;
  },

  async saveFieldMappings(mappings: StorageData["fieldMappings"]) {
    await ensureSchemaVersion();
    if (mappings === undefined) {
      await Storage.remove("fieldMappings");
      return;
    }
    await Storage.set("fieldMappings", mappings);
  },

  async getFieldMappings(): Promise<StorageData["fieldMappings"]> {
    await ensureSchemaVersion();
    return (await Storage.get("fieldMappings")) || undefined;
  },

  async saveWorkflowState(state: StorageData["workflowState"]) {
    await ensureSchemaVersion();
    await Storage.set("workflowState", state);
  },

  async getWorkflowState(): Promise<StorageData["workflowState"]> {
    await ensureSchemaVersion();
    const state = await Storage.get<StorageData["workflowState"]>("workflowState");
    return state || createIdleWorkflowState();
  },

  async saveLastFillSnapshot(snapshot: StorageData["lastFillSnapshot"]) {
    await ensureSchemaVersion();
    if (snapshot === undefined) {
      await Storage.remove("lastFillSnapshot");
      return;
    }
    await Storage.set("lastFillSnapshot", snapshot);
  },

  async getLastFillSnapshot(): Promise<StorageData["lastFillSnapshot"]> {
    await ensureSchemaVersion();
    return (await Storage.get("lastFillSnapshot")) || undefined;
  },

  async clearWorkflowRuntimeData() {
    await ensureSchemaVersion();
    await Promise.all([
      Storage.remove("parsedAIResponse"),
      Storage.remove("fieldMappings"),
      Storage.remove("lastFillSnapshot"),
      Storage.set("workflowState", createIdleWorkflowState()),
    ]);
  },

  async saveSettings(settings: StorageData["settings"]) {
    await ensureSchemaVersion();
    await Storage.set("settings", settings);
  },

  async getSettings(): Promise<StorageData["settings"]> {
    await ensureSchemaVersion();
    const defaultSettings = {
      selectedModel: "chatgpt",
      chatgptUrl: "https://chatgpt.com/",
      autoDetect: true,
      showFloatingIcon: true,
      autoOpenChatGPT: true,
      autoPasteOnChatGPT: true,
    };
    const saved = await Storage.get("settings");
    return { ...defaultSettings, ...(saved || {}) };
  },

  async saveUserData(userData: StorageData["userData"]) {
    await ensureSchemaVersion();
    await Storage.set("userData", userData);
  },

  async getUserData(): Promise<StorageData["userData"]> {
    await ensureSchemaVersion();
    return (await Storage.get("userData")) || undefined;
  },

  async saveSignOutFlag(signOutFlag: StorageData["signOutFlag"]) {
    await ensureSchemaVersion();
    await Storage.set("signOutFlag", signOutFlag);
  },

  async getSignOutFlag(): Promise<StorageData["signOutFlag"]> {
    await ensureSchemaVersion();
    return (await Storage.get("signOutFlag")) || undefined;
  },
};
