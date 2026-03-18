// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadStep } from "@/components/upload-step";

describe("UploadStep", () => {
  it("renders the file drop zone", () => {
    render(<UploadStep onUpload={vi.fn()} onGitHubImport={vi.fn()} isLoading={false} />);
    expect(screen.getByText(/drag/i)).toBeDefined();
  });

  it("renders the GitHub URL input", () => {
    render(<UploadStep onUpload={vi.fn()} onGitHubImport={vi.fn()} isLoading={false} />);
    expect(screen.getByPlaceholderText(/github/i)).toBeDefined();
  });

  it("calls onUpload when a file is selected via input", () => {
    const onUpload = vi.fn();
    render(<UploadStep onUpload={onUpload} onGitHubImport={vi.fn()} isLoading={false} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDefined();

    const file = new File(["content"], "project.zip", { type: "application/zip" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it("calls onGitHubImport when GitHub URL is submitted", () => {
    const onGitHubImport = vi.fn();
    render(<UploadStep onUpload={vi.fn()} onGitHubImport={onGitHubImport} isLoading={false} />);
    const input = screen.getByPlaceholderText(/github/i);
    const button = screen.getByRole("button", { name: /import/i });

    fireEvent.change(input, { target: { value: "https://github.com/user/repo" } });
    fireEvent.click(button);
    expect(onGitHubImport).toHaveBeenCalledWith("https://github.com/user/repo");
  });

  it("shows loading state and hides inputs when loading", () => {
    render(<UploadStep onUpload={vi.fn()} onGitHubImport={vi.fn()} isLoading={true} />);
    expect(screen.getByText(/uploading|processing/i)).toBeDefined();
    expect(screen.queryByPlaceholderText(/github/i)).toBeNull();
  });

  it("displays file manifest when provided", () => {
    const manifest = [
      { path: "README.md", size: 1024, language: null, priority: "high" as const },
      { path: "src/index.ts", size: 512, language: "TypeScript", priority: "medium" as const },
    ];
    render(
      <UploadStep
        onUpload={vi.fn()}
        onGitHubImport={vi.fn()}
        isLoading={false}
        manifest={manifest}
      />
    );
    expect(screen.getByText("README.md")).toBeDefined();
    expect(screen.getByText("src/index.ts")).toBeDefined();
  });
});
