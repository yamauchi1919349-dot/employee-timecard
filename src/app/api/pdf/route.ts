import { NextResponse } from "next/server";
import { getMonthlyLogs } from "@/lib/attendance-service";
import { buildMonthlyAttendancePdf } from "@/lib/monthly-attendance-pdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get("k");
  const month = searchParams.get("month");
  const staffId = searchParams.get("staffId");

  if (!key || !month) {
    return NextResponse.json(
      { message: "k と month が必要です。" },
      { status: 400 },
    );
  }

  try {
    const { member, logs, staff } = await getMonthlyLogs({ key, month, staffId });
    const pdfBytes = await buildMonthlyAttendancePdf({
      memberName: member.name,
      memberKey: member.key,
      staffName: staff?.name ?? logs.find((log) => log.staff_name)?.staff_name,
      month,
      logs,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${member.key}-${month}-attendance.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "PDF生成に失敗しました。",
      },
      { status: 500 },
    );
  }
}
