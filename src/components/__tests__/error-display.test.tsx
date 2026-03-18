// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorDisplay } from "@/components/error-display";

describe("ErrorDisplay", () => {
  it("renders error message", () => {
    render(<ErrorDisplay message="Something went wrong" onDismiss={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ErrorDisplay message="Error" onDismiss={onDismiss} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay message="Error" onDismiss={vi.fn()} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("does not render when message is null", () => {
    const { container } = render(<ErrorDisplay message={null} onDismiss={vi.fn()} onRetry={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});
