import { NextResponse } from "next/server";
import {
  addPdfEmailRecipient,
  deletePdfEmailRecipient,
  getPdfEmailRecipients,
} from "@/lib/attendance-service";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get("k");
  const staffId = searchParams.get("staffId");

  if (!key) {
    return NextResponse.json({ message: "k is required." }, { status: 400 });
  }

  try {
    const { recipients } = await getPdfEmailRecipients({ key, staffId });
    return NextResponse.json({ recipients });
  } catch (error) {
    return handleError(error, "PDF送信先を取得できませんでした。");
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    k?: string;
    email?: string;
    staffId?: string | null;
  };

  if (!body.k || !body.email) {
    return NextResponse.json(
      { message: "k and email are required." },
      { status: 400 },
    );
  }

  try {
    const recipient = await addPdfEmailRecipient({
      key: body.k,
      email: body.email,
      staffId: body.staffId,
    });
    return NextResponse.json({ recipient });
  } catch (error) {
    return handleError(error, "PDF送信先を追加できませんでした。");
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    k?: string;
    id?: string;
    staffId?: string | null;
  };

  if (!body.k || !body.id) {
    return NextResponse.json(
      { message: "k and id are required." },
      { status: 400 },
    );
  }

  try {
    await deletePdfEmailRecipient({
      key: body.k,
      id: body.id,
      staffId: body.staffId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error, "PDF送信先を削除できませんでした。");
  }
}

function handleError(error: unknown, fallback: string) {
  return NextResponse.json(
    {
      message: error instanceof Error ? error.message : fallback,
    },
    { status: 500 },
  );
}
