import React, { useEffect, useMemo } from "react";
import { SUPPORTED_MODELS, getModelById } from "../libs/config";
import { useExtensionStore } from "./store";

const workflowLabelMap: Record<string, string> = {
  idle: "Idle",
  capturing: "Capturing",
  prompt_ready: "Prompt Ready",
  waiting_ai: "Waiting AI",
  review_ready: "Review Ready",
  applying: "Applying",
  done: "Done",
  error: "Error",
};

const workflowClassMap: Record<string, string> = {
  idle: "bg-gray-100 text-gray-700",
  capturing: "bg-amber-100 text-amber-700",
  prompt_ready: "bg-blue-100 text-blue-700",
  waiting_ai: "bg-purple-100 text-purple-700",
  review_ready: "bg-sky-100 text-sky-700",
  applying: "bg-orange-100 text-orange-700",
  done: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
};

export const Popup: React.FC = () => {
  const {
    settings,
    workflowState,
    currentFormData,
    parsedAIResponse,
    fieldMappings,
    isBusy,
    error,
    info,
    initialize,
    captureForm,
    openModel,
    readAIFromClipboard,
    refreshMappings,
    toggleMapping,
    applyMappings,
    undoLastFill,
    updateSetting,
    clearError,
  } = useExtensionStore();

  useEffect(() => {
    initialize().catch(() => {
      // Ignore and allow UI error state.
    });
  }, [initialize]);

  const mappingStats = useMemo(() => {
    const matched = fieldMappings.filter((item) => item.status === "matched").length;
    const conflicts = fieldMappings.filter((item) => item.status === "conflict").length;
    const unmatched = fieldMappings.filter((item) => item.status === "unmatched").length;
    const enabled = fieldMappings.filter((item) => item.enabled).length;

    return { matched, conflicts, unmatched, enabled };
  }, [fieldMappings]);

  const workflowLabel = workflowLabelMap[workflowState.status] || "Idle";
  const workflowClass = workflowClassMap[workflowState.status] || workflowClassMap.idle;

  return (
    <div className="w-[380px] bg-white max-h-[700px] flex flex-col">
      <header className="bg-primary text-white p-4 border-b border-black/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="FoxiFill" className="w-8 h-8" />
            <div>
              <h1 className="font-semibold text-lg leading-tight">FoxiFill</h1>
              <p className="text-xs opacity-80">AI form filler workflow center</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${workflowClass}`}>{workflowLabel}</span>
        </div>
      </header>

      <main className="p-4 space-y-4 overflow-y-auto">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-xs p-3">
            <div className="font-semibold mb-1">Error</div>
            <div>{error}</div>
            <button onClick={clearError} className="mt-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {info && <div className="rounded-md border border-green-200 bg-green-50 text-green-700 text-xs p-3">{info}</div>}

        <section className="rounded-lg border border-gray-200 p-3 space-y-3">
          <h2 className="font-semibold text-sm text-[#243036]">Workflow Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => captureForm()}
              disabled={isBusy}
              className="px-3 py-2 rounded-md bg-[#F67B26] text-white text-xs font-semibold disabled:opacity-50"
            >
              Capture Form
            </button>
            <button
              onClick={() => openModel()}
              disabled={isBusy}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs font-semibold text-[#243036] disabled:opacity-50"
            >
              Open AI
            </button>
            <button
              onClick={() => readAIFromClipboard()}
              disabled={isBusy}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs font-semibold text-[#243036] disabled:opacity-50"
            >
              Read AI JSON
            </button>
            <button
              onClick={() => refreshMappings()}
              disabled={isBusy || !parsedAIResponse}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs font-semibold text-[#243036] disabled:opacity-50"
            >
              Rebuild Mapping
            </button>
            <button
              onClick={() => applyMappings()}
              disabled={isBusy || mappingStats.enabled === 0}
              className="px-3 py-2 rounded-md bg-[#243036] text-white text-xs font-semibold disabled:opacity-50"
            >
              Apply Fill
            </button>
            <button
              onClick={() => undoLastFill()}
              disabled={isBusy}
              className="px-3 py-2 rounded-md border border-gray-300 text-xs font-semibold text-[#243036] disabled:opacity-50"
            >
              Undo Last Fill
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 p-3 space-y-2">
          <h2 className="font-semibold text-sm text-[#243036]">Context</h2>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Captured fields: {currentFormData?.fields.length || 0}</div>
            <div>AI keys parsed: {parsedAIResponse ? Object.keys(parsedAIResponse.values).length : 0}</div>
            <div>
              Mapping: {mappingStats.matched} matched / {mappingStats.conflicts} conflict / {mappingStats.unmatched} unmatched
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-[#243036]">Review Mapping</h2>
            <span className="text-xs text-gray-500">Enabled {mappingStats.enabled}</span>
          </div>

          {fieldMappings.length === 0 ? (
            <div className="text-xs text-gray-500">No mappings yet. Capture a form and import AI JSON first.</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {fieldMappings.map((mapping) => {
                const statusClass =
                  mapping.status === "matched"
                    ? "border-green-200 bg-green-50"
                    : mapping.status === "conflict"
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 bg-gray-50";

                return (
                  <label key={mapping.id} className={`block rounded-md border p-2 text-xs ${statusClass}`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={mapping.enabled}
                        disabled={mapping.status === "unmatched"}
                        onChange={(event) => {
                          toggleMapping(mapping.id, event.target.checked).catch(() => {
                            // Ignore and keep previous state.
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="font-semibold text-[#243036] truncate">{mapping.responseKey}</div>
                        <div className="text-gray-700 break-words">{mapping.responseValue || "(empty)"}</div>
                        <div className="text-gray-500">
                          {mapping.status.toUpperCase()} · {mapping.matchType} · {Math.round(mapping.confidence * 100)}%
                        </div>
                        {mapping.fieldLabel && <div className="text-gray-500 truncate">Field: {mapping.fieldLabel}</div>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 p-3 space-y-3">
          <h2 className="font-semibold text-sm text-[#243036]">Settings</h2>

          <div className="space-y-2">
            <div className="font-medium text-xs">Default AI Model</div>
            <div className="relative">
              <select
                value={settings.selectedModel}
                onChange={(event) => updateSetting("selectedModel", event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#F67B26]/20 focus:border-[#F67B26] bg-white"
              >
                {SUPPORTED_MODELS.map((model) => (
                  <option key={model.id} value={model.id} disabled={!model.enabled}>
                    {model.name} {model.comingSoon ? "(Coming Soon)" : ""}
                  </option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 transform -translate-y-1/2 pointer-events-none">
                {(() => {
                  const selectedModel = getModelById(settings.selectedModel);
                  return selectedModel ? <img src={selectedModel.logo} alt={selectedModel.name} className="w-4 h-4 object-contain" /> : null;
                })()}
              </div>
            </div>
          </div>

          <label className="flex items-center justify-between text-xs">
            <span className="text-[#243036]">Show Floating Icon</span>
            <input type="checkbox" checked={settings.showFloatingIcon} onChange={(event) => updateSetting("showFloatingIcon", event.target.checked)} />
          </label>

          <label className="flex items-center justify-between text-xs">
            <span className="text-[#243036]">Auto Open AI</span>
            <input type="checkbox" checked={settings.autoOpenChatGPT} onChange={(event) => updateSetting("autoOpenChatGPT", event.target.checked)} />
          </label>

          <label className="flex items-center justify-between text-xs">
            <span className="text-[#243036]">Auto Paste in AI Page</span>
            <input type="checkbox" checked={settings.autoPasteOnChatGPT} onChange={(event) => updateSetting("autoPasteOnChatGPT", event.target.checked)} />
          </label>
        </section>
      </main>

      <footer className="p-3 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-500">
        <div>Capture → Chat → Review → Apply</div>
        <a href="https://foxifill.com" target="_blank" rel="noopener noreferrer" className="text-[#F67B26] hover:text-[#E55A1A] underline">
          foxifill.com
        </a>
      </footer>
    </div>
  );
};
