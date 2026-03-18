"use client";

import { useReducer, useCallback, useEffect } from "react";
import { workflowReducer, initialWorkflowState } from "@/components/workflow-reducer";
import { StepIndicator } from "@/components/step-indicator";
import { UploadStep } from "@/components/upload-step";
import { AnalyzeStep } from "@/components/analyze-step";
import { ReviewStep } from "@/components/review-step";
import { PublishStep } from "@/components/publish-step";
import { ErrorDisplay } from "@/components/error-display";

export default function Home() {
  const [state, dispatch] = useReducer(workflowReducer, initialWorkflowState);

  // Check LinkedIn connection status on mount
  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.connected) {
          dispatch({ type: "SET_LINKEDIN_CONNECTED", payload: true });
        }
      })
      .catch(() => {
        // silently ignore — user can connect later
      });
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", payload: { step: "upload", message: data.error?.message || "Upload failed" } });
        return;
      }
      dispatch({ type: "UPLOAD_SUCCESS", payload: data });
    } catch {
      dispatch({ type: "SET_ERROR", payload: { step: "upload", message: "Network error. Please try again." } });
    }
  }, []);

  const handleGitHubImport = useCallback(async (url: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", payload: { step: "upload", message: data.error?.message || "Import failed" } });
        return;
      }
      dispatch({ type: "UPLOAD_SUCCESS", payload: data });
    } catch {
      dispatch({ type: "SET_ERROR", payload: { step: "upload", message: "Network error. Please try again." } });
    }
  }, []);

  const handleAnalyze = useCallback(async (additionalContext?: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, additionalContext }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", payload: { step: "analyze", message: data.error?.message || "Analysis failed" } });
        return;
      }
      dispatch({ type: "ANALYSIS_SUCCESS", payload: data });
    } catch {
      dispatch({ type: "SET_ERROR", payload: { step: "analyze", message: "Network error. Please try again." } });
    }
  }, [state.sessionId]);

  const handleGenerate = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    try {
      const res = await fetch("/api/summary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", payload: { step: "review", message: data.error?.message || "Generation failed" } });
        return;
      }
      dispatch({ type: "SUMMARY_SUCCESS", payload: { sessionId: state.sessionId!, ...data } });
    } catch {
      dispatch({ type: "SET_ERROR", payload: { step: "review", message: "Network error. Please try again." } });
    }
  }, [state.sessionId]);

  const handleRegenerate = useCallback(async (feedback: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    try {
      const res = await fetch("/api/summary/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, feedback }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", payload: { step: "review", message: data.error?.message || "Regeneration failed" } });
        return;
      }
      dispatch({ type: "SUMMARY_SUCCESS", payload: { sessionId: state.sessionId!, ...data } });
    } catch {
      dispatch({ type: "SET_ERROR", payload: { step: "review", message: "Network error. Please try again." } });
    }
  }, [state.sessionId]);

  const handlePublish = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", payload: { step: "publish", message: data.error?.message || "Publishing failed" } });
        return;
      }
      dispatch({ type: "PUBLISH_SUCCESS", payload: data });
    } catch {
      dispatch({ type: "SET_ERROR", payload: { step: "publish", message: "Network error. Please try again." } });
    }
  }, [state.sessionId]);

  const handleRetry = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const currentStepError =
    state.error?.step === state.currentStep ? state.error.message : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            LinkedIn Project Poster
          </h1>
          {state.currentStep !== "upload" && state.currentStep !== "complete" && (
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <StepIndicator currentStep={state.currentStep} />

        {/* Error display */}
        <ErrorDisplay
          message={currentStepError}
          onDismiss={() => dispatch({ type: "CLEAR_ERROR" })}
          onRetry={handleRetry}
        />

        {/* Step content */}
        {state.currentStep === "upload" && (
          <UploadStep
            onUpload={handleUpload}
            onGitHubImport={handleGitHubImport}
            isLoading={state.isLoading}
            manifest={state.uploadResult?.manifest}
          />
        )}

        {state.currentStep === "analyze" && (
          <AnalyzeStep
            onAnalyze={() => handleAnalyze()}
            onProvideContext={(ctx) => handleAnalyze(ctx)}
            isLoading={state.isLoading}
            analysisResult={state.analysisResult}
          />
        )}

        {state.currentStep === "review" && (
          <ReviewStep
            onGenerate={handleGenerate}
            onRegenerate={handleRegenerate}
            onPublish={() => dispatch({ type: "GO_TO_PUBLISH" })}
            isLoading={state.isLoading}
            summaryResult={state.summaryResult}
            linkedInConnected={state.linkedInConnected}
          />
        )}

        {state.currentStep === "publish" && (
          <PublishStep
            onPublish={handlePublish}
            onRetry={handlePublish}
            isLoading={state.isLoading}
            publishResult={state.publishResult}
            error={currentStepError}
          />
        )}

        {state.currentStep === "complete" && (
          <PublishStep
            onPublish={() => {}}
            onRetry={() => {}}
            isLoading={false}
            publishResult={state.publishResult}
            error={null}
          />
        )}
      </main>
    </div>
  );
}
