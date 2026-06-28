import { ModelInfo } from "./types";

// Environment configuration
export const config = {
  isDevelopment: true,

  devPort: 8080,

  getAuthUrl: () => {
    if (config.isDevelopment) {
      return `http://localhost:${config.devPort}/auth`;
    }
    return "https://foxifill.com/auth";
  },

  getWebsiteUrl: () => {
    if (config.isDevelopment) {
      return `http://localhost:${config.devPort}`;
    }
    return "https://foxifill.com";
  },

  // 获取基础URL（与getWebsiteUrl相同）
  getBaseUrl: () => {
    return config.getWebsiteUrl();
  },
};

// Supported AI model destinations
export const SUPPORTED_MODELS: ModelInfo[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    logo: "/models/ChatGPT-Logo.svg",
    url: "https://chatgpt.com/",
    enabled: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    logo: "/models/DeepSeek_logo.svg",
    url: "https://chat.deepseek.com/",
    enabled: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    logo: "/models/logo_Google_Gemini.svg",
    url: "https://gemini.google.com/",
    enabled: false,
    comingSoon: true,
  },
  {
    id: "qwen",
    name: "Qwen",
    logo: "/models/qwen-seeklogo.svg",
    url: "https://qwen.chat/",
    enabled: false,
    comingSoon: true,
  },
  {
    id: "doubao",
    name: "DouBao",
    logo: "/models/logo_new.png",
    url: "https://www.doubao.com/",
    enabled: false,
    comingSoon: true,
  },
];

export const DEFAULT_MODEL = "chatgpt";

export const getModelById = (id: string): ModelInfo | undefined => {
  return SUPPORTED_MODELS.find((model) => model.id === id);
};

export const getEnabledModels = (): ModelInfo[] => {
  return SUPPORTED_MODELS.filter((model) => model.enabled);
};
