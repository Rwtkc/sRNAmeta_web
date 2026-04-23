export const defaultExportSettings = {
  format: "png",
  dpi: "300"
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resolveExportSize(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveExportDpi(value) {
  return Math.min(Math.max(resolveExportSize(value, 300), 72), 1200);
}

export function normalizeDpiValue(value) {
  const fallback = 300;
  const parsed = Number.parseInt(value, 10);
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  const clamped = Math.min(Math.max(normalized, 72), 1200);
  let hint = "";

  if (!Number.isFinite(parsed) || parsed <= 0) {
    hint = `Resolution was reset to ${clamped} DPI.`;
  } else if (parsed < 72) {
    hint = "Resolution below 72 DPI was adjusted to 72 DPI.";
  } else if (parsed > 1200) {
    hint = "Resolution above 1200 DPI was adjusted to 1200 DPI.";
  }

  return {
    value: String(clamped),
    hint
  };
}
