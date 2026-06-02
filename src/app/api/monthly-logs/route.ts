import { NextResponse } from "next/server";
import { getMonthlyLogs } from "@/lib/attendance-service";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get("k");
  const month = searchParams.get("month");
  const staffId = searchParams.get("staffId");

  if (!key || !month) {
    return NextResponse.json({ message: "k and month are required." }, { status: 400 });
  }

  try {
    const { member, logs } = await getMonthlyLogs({ key, month, staffId });
    return NextResponse.json({ member, logs });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Monthly attendance logs could not be loaded.",
      },
      { status: 500 },
    );
  }
}
