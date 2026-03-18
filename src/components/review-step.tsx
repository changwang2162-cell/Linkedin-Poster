"use client";

import { useState } from "react";
import type { SummaryResult } from "@/lib/types";

interface ReviewStepProps {
  onGenerate: () => void;
  onRegenerate: (feedback: string) => void;
  onPublish: () => void;
  isLoading: boolean;
  summaryResult: SummaryResult | null;
  linkedInConnected: boolean;
}

export function ReviewStep({
  onGenerate,
  onRegenerate,
  onPublish,
  isLoading,
  summaryResult,
  linkedInConnected,
}: ReviewStepProps) {
  const [feedback, setFeedback] = useState("");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400">Generating your LinkedIn post...</p>
      </div>
    );
  }

  if (!summaryResult) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Generate a LinkedIn post from your project analysis
        </p>
        <button
          onClick={onGenerate}
          className="rounded-lg bg-blue-600 text-white px-8 py-3 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Generate Summary
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Post Preview */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Post Preview</span>
          <span className="text-xs text-zinc-500">
            {summaryResult.characterCount} / 3,000 characters
          </span>
        </div>
        <div className="p-4">
          <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {summaryResult.summary}
          </p>
          {summaryResult.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {summaryResult.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm text-blue-600 dark:text-blue-400 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feedback & Regenerate */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Provide feedback to refine the post..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => {
            onRegenerate(feedback);
            setFeedback("");
          }}
          disabled={!feedback.trim()}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-6 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          Regenerate
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {!linkedInConnected ? (
          <a
            href="/api/auth/linkedin"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0077B5] text-white px-6 py-3 text-sm font-medium hover:bg-[#006097] transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Connect LinkedIn
          </a>
        ) : (
          <button
            onClick={onPublish}
            className="rounded-lg bg-blue-600 text-white px-8 py-3 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Proceed to Publish
          </button>
        )}
      </div>
    </div>
  );
}
