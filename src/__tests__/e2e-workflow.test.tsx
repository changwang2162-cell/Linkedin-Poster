// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Home from "@/app/page";

// Mock fetch globally for all tests
const mockFetch = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  // Default: auth status returns not connected
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/api/auth/status")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ connected: false }),
      });
    }
    return Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Not mocked" } }),
    });
  });
  vi.stubGlobal("fetch", mockFetch);
});

describe("E2E Workflow Validation", () => {
  describe("Initial state and step transitions", () => {
    it("renders the upload step initially with all 4 step indicators", async () => {
      await act(async () => {
        render(<Home />);
      });

      // Step indicators present
      expect(screen.getByText("Upload")).toBeDefined();
      expect(screen.getByText("Analyze")).toBeDefined();
      expect(screen.getByText("Review")).toBeDefined();
      expect(screen.getByText("Publish")).toBeDefined();

      // Upload UI present
      expect(screen.getByText(/drag/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/github/i)).toBeDefined();
    });

    it("shows the app title", async () => {
      await act(async () => {
        render(<Home />);
      });
      expect(screen.getByText("LinkedIn Project Poster")).toBeDefined();
    });

    it("does not show Start Over button on upload step", async () => {
      await act(async () => {
        render(<Home />);
      });
      expect(screen.queryByText("Start Over")).toBeNull();
    });
  });

  describe("Upload → Analyze transition", () => {
    it("transitions to analyze step after successful file upload", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connected: false }),
          });
        }
        if (typeof url === "string" && url.includes("/api/upload")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "test-session",
                fileCount: 3,
                manifest: [
                  { path: "README.md", size: 100, language: null, priority: "high" },
                ],
                totalSize: 300,
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Not mocked" } }),
        });
      });

      await act(async () => {
        render(<Home />);
      });

      // Upload a file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["content"], "project.zip", { type: "application/zip" });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should transition to analyze step
      await waitFor(() => {
        expect(screen.getByText(/analyze project/i)).toBeDefined();
      });
    });

    it("transitions to analyze step after successful GitHub import", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/auth/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connected: false }),
          });
        }
        if (typeof url === "string" && url.includes("/api/upload")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "gh-session",
                fileCount: 5,
                manifest: [],
                totalSize: 1000,
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Not mocked" } }),
        });
      });

      await act(async () => {
        render(<Home />);
      });

      const input = screen.getByPlaceholderText(/github/i);
      const importBtn = screen.getByRole("button", { name: /import/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: "https://github.com/user/repo" } });
        fireEvent.click(importBtn);
      });

      await waitFor(() => {
        expect(screen.getByText(/analyze project/i)).toBeDefined();
      });
    });

    it("shows error on upload failure without leaving upload step", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connected: false }),
          });
        }
        if (typeof url === "string" && url.includes("/api/upload")) {
          return Promise.resolve({
            ok: false,
            status: 413,
            json: () =>
              Promise.resolve({ error: { code: "FILE_TOO_LARGE", message: "File exceeds 50MB limit" } }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Not mocked" } }),
        });
      });

      await act(async () => {
        render(<Home />);
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["x"], "big.zip", { type: "application/zip" });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/exceeds/i)).toBeDefined();
      });

      // Still on upload step (GitHub input still visible alongside error)
      expect(screen.getByPlaceholderText(/github/i)).toBeDefined();
    });
  });

  describe("Full workflow: Upload → Analyze → Review → Publish", () => {
    function setupFullWorkflowMocks() {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/auth/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connected: true, displayName: "Test User" }),
          });
        }
        if (typeof url === "string" && url.includes("/api/upload")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "workflow-session",
                fileCount: 3,
                manifest: [{ path: "README.md", size: 100, language: null, priority: "high" }],
                totalSize: 500,
              }),
          });
        }
        if (typeof url === "string" && url.includes("/api/analyze")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "workflow-session",
                attributes: {
                  name: "TestProject",
                  description: "A test project",
                  primaryLanguages: ["TypeScript"],
                  frameworks: ["React"],
                  keyFeatures: ["Fast"],
                  projectType: "web-app",
                },
                confidence: "high",
                additionalContextNeeded: false,
              }),
          });
        }
        if (typeof url === "string" && url.includes("/api/summary/generate")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                summary: "Check out TestProject! Built with TypeScript and React.",
                characterCount: 52,
                hashtags: ["#typescript", "#react"],
              }),
          });
        }
        if (typeof url === "string" && url.includes("/api/publish")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                postUrn: "urn:li:share:12345",
                postUrl: "https://www.linkedin.com/feed/update/urn:li:share:12345/",
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Not mocked" } }),
        });
      });
    }

    it("completes the full journey: upload → analyze → generate → publish", async () => {
      setupFullWorkflowMocks();

      await act(async () => {
        render(<Home />);
      });

      // Step 1: Upload
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["content"], "project.zip", { type: "application/zip" });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Step 2: Analyze
      await waitFor(() => {
        expect(screen.getByText(/analyze project/i)).toBeDefined();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /analyze project/i }));
      });

      // Step 3: Review — generate summary
      await waitFor(() => {
        expect(screen.getByText(/generate summary/i)).toBeDefined();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));
      });

      // Summary should appear
      await waitFor(() => {
        expect(screen.getByText(/TestProject/)).toBeDefined();
        expect(screen.getByText(/52/)).toBeDefined();
      });

      // Step 4: Proceed to publish
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /proceed to publish/i }));
      });

      // Publish step
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /publish.*linkedin/i })).toBeDefined();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /publish.*linkedin/i }));
      });

      // Success
      await waitFor(() => {
        expect(screen.getByText(/published/i)).toBeDefined();
        const link = screen.getByRole("link", { name: /view.*post/i });
        expect(link.getAttribute("href")).toContain("12345");
      });
    });
  });

  describe("Error recovery", () => {
    it("preserves workflow state after error and allows retry", async () => {
      const analyzeResponses: Array<() => Promise<Response>> = [];
      // First call fails
      analyzeResponses.push(() =>
        Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({ error: { code: "LLM_ERROR", message: "Analysis timed out" } }),
        } as Response)
      );
      // Second call succeeds
      analyzeResponses.push(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: "err-session",
              attributes: {
                name: "Recovered",
                description: "A recovered project",
                primaryLanguages: ["Python"],
                frameworks: [],
                keyFeatures: [],
                projectType: "other",
              },
              confidence: "medium",
              additionalContextNeeded: false,
            }),
        } as Response)
      );
      let analyzeIdx = 0;

      mockFetch.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connected: false }),
          });
        }
        if (typeof url === "string" && url.includes("/api/upload")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "err-session",
                fileCount: 2,
                manifest: [],
                totalSize: 200,
              }),
          });
        }
        if (typeof url === "string" && url.includes("/api/analyze")) {
          const resp = analyzeResponses[analyzeIdx] || analyzeResponses[analyzeResponses.length - 1];
          analyzeIdx++;
          return resp();
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Not mocked" } }),
        });
      });

      await act(async () => {
        render(<Home />);
      });

      // Upload
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(fileInput, {
          target: { files: [new File(["x"], "p.zip", { type: "application/zip" })] },
        });
      });

      // Analyze — first attempt fails
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /analyze project/i })).toBeDefined();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /analyze project/i }));
      });

      // Error shown
      await waitFor(() => {
        expect(screen.getByText(/timed out/i)).toBeDefined();
      });

      // Dismiss error via retry
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      });

      // Analyze button should be visible again
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /analyze project/i })).toBeDefined();
      });

      // Retry analysis — second call succeeds
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /analyze project/i }));
      });

      // Should succeed and advance to review step (Generate Summary button visible)
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /generate summary/i })).toBeDefined();
      });
    });

    it("shows Start Over button on non-upload steps", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connected: false }),
          });
        }
        if (typeof url === "string" && url.includes("/api/upload")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "so-session",
                fileCount: 1,
                manifest: [],
                totalSize: 100,
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Not mocked" } }),
        });
      });

      await act(async () => {
        render(<Home />);
      });

      // Upload a file
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(fileInput, {
          target: { files: [new File(["x"], "p.zip", { type: "application/zip" })] },
        });
      });

      // On analyze step — Start Over should appear
      await waitFor(() => {
        expect(screen.getByText("Start Over")).toBeDefined();
      });

      // Click Start Over — should go back to upload
      await act(async () => {
        fireEvent.click(screen.getByText("Start Over"));
      });

      expect(screen.getByPlaceholderText(/github/i)).toBeDefined();
      expect(screen.queryByText("Start Over")).toBeNull();
    });
  });

  describe("LinkedIn connection status", () => {
    it("checks LinkedIn connection on mount and reflects connected state in review", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/api/auth/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ connected: true, displayName: "Jane" }),
          });
        }
        if (typeof url === "string" && url.includes("/api/upload")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "li-session",
                fileCount: 1,
                manifest: [],
                totalSize: 100,
              }),
          });
        }
        if (typeof url === "string" && url.includes("/api/analyze")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                sessionId: "li-session",
                attributes: {
                  name: "P",
                  description: "D",
                  primaryLanguages: [],
                  frameworks: [],
                  keyFeatures: [],
                  projectType: "other",
                },
                confidence: "medium",
                additionalContextNeeded: false,
              }),
          });
        }
        if (typeof url === "string" && url.includes("/api/summary/generate")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                summary: "A post",
                characterCount: 6,
                hashtags: [],
              }),
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Not mocked" } }),
        });
      });

      await act(async () => {
        render(<Home />);
      });

      // Upload → Analyze → Review
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(fileInput, {
          target: { files: [new File(["x"], "p.zip", { type: "application/zip" })] },
        });
      });

      await waitFor(() => expect(screen.getByText(/analyze project/i)).toBeDefined());
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /analyze project/i }));
      });

      await waitFor(() => expect(screen.getByText(/generate summary/i)).toBeDefined());
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));
      });

      // Connected: should show "Proceed to Publish" not "Connect LinkedIn"
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /proceed to publish/i })).toBeDefined();
        expect(screen.queryByText(/connect linkedin/i)).toBeNull();
      });
    });
  });
});
