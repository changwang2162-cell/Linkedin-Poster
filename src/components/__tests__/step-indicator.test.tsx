// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepIndicator } from "@/components/step-indicator";

describe("StepIndicator", () => {
  it("renders all 4 workflow steps", () => {
    render(<StepIndicator currentStep="upload" />);
    expect(screen.getByText("Upload")).toBeDefined();
    expect(screen.getByText("Analyze")).toBeDefined();
    expect(screen.getByText("Review")).toBeDefined();
    expect(screen.getByText("Publish")).toBeDefined();
  });

  it("highlights the current step as active", () => {
    render(<StepIndicator currentStep="analyze" />);
    const analyzeStep = screen.getByText("Analyze").closest("[data-step]");
    expect(analyzeStep?.getAttribute("data-active")).toBe("true");
  });

  it("marks completed steps", () => {
    render(<StepIndicator currentStep="review" />);
    const uploadStep = screen.getByText("Upload").closest("[data-step]");
    const analyzeStep = screen.getByText("Analyze").closest("[data-step]");
    expect(uploadStep?.getAttribute("data-completed")).toBe("true");
    expect(analyzeStep?.getAttribute("data-completed")).toBe("true");
  });

  it("does not mark future steps as completed or active", () => {
    render(<StepIndicator currentStep="upload" />);
    const reviewStep = screen.getByText("Review").closest("[data-step]");
    expect(reviewStep?.getAttribute("data-active")).not.toBe("true");
    expect(reviewStep?.getAttribute("data-completed")).not.toBe("true");
  });

  it("shows complete state when currentStep is complete", () => {
    render(<StepIndicator currentStep="complete" />);
    // All steps should be marked completed
    const publishStep = screen.getByText("Publish").closest("[data-step]");
    expect(publishStep?.getAttribute("data-completed")).toBe("true");
  });
});
