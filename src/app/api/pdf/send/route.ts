import { NextResponse } from "next/server";
import {
  getMonthlyLogs,
  getPdfEmailRecipients,
} from "@/lib/attendance-service";
import { buildMonthlyAttendancePdf } from "@/lib/monthly-attendance-pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    k?: string;
    month?: string;
    staffId?: string | null;
  };

  if (!body.k || !body.month) {
    return NextResponse.json(
      { message: "k and month are required." },
      { status: 400 },
    );
  }

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.PDF_FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      throw new Error(
        "メール送信設定が未完了です。RESEND_API_KEY と PDF_FROM_EMAIL を設定してください。",
      );
    }

    const [{ member, logs, staff }, { recipients }] = await Promise.all([
      getMonthlyLogs({ key: body.k, month: body.month, staffId: body.staffId }),
      getPdfEmailRecipients({ key: body.k, staffId: body.staffId }),
    ]);

    if (recipients.length === 0) {
      throw new Error("送信先メールアドレスを登録してください。");
    }

    const pdfBytes = await buildMonthlyAttendancePdf({
      memberName: member.name,
      memberKey: member.key,
      staffName: staff?.name ?? logs.find((log) => log.staff_name)?.staff_name,
      month: body.month,
      logs,
    });
    const subject = `${formatMonthLabel(body.month)} 勤怠PDF`;
    const filename = `${member.key}-${body.month}-attendance.pdf`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients.map((recipient) => recipient.email),
        subject,
        text: "添付の勤怠PDFをご確認ください。",
        attachments: [
          {
            filename,
            content: Buffer.from(pdfBytes).toString("base64"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message ?? "メール送信に失敗しました。");
    }

    return NextResponse.json({
      ok: true,
      sentTo: recipients.map((recipient) => recipient.email),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "PDFメール送信に失敗しました。",
      },
      { status: 500 },
    );
  }
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return `${year}年${monthNumber}月`;
}
