export const statusLabels = {
  up: "Up",
  down: "Down",
  not_significant: "Non"
};

export const analysisStages = [
  { key: "data", label: "Data" },
  { key: "volcano", label: "Volcano Plot" },
  { key: "heatmap", label: "Heatmap" }
];

export function formatNumber(value, digits = 2) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "NA";
  }

  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits
  });
}

export function formatPValue(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "NA";
  }

  if (numeric === 0) {
    return "<1e-308";
  }

  if (numeric < 0.0001) {
    return numeric.toExponential(2);
  }

  return formatNumber(numeric, 4);
}

export function formatFoldChangeFromLog2(value, digits = 3) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "NA";
  }

  return formatNumber(2 ** numeric, digits);
}

export function resolveFoldChangeInput(lastRequest, config) {
  const requestedLog2fc = Number(lastRequest.log2fc);

  if (Number.isFinite(requestedLog2fc)) {
    return String(Number((2 ** requestedLog2fc).toFixed(3)));
  }

  return String(config.defaultFoldChange || 2);
}

export function foldChangeToLog2(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.log2(numeric);
}

export function statusPriority(status) {
  switch (status) {
    case "up":
      return 0;
    case "not_significant":
      return 1;
    case "down":
      return 2;
    default:
      return 3;
  }
}

export function parseGeneIds(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[\s,，;；\r\n\t]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function createIndexRange(start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    return [];
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function buildHeatmapSubset(heatmap, rowIndexes, columnIndexes = null, signatureSuffix = "detail") {
  const rows = Array.isArray(heatmap?.rows) ? heatmap.rows : [];
  const columns = Array.isArray(heatmap?.columns) ? heatmap.columns : [];
  const matrix = Array.isArray(heatmap?.matrix) ? heatmap.matrix : [];
  const baseSignature = heatmap?.signature || "heatmap";
  const safeRowIndexes = rowIndexes.filter(
    (index) => Number.isInteger(index) && index >= 0 && index < rows.length
  );
  const resolvedColumnIndexes = (columnIndexes || columns.map((_, index) => index)).filter(
    (index) => Number.isInteger(index) && index >= 0 && index < columns.length
  );

  if (!safeRowIndexes.length || !resolvedColumnIndexes.length) {
    return {
      ...heatmap,
      subtitle: "",
      rows: [],
      columns: [],
      matrix: [],
      signature: `${baseSignature}::${signatureSuffix}::empty`
    };
  }

  return {
    ...heatmap,
    subtitle: `${safeRowIndexes.length.toLocaleString()} genes x ${resolvedColumnIndexes.length} samples`,
    rows: safeRowIndexes.map((index) => rows[index]),
    columns: resolvedColumnIndexes.map((index) => columns[index]),
    matrix: safeRowIndexes.map((rowIndex) =>
      resolvedColumnIndexes.map((columnIndex) => Number(matrix[rowIndex]?.[columnIndex] || 0))
    ),
    showRowLabels: false,
    brushEnabled: false,
    signature: `${baseSignature}::${signatureSuffix}::rows=${safeRowIndexes[0]}-${safeRowIndexes[safeRowIndexes.length - 1]}::cols=${resolvedColumnIndexes[0]}-${resolvedColumnIndexes[resolvedColumnIndexes.length - 1]}`
  };
}
