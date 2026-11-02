import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/repository";
import { ApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ storagePath: string }>>> {
  if (process.env.DATA_MODE !== "local") {
    return NextResponse.json({ ok: false, error: "Local upload endpoint only available in DATA_MODE=local." }, { status: 403 });
  }

  const url = new URL(request.url);
  const storagePath = url.searchParams.get("path");

  if (!storagePath) {
    return NextResponse.json({ ok: false, error: "Missing 'path' query parameter." }, { status: 400 });
  }

  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storage = getStorageProvider();
    await storage.saveUploadedBuffer("reviews", storagePath, buffer);

    return NextResponse.json({ ok: true, data: { storagePath } });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: `Local file upload failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
