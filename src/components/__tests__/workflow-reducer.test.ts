import { describe, it, expect } from "vitest";
import {
  workflowReducer,
  initialWorkflowState,
  type WorkflowState,
  type WorkflowAction,
} from "@/components/workflow-reducer";

describe("workflowReducer", () => {
  it("has correct initial state", () => {
    expect(initialWorkflowState.currentStep).toBe("upload");
    expect(initialWorkflowState.sessionId).toBeNull();
    expect(initialWorkflowState.uploadResult).toBeNull();
    expect(initialWorkflowState.analysisResult).toBeNull();
    expect(initialWorkflowState.summaryResult).toBeNull();
    expect(initialWorkflowState.publishResult).toBeNull();
    expect(initialWorkflowState.error).toBeNull();
    expect(initialWorkflowState.isLoading).toBe(false);
  });

  it("sets loading state on SET_LOADING", () => {
    const state = workflowReducer(initialWorkflowState, {
      type: "SET_LOADING",
      payload: true,
    });
    expect(state.isLoading).toBe(true);
  });

  it("stores upload result and advances to analyze step on UPLOAD_SUCCESS", () => {
    const uploadResult = {
      sessionId: "sess-1",
      fileCount: 5,
      manifest: [],
      totalSize: 1024,
    };
    const state = workflowReducer(initialWorkflowState, {
      type: "UPLOAD_SUCCESS",
      payload: uploadResult,
    });
    expect(state.currentStep).toBe("analyze");
    expect(state.sessionId).toBe("sess-1");
    expect(state.uploadResult).toEqual(uploadResult);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("stores analysis result and advances to review step on ANALYSIS_SUCCESS", () => {
    const prev: WorkflowState = {
      ...initialWorkflowState,
      currentStep: "analyze",
      sessionId: "sess-1",
    };
    const analysisResult = {
      sessionId: "sess-1",
      attributes: {
        name: "Test",
        description: "A test project",
        primaryLanguages: ["TypeScript"],
        frameworks: ["Next.js"],
        keyFeatures: ["Testing"],
        projectType: "web-app",
      },
      confidence: "high" as const,
      additionalContextNeeded: false,
    };
    const state = workflowReducer(prev, {
      type: "ANALYSIS_SUCCESS",
      payload: analysisResult,
    });
    expect(state.currentStep).toBe("review");
    expect(state.analysisResult).toEqual(analysisResult);
    expect(state.isLoading).toBe(false);
  });

  it("stores summary result on SUMMARY_SUCCESS (stays on review)", () => {
    const prev: WorkflowState = {
      ...initialWorkflowState,
      currentStep: "review",
      sessionId: "sess-1",
    };
    const summaryResult = {
      sessionId: "sess-1",
      summary: "A great post!",
      characterCount: 14,
      hashtags: ["#test"],
    };
    const state = workflowReducer(prev, {
      type: "SUMMARY_SUCCESS",
      payload: summaryResult,
    });
    expect(state.currentStep).toBe("review");
    expect(state.summaryResult).toEqual(summaryResult);
    expect(state.isLoading).toBe(false);
  });

  it("stores publish result and advances to complete on PUBLISH_SUCCESS", () => {
    const prev: WorkflowState = {
      ...initialWorkflowState,
      currentStep: "publish",
      sessionId: "sess-1",
    };
    const publishResult = {
      postUrn: "urn:li:share:123",
      postUrl: "https://linkedin.com/feed/update/urn:li:share:123/",
    };
    const state = workflowReducer(prev, {
      type: "PUBLISH_SUCCESS",
      payload: publishResult,
    });
    expect(state.currentStep).toBe("complete");
    expect(state.publishResult).toEqual(publishResult);
    expect(state.isLoading).toBe(false);
  });

  it("sets error on SET_ERROR", () => {
    const state = workflowReducer(initialWorkflowState, {
      type: "SET_ERROR",
      payload: { step: "upload", message: "Upload failed" },
    });
    expect(state.error).toEqual({ step: "upload", message: "Upload failed" });
    expect(state.isLoading).toBe(false);
  });

  it("clears error on CLEAR_ERROR", () => {
    const prev: WorkflowState = {
      ...initialWorkflowState,
      error: { step: "upload", message: "fail" },
    };
    const state = workflowReducer(prev, { type: "CLEAR_ERROR" });
    expect(state.error).toBeNull();
  });

  it("navigates to a step on GO_TO_STEP", () => {
    const prev: WorkflowState = {
      ...initialWorkflowState,
      currentStep: "review",
      sessionId: "sess-1",
    };
    const state = workflowReducer(prev, {
      type: "GO_TO_STEP",
      payload: "upload",
    });
    expect(state.currentStep).toBe("upload");
    expect(state.error).toBeNull();
  });

  it("resets to initial state on RESET", () => {
    const prev: WorkflowState = {
      currentStep: "complete",
      sessionId: "sess-1",
      uploadResult: { sessionId: "sess-1", fileCount: 1, manifest: [], totalSize: 100 },
      analysisResult: null,
      summaryResult: null,
      publishResult: { postUrn: "urn", postUrl: "url" },
      error: null,
      isLoading: false,
      linkedInConnected: false,
    };
    const state = workflowReducer(prev, { type: "RESET" });
    expect(state).toEqual(initialWorkflowState);
  });

  it("sets LinkedIn connection status on SET_LINKEDIN_CONNECTED", () => {
    const state = workflowReducer(initialWorkflowState, {
      type: "SET_LINKEDIN_CONNECTED",
      payload: true,
    });
    expect(state.linkedInConnected).toBe(true);
  });

  it("moves to publish step on GO_TO_PUBLISH", () => {
    const prev: WorkflowState = {
      ...initialWorkflowState,
      currentStep: "review",
      sessionId: "sess-1",
      summaryResult: {
        sessionId: "sess-1",
        summary: "Post",
        characterCount: 4,
        hashtags: [],
      },
    };
    const state = workflowReducer(prev, { type: "GO_TO_PUBLISH" });
    expect(state.currentStep).toBe("publish");
  });
});
