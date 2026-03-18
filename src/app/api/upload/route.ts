import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { validateAndProcessUpload, processGitHubUrl } from "@/services/upload";
import { isOk } from "@/lib/result";

export const UPLOAD_TMP_DIR = path.join(process.cwd(), "tmp-uploads");

const ERROR_STATUS_MAP: Record<string, number> = {
  FILE_TOO_LARGE: 413,
  CORRUPTED_ARCHIVE: 422,
  NO_PROJECT_FILES: 422,
  UNSUPPORTED_FORMAT: 400,
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

    // JSON body with githubUrl
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const githubUrl = body.githubUrl;

      if (!githubUrl || typeof githubUrl !== "string") {
        return NextResponse.json(
          { error: { code: "UNSUPPORTED_FORMAT", message: "Missing githubUrl field." } },
          { status: 400 }
        );
      }

      const result = await processGitHubUrl(githubUrl, UPLOAD_TMP_DIR);

      if (!isOk(result)) {
        const status = ERROR_STATUS_MAP[result.error.code] ?? 400;
        return NextResponse.json({ error: result.error }, { status });
      }

      return NextResponse.json(result.data);
    }

    // Multipart form data with file
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: { code: "UNSUPPORTED_FORMAT", message: "No file provided. Please upload a ZIP archive." } },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await validateAndProcessUpload(buffer, UPLOAD_TMP_DIR);

    if (!isOk(result)) {
      const status = ERROR_STATUS_MAP[result.error.code] ?? 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_FORMAT", message: "An unexpected error occurred during upload." } },
      { status: 500 }
    );
  }
}
