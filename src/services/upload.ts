import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { ok, err } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { FileManifestEntry, UploadResult, UploadError } from "@/lib/types";

const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".r": "r",
  ".R": "r",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".lua": "lua",
  ".dart": "dart",
  ".zig": "zig",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".hs": "haskell",
  ".ml": "ocaml",
  ".clj": "clojure",
  ".vue": "vue",
  ".svelte": "svelte",
};

const HIGH_PRIORITY_FILENAMES = new Set([
  "readme",
  "readme.md",
  "readme.txt",
  "readme.rst",
  "package.json",
  "cargo.toml",
  "go.mod",
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "pom.xml",
  "build.gradle",
  "gemfile",
  "composer.json",
  "mix.exs",
  "pubspec.yaml",
  "contributing.md",
  "changelog.md",
  "license",
  "license.md",
]);

const HIGH_PRIORITY_DIRS = ["docs", "doc", "documentation"];

const SOURCE_CODE_EXTENSIONS = new Set(Object.keys(LANGUAGE_MAP));
const CONFIG_EXTENSIONS = new Set([
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
  ".xml",
]);

export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] ?? null;
}

export function assignPriority(filePath: string): "high" | "medium" | "low" {
  const basename = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  // High priority: README, package manifests, docs
  if (HIGH_PRIORITY_FILENAMES.has(basename)) return "high";

  // High priority: files in docs directories or markdown docs
  const dirParts = filePath.toLowerCase().split(/[/\\]/);
  if (dirParts.some((d) => HIGH_PRIORITY_DIRS.includes(d))) return "high";
  if (ext === ".md" || ext === ".rst") return "high";

  // Medium priority: source code and config files
  if (SOURCE_CODE_EXTENSIONS.has(ext)) return "medium";
  if (CONFIG_EXTENSIONS.has(ext)) return "medium";

  // Low priority: everything else
  return "low";
}

function stripCommonRoot(entries: string[]): string[] {
  if (entries.length === 0) return entries;

  // Check if all entries share a common root directory
  const parts = entries.map((e) => e.split(/[/\\]/));
  const firstDir = parts[0][0];

  if (firstDir && parts.every((p) => p.length > 1 && p[0] === firstDir)) {
    return entries.map((e) => e.slice(firstDir.length + 1));
  }

  return entries;
}

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

const RECOGNIZED_EXTENSIONS = new Set([
  ...Object.keys(LANGUAGE_MAP),
  ".md",
  ".rst",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".sql",
  ".graphql",
  ".proto",
  ".dockerfile",
  ".makefile",
]);

const RECOGNIZED_FILENAMES = new Set([
  "readme",
  "readme.md",
  "readme.txt",
  "makefile",
  "dockerfile",
  "gemfile",
  "rakefile",
  "procfile",
  "package.json",
  "cargo.toml",
  "go.mod",
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "pom.xml",
  "build.gradle",
  "composer.json",
  "mix.exs",
  "pubspec.yaml",
  ".gitignore",
]);

function isRecognizedProjectFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  if (RECOGNIZED_FILENAMES.has(basename)) return true;
  const ext = path.extname(filePath).toLowerCase();
  return RECOGNIZED_EXTENSIONS.has(ext);
}

function sanitizePath(entryName: string): string | null {
  // Remove leading slashes
  let sanitized = entryName.replace(/^[/\\]+/, "");
  // Reject paths with directory traversal
  const parts = sanitized.split(/[/\\]/);
  if (parts.some((p) => p === "..")) return null;
  return sanitized;
}

