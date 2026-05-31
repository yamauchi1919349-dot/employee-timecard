import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  RGB,
  rgb,
  StandardFonts,
} from "pdf-lib";
import * as fontkit from "@pdf-lib/fontkit";
import { getMonthlyLogs } from "@/lib/attendance-service";
import {
  calculatePdfMinutes,
  formatMinutes,
  formatTime,
  getWorkTypeLabel,
  summarizeMonthlyLogs,
} from "@/lib/attendance";

export const runtime = "nodejs";

const FONT_REGULAR_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "noto-sans-jp-japanese-400-normal.woff",
);
const FONT_BOLD_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "noto-sans-jp-japanese-700-normal.woff",
);

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 34;
const TABLE_TOP = 178;
const ROW_HEIGHT = 32;
const TABLE_COLUMNS = [
  { label: "日付", x: 38, width: 72 },
  { label: "区分", x: 110, width: 98 },
  { label: "休憩", x: 208, width: 52 },
  { label: "出勤", x: 260, width: 58 },
  { label: "退勤", x: 318, width: 58 },
  { label: "総労働時間", x: 376, width: 78 },
  { label: "残業時間", x: 454, width: 70 },
  { label: "備考", x: 524, width: 278 },
];

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get("k");
  const month = searchParams.get("month");

  if (!key || !month) {
    return NextResponse.json(
      { message: "k と month が必要です。" },
      { status: 400 },
    );
  }

  try {
    const { member, logs } = await getMonthlyLogs({ key, month });
    const pdfBytes = await buildMonthlyAttendancePdf(member.name, member.key, month, logs);

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

async function buildMonthlyAttendancePdf(
  memberName: string,
  memberKey: string,
  month: string,
  logs: Awaited<ReturnType<typeof getMonthlyLogs>>["logs"],
) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    readFile(FONT_REGULAR_PATH),
    readFile(FONT_BOLD_PATH),
  ]);
  const regularFont = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const summary = summarizeMonthlyLogs(logs);
  let page = addPage(pdfDoc);
  let y = drawHeader(page, {
    memberName,
    memberKey,
    month,
    regularFont,
    boldFont,
    latinFont,
    summary,
  });

  drawTableHeader(page, boldFont, y);
  y += 25;

  for (const log of logs) {
    if (y + ROW_HEIGHT > PAGE_HEIGHT - MARGIN) {
      page = addPage(pdfDoc);
      y = TABLE_TOP;
      drawTableHeader(page, boldFont, y);
      y += 25;
    }

    const pdfMinutes = calculatePdfMinutes(
      log.clock_in,
      log.clock_out,
      log.break_flag,
    );
    drawTableRow(
      page,
      regularFont,
      y,
      [
        log.date,
        getWorkTypeLabel(log.work_type),
        log.break_flag ? "あり" : "なし",
        formatTime(log.clock_in),
        formatTime(log.clock_out),
        formatMinutes(pdfMinutes.workMinutes),
        formatMinutes(pdfMinutes.overtimeMinutes),
        log.note?.replace(/\n/g, " / ") || "",
      ],
    );
    y += ROW_HEIGHT;
  }

  if (logs.length === 0) {
    drawText(page, "この月の打刻記録はありません。", MARGIN, y + 24, {
      font: regularFont,
      size: 10,
      color: rgb(0.35, 0.39, 0.45),
    });
  }

  return pdfDoc.save();
}

function addPage(pdfDoc: PDFDocument) {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1),
  });
  return page;
}

