export interface FormField {
  id: string;
  originalId?: string;
  name?: string;
  type: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  value?: string;
  selector: string;
  element?: HTMLElement;
}

export interface FormData {
  url: string;
  html: string;
  screenshot: string;
  fields: FormField[];
  timestamp: number;
}

export interface AIResponse {
  foxifill_status: string;
  [key: string]: string;
}

export interface ParsedAIResponse {
  foxifill_status: "completed";
  values: Record<string, string>;
  raw: Record<string, unknown>;
}

export type MappingMatchType = "field_id" | "label" | "name" | "placeholder" | "aria_label" | "fuzzy" | "unmatched";

export type MappingStatus = "matched" | "unmatched" | "conflict";

export interface FieldMapping {
  id: string;
  responseKey: string;
  responseValue: string;
  fieldId?: string;
  selector?: string;
  fieldName?: string;
  fieldLabel?: string;
  fieldPlaceholder?: string;
  fieldAriaLabel?: string;
  matchType: MappingMatchType;
  status: MappingStatus;
  confidence: number;
  enabled: boolean;
}

export interface FillSnapshotItem {
  selector: string;
  fieldType: string;
  previousValue?: string;
  previousChecked?: boolean;
}

export interface FillSnapshot {
  url: string;
  items: FillSnapshotItem[];
  createdAt: number;
}

export type WorkflowStatus = "idle" | "capturing" | "prompt_ready" | "waiting_ai" | "review_ready" | "applying" | "done" | "error";

export type WorkflowErrorCode = "NO_ACTIVE_TAB" | "NO_FORM_DETECTED" | "AI_JSON_INVALID" | "AI_STATUS_INVALID" | "MODEL_PAGE_NOT_READY" | "FILL_APPLY_FAILED" | "UNDO_FAILED" | "UNKNOWN";

export interface WorkflowState {
  status: WorkflowStatus;
  updatedAt: number;
  errorCode?: WorkflowErrorCode;
  errorMessage?: string;
}

export interface ExtensionState {
  isCapturing: boolean;
  isProcessing: boolean;
  currentFormData: FormData | null;
  lastAIResponse: AIResponse | null;
  error: string | null;
}

export interface Message {
  type:
    | "CAPTURE_FORM"
    | "FILL_FORM"
    | "OPEN_CHATGPT"
    | "OPEN_MODEL"
    | "AI_RESPONSE"
    | "STATE_UPDATE"
    | "WORKFLOW_STATE_UPDATE"
    | "GET_WORKFLOW_STATE"
    | "PARSE_AI_RESPONSE"
    | "PREVIEW_FIELD_MAPPINGS"
    | "APPLY_FIELD_MAPPINGS"
    | "UNDO_LAST_FILL"
    | "ERROR"
    | "AUTH_SUCCESS"
    | "AUTH_STATE_UPDATE"
    | "AUTH_STATE_CHANGE"
    | "AUTH_ERROR"
    | "START_AUTH"
    | "CHECK_AUTH"
    | "SIGN_OUT"
    | "TOGGLE_FLOATING_ICON"
    | "PASTE_CONTENT"
    | "HANDLE_FLOATING_ICON_CLICK"
    | "SHOW_TOAST"
    | "CAPTURE_VISIBLE_TAB"
    | "USER_SIGNED_OUT";
  payload?: any;
}

export interface UserData {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  logo: string;
  url: string;
  enabled: boolean;
  comingSoon?: boolean;
}

export interface StorageData {
  schemaVersion?: number;
  formData?: FormData;
  aiResponse?: AIResponse;
  parsedAIResponse?: ParsedAIResponse;
  fieldMappings?: FieldMapping[];
  workflowState?: WorkflowState;
  lastFillSnapshot?: FillSnapshot;
  userData?: UserData;
  signOutFlag?: boolean;
  settings?: {
    selectedModel: string;
    chatgptUrl: string;
    autoDetect: boolean;
    showFloatingIcon: boolean;
    autoOpenChatGPT: boolean;
    autoPasteOnChatGPT: boolean;
  };
}
