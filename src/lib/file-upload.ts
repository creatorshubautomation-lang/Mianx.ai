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

// Binary formats where we can verify the real file content via magic bytes,
// since `file.type` is set by the client and is trivially spoofable
// (e.g. renaming a script to declare "image/png"). Text-based types have
// no reliable signature, so they're accepted based on declared type only —
// size limits + downstream sanitization still apply to those.
const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  "image/png": (buf) =>
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47,
  "image/jpeg": (buf) =>
    buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  "image/gif": (buf) =>
    buf.length >= 6 &&
    buf.subarray(0, 3).toString("ascii") === "GIF" &&
    (buf.subarray(3, 6).toString("ascii") === "87a" ||
      buf.subarray(3, 6).toString("ascii") === "89a"),
  "image/webp": (buf) =>
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP",
  "application/pdf": (buf) =>
    buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-",
  "application/zip": (buf) =>
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07),
};

/** Verify the file's actual bytes match its declared MIME type, where checkable. */
function verifyFileSignature(declaredType: string, buffer: Buffer): boolean {
  const check = MAGIC_BYTES[declaredType];
  if (!check) return true; // no signature available for this type — skip
  return check(buffer);
}

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

    // Verify actual file content matches the declared type — the browser-
    // supplied `file.type` can be spoofed, so binary formats are checked
    // against their real magic bytes before we trust them.
    if (!verifyFileSignature(file.type, buffer)) {
      return {
        success: false,
        error: `File content does not match declared type: ${file.type}`,
      };
    }

    // Determine file type category
    let fileType = "document";
    if (file.type.startsWith("image/")) fileType = "design";
    else if (file.type.includes("javascript") || file.type.includes("css") || file.type.includes("html"))
      fileType = "code";
    else if (file.type === "application/pdf") fileType = "report";
    else if (file.type === "application/zip") fileType = "archive";

    // Save as deliverable — the actual file bytes (base64-encoded) are
    // stored in `content`, with `contentEncoding` marking how to decode it
    // on download. Previously this only stored a placeholder string
    // ("content stored separately") and the real bytes were discarded,
    // meaning uploaded files could never actually be downloaded again.
    const deliverable = await db.deliverable.create({
      data: {
        projectId,
        uploadedBy: userId,
        title: file.name,
        description: `Uploaded by user — ${file.type}`,
        fileType,
        content: base64Content,
        contentEncoding: "base64",
        mimeType: file.type,
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
