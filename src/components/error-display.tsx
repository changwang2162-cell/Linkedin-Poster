"use client";

interface ErrorDisplayProps {
  message: string | null;
  onDismiss: () => void;
  onRetry: () => void;
}

export function ErrorDisplay({ message, onDismiss, onRetry }: ErrorDisplayProps) {
  if (!message) return null;

  return (
    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onRetry}
              className="text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 underline"
            >
              Retry
            </button>
            <button
              onClick={onDismiss}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