export async function validateAndProcessUpload(
  buffer: Buffer,
  baseTmpDir: string
): Promise<Result<UploadResult, UploadError>> {
  // Check size limit
  if (buffer.length > MAX_UPLOAD_SIZE) {
    return err({
      code: "FILE_TOO_LARGE",
      message: `File exceeds the maximum allowed size of ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB.`,
      maxSize: MAX_UPLOAD_SIZE,
    });
  }

  // Try to parse as ZIP
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
    // Validate we can actually read entries
    zip.getEntries();
  } catch {
    return err({
      code: "CORRUPTED_ARCHIVE",
      message: "The uploaded file is not a valid ZIP archive or is corrupted.",
    });
  }

  const allEntries = zip.getEntries().filter((e) => !e.isDirectory);

  // Sanitize paths and filter out dangerous entries
  const safeEntries = allEntries
    .map((entry) => ({ entry, safePath: sanitizePath(entry.entryName) }))
    .filter((e): e is { entry: typeof allEntries[0]; safePath: string } => e.safePath !== null);

  if (safeEntries.length === 0) {
    return err({
      code: "NO_PROJECT_FILES",
      message: "The archive contains no files.",
    });
  }

  // Check for at least one recognizable project file
  const hasProjectFile = safeEntries.some((e) => isRecognizedProjectFile(e.safePath));
  if (!hasProjectFile) {
    return err({
      code: "NO_PROJECT_FILES",
      message: "The archive does not contain any recognizable project files (source code, README, or package manifest).",
    });
  }

  // Extract to session directory
  const sessionId = crypto.randomUUID();
  const sessionDir = path.join(baseTmpDir, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });
  zip.extractAllTo(sessionDir, true);

  // Build manifest with stripped common root
  const rawPaths = safeEntries.map((e) => e.safePath);
  const strippedPaths = stripCommonRoot(rawPaths);

  let totalSize = 0;
  const manifest: FileManifestEntry[] = safeEntries.map((e, i) => {
    const size = e.entry.header.size;
    totalSize += size;
    const displayPath = strippedPaths[i];

    return {
      path: displayPath,
      size,
      language: detectLanguage(displayPath),
      priority: assignPriority(displayPath),
    };
  });

  return ok({
    sessionId,
    fileCount: manifest.length,
    manifest,
    totalSize,
  });
}

export interface GitHubRepo {
  owner: string;
  repo: string;
  ref: string;
}

export function parseGitHubUrl(url: string): GitHubRepo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.replace(/^www\./, "");
  if (hostname !== "github.com") return null;

  // Remove trailing slashes and .git suffix
  let pathname = parsed.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1];
  let ref = "main";

  // Check for /tree/<branch> pattern
  if (parts.length >= 4 && parts[2] === "tree") {
    ref = parts.slice(3).join("/");
  }

  return { owner, repo, ref };
}

export async function processGitHubUrl(
  url: string,
  baseTmpDir: string
): Promise<Result<UploadResult, UploadError>> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return err({
      code: "UNSUPPORTED_FORMAT",
      message: "Invalid GitHub repository URL. Expected format: https://github.com/owner/repo",
    });
  }

  const zipUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/${parsed.ref}.zip`;

  let response: Response;
  try {
    response = await fetch(zipUrl);
  } catch {
    return err({
      code: "UNSUPPORTED_FORMAT",
      message: "Failed to download the repository. Please check the URL and try again.",
    });
  }

  if (!response.ok) {
    return err({
      code: "UNSUPPORTED_FORMAT",
      message: `Failed to download repository: HTTP ${response.status}. Please verify the URL and that the repository is public.`,
    });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return validateAndProcessUpload(buffer, baseTmpDir);
}

export function getSessionDir(sessionId: string, baseTmpDir: string): string {
  return path.join(baseTmpDir, sessionId);
}

export async function cleanupSession(
  sessionId: string,
  baseTmpDir: string
): Promise<void> {
  const sessionDir = getSessionDir(sessionId, baseTmpDir);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export async function processZipBuffer(
  buffer: Buffer,
  baseTmpDir: string
): Promise<Result<UploadResult, UploadError>> {
  const sessionId = crypto.randomUUID();
  const sessionDir = path.join(baseTmpDir, sessionId);

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return err({
      code: "CORRUPTED_ARCHIVE",
      message: "The uploaded file is not a valid ZIP archive or is corrupted.",
    });
  }

  const zipEntries = zip.getEntries().filter((e) => !e.isDirectory);

  if (zipEntries.length === 0) {
    return err({
      code: "NO_PROJECT_FILES",
      message: "The archive contains no files.",
    });
  }

  // Extract to session directory
  fs.mkdirSync(sessionDir, { recursive: true });
  zip.extractAllTo(sessionDir, true);

  // Build raw paths and strip common root
  const rawPaths = zipEntries.map((e) => e.entryName);
  const strippedPaths = stripCommonRoot(rawPaths);

  let totalSize = 0;
  const manifest: FileManifestEntry[] = zipEntries.map((entry, i) => {
    const size = entry.header.size;
    totalSize += size;
    const displayPath = strippedPaths[i];

    return {
      path: displayPath,
      size,
      language: detectLanguage(displayPath),
      priority: assignPriority(displayPath),
    };
  });

  return ok({
    sessionId,
    fileCount: manifest.length,
    manifest,
    totalSize,
  });
}
