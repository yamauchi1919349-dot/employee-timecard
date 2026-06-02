import { NextResponse } from "next/server";
import {
  getCalendarDays,
  saveCalendarDay,
} from "@/lib/attendance-service";
import { CalendarDayType } from "@/lib/types";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get("k");
  const month = searchParams.get("month");
  const staffId = searchParams.get("staffId");

  if (!key || !month) {
    return NextResponse.json({ message: "k and month are required." }, { status: 400 });
  }

  try {
    const { member, days } = await getCalendarDays({ key, month, staffId });
    return NextResponse.json({ member, days });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Calendar days could not be loaded.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    k?: string;
    date?: string;
    dayType?: CalendarDayType;
    staffId?: string | null;
    note?: string | null;
  };

  if (!body.k || !body.date || !body.dayType) {
    return NextResponse.json(
      { message: "k, date and dayType are required." },
      { status: 400 },
    );
  }

  if (body.dayType !== "workday" && body.dayType !== "holiday") {
    return NextResponse.json({ message: "Invalid dayType." }, { status: 400 });
  }

  try {
    const day = await saveCalendarDay({
      key: body.k,
      date: body.date,
      dayType: body.dayType,
      staffId: body.staffId,
      note: body.note,
    });
    return NextResponse.json({ day });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Calendar day could not be saved.",
      },
      { status: 500 },
    );
  }
}
