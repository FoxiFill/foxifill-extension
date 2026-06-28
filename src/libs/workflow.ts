import { WorkflowErrorCode, WorkflowState, WorkflowStatus } from "./types";

export const STORAGE_SCHEMA_VERSION = 2;

export function createWorkflowState(status: WorkflowStatus, options?: { errorCode?: WorkflowErrorCode; errorMessage?: string }): WorkflowState {
  return {
    status,
    updatedAt: Date.now(),
    errorCode: options?.errorCode,
    errorMessage: options?.errorMessage,
  };
}

export function createIdleWorkflowState(): WorkflowState {
  return createWorkflowState("idle");
}
