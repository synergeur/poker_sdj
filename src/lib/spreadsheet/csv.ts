export type CsvValue = string | number | null;

export function toCsv(rows: CsvValue[][], locale: string) {
  const french = locale.toLowerCase().startsWith("fr");
  const separator = french ? ";" : ",";
  const decimal = french ? "," : ".";
  const body = rows.map((row) => row.map((value) => field(value, separator, decimal)).join(separator)).join("\r\n");
  return `\uFEFF${body}`;
}

function field(value: CsvValue, separator: string, decimal: string) {
  if (value === null) return "";
  const text = typeof value === "number" ? String(value).replace(".", decimal) : value;
  if (text.includes(separator) || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
