export type DownloadKind = "csv" | "xlsx" | "pdf";

const EXTENSION: Record<DownloadKind, string> = {
  csv: ".csv",
  xlsx: ".xlsx",
  pdf: ".pdf",
};

const MIME: Record<DownloadKind, string> = {
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export function filenameFor(name: string, kind: DownloadKind) {
  const base = name.replace(/\.(csv|xlsx|xls|pdf)$/i, "");
  return `${base}${EXTENSION[kind]}`;
}

export function downloadBlob(name: string, bytes: BlobPart, kind: DownloadKind) {
  const filename = filenameFor(name, kind);
  const blob = new Blob([bytes], { type: MIME[kind] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
