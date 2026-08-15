import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/deliverables/download?id=xxx
// Downloads a deliverable file (ZIP if available, else text)

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 },
      );
    }

    const deliverable = await db.deliverable.findUnique({
      where: { id },
      include: { project: { select: { clientId: true } } },
    });

    if (!deliverable) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check access
    if (
      deliverable.project.clientId !== session.user.id &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const fileName = deliverable.fileName || `deliverable-${id}.txt`;

    // Uploaded files are stored base64-encoded (see file-upload.ts); AI-
    // generated text deliverables are stored as plain utf8. Decode
    // accordingly so uploaded binaries (images, PDFs, zips, etc.) come
    // back byte-for-byte instead of being served as a text placeholder.
    const isBase64 = deliverable.contentEncoding === "base64";
    const fileBuffer = isBase64
      ? Buffer.from(deliverable.content, "base64")
      : Buffer.from(deliverable.content, "utf-8");

    const contentType = isBase64
      ? deliverable.mimeType || "application/octet-stream"
      : "text/plain; charset=utf-8";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (e) {
    console.error("[deliverables/download] error:", e);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 },
    );
  }
}
