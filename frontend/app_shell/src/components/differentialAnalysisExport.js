import {
  defaultExportSettings,
  exportChartBundle,
  exportSingleChart,
  normalizeDpiValue
} from "./mappingStatisticsExport";
import JSZip from "jszip";

export { defaultExportSettings, exportChartBundle, exportSingleChart, normalizeDpiValue };

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replaceAll("\"", "\"\"")}"`
    : stringValue;
}

function formatCsvNumber(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "";
  }

  return String(numeric);
}

export function buildDifferentialAnalysisCsv(rows = []) {
  const header = [
    "gene",
    "base_mean",
    "log2_fold_change",
    "fold_change",
    "p_value",
    "adjusted_p_value",
    "status"
  ];
  const lines = [header.join(",")];

  rows.forEach((row) => {
    const log2FoldChange = Number(row?.log2FoldChange);
    const foldChange = Number.isFinite(log2FoldChange) ? 2 ** log2FoldChange : "";
    const fields = [
      row?.gene,
      formatCsvNumber(row?.baseMean),
      formatCsvNumber(row?.log2FoldChange),
      formatCsvNumber(foldChange),
      formatCsvNumber(row?.pvalue),
      formatCsvNumber(row?.padj),
      row?.status
    ];

    lines.push(fields.map(escapeCsvValue).join(","));
  });

  return lines.join("\r\n");
}

export function buildTargetGeneNetworkCsv(rows = []) {
  const header = [
    "gene_symbol",
    "ensembl_id",
    "support_mirnas",
    "up_mirnas",
    "down_mirnas",
    "best_weighted_context_score",
    "mean_weighted_context_score",
    "example_mirnas",
    "string_url"
  ];
  const lines = [header.join(",")];

  rows.forEach((row) => {
    const stringUrl = String(row?.stringUrl ?? "");
    const fields = [
      row?.gene,
      row?.geneId,
      formatCsvNumber(row?.supportMirnas),
      formatCsvNumber(row?.upMirnas),
      formatCsvNumber(row?.downMirnas),
      formatCsvNumber(row?.bestWeightedContextScore),
      formatCsvNumber(row?.meanWeightedContextScore),
      row?.exampleMirnas,
      stringUrl
    ];

    lines.push(fields.map(escapeCsvValue).join(","));
  });

  return lines.join("\r\n");
}

export async function exportDifferentialAnalysisCsvBundle(
  analysisRows,
  targetRows = [],
  filename = "srnameta_differential_analysis_bundle.zip"
) {
  const zip = new JSZip();

  zip.file(
    "srnameta_differential_analysis.csv",
    buildDifferentialAnalysisCsv(analysisRows)
  );

  if (Array.isArray(targetRows) && targetRows.length > 0) {
    zip.file(
      "srnameta_target_gene_network.csv",
      buildTargetGeneNetworkCsv(targetRows)
    );
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, filename);
}
