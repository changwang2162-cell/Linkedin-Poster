"use client";

import { useState, useCallback, useRef } from "react";
import type { FileManifestEntry } from "@/lib/types";

interface UploadStepProps {
  onUpload: (file: File) => void;
  onGitHubImport: (url: string) => void;
  isLoading: boolean;
  manifest?: FileManifestEntry[];
}

export function UploadStep({ onUpload, onGitHubImport, isLoading, manifest }: UploadStepProps) {
  const [githubUrl, setGithubUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  const handleGitHubSubmit = useCallback(() => {
    if (githubUrl.trim()) {
      onGitHubImport(githubUrl.trim());
    }
  }, [githubUrl, onGitHubImport]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400">Uploading and processing your project...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-zinc-300 dark:border-zinc-600 hover:border-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
      >
        <svg className="mx-auto h-12 w-12 text-zinc-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
          Drag & drop your project ZIP here
        </p>
        <p className="text-sm text-zinc-500 mt-1">or click to upload (max 50MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-sm text-zinc-500">or</span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* GitHub URL Input */}
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://github.com/user/repo"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          disabled={isLoading}
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleGitHubSubmit}
          disabled={isLoading || !githubUrl.trim()}
          className="rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 px-6 py-3 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50 transition-colors"
        >
          Import
        </button>
      </div>

      {/* File Manifest */}
      {manifest && manifest.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
            Project Files ({manifest.length})
          </h3>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {manifest.map((entry) => (
              <li key={entry.path} className="flex items-center justify-between text-sm py-1">
                <span className="text-zinc-700 dark:text-zinc-300 font-mono text-xs truncate flex-1">
                  {entry.path}
                </span>
                <span className="text-zinc-400 text-xs ml-2 shrink-0">
                  {entry.language || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
