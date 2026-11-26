import type { BadbeatReport, ReportFigure } from "@/lib/badbeat/report";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 36;

const WIN: Record<number, number> = {
  0x0152: 0x8c,
  0x0153: 0x9c,
  0x0160: 0x8a,
  0x0161: 0x9a,
  0x0178: 0x9f,
  0x017d: 0x8e,
  0x017e: 0x9e,
  0x0192: 0x83,
  0x02c6: 0x88,
  0x02dc: 0x98,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201a: 0x82,
  0x201c: 0x93,
  0x201d: 0x94,
  0x201e: 0x84,
  0x2020: 0x86,
  0x2021: 0x87,
  0x2022: 0x95,
  0x2026: 0x85,
  0x2030: 0x89,
  0x2039: 0x8b,
  0x203a: 0x9b,
  0x20ac: 0x80,
  0x2122: 0x99,
};

function encode(value: string) {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 63;
    const byte = code < 128 || (code >= 160 && code <= 255) ? code : (WIN[code] ?? 63);
    const glyph = String.fromCharCode(byte);
    out += glyph === "\\" || glyph === "(" || glyph === ")" ? `\\${glyph}` : glyph;
  }
  return out;
}

function money(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function plain(value: number, locale: string, digits: number) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function figureText(item: ReportFigure, locale: string, none: string) {
  if (item.value === null) return none;
  if (item.kind === "money") return money(item.value, locale);
  if (item.kind === "decimal") return plain(item.value, locale, 2);
  return plain(item.value, locale, 0);
}

function displayDate(iso: string, locale: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)),
  );
}

type Page = string[];

export function badbeatPdf(report: BadbeatReport, locale: string) {
  const pages: Page[] = [[]];
  let y = PAGE_HEIGHT - MARGIN;

  function page() {
    return pages[pages.length - 1] ?? pages[0];
  }

  function nextPage() {
    pages.push([]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensure(height: number) {
    if (y - height < MARGIN) nextPage();
  }

  function text(value: string, x: number, size: number, font: "F1" | "F2", color = "0.145 0.086 0.247") {
    page()?.push(`${color} rg BT /${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${encode(value)}) Tj ET`);
  }

  function line(x1: number, x2: number) {
    page()?.push(`0.35 0.19 0.65 RG 0.6 w ${x1.toFixed(1)} ${(y - 4).toFixed(1)} m ${x2.toFixed(1)} ${(y - 4).toFixed(1)} l S`);
  }

  function heading(value: string) {
    ensure(28);
    text(value, MARGIN, 16, "F2");
    y -= 22;
  }

  function subheading(value: string) {
    ensure(16);
    text(value, MARGIN, 10, "F1", "0.349 0.188 0.647");
    y -= 16;
  }

  function figures(items: ReportFigure[]) {
    const width = (PAGE_WIDTH - MARGIN * 2) / items.length;
    ensure(32);
    items.forEach((item, index) => {
      const x = MARGIN + index * width;
      text(item.label, x, 8, "F1", "0.349 0.188 0.647");
    });
    y -= 14;
    items.forEach((item, index) => {
      const x = MARGIN + index * width;
      text(figureText(item, locale, report.none), x, 12, "F2");
    });
    y -= 20;
  }

  function table(headers: string[], rows: string[][], widths: number[]) {
    const drawHeader = () => {
      ensure(18);
      let x = MARGIN;
      headers.forEach((header, index) => {
        text(header, x, 8, "F2", "0.349 0.188 0.647");
        x += widths[index] ?? 0;
      });
      line(MARGIN, MARGIN + widths.reduce((sum, width) => sum + width, 0));
      y -= 16;
    };
    drawHeader();
    for (const row of rows) {
      if (y - 14 < MARGIN) {
        nextPage();
        drawHeader();
      }
      let x = MARGIN;
      row.forEach((cell, index) => {
        const width = (widths[index] ?? 40) - 6;
        const clipped = clip(cell, width);
        text(clipped, x, 9, "F1");
        x += widths[index] ?? 0;
      });
      y -= 14;
    }
  }

  heading(report.summaryTitle);
  subheading(report.periodLine);
  figures(report.top);
  figures(report.middle);
  ensure(16);
  text(report.keyStats, MARGIN, 11, "F2");
  y -= 16;
  for (const item of report.keys) {
    ensure(14);
    text(item.label, MARGIN, 10, "F1");
    text(figureText(item, locale, report.none), 280, 10, "F2");
    y -= 14;
  }
  y -= 6;
  for (const lineText of report.contextLines) {
    if (!lineText) continue;
    for (const wrapped of wrap(lineText, 90)) {
      ensure(12);
      text(wrapped, MARGIN, 9, "F1", "0.349 0.188 0.647");
      y -= 12;
    }
  }
  y -= 10;
  heading(report.registerTitle);
  subheading(report.exportLine);
  table(
    report.registerHeaders,
    report.register.map((row) => [
      displayDate(row.date, locale),
      row.time,
      String(row.customers),
      money(row.amount, locale),
      row.comment,
      row.won,
      money(row.added, locale),
    ]),
    [78, 42, 58, 70, 150, 48, 70],
  );

  const objects: string[] = [];
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`);
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push(`2 0 obj << /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >> endobj`);
  pages.forEach((commands, index) => {
    const id = 3 + index * 2;
    const stream = commands.join("\n");
    objects.push(
      `${id} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R /F2 ${4 + pages.length * 2} 0 R >> >> /Contents ${id + 1} 0 R >> endobj`,
    );
    objects.push(`${id + 1} 0 obj << /Length ${byteLength(stream)} >> stream\n${stream}\nendstream endobj`);
  });
  const font = 3 + pages.length * 2;
  objects.push(`${font} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj`);
  objects.push(`${font + 1} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj`);

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(byteLength(body));
    body += `${object}\n`;
  }
  const xref = byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return latin1(body);
}

function clip(value: string, width: number) {
  const max = Math.max(4, Math.floor(width / 5));
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function wrap(value: string, width: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function byteLength(value: string) {
  return latin1(value).length;
}

function latin1(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}
