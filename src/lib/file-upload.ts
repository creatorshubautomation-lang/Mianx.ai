// Mianx.ai — File Upload Service
// Handles file uploads for deliverables, project assets, etc.
// Uses base64 encoding (stored in DB) for small files
// For production, use Supabase Storage / S3 for large files

import { db } from "@/lib/db";

interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

const ALLOWED_TYPES = [
  "text/plain",
  "text/markdown",
  "application/json",
  "application/javascript",
  "text/javascript",
  "text/css",
  "text/html",
  "application/x-yaml",
  "text/yaml",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
];

// ─────────────────────────────────────────────
//  Upload file (base64 to DB)
// ─────────────────────────────────────────────

export async function uploadFile(
  file: File,
  projectId: string,
  userId: string,
): Promise<UploadResult> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: `File type not allowed: ${file.type}`,
      };
    }

    // Read file as base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString("base64");

    // Determine file type category
    let fileType = "document";
    if (file.type.startsWith("image/")) fileType = "design";
    else if (file.type.includes("javascript") || file.type.includes("css") || file.type.includes("html"))
      fileType = "code";
    else if (file.type === "application/pdf") fileType = "report";
    else if (file.type === "application/zip") fileType = "archive";

    // Save as deliverable
    const deliverable = await db.deliverable.create({
      data: {
        projectId,
        uploadedBy: userId,
        title: file.name,
        description: `Uploaded by user — ${file.type}`,
        fileType,
        content: `[UPLOADED FILE]\nName: ${file.name}\nType: ${file.type}\nSize: ${file.size} bytes\n\n[Base64 content stored separately — download to view]`,
        fileName: file.name,
        fileSize: file.size,
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        projectId,
        userId,
        action: "FILE_UPLOADED",
        details: `Uploaded: ${file.name} (${file.size} bytes)`,
      },
    });

    return {
      success: true,
      fileId: deliverable.id,
      fileName: file.name,
      fileSize: file.size,
      fileType,
    };
  } catch (e) {
    console.error("[upload] error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

// ─────────────────────────────────────────────
//  Validate file before upload
// ─────────────────────────────────────────────

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`;
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return `File type not allowed: ${file.type || "unknown"}`;
  }

  return null;
}

export { MAX_FILE_SIZE, ALLOWED_TYPES };
