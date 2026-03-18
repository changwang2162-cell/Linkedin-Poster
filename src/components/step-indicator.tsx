"use client";

import type { WorkflowStep } from "./workflow-reducer";

const STEPS: { key: WorkflowStep; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "analyze", label: "Analyze" },
  { key: "review", label: "Review" },
  { key: "publish", label: "Publish" },
];

const STEP_ORDER: WorkflowStep[] = ["upload", "analyze", "review", "publish", "complete"];

function getStepIndex(step: WorkflowStep): number {
  return STEP_ORDER.indexOf(step);
}

export function StepIndicator({ currentStep }: { currentStep: WorkflowStep }) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <nav className="flex items-center justify-between w-full max-w-2xl mx-auto mb-8" aria-label="Workflow progress">
      {STEPS.map((step, i) => {
        const stepIndex = getStepIndex(step.key);
        const isActive = step.key === currentStep;
        const isCompleted = currentIndex > stepIndex;

        return (
          <div
            key={step.key}
            data-step={step.key}
            data-active={isActive ? "true" : undefined}
            data-completed={isCompleted ? "true" : undefined}
            className="flex flex-col items-center flex-1"
          >
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
                isCompleted
                  ? "bg-green-600 text-white"
                  : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {isCompleted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`mt-2 text-xs font-medium ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : isCompleted
                    ? "text-green-600 dark:text-green-400"
                    : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`hidden sm:block absolute h-0.5 w-full ${
                  isCompleted ? "bg-green-600" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
