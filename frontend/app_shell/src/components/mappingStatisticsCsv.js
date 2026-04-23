import { downloadBlob } from "./mappingExportCore";

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");

  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replaceAll("\"", "\"\"")}"`
    : stringValue;
}

export function buildMappingStatisticsCsv(rows, totalReads, totalUniqueTags) {
  const hasJobId = rows.some((row) => row.jobId);
  const header = hasJobId
    ? [
        "job_id",
        "type",
        "label",
        "total_reads",
        "total_reads_percent",
        "unique_tags",
        "unique_tags_percent"
      ]
    : [
        "type",
        "label",
        "total_reads",
        "total_reads_percent",
        "unique_tags",
        "unique_tags_percent"
      ];
  const lines = [header.join(",")];

  rows.forEach((row) => {
    const readsBase =
      row.jobTotalReads !== undefined ? Number(row.jobTotalReads || 0) : Number(totalReads || 0);
    const tagsBase =
      row.jobTotalUniqueTags !== undefined
        ? Number(row.jobTotalUniqueTags || 0)
        : Number(totalUniqueTags || 0);
    const readsPercent = readsBase > 0 ? (Number(row.totalReads || 0) / readsBase) * 100 : 0;
    const tagsPercent = tagsBase > 0 ? (Number(row.uniqueTags || 0) / tagsBase) * 100 : 0;
    const fields = hasJobId
      ? [
          row.jobId,
          row.type,
          row.label,
          row.totalReads,
          readsPercent.toFixed(4),
          row.uniqueTags,
          tagsPercent.toFixed(4)
        ]
      : [
          row.type,
          row.label,
          row.totalReads,
          readsPercent.toFixed(4),
          row.uniqueTags,
          tagsPercent.toFixed(4)
        ];

    lines.push(fields.map(escapeCsvValue).join(","));
  });

  return lines.join("\r\n");
}

export function exportMappingStatisticsCsv(rows, totalReads, totalUniqueTags, filename) {
  const csvContent = buildMappingStatisticsCsv(rows, totalReads, totalUniqueTags);
  const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

  downloadBlob(csvBlob, filename);
}
