export async function exportToCSV(
  rows: Record<string, unknown>[],
  filename = "report.csv",
) {
  const headers = Object.keys(rows[0] ?? {});
  const csv = [headers.join(",")]
    .concat(
      rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Lightweight Excel via CSV for now. PDF generation should be done with jspdf in the UI when needed.
export async function exportToExcel(
  rows: Record<string, unknown>[],
  filename = "report.xlsx",
) {
  // fallback to CSV with .xlsx name for simple client export
  return exportToCSV(rows, filename.replace(/\.xlsx$/i, ".csv"));
}
