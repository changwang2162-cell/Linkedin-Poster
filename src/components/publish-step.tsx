"use client";

import type { PublishResult } from "@/lib/types";

interface PublishStepProps {
  onPublish: () => void;
  onRetry: () => void;
  isLoading: boolean;
  publishResult: PublishResult | null;
  error: string | null;
}

export function PublishStep({ onPublish, onRetry, isLoading, publishResult, error }: PublishStepProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400">Publishing to LinkedIn...</p>
      </div>
    );
  }

  if (publishResult) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Successfully published!
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Your project post is now live on LinkedIn.
        </p>
        <a
          href={publishResult.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#0077B5] text-white px-6 py-3 text-sm font-medium hover:bg-[#006097] transition-colors"
        >
          View Post on LinkedIn
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Publishing Failed
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-center max-w-md">
          {error}
        </p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-blue-600 text-white px-8 py-3 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg className="h-16 w-16 text-zinc-300 dark:text-zinc-600 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Ready to share your project with the world?
      </p>
      <button
        onClick={onPublish}
        className="rounded-lg bg-[#0077B5] text-white px-8 py-3 text-sm font-medium hover:bg-[#006097] transition-colors"
      >
        Publish to LinkedIn
      </button>
    </div>
  );
}
