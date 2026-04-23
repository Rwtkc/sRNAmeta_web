export const chartColors = [
  "#60762b",
  "#91a80d",
  "#b5c84e",
  "#6f835b",
  "#d0d977",
  "#273126",
  "#7f946f",
  "#4f654b",
  "#d8e1bc",
  "#708062",
  "#354335",
  "#e2e8c7"
];

export const mappingTypeOrder = [
  "miRNA",
  "tRNA",
  "rRNA",
  "snRNA",
  "snoRNA",
  "other_Rfam",
  "mRNA",
  "lncRNA",
  "circRNA",
  "piRNA",
  "other",
  "non_mapping"
];

const typeColorMap = Object.fromEntries(
  mappingTypeOrder.map((type, index) => [type, chartColors[index % chartColors.length]])
);

export const TAU = Math.PI * 2;

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function getTypeColor(type, fallbackIndex = 0) {
  return typeColorMap[type] || chartColors[fallbackIndex % chartColors.length];
}

export function sortRowsByType(rows) {
  const orderIndex = new Map(mappingTypeOrder.map((type, index) => [type, index]));

  return [...rows].sort((left, right) => {
    const leftOrder = orderIndex.has(left.type)
      ? orderIndex.get(left.type)
      : Number.MAX_SAFE_INTEGER;
    const rightOrder = orderIndex.has(right.type)
      ? orderIndex.get(right.type)
      : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return String(left.label || left.type).localeCompare(String(right.label || right.type));
  });
}

export function flattenJobRows(jobs) {
  return jobs.flatMap((job) =>
    (job.rows || []).map((row) => ({
      ...row,
      jobId: job.jobId
    }))
  );
}

export function buildExportRowsFromJobs(jobs) {
  return jobs.flatMap((job) =>
    (job.rows || []).map((row) => ({
      ...row,
      jobId: job.jobId,
      jobTotalReads: job.totalReads,
      jobTotalUniqueTags: job.totalUniqueTags
    }))
  );
}

export function getStackedChartLayout(jobCount) {
  const viewBoxWidth = Math.max(500, jobCount * 148 + 120);
  const viewBoxHeight = 430;
  const chartTop = 54;
  const chartBottom = 316;
  const chartLeft = 68;
  const chartRight = 24;
  const chartHeight = chartBottom - chartTop;
  const chartWidth = viewBoxWidth - chartLeft - chartRight;
  const stepWidth = chartWidth / Math.max(jobCount, 1);
  const barWidth = Math.min(84, stepWidth * 0.58);

  return {
    viewBoxWidth,
    viewBoxHeight,
    chartTop,
    chartBottom,
    chartLeft,
    chartRight,
    chartHeight,
    chartWidth,
    stepWidth,
    barWidth
  };
}

function polarToCartesian(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

export function donutSegmentPath(startAngle, endAngle, outerRadius, innerRadius) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const center = 120;
  const outerStart = polarToCartesian(center, center, outerRadius, startAngle);
  const outerEnd = polarToCartesian(center, center, outerRadius, endAngle);
  const innerStart = polarToCartesian(center, center, innerRadius, endAngle);
  const innerEnd = polarToCartesian(center, center, innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z"
  ].join(" ");
}
