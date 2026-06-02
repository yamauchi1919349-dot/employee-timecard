import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  RGB,
  rgb,
} from "pdf-lib";
import {
  calculatePdfMinutes,
  calculateWorkMinutes,
  formatMinutes,
  formatTime,
  getWorkTypeLabel,
  summarizeMonthlyLogs,
} from "@/lib/attendance";
import { AttendanceLog } from "@/lib/types";

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
const MARGIN = 30;
const ROW_HEIGHT = 30;
const TABLE_COLUMNS = [
  { label: "日付", x: 34, width: 66 },
  { label: "区分", x: 100, width: 86 },
  { label: "休憩", x: 186, width: 46 },
  { label: "出勤", x: 232, width: 54 },
  { label: "退勤", x: 286, width: 54 },
  { label: "実勤務", x: 340, width: 62 },
  { label: "丸め勤務", x: 402, width: 70 },
  { label: "丸め残業", x: 472, width: 70 },
  { label: "備考", x: 542, width: 264 },
];

export type MonthlyPdfInput = {
  memberName: string;
  memberKey: string;
  staffName?: string | null;
  month: string;
  logs: AttendanceLog[];
};

export async function buildMonthlyAttendancePdf({
  memberName,
  memberKey,
  staffName,
  month,
  logs,
}: MonthlyPdfInput) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    readFile(FONT_REGULAR_PATH),
    readFile(FONT_BOLD_PATH),
  ]);
  const regularFont = await pdfDoc.embedFont(regularBytes, { subset: true });
  const boldFont = await pdfDoc.embedFont(boldBytes, { subset: true });
  const summary = summarizeMonthlyLogs(logs);
  const totalOvertimeMinutes =
    summary.normalOvertimeMinutes + summary.kitchenCarOvertimeMinutes;
  let page = addPage(pdfDoc);
  let y = drawHeader(page, {
    memberName,
    memberKey,
    staffName,
    month,
    regularFont,
    boldFont,
    summary,
    totalOvertimeMinutes,
  });

  drawTableHeader(page, boldFont, y);
  y += 24;

  for (const log of logs) {
    if (y + ROW_HEIGHT > PAGE_HEIGHT - MARGIN) {
      page = addPage(pdfDoc);
      y = 548;
      drawTableHeader(page, boldFont, y);
      y += 24;
    }

    const actualMinutes =
      log.clock_in && log.clock_out
        ? calculateWorkMinutes(log.clock_in, log.clock_out, log.break_flag)
        : 0;
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
        formatMinutes(actualMinutes),
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
    staffName?: string | null;
    month: string;
    regularFont: PDFFont;
    boldFont: PDFFont;
    summary: ReturnType<typeof summarizeMonthlyLogs>;
    totalOvertimeMinutes: number;
  },
) {
  const {
    memberName,
    memberKey,
    staffName,
    month,
    regularFont,
    boldFont,
    summary,
    totalOvertimeMinutes,
  } = options;

  drawText(page, "タイムカード 月別記録", MARGIN, 552, {
    font: boldFont,
    size: 19,
    color: rgb(0.08, 0.1, 0.14),
  });
  drawText(page, `出力ID: ${memberKey}`, PAGE_WIDTH - MARGIN - 138, 556, {
    font: regularFont,
    size: 8,
    color: rgb(0.45, 0.49, 0.55),
  });

  const staffLabel = staffName ? staffName : "-";
  const items = [
    ["対象月", formatMonthLabel(month)],
    ["従業員名", memberName],
    ["スタッフ名", staffLabel],
    ["総勤務時間", formatMinutes(summary.totalWorkMinutes)],
    ["出勤日数", `${summary.workedDays}日`],
    ["総残業時間", formatMinutes(totalOvertimeMinutes)],
    ["通常勤務残業", formatMinutes(summary.normalOvertimeMinutes)],
    ["キッチンカー残業", formatMinutes(summary.kitchenCarOvertimeMinutes)],
  ];

  const cardX = MARGIN;
  const cardY = 456;
  const cardW = PAGE_WIDTH - MARGIN * 2;
  const cardH = 70;
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    borderColor: rgb(0.86, 0.88, 0.91),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });

  const cellW = cardW / 4;
  items.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = cardX + cellW * col + 10;
    const y = cardY + 48 - row * 32;
    drawText(page, label, x, y, {
      font: regularFont,
      size: 7.5,
      color: rgb(0.42, 0.46, 0.52),
    });
    drawText(page, value, x, y - 15, {
      font: boldFont,
      size: 10,
      color: rgb(0.08, 0.1, 0.14),
      maxWidth: cellW - 16,
    });
  });

  drawText(page, "日別打刻記録", MARGIN, 424, {
    font: boldFont,
    size: 13,
    color: rgb(0.08, 0.1, 0.14),
  });

  return 390;
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
      size: 8,
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
      size: 7.5,
      color: rgb(0.12, 0.15, 0.19),
      maxLines: index === 8 ? 2 : 1,
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

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return `${year}年${monthNumber}月`;
}