function drawHeader(
  page: PDFPage,
  options: {
    memberName: string;
    memberKey: string;
    month: string;
    regularFont: PDFFont;
    boldFont: PDFFont;
    latinFont: PDFFont;
    summary: ReturnType<typeof summarizeMonthlyLogs>;
  },
) {
  const { memberName, memberKey, month, regularFont, boldFont, latinFont, summary } =
    options;

  drawText(page, "タイムカード 月別記録", MARGIN, 548, {
    font: boldFont,
    size: 19,
    color: rgb(0.08, 0.1, 0.14),
  });
  drawText(page, `出力ID: ${memberKey}`, PAGE_WIDTH - MARGIN - 135, 552, {
    font: latinFont,
    size: 8,
    color: rgb(0.45, 0.49, 0.55),
  });

  const items = [
    ["氏名", memberName],
    ["対象月", month],
    ["総労働時間", formatMinutes(summary.totalWorkMinutes)],
    ["通常勤務残業時間", formatMinutes(summary.normalOvertimeMinutes)],
    ["キッチンカー残業時間", formatMinutes(summary.kitchenCarOvertimeMinutes)],
    ["出勤日数", `${summary.workedDays}日`],
  ];

  const cardX = MARGIN;
  const cardY = 464;
  const cardW = PAGE_WIDTH - MARGIN * 2;
  const cardH = 58;
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    borderColor: rgb(0.86, 0.88, 0.91),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });

  const cellW = cardW / 6;
  items.forEach(([label, value], index) => {
    const x = cardX + cellW * index + 10;
    drawText(page, label, x, cardY + 36, {
      font: regularFont,
      size: 8,
      color: rgb(0.42, 0.46, 0.52),
    });
    drawText(page, value, x, cardY + 16, {
      font: boldFont,
      size: 11,
      color: rgb(0.08, 0.1, 0.14),
      maxWidth: cellW - 16,
    });
  });

  drawText(page, "日別明細", MARGIN, 430, {
    font: boldFont,
    size: 13,
    color: rgb(0.08, 0.1, 0.14),
  });

  return 397;
}

function drawTableHeader(page: PDFPage, font: PDFFont, y: number) {
  page.drawRectangle({
    x: MARGIN,
    y: y - 7,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 22,
    color: rgb(0.94, 0.96, 0.98),
  });

  TABLE_COLUMNS.forEach((column) => {
    drawText(page, column.label, column.x, y, {
      font,
      size: 8.5,
      color: rgb(0.22, 0.26, 0.32),
      maxWidth: column.width - 8,
    });
  });
}

function drawTableRow(
  page: PDFPage,
  font: PDFFont,
  y: number,
  values: string[],
) {
  page.drawLine({
    start: { x: MARGIN, y: y - 9 },
    end: { x: PAGE_WIDTH - MARGIN, y: y - 9 },
    thickness: 0.5,
    color: rgb(0.9, 0.92, 0.95),
  });

  values.forEach((value, index) => {
    const column = TABLE_COLUMNS[index];
    drawWrappedText(page, value, column.x, y, column.width - 8, {
      font,
      size: 8,
      color: rgb(0.12, 0.15, 0.19),
      maxLines: index === 7 ? 2 : 1,
    });
  });
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: {
    font: PDFFont;
    size: number;
    color: RGB;
    maxLines: number;
  },
) {
  const lines = wrapText(text || "-", options.font, options.size, maxWidth).slice(
    0,
    options.maxLines,
  );

  lines.forEach((line, index) => {
    drawText(page, line, x, y - index * (options.size + 2), {
      font: options.font,
      size: options.size,
      color: options.color,
    });
  });
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: {
    font: PDFFont;
    size: number;
    color: RGB;
    maxWidth?: number;
  },
) {
  const value = options.maxWidth
    ? truncateToWidth(text, options.font, options.size, options.maxWidth)
    : text;

  page.drawText(value, {
    x,
    y,
    size: options.size,
    font: options.font,
    color: options.color,
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return ["-"];

  const lines: string[] = [];
  let current = "";

  for (const char of normalized) {
    const candidate = `${current}${char}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = char;
  }

  if (current) lines.push(current);
  return lines;
}

function truncateToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  const ellipsis = "...";
  let result = "";
  for (const char of text) {
    const candidate = `${result}${char}${ellipsis}`;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) break;
    result += char;
  }

  return `${result}${ellipsis}`;
}
