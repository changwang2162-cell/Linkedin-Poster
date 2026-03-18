// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PublishStep } from "@/components/publish-step";
import type { PublishResult } from "@/lib/types";

describe("PublishStep", () => {
  it("shows publish confirmation button", () => {
    render(
      <PublishStep
        onPublish={vi.fn()}
        onRetry={vi.fn()}
        isLoading={false}
        publishResult={null}
        error={null}
      />
    );
    expect(screen.getByRole("button", { name: /publish.*linkedin/i })).toBeDefined();
  });

  it("calls onPublish when button is clicked", () => {
    const onPublish = vi.fn();
    render(
      <PublishStep
        onPublish={onPublish}
        onRetry={vi.fn()}
        isLoading={false}
        publishResult={null}
        error={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /publish.*linkedin/i }));
    expect(onPublish).toHaveBeenCalled();
  });

  it("shows progress indicator during publishing", () => {
    render(
      <PublishStep
        onPublish={vi.fn()}
        onRetry={vi.fn()}
        isLoading={true}
        publishResult={null}
        error={null}
      />
    );
    expect(screen.getByText(/publishing/i)).toBeDefined();
  });

  it("shows success with post link after publishing", () => {
    const result: PublishResult = {
      postUrn: "urn:li:share:123",
      postUrl: "https://www.linkedin.com/feed/update/urn:li:share:123/",
    };
    render(
      <PublishStep
        onPublish={vi.fn()}
        onRetry={vi.fn()}
        isLoading={false}
        publishResult={result}
        error={null}
      />
    );
    expect(screen.getByText(/published/i)).toBeDefined();
    const link = screen.getByRole("link", { name: /view.*post/i });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:123/"
    );
  });

  it("shows error with retry button on failure", () => {
    render(
      <PublishStep
        onPublish={vi.fn()}
        onRetry={vi.fn()}
        isLoading={false}
        publishResult={null}
        error="Rate limit exceeded. Please try again later."
      />
    );
    expect(screen.getByText(/rate limit/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /retry/i })).toBeDefined();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(
      <PublishStep
        onPublish={vi.fn()}
        onRetry={onRetry}
        isLoading={false}
        publishResult={null}
        error="Something went wrong"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
