// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewStep } from "@/components/review-step";
import type { SummaryResult } from "@/lib/types";

describe("ReviewStep", () => {
  const mockSummary: SummaryResult = {
    sessionId: "sess-1",
    summary: "Check out my awesome project! It does amazing things with TypeScript and React.",
    characterCount: 78,
    hashtags: ["#typescript", "#react", "#opensource"],
  };

  it("shows generate button when no summary exists", () => {
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={null}
        linkedInConnected={true}
      />
    );
    expect(screen.getByRole("button", { name: /generate/i })).toBeDefined();
  });

  it("calls onGenerate when generate button clicked", () => {
    const onGenerate = vi.fn();
    render(
      <ReviewStep
        onGenerate={onGenerate}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={null}
        linkedInConnected={true}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it("displays summary text and character count", () => {
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={mockSummary}
        linkedInConnected={true}
      />
    );
    expect(screen.getByText(/awesome project/)).toBeDefined();
    expect(screen.getByText(/78/)).toBeDefined();
  });

  it("displays hashtags", () => {
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={mockSummary}
        linkedInConnected={true}
      />
    );
    expect(screen.getByText(/#typescript/)).toBeDefined();
    expect(screen.getByText(/#react/)).toBeDefined();
  });

  it("shows feedback input and regenerate button when summary exists", () => {
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={mockSummary}
        linkedInConnected={true}
      />
    );
    expect(screen.getByPlaceholderText(/feedback/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeDefined();
  });

  it("calls onRegenerate with feedback text", () => {
    const onRegenerate = vi.fn();
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={onRegenerate}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={mockSummary}
        linkedInConnected={true}
      />
    );
    const input = screen.getByPlaceholderText(/feedback/i);
    fireEvent.change(input, { target: { value: "Make it shorter" } });
    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    expect(onRegenerate).toHaveBeenCalledWith("Make it shorter");
  });

  it("shows Connect LinkedIn button when not connected", () => {
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={mockSummary}
        linkedInConnected={false}
      />
    );
    expect(screen.getByText(/connect linkedin/i)).toBeDefined();
  });

  it("shows Publish button when connected and summary exists", () => {
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={false}
        summaryResult={mockSummary}
        linkedInConnected={true}
      />
    );
    expect(screen.getByRole("button", { name: /publish|proceed/i })).toBeDefined();
  });

  it("shows loading state during generation", () => {
    render(
      <ReviewStep
        onGenerate={vi.fn()}
        onRegenerate={vi.fn()}
        onPublish={vi.fn()}
        isLoading={true}
        summaryResult={null}
        linkedInConnected={true}
      />
    );
    expect(screen.getByText(/generating/i)).toBeDefined();
  });
});
