import { toCsv, type CsvValue } from "@/lib/spreadsheet/csv";
import { buildXlsx, type XlsxCell, type XlsxKind, type XlsxSheet, type XlsxStyle } from "@/lib/spreadsheet/xlsx";
import { badbeatInsights, badbeatStats, badbeatTrend, priceBadbeat, type BadbeatEntryInput } from "@/lib/badbeat/stats";

export type ReportFigure = {
  label: string;
  value: number | null;
  kind: "money" | "count" | "decimal";
};

export type BadbeatReportCopy = {
  summaryTitle: string;
  registerTitle: string;
  trendsTitle: string;
  summarySheet: string;
  registerSheet: string;
  trendsSheet: string;
  periodPrefix: string;
  asOf: string;
  exportWord: string;
  keyStats: string;
  context: string;
  bestDay: string;
  highestOn: string;
  busiestOn: string;
  window: string;
  current: string;
  addedToday: string;
  carryover: string;
  wins: string;
  periodTotal: string;
  entries: string;
  averageCustomers: string;
  entriesToday: string;
  highestDay: string;
  medianCustomers: string;
  busiestDay: string;
  averageDay: string;
  lastWon: string;
  date: string;
  time: string;
  customers: string;
  cumul: string;
  comment: string;
  won: string;
  added: string;
  yes: string;
  no: string;
  none: string;
  rule: string;
};

export type BadbeatReport = {
  summaryTitle: string;
  periodLine: string;
  registerTitle: string;
  exportLine: string;
  trendsTitle: string;
  windowNote: string;
  summarySheet: string;
  registerSheet: string;
  trendsSheet: string;
  keyStats: string;
  context: string;
  contextLines: [string, string];
  none: string;
  top: ReportFigure[];
  middle: ReportFigure[];
  keys: ReportFigure[];
  registerHeaders: string[];
  register: Array<{
    date: string;
    time: string;
    customers: number;
    amount: number;
    comment: string;
    won: string;
    added: number;
  }>;
  trendHeaders: string[];
  trends: Array<{ date: string; amount: number; customers: number }>;
};

function utc(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function longDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(utc(iso));
}

export function monthRange(today: string) {
  const [year, month] = today.split("-").map(Number);
  const last = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
  const paddedMonth = String(month ?? 1).padStart(2, "0");
  return {
    start: `${year}-${paddedMonth}-01`,
    end: `${year}-${paddedMonth}-${String(last).padStart(2, "0")}`,
  };
}

export function periodLabel(start: string, end: string, locale: string) {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  if (!sameMonth) return `${longDate(start, locale)} – ${longDate(end, locale)}`;
  if (locale.toLowerCase().startsWith("fr")) return `${utc(start).getUTCDate()}–${longDate(end, locale)}`;
  const month = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(utc(start));
  return `${month} ${utc(start).getUTCDate()}–${utc(end).getUTCDate()}, ${utc(start).getUTCFullYear()}`;
}

function byMoment(left: BadbeatEntryInput, right: BadbeatEntryInput) {
  return `${left.date}T${left.time}T${left.createdAt ?? ""}`.localeCompare(
    `${right.date}T${right.time}T${right.createdAt ?? ""}`,
  );
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildBadbeatReport<T extends BadbeatEntryInput & { comment?: string }>(
  entries: T[],
  today: string,
  start: string,
  end: string,
  copy: BadbeatReportCopy,
  locale: string,
): BadbeatReport {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const priced = [...priceBadbeat(entries)].sort(byMoment);
  const periodEntries = priced.filter((entry) => entry.date >= from && entry.date <= to);
  const insights = badbeatInsights(periodEntries);
  const live = badbeatStats(entries, today);
  const trend = badbeatTrend(entries, from, to, today);
  const customers = periodEntries.reduce((sum, entry) => sum + entry.customers, 0);
  const periodTotal = trend.at(-1)?.amount ?? 0;
  const lastWon = [...periodEntries].reverse().find((entry) => entry.wonAmount !== null)?.wonAmount ?? null;
  const bestDate = insights.highestDay?.date ?? null;
  const busyDate = insights.busiestDay?.date ?? null;
  const contextLine =
    bestDate && busyDate && bestDate === busyDate
      ? copy.bestDay.replace("{date}", longDate(bestDate, locale))
      : [
          bestDate ? `${copy.highestOn} ${longDate(bestDate, locale)}.` : "",
          busyDate ? `${copy.busiestOn} ${longDate(busyDate, locale)}.` : "",
        ]
          .filter(Boolean)
          .join(" ");
  const range = periodLabel(from, to, locale);
  const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(from));

  return {
    summaryTitle: copy.summaryTitle,
    periodLine: `${copy.periodPrefix} ${range}  •  ${copy.asOf} ${longDate(today, locale)}`,
    registerTitle: copy.registerTitle,
    exportLine: `${copy.exportWord} • ${from.slice(0, 7) === to.slice(0, 7) ? month : range}`,
    trendsTitle: copy.trendsTitle,
    windowNote: `${copy.window} ${range}.`,
    summarySheet: copy.summarySheet,
    registerSheet: copy.registerSheet,
    trendsSheet: copy.trendsSheet,
    keyStats: copy.keyStats,
    context: copy.context,
    contextLines: [contextLine, copy.rule],
    none: copy.none,
    top: [
      { label: copy.current, value: live.current, kind: "money" },
      { label: copy.addedToday, value: live.dayTotal, kind: "money" },
      { label: copy.carryover, value: live.carryover, kind: "money" },
      { label: copy.wins, value: insights.wins, kind: "count" },
    ],
    middle: [
      { label: copy.periodTotal, value: periodTotal, kind: "money" },
      { label: copy.entries, value: periodEntries.length, kind: "count" },
      { label: copy.averageCustomers, value: periodEntries.length === 0 ? null : round(customers / periodEntries.length), kind: "decimal" },
      { label: copy.entriesToday, value: live.dayEntries, kind: "count" },
    ],
    keys: [
      { label: copy.highestDay, value: insights.highestDay?.added ?? null, kind: "money" },
      { label: copy.medianCustomers, value: insights.medianCustomers, kind: "decimal" },
      { label: copy.busiestDay, value: insights.busiestDay?.customers ?? null, kind: "count" },
      { label: copy.averageDay, value: insights.averageAdded, kind: "money" },
      { label: copy.lastWon, value: lastWon, kind: "money" },
    ],
    registerHeaders: [copy.date, copy.time, copy.customers, copy.cumul, copy.comment, copy.won, copy.added],
    register: periodEntries.map((entry) => ({
      date: entry.date,
      time: entry.time,
      customers: entry.customers,
      amount: entry.amount,
      comment: entry.comment ?? "",
      won: entry.won ? copy.yes : copy.no,
      added: entry.added,
    })),
    trendHeaders: [copy.date, copy.cumul, copy.customers],
    trends: trend.map((point) => ({ date: point.date, amount: point.amount, customers: point.customers })),
  };
}

