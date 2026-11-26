import assert from "node:assert/strict";
import test from "node:test";

import { filenameFor } from "@/lib/download";
import { badbeatPdf } from "@/lib/badbeat/pdf";
import { buildBadbeatReport, monthRange, reportCsv, reportXlsx, type BadbeatReportCopy } from "@/lib/badbeat/report";

const copy: BadbeatReportCopy = {
  summaryTitle: "CASINO ROOM  /  BAD BEAT REPORT",
  registerTitle: "CASINO ROOM  /  BAD BEAT LOG",
  trendsTitle: "CASINO ROOM  /  TRENDS",
  summarySheet: "Summary",
  registerSheet: "Log",
  trendsSheet: "Trends",
  periodPrefix: "Period:",
  asOf: "As of",
  exportWord: "Export",
  keyStats: "KEY STATS",
  context: "CONTEXT",
  bestDay: "Best day and traffic: {date}.",
  highestOn: "Highest day:",
  busiestOn: "Busiest day:",
  window: "Window:",
  current: "Current total",
  addedToday: "Added today",
  carryover: "Previous carryover",
  wins: "Wins",
  periodTotal: "Period total",
  entries: "Entries",
  averageCustomers: "Average customers",
  entriesToday: "Entries today",
  highestDay: "Highest day",
  medianCustomers: "Median customers",
  busiestDay: "Busiest day",
  averageDay: "Average added per active day",
  lastWon: "Last win",
  date: "Date",
  time: "Time",
  customers: "Customers",
  cumul: "Total ($)",
  comment: "Comments",
  won: "Won",
  added: "Added ($)",
  yes: "Yes",
  no: "No",
  none: "—",
  rule: "Each customer adds $2.",
};

const entries = [
  { id: "a", date: "2026-11-24", time: "05:50", customers: 50, won: false, comment: "A, B", createdAt: "1" },
  { id: "b", date: "2026-11-24", time: "05:50", customers: 234, won: false, comment: "", createdAt: "2" },
  { id: "c", date: "2026-11-24", time: "05:50", customers: 234, won: false, comment: "", createdAt: "3" },
];

test("the report follows the bad beat workbook for the chosen month", () => {
  assert.deepEqual(monthRange("2026-11-26"), { start: "2026-11-01", end: "2026-11-30" });
  const report = buildBadbeatReport(entries, "2026-11-26", "2026-11-01", "2026-11-30", copy, "en");
  assert.deepEqual(
    report.top.map((item) => item.value),
    [1036, 0, 1036, 0],
  );
  assert.deepEqual(
    report.middle.map((item) => item.value),
    [1036, 3, 172.67, 0],
  );
  assert.deepEqual(
    report.keys.map((item) => item.value),
    [1036, 234, 518, 1036, null],
  );
  assert.equal(report.contextLines[0], "Best day and traffic: November 24, 2026.");
  assert.deepEqual(
    report.register.map((row) => [row.customers, row.added, row.amount, row.won]),
    [
      [50, 100, 100, "No"],
      [234, 468, 568, "No"],
      [234, 468, 1036, "No"],
    ],
  );
  assert.equal(report.trends.find((row) => row.date === "2026-11-24")?.customers, 518);
  assert.equal(report.trends.at(-1)?.date, "2026-11-26");

  const csv = reportCsv(report, "en");
  assert.match(csv, /^﻿Date,Time,Customers,Total \(\$\),Comments,Won,Added \(\$\)/);
  assert.match(csv, /"A, B"/);
  assert.doesNotMatch(csv, /Current total|KEY STATS|TRENDS/);
  const french = reportCsv(report, "fr");
  assert.match(french, /^﻿Date;Time;Customers/);
  assert.doesNotMatch(french, /Current total|KEY STATS|TRENDS/);

  const xlsx = new TextDecoder().decode(reportXlsx(report));
  assert.match(xlsx, /name="Summary"/);
  assert.match(xlsx, /name="Log"/);
  assert.match(xlsx, /FF5930A5/);
  assert.match(xlsx, /FF25163F/);
  assert.doesNotMatch(xlsx, /name="Trends"/);

  const pdf = new TextDecoder().decode(badbeatPdf(report, "en"));
  assert.match(pdf, /%PDF-1\.4/);
  assert.match(pdf, /CASINO ROOM/);
  assert.doesNotMatch(pdf, /TRENDS/);
});

test("a csv download always uses the csv extension", () => {
  assert.equal(filenameFor("badbeat-2026-11.xls", "csv"), "badbeat-2026-11.csv");
  assert.equal(filenameFor("badbeat.csv", "xlsx"), "badbeat.xlsx");
  assert.equal(filenameFor("badbeat", "pdf"), "badbeat.pdf");
});
