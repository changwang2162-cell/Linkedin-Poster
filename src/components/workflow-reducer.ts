import type {
  UploadResult,
  AnalysisResult,
  SummaryResult,
  PublishResult,
} from "@/lib/types";

export type WorkflowStep = "upload" | "analyze" | "review" | "publish" | "complete";

export interface WorkflowState {
  currentStep: WorkflowStep;
  sessionId: string | null;
  uploadResult: UploadResult | null;
  analysisResult: AnalysisResult | null;
  summaryResult: SummaryResult | null;
  publishResult: PublishResult | null;
  error: { step: WorkflowStep; message: string } | null;
  isLoading: boolean;
  linkedInConnected: boolean;
}

export type WorkflowAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "UPLOAD_SUCCESS"; payload: UploadResult }
  | { type: "ANALYSIS_SUCCESS"; payload: AnalysisResult }
  | { type: "SUMMARY_SUCCESS"; payload: SummaryResult }
  | { type: "PUBLISH_SUCCESS"; payload: PublishResult }
  | { type: "SET_ERROR"; payload: { step: WorkflowStep; message: string } }
  | { type: "CLEAR_ERROR" }
  | { type: "GO_TO_STEP"; payload: WorkflowStep }
  | { type: "GO_TO_PUBLISH" }
  | { type: "SET_LINKEDIN_CONNECTED"; payload: boolean }
  | { type: "RESET" };

export const initialWorkflowState: WorkflowState = {
  currentStep: "upload",
  sessionId: null,
  uploadResult: null,
  analysisResult: null,
  summaryResult: null,
  publishResult: null,
  error: null,
  isLoading: false,
  linkedInConnected: false,
};

export function workflowReducer(
  state: WorkflowState,
  action: WorkflowAction
): WorkflowState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "UPLOAD_SUCCESS":
      return {
        ...state,
        currentStep: "analyze",
        sessionId: action.payload.sessionId,
        uploadResult: action.payload,
        isLoading: false,
        error: null,
      };

    case "ANALYSIS_SUCCESS":
      return {
        ...state,
        currentStep: "review",
        analysisResult: action.payload,
        isLoading: false,
        error: null,
      };

    case "SUMMARY_SUCCESS":
      return {
        ...state,
        summaryResult: action.payload,
        isLoading: false,
        error: null,
      };

    case "PUBLISH_SUCCESS":
      return {
        ...state,
        currentStep: "complete",
        publishResult: action.payload,
        isLoading: false,
        error: null,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "GO_TO_STEP":
      return { ...state, currentStep: action.payload, error: null };

    case "GO_TO_PUBLISH":
      return { ...state, currentStep: "publish" };

    case "SET_LINKEDIN_CONNECTED":
      return { ...state, linkedInConnected: action.payload };

    case "RESET":
      return initialWorkflowState;

    default:
      return state;
  }
}
