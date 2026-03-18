// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalyzeStep } from "@/components/analyze-step";
import type { AnalysisResult } from "@/lib/types";

describe("AnalyzeStep", () => {
  it("renders analyze button", () => {
    render(
      <AnalyzeStep
        onAnalyze={vi.fn()}
        onProvideContext={vi.fn()}
        isLoading={false}
        analysisResult={null}
      />
    );
    expect(screen.getByRole("button", { name: /analyze/i })).toBeDefined();
  });

  it("calls onAnalyze when button is clicked", () => {
    const onAnalyze = vi.fn();
    render(
      <AnalyzeStep
        onAnalyze={onAnalyze}
        onProvideContext={vi.fn()}
        isLoading={false}
        analysisResult={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /analyze/i }));
    expect(onAnalyze).toHaveBeenCalled();
  });

  it("shows loading indicator when analyzing", () => {
    render(
      <AnalyzeStep
        onAnalyze={vi.fn()}
        onProvideContext={vi.fn()}
        isLoading={true}
        analysisResult={null}
      />
    );
    expect(screen.getByText(/analyzing/i)).toBeDefined();
  });

  it("displays project attributes when analysis is complete", () => {
    const result: AnalysisResult = {
      sessionId: "sess-1",
      attributes: {
        name: "MyProject",
        description: "A cool project",
        primaryLanguages: ["TypeScript"],
        frameworks: ["React"],
        keyFeatures: ["Fast", "Reliable"],
        projectType: "web-app",
      },
      confidence: "high",
      additionalContextNeeded: false,
    };
    render(
      <AnalyzeStep
        onAnalyze={vi.fn()}
        onProvideContext={vi.fn()}
        isLoading={false}
        analysisResult={result}
      />
    );
    expect(screen.getByText("MyProject")).toBeDefined();
    expect(screen.getByText(/TypeScript/)).toBeDefined();
    expect(screen.getByText(/React/)).toBeDefined();
  });

  it("shows context input when additional context is needed", () => {
    const result: AnalysisResult = {
      sessionId: "sess-1",
      attributes: {
        name: "Unknown",
        description: "",
        primaryLanguages: [],
        frameworks: [],
        keyFeatures: [],
        projectType: "unknown",
      },
      confidence: "low",
      additionalContextNeeded: true,
      contextPrompt: "Please describe your project.",
    };
    render(
      <AnalyzeStep
        onAnalyze={vi.fn()}
        onProvideContext={vi.fn()}
        isLoading={false}
        analysisResult={result}
      />
    );
    expect(screen.getByText(/additional context/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/describe/i)).toBeDefined();
  });

  it("calls onProvideContext with user input", () => {
    const onProvideContext = vi.fn();
    const result: AnalysisResult = {
      sessionId: "sess-1",
      attributes: {
        name: "Unknown",
        description: "",
        primaryLanguages: [],
        frameworks: [],
        keyFeatures: [],
        projectType: "unknown",
      },
      confidence: "low",
      additionalContextNeeded: true,
      contextPrompt: "Please describe your project.",
    };
    render(
      <AnalyzeStep
        onAnalyze={vi.fn()}
        onProvideContext={onProvideContext}
        isLoading={false}
        analysisResult={result}
      />
    );
    const input = screen.getByPlaceholderText(/describe/i);
    fireEvent.change(input, { target: { value: "It's a CLI tool" } });
    fireEvent.click(screen.getByRole("button", { name: /re-analyze/i }));
    expect(onProvideContext).toHaveBeenCalledWith("It's a CLI tool");
  });
});
