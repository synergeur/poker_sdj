export type XlsxKind = "text" | "money" | "count" | "decimal" | "date" | "time";

export type XlsxStyle = "title" | "subtitle" | "header" | "label" | "section" | "note" | "value" | "data" | "alt";

export type XlsxCell = {
  value: string | number | null;
  kind?: XlsxKind;
  style?: XlsxStyle;
};

export type XlsxSheet = {
  name: string;
  widths: number[];
  merges: string[];
  heights?: Array<number | null>;
  rows: Array<Array<XlsxCell | null>>;
};

const CRC = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC[index] = value >>> 0;
}

function crc32(data: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of data) value = CRC[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; data: Uint8Array }>) {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, file.data);
    const directory = new Uint8Array(46 + name.length);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint16(4, 20, true);
    directoryView.setUint16(6, 20, true);
    directoryView.setUint32(16, crc, true);
    directoryView.setUint32(20, file.data.length, true);
    directoryView.setUint32(24, file.data.length, true);
    directoryView.setUint16(28, name.length, true);
    directoryView.setUint32(42, offset, true);
    directory.set(name, 46);
    central.push(directory);
    offset += local.length + file.data.length;
  }
  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);
  const out = new Uint8Array(offset + directorySize + end.length);
  let cursor = 0;
  for (const part of locals) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of central) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(end, cursor);
  return out;
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let current = index + 1;
  let name = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function sheetName(value: string, used: Set<string>) {
  const cleaned = value.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  let name = cleaned;
  let suffix = 2;
  while (used.has(name)) {
    const tail = ` ${suffix}`;
    name = `${cleaned.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(name);
  return name;
}

type StyleSpec = {
  font: number;
  fill: number;
  border?: number;
  num?: number;
  align?: "center" | "wrap";
};

const SPECS: StyleSpec[] = [
  { font: 0, fill: 0 },
  { font: 1, fill: 2, align: "center" },
  { font: 2, fill: 4 },
  { font: 3, fill: 3, align: "center" },
  { font: 2, fill: 4, border: 1 },
  { font: 3, fill: 2, align: "center" },
  { font: 5, fill: 5, align: "wrap" },
  { font: 4, fill: 6, border: 1, num: 202 },
  { font: 4, fill: 6, border: 1, num: 1 },
  { font: 4, fill: 6, border: 1, num: 203 },
  { font: 4, fill: 6, border: 1 },
  { font: 0, fill: 6, border: 1, num: 200 },
  { font: 0, fill: 6, border: 1, num: 201 },
  { font: 0, fill: 6, border: 1, num: 202 },
  { font: 0, fill: 6, border: 1, num: 1 },
  { font: 0, fill: 6, border: 1 },
  { font: 0, fill: 5, border: 1, num: 200 },
  { font: 0, fill: 5, border: 1, num: 201 },
  { font: 0, fill: 5, border: 1, num: 202 },
  { font: 0, fill: 5, border: 1, num: 1 },
  { font: 0, fill: 5, border: 1 },
];

const STYLE: Record<string, number> = {
  "title:text": 1,
  "subtitle:text": 2,
  "header:text": 3,
  "label:text": 4,
  "section:text": 5,
  "note:text": 6,
  "value:money": 7,
  "value:count": 8,
  "value:decimal": 9,
  "value:text": 10,
  "data:date": 11,
  "data:time": 12,
  "data:money": 13,
  "data:count": 14,
  "data:text": 15,
  "alt:date": 16,
  "alt:time": 17,
  "alt:money": 18,
  "alt:count": 19,
  "alt:text": 20,
};

function styleIndex(cell: XlsxCell) {
  const role = cell.style ?? "plain";
  const kind = cell.kind ?? "text";
  return STYLE[`${role}:${kind}`] ?? STYLE[`${role}:text`] ?? 0;
}

function cellXml(cell: XlsxCell, reference: string) {
  const style = styleIndex(cell);
  if (cell.value === null || cell.value === "") return `<c r="${reference}" s="${style}"/>`;
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t>${xml(String(cell.value))}</t></is></c>`;
}

function worksheet(sheet: XlsxSheet) {
  const columns = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => (cell ? cellXml(cell, `${columnName(columnIndex)}${rowIndex + 1}`) : ""))
        .join("");
      const height = sheet.heights?.[rowIndex];
      const sizing = height ? ` ht="${height}" customHeight="1"` : "";
      return `<row r="${rowIndex + 1}"${sizing}>${cells}</row>`;
    })
    .join("");
  const merges = sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${xml(ref)}"/>`).join("")}</mergeCells>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF5930A5"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData>${merges}</worksheet>`;
}

function xf(spec: StyleSpec) {
  const format = spec.num ? ` numFmtId="${spec.num}" applyNumberFormat="1"` : ` numFmtId="0"`;
  const alignment =
    spec.align === "wrap"
      ? ` applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>`
      : spec.align === "center"
        ? ` applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>`
        : ` applyAlignment="1"><alignment vertical="center"/></xf>`;
  return `<xf${format} fontId="${spec.font}" fillId="${spec.fill}" borderId="${spec.border ?? 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${alignment}`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4">
<numFmt numFmtId="200" formatCode="dd/mm/yyyy"/>
<numFmt numFmtId="201" formatCode="hh:mm"/>
<numFmt numFmtId="202" formatCode="#,##0.00"/>
<numFmt numFmtId="203" formatCode="0.00"/>
</numFmts>
<fonts count="6">
<font><sz val="11"/><color rgb="FF25163F"/><name val="Calibri"/></font>
<font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF5930A5"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF25163F"/><name val="Calibri"/></font>
<font><sz val="11"/><color rgb="FF5930A5"/><name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF25163F"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF5930A5"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF0EBFA"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF6F2FC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
</fills>
<borders count="2">
<border/>
<border>
<left style="thin"><color rgb="FFE4DCF5"/></left>
<right style="thin"><color rgb="FFE4DCF5"/></right>
<top style="thin"><color rgb="FFE4DCF5"/></top>
<bottom style="thin"><color rgb="FFE4DCF5"/></bottom>
</border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${SPECS.length}">
${SPECS.map(xf).join("")}
</cellXfs>
</styleSheet>`;

function workbookXml(names: string[]) {
  const sheets = names.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRels(count: number) {
  const sheets = Array.from({ length: count }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

export function buildXlsx(sheets: XlsxSheet[]) {
  const used = new Set<string>();
  const names = sheets.map((sheet) => sheetName(sheet.name, used));
  const encoder = new TextEncoder();
  const files = [
    {
      name: "[Content_Types].xml",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    },
    { name: "xl/workbook.xml", data: encoder.encode(workbookXml(names)) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels(sheets.length)) },
    { name: "xl/styles.xml", data: encoder.encode(STYLES) },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: encoder.encode(worksheet(sheet)) })),
  ];
  return zipStore(files);
}