function excelDate(iso: string) {
  return Math.round((utc(iso).getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}

function excelTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return ((hour ?? 0) * 60 + (minute ?? 0)) / 1440;
}

function text(value: string | null, style?: XlsxCell["style"]): XlsxCell {
  return { value, style, kind: "text" };
}

function figure(value: number | null, kind: XlsxKind, none: string): XlsxCell {
  if (value === null) return { value: none, kind: "text", style: "value" };
  return { value, kind, style: "value" };
}

function paint(cell: XlsxCell, span: number): XlsxCell[] {
  return [cell, ...Array.from({ length: span - 1 }, () => text(null, cell.style))];
}

function blanks(count: number) {
  return Array.from({ length: count }, () => null);
}

export function reportSheets(report: BadbeatReport): XlsxSheet[] {
  const topLabels = report.top.flatMap((item) => paint(text(item.label, "label"), 2));
  const topValues = report.top.flatMap((item) => paint(figure(item.value, item.kind, report.none), 2));
  const middleLabels = report.middle.flatMap((item) => paint(text(item.label, "label"), 2));
  const middleValues = report.middle.flatMap((item) => paint(figure(item.value, item.kind, report.none), 2));
  const keyRows = report.keys.map((item, index) => [
    ...paint(text(item.label, "label"), 3),
    figure(item.value, item.kind, report.none),
    ...(index === 0 ? paint(text(report.contextLines[0], "note"), 4) : blanks(4)),
  ]);
  const third = report.keys[2];
  if (third) {
    keyRows[2] = [
      ...paint(text(third.label, "label"), 3),
      figure(third.value, third.kind, report.none),
      ...paint(text(report.contextLines[1], "note"), 4),
    ];
  }

  return [
    {
      name: report.summarySheet,
      widths: [18, 18, 18, 18, 22, 18, 18, 18],
      heights: [34, 22, 8, 20, 28, 8, 20, 28, 8, 24, 24, 24, 36, 24, 24],
      merges: [
        "A1:H1",
        "A2:H2",
        "A4:B4",
        "C4:D4",
        "E4:F4",
        "G4:H4",
        "A5:B5",
        "C5:D5",
        "E5:F5",
        "G5:H5",
        "A7:B7",
        "C7:D7",
        "E7:F7",
        "G7:H7",
        "A8:B8",
        "C8:D8",
        "E8:F8",
        "G8:H8",
        "A10:D10",
        "E10:H10",
        "A11:C11",
        "A12:C12",
        "A13:C13",
        "A14:C14",
        "A15:C15",
        "E11:H12",
        "E13:H15",
      ],
      rows: [
        paint(text(report.summaryTitle, "title"), 8),
        paint(text(report.periodLine, "subtitle"), 8),
        blanks(8),
        topLabels,
        topValues,
        blanks(8),
        middleLabels,
        middleValues,
        blanks(8),
        [...paint(text(report.keyStats, "section"), 4), ...paint(text(report.context, "section"), 4)],
        ...keyRows,
      ],
    },
    {
      name: report.registerSheet,
      widths: [16, 12, 14, 16, 36, 12, 14],
      heights: [34, 22, 8, 22],
      merges: ["A1:G1", "A2:G2"],
      rows: [
        paint(text(report.registerTitle, "title"), 7),
        paint(text(report.exportLine, "subtitle"), 7),
        blanks(7),
        report.registerHeaders.map((header) => text(header, "header")),
        ...report.register.map((row, index) => {
          const stripe: XlsxStyle = index % 2 === 1 ? "alt" : "data";
          return [
            { value: excelDate(row.date), kind: "date" as const, style: stripe },
            { value: excelTime(row.time), kind: "time" as const, style: stripe },
            { value: row.customers, kind: "count" as const, style: stripe },
            { value: row.amount, kind: "money" as const, style: stripe },
            { value: row.comment, kind: "text" as const, style: stripe },
            { value: row.won, kind: "text" as const, style: stripe },
            { value: row.added, kind: "money" as const, style: stripe },
          ];
        }),
      ],
    },
  ];
}

export function reportCsv(report: BadbeatReport, locale: string) {
  const rows: CsvValue[][] = [
    report.registerHeaders,
    ...report.register.map((row) => [row.date, row.time, row.customers, row.amount, row.comment, row.won, row.added]),
  ];
  return toCsv(rows, locale);
}

export function reportXlsx(report: BadbeatReport) {
  return buildXlsx(reportSheets(report));
}
