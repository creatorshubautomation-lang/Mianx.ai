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

    // If it's an archive (ZIP stored as base64 in content), return as ZIP
    // Otherwise return as text file

    const fileName = deliverable.fileName || `deliverable-${id}.txt`;
    const isZip = deliverable.fileType === "archive";

    if (isZip) {
      // For ZIP, we need to regenerate it from content
      // (since we stored text content, not binary)
      // For now, return the text content as .txt
      // In production, store ZIP in S3/Supabase Storage
      const textBuffer = Buffer.from(deliverable.content, "utf-8");

      return new NextResponse(textBuffer, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName.replace(".zip", ".txt")}"`,
          "Content-Length": textBuffer.length.toString(),
        },
      });
    }

    // Text file download
    const textBuffer = Buffer.from(deliverable.content, "utf-8");

    return new NextResponse(textBuffer, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": textBuffer.length.toString(),
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
