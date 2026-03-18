"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";

interface AnalyzeStepProps {
  onAnalyze: () => void;
  onProvideContext: (context: string) => void;
  isLoading: boolean;
  analysisResult: AnalysisResult | null;
}

export function AnalyzeStep({ onAnalyze, onProvideContext, isLoading, analysisResult }: AnalyzeStepProps) {
  const [additionalContext, setAdditionalContext] = useState("");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400">Analyzing your project...</p>
      </div>
    );
  }

  if (analysisResult?.additionalContextNeeded) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Additional context needed
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {analysisResult.contextPrompt || "Please provide more details about your project."}
          </p>
        </div>
        <textarea
          placeholder="Describe your project..."
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => onProvideContext(additionalContext)}
          disabled={!additionalContext.trim()}
          className="rounded-lg bg-blue-600 text-white px-6 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Re-analyze
        </button>
      </div>
    );
  }

  if (analysisResult) {
    const { attributes } = analysisResult;
    return (
      <div className="space-y-6">
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-700 dark:text-green-400">
            Analysis complete with {analysisResult.confidence} confidence
          </p>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Project Name</label>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{attributes.name}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{attributes.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Languages</label>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{attributes.primaryLanguages.join(", ") || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Frameworks</label>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{attributes.frameworks.join(", ") || "—"}</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Key Features</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {attributes.keyFeatures.map((f) => (
                <span
                  key={f}
                  className="px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Project Type</label>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{attributes.projectType}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg className="h-16 w-16 text-zinc-300 dark:text-zinc-600 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Ready to analyze your project with AI
      </p>
      <button
        onClick={onAnalyze}
        className="rounded-lg bg-blue-600 text-white px-8 py-3 text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Analyze Project
      </button>
    </div>
  );
}
