import JSZip from "jszip";
import {
  defaultExportSettings,
  downloadBlob,
  normalizeDpiValue
} from "./mappingExportCore";
import { exportMappingStatisticsCsv } from "./mappingStatisticsCsv";
import { getTypeColor } from "./mappingStatisticsData";
import {
  cloneSvgForExport,
  parseCssNumber,
  renderSvgCloneToPdfBlob,
  renderSvgMarkupToPngBlob,
  resolveSvgDisplaySize,
  resolveSvgExportDimensions,
  resolveSvgViewBoxSize,
  SVG_NS
} from "./mappingSvgExportCore";
import {
  convertSvgTextToPaths,
  fitLegendFontSize,
  loadBoldFont,
  normalizePdfTextNodes,
  SYSTEM_FONT_STACK
} from "./mappingSvgTextExport";

export { defaultExportSettings, exportMappingStatisticsCsv, normalizeDpiValue };

async function buildSvgExportMarkup(svgElement, settings, { pathifyText = false } = {}) {
  const format = settings.format || defaultExportSettings.format;
  const { width, height } = resolveSvgExportDimensions(svgElement, settings, format);
  const serializer = new XMLSerializer();
  const clone = cloneSvgForExport(svgElement, width, height);

  if (pathifyText) {
    await convertSvgTextToPaths(clone);
  }

  return {
    width,
    height,
    clone,
    markup: serializer.serializeToString(clone)
  };
}

function resolveLegendExportLayout(legendElement, { stable = false } = {}) {
  const itemNodes = [...legendElement.querySelectorAll(".mapping-type-legend__item")];
  const firstItem = itemNodes[0];
  const swatchNode = legendElement.querySelector(".mapping-type-legend__swatch");
  const legendStyle = window.getComputedStyle(legendElement);
  const itemStyle = firstItem ? window.getComputedStyle(firstItem) : null;
  const swatchStyle = swatchNode ? window.getComputedStyle(swatchNode) : null;
  const labelColor = itemStyle?.color || "#262d24";
  const labelWeight = itemStyle?.fontWeight || "700";
  const cardFill = itemStyle?.backgroundColor || "#ffffff";
  const cardStroke = itemStyle?.borderColor || "rgba(94, 116, 45, 0.18)";

  if (stable) {
    const columns = 4;
    const columnGap = 12;
    const rowGap = 10;
    const itemWidth = 180;
    const itemHeight = 44;
    const paddingLeft = 12;
    const paddingRight = 12;
    const swatchSize = 12;
    const swatchGap = 10;
    const borderRadius = 12;
    const borderWidth = 1;
    const fontSize = 16;
    const rows = Math.ceil(itemNodes.length / columns);
    const legendWidth = columns * itemWidth + Math.max(0, columns - 1) * columnGap;
    const legendHeight = rows * itemHeight + Math.max(0, rows - 1) * rowGap;

    return {
      itemNodes,
      columns,
      columnGap,
      rowGap,
      itemWidth,
      itemHeight,
      paddingLeft,
      paddingRight,
      swatchSize,
      swatchGap,
      borderRadius,
      borderWidth,
      fontSize,
      labelColor,
      labelWeight,
      cardFill,
      cardStroke,
      legendWidth,
      legendHeight
    };
  }

  const columns = Math.max(
    1,
    String(legendStyle.gridTemplateColumns || "")
      .split(" ")
      .filter(Boolean).length || 1
  );
  const columnGap = parseCssNumber(legendStyle.columnGap || legendStyle.gap, 8);
  const rowGap = parseCssNumber(legendStyle.rowGap || legendStyle.gap, 8);
  const itemWidth = firstItem ? Math.ceil(firstItem.getBoundingClientRect().width) : 180;
  const itemHeight = firstItem ? Math.ceil(firstItem.getBoundingClientRect().height) : 48;
  const paddingLeft = itemStyle ? parseCssNumber(itemStyle.paddingLeft, 12) : 12;
  const paddingRight = itemStyle ? parseCssNumber(itemStyle.paddingRight, 12) : 12;
  const swatchSize = swatchStyle ? parseCssNumber(swatchStyle.width, 12) : 12;
  const swatchGap = itemStyle ? parseCssNumber(itemStyle.gap, 8) : 8;
  const borderRadius = itemStyle ? parseCssNumber(itemStyle.borderRadius, 10) : 10;
  const borderWidth = itemStyle ? parseCssNumber(itemStyle.borderWidth, 1) : 1;
  const fontSize = itemStyle ? parseCssNumber(itemStyle.fontSize, 18) : 18;
  const rows = Math.ceil(itemNodes.length / columns);
  const legendWidth = columns * itemWidth + Math.max(0, columns - 1) * columnGap;
  const legendHeight = rows * itemHeight + Math.max(0, rows - 1) * rowGap;

  return {
    itemNodes,
    columns,
    columnGap,
    rowGap,
    itemWidth,
    itemHeight,
    paddingLeft,
    paddingRight,
    swatchSize,
    swatchGap,
    borderRadius,
    borderWidth,
    fontSize,
    labelColor,
    labelWeight,
    cardFill,
    cardStroke,
    legendWidth,
    legendHeight
  };
}

async function buildSvgWithLegendExportMarkup(
  svgElement,
  legendElement,
  settings,
  { pathifyText = false } = {}
) {
  const serializer = new XMLSerializer();
  const legendFont = await loadBoldFont();
  const isStackedChartExport = svgElement.classList.contains("mapping-stacked-chart__svg");
  const viewBoxSize = resolveSvgViewBoxSize(svgElement);
  const exportScale = isStackedChartExport ? 2.25 : 1;
  const svgSize = isStackedChartExport
    ? {
        width: Math.round(viewBoxSize.width * exportScale),
        height: Math.round(viewBoxSize.height * exportScale)
      }
    : resolveSvgExportDimensions(svgElement, settings, "pdf");
  const exportBottom = Number.parseFloat(svgElement.getAttribute("data-export-bottom"));
  const chartViewBoxHeight =
    Number.isFinite(exportBottom) && exportBottom > 0
      ? Math.min(viewBoxSize.height, exportBottom)
      : viewBoxSize.height;
  const chartVisibleHeight = isStackedChartExport
    ? Math.round(chartViewBoxHeight * exportScale)
    : Math.min(svgSize.height, chartViewBoxHeight);
  const legendLayout = resolveLegendExportLayout(legendElement, {
    stable: isStackedChartExport
  });
  const paddingX = 20;
  const paddingY = 16;
  const legendSpacing = 4;
  const outerWidth = Math.max(svgSize.width, legendLayout.legendWidth) + paddingX * 2;
  const outerHeight =
    chartVisibleHeight + legendSpacing + legendLayout.legendHeight + paddingY * 2;
  const outerSvg = document.createElementNS(SVG_NS, "svg");
  const background = document.createElementNS(SVG_NS, "rect");
  const chartClone = cloneSvgForExport(svgElement, svgSize.width, svgSize.height);
  const chartX = (outerWidth - svgSize.width) / 2;
  const chartY = paddingY;
  const legendX = (outerWidth - legendLayout.legendWidth) / 2;
  const legendY = chartY + chartVisibleHeight + legendSpacing;

  outerSvg.setAttribute("xmlns", SVG_NS);
  outerSvg.setAttribute("width", String(outerWidth));
  outerSvg.setAttribute("height", String(outerHeight));
  outerSvg.setAttribute("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(outerWidth));
  background.setAttribute("height", String(outerHeight));
  background.setAttribute("fill", "#ffffff");
  outerSvg.appendChild(background);

  if (isStackedChartExport) {
    const defs = document.createElementNS(SVG_NS, "defs");
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    const clipRect = document.createElementNS(SVG_NS, "rect");
    const chartGroup = document.createElementNS(SVG_NS, "g");
    const clipId = `mapping-stacked-export-clip-${Math.random().toString(36).slice(2, 10)}`;

    clipPath.setAttribute("id", clipId);
    clipRect.setAttribute("x", String(chartX));
    clipRect.setAttribute("y", String(chartY));
    clipRect.setAttribute("width", String(svgSize.width));
    clipRect.setAttribute("height", String(chartVisibleHeight));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    outerSvg.appendChild(defs);

    chartGroup.setAttribute("transform", `translate(${chartX} ${chartY}) scale(${exportScale})`);
    chartGroup.setAttribute("clip-path", `url(#${clipId})`);

    [...chartClone.childNodes].forEach((node) => {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.nodeName.toLowerCase() === "rect" &&
        node === chartClone.firstChild
      ) {
        return;
      }

      chartGroup.appendChild(node.cloneNode(true));
    });

    outerSvg.appendChild(chartGroup);
  } else {
    chartClone.removeAttribute("xmlns");
    chartClone.setAttribute("x", String(chartX));
    chartClone.setAttribute("y", String(chartY));
    chartClone.setAttribute("width", String(svgSize.width));
    chartClone.setAttribute("height", String(chartVisibleHeight));
    chartClone.setAttribute("viewBox", `0 0 ${viewBoxSize.width} ${chartViewBoxHeight}`);
    outerSvg.appendChild(chartClone);
  }

  legendLayout.itemNodes.forEach((itemNode, index) => {
    const label = itemNode.textContent?.trim() || "";
    const swatchNode = itemNode.querySelector(".mapping-type-legend__swatch");
    const swatchColor = swatchNode
      ? window.getComputedStyle(swatchNode).backgroundColor
      : getTypeColor(label, index);
    const columnIndex = index % legendLayout.columns;
    const rowIndex = Math.floor(index / legendLayout.columns);
    const x = legendX + columnIndex * (legendLayout.itemWidth + legendLayout.columnGap);
    const y = legendY + rowIndex * (legendLayout.itemHeight + legendLayout.rowGap);
    const card = document.createElementNS(SVG_NS, "rect");
    const swatch = document.createElementNS(SVG_NS, "circle");
    const text = document.createElementNS(SVG_NS, "text");
    const maxLabelWidth =
      legendLayout.itemWidth -
      legendLayout.paddingLeft -
      legendLayout.paddingRight -
      legendLayout.swatchSize -
      legendLayout.swatchGap;
    const fittedFontSize = fitLegendFontSize(
      label,
      legendFont,
      legendLayout.fontSize,
      maxLabelWidth
    );

    card.setAttribute("x", String(x));
    card.setAttribute("y", String(y));
    card.setAttribute("width", String(legendLayout.itemWidth));
    card.setAttribute("height", String(legendLayout.itemHeight));
    card.setAttribute("rx", String(legendLayout.borderRadius));
    card.setAttribute("ry", String(legendLayout.borderRadius));
    card.setAttribute("fill", legendLayout.cardFill);
    card.setAttribute("stroke", legendLayout.cardStroke);
    card.setAttribute("stroke-width", String(legendLayout.borderWidth));
    outerSvg.appendChild(card);

    swatch.setAttribute(
      "cx",
      String(x + legendLayout.paddingLeft + legendLayout.swatchSize / 2)
    );
    swatch.setAttribute("cy", String(y + legendLayout.itemHeight / 2));
    swatch.setAttribute("r", String(legendLayout.swatchSize / 2));
    swatch.setAttribute("fill", swatchColor);
    outerSvg.appendChild(swatch);

    text.textContent = label;
    text.setAttribute(
      "x",
      String(
        x +
          legendLayout.paddingLeft +
          legendLayout.swatchSize +
          legendLayout.swatchGap
      )
    );
    text.setAttribute("y", String(y + legendLayout.itemHeight / 2 + fittedFontSize * 0.35));
    text.setAttribute("fill", legendLayout.labelColor);
    text.setAttribute("font-size", String(fittedFontSize));
    text.setAttribute("font-weight", String(legendLayout.labelWeight));
    text.setAttribute("font-family", SYSTEM_FONT_STACK);
    outerSvg.appendChild(text);
  });

  if (pathifyText) {
    await convertSvgTextToPaths(outerSvg);
  }

  return {
    width: outerWidth,
    height: outerHeight,
    clone: outerSvg,
    markup: serializer.serializeToString(outerSvg)
  };
}

async function buildSingleSampleFigureExportMarkup(
  uniqueSvgElement,
  totalSvgElement,
  rows,
  settings,
  { pathifyText = false } = {}
) {
  const serializer = new XMLSerializer();
  const legendFont = await loadBoldFont();
  const uniqueSize = resolveSvgDisplaySize(uniqueSvgElement);
  const totalSize = resolveSvgDisplaySize(totalSvgElement);
  const chartWidth = Math.max(uniqueSize.width, totalSize.width);
  const chartHeight = Math.max(uniqueSize.height, totalSize.height);
  const panelWidth = Math.max(chartWidth + 72, 520);
  const paddingX = 24;
  const paddingTop = 24;
  const paddingBottom = 18;
  const chartGap = 56;
  const titleHeight = 32;
  const titleGap = 10;
  const legendGap = 10;
  const legendColumns = 4;
  const legendColumnGap = 12;
  const legendRowGap = 10;
  const legendItemHeight = 50;
  const legendPaddingLeft = 14;
  const legendPaddingRight = 14;
  const legendSwatchSize = 12;
  const legendSwatchGap = 10;
  const titleFontSize = 24;
  const legendFontSize = 16;
  const legendRadius = 12;
  const legendBorderWidth = 1;
  const outerWidth = paddingX * 2 + panelWidth * 2 + chartGap;
  const legendItemWidth =
    (outerWidth - paddingX * 2 - legendColumnGap * (legendColumns - 1)) /
    legendColumns;
  const legendRows = Math.ceil(rows.length / legendColumns);
  const legendHeight =
    legendRows * legendItemHeight + Math.max(0, legendRows - 1) * legendRowGap;
  const outerHeight =
    paddingTop +
    titleHeight +
    titleGap +
    chartHeight +
    legendGap +
    legendHeight +
    paddingBottom;
  const chartY = paddingTop + titleHeight + titleGap;
  const uniquePanelX = paddingX;
  const totalPanelX = paddingX + panelWidth + chartGap;
  const uniqueChartX = uniquePanelX + (panelWidth - chartWidth) / 2;
  const totalChartX = totalPanelX + (panelWidth - chartWidth) / 2;
  const legendY = chartY + chartHeight + legendGap;
  const outerSvg = document.createElementNS(SVG_NS, "svg");
  const background = document.createElementNS(SVG_NS, "rect");
  const uniqueClone = cloneSvgForExport(uniqueSvgElement, chartWidth, chartHeight);
  const totalClone = cloneSvgForExport(totalSvgElement, chartWidth, chartHeight);
  const titles = [
    {
      text: "Based on unique tags",
      centerX: uniquePanelX + panelWidth / 2
    },
    {
      text: "Based on total reads count",
      centerX: totalPanelX + panelWidth / 2
    }
  ];

  outerSvg.setAttribute("xmlns", SVG_NS);
  outerSvg.setAttribute("width", String(outerWidth));
  outerSvg.setAttribute("height", String(outerHeight));
  outerSvg.setAttribute("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(outerWidth));
  background.setAttribute("height", String(outerHeight));
  background.setAttribute("fill", "#ffffff");
  outerSvg.appendChild(background);

  titles.forEach(({ text, centerX }) => {
    const titleNode = document.createElementNS(SVG_NS, "text");

    titleNode.textContent = text;
    titleNode.setAttribute("x", String(centerX));
    titleNode.setAttribute("y", String(paddingTop + titleFontSize));
    titleNode.setAttribute("text-anchor", "middle");
    titleNode.setAttribute("fill", "#262d24");
    titleNode.setAttribute("font-size", String(titleFontSize));
    titleNode.setAttribute("font-weight", "800");
    titleNode.setAttribute("font-family", SYSTEM_FONT_STACK);
    outerSvg.appendChild(titleNode);
  });

  uniqueClone.removeAttribute("xmlns");
  uniqueClone.setAttribute("x", String(uniqueChartX));
  uniqueClone.setAttribute("y", String(chartY));
  uniqueClone.setAttribute("width", String(chartWidth));
  uniqueClone.setAttribute("height", String(chartHeight));
  outerSvg.appendChild(uniqueClone);

  totalClone.removeAttribute("xmlns");
  totalClone.setAttribute("x", String(totalChartX));
  totalClone.setAttribute("y", String(chartY));
  totalClone.setAttribute("width", String(chartWidth));
  totalClone.setAttribute("height", String(chartHeight));
  outerSvg.appendChild(totalClone);

  rows.forEach((row, index) => {
    const columnIndex = index % legendColumns;
    const rowIndex = Math.floor(index / legendColumns);
    const x = paddingX + columnIndex * (legendItemWidth + legendColumnGap);
    const y = legendY + rowIndex * (legendItemHeight + legendRowGap);
    const card = document.createElementNS(SVG_NS, "rect");
    const swatch = document.createElementNS(SVG_NS, "circle");
    const text = document.createElementNS(SVG_NS, "text");
    const maxLabelWidth =
      legendItemWidth -
      legendPaddingLeft -
      legendPaddingRight -
      legendSwatchSize -
      legendSwatchGap;
    const fittedFontSize = fitLegendFontSize(
      row.label,
      legendFont,
      legendFontSize,
      maxLabelWidth
    );

    card.setAttribute("x", String(x));
    card.setAttribute("y", String(y));
    card.setAttribute("width", String(legendItemWidth));
    card.setAttribute("height", String(legendItemHeight));
    card.setAttribute("rx", String(legendRadius));
    card.setAttribute("ry", String(legendRadius));
    card.setAttribute("fill", "rgba(255, 255, 255, 0.72)");
    card.setAttribute("stroke", "rgba(94, 116, 45, 0.18)");
    card.setAttribute("stroke-width", String(legendBorderWidth));
    outerSvg.appendChild(card);

    swatch.setAttribute("cx", String(x + legendPaddingLeft + legendSwatchSize / 2));
    swatch.setAttribute("cy", String(y + legendItemHeight / 2));
    swatch.setAttribute("r", String(legendSwatchSize / 2));
    swatch.setAttribute("fill", getTypeColor(row.type, index));
    outerSvg.appendChild(swatch);

    text.textContent = row.label;
    text.setAttribute(
      "x",
      String(x + legendPaddingLeft + legendSwatchSize + legendSwatchGap)
    );
    text.setAttribute("y", String(y + legendItemHeight / 2 + fittedFontSize * 0.34));
    text.setAttribute("fill", "#262d24");
    text.setAttribute("font-size", String(fittedFontSize));
    text.setAttribute("font-weight", "800");
    text.setAttribute("font-family", SYSTEM_FONT_STACK);
    outerSvg.appendChild(text);
  });

  if (pathifyText) {
    await convertSvgTextToPaths(outerSvg);
  }

  return {
    width: outerWidth,
    height: outerHeight,
    clone: outerSvg,
    markup: serializer.serializeToString(outerSvg)
  };
}

async function exportSvgChartBlob(svgElement, settings, { pathifyText = true } = {}) {
  if (!svgElement) {
    return null;
  }

  const format = settings.format || defaultExportSettings.format;

  if (format === "pdf") {
    const { clone, width, height } = await buildSvgExportMarkup(svgElement, settings, {
      pathifyText
    });

    if (!pathifyText) {
      normalizePdfTextNodes(clone);
    }

    return {
      blob: await renderSvgCloneToPdfBlob(clone, width, height),
      extension: "pdf"
    };
  }

  const { markup, width, height } = await buildSvgExportMarkup(svgElement, settings);
  const pngBlob = await renderSvgMarkupToPngBlob(markup, width, height);

  if (!pngBlob) {
    return null;
  }

  return {
    blob: pngBlob,
    extension: "png"
  };
}

async function exportSvgChartWithLegendBlob(svgElement, legendElement, settings) {
  if (!svgElement || !legendElement) {
    return null;
  }

  const format = settings.format || defaultExportSettings.format;

  if (format === "pdf") {
    const { clone, width, height } = await buildSvgWithLegendExportMarkup(
      svgElement,
      legendElement,
      settings,
      { pathifyText: true }
    );

    return {
      blob: await renderSvgCloneToPdfBlob(clone, width, height),
      extension: "pdf"
    };
  }

  const { markup, width, height } = await buildSvgWithLegendExportMarkup(
    svgElement,
    legendElement,
    settings
  );
  const pngBlob = await renderSvgMarkupToPngBlob(markup, width, height);

  if (!pngBlob) {
    return null;
  }

  return {
    blob: pngBlob,
    extension: "png"
  };
}

async function exportSingleSampleFigureBlob(chart, settings) {
  const uniqueSvg = chart?.pairSvgRefs?.unique?.current;
  const totalSvg = chart?.pairSvgRefs?.total?.current;
  const rows = chart?.rows || [];

  if (!uniqueSvg || !totalSvg || rows.length === 0) {
    return null;
  }

  const format = settings.format || defaultExportSettings.format;

  if (format === "pdf") {
    const { clone, width, height } = await buildSingleSampleFigureExportMarkup(
      uniqueSvg,
      totalSvg,
      rows,
      settings,
      { pathifyText: true }
    );

    return {
      blob: await renderSvgCloneToPdfBlob(clone, width, height),
      extension: "pdf"
    };
  }

  const { markup, width, height } = await buildSingleSampleFigureExportMarkup(
    uniqueSvg,
    totalSvg,
    rows,
    settings
  );
  const pngBlob = await renderSvgMarkupToPngBlob(markup, width, height);

  if (!pngBlob) {
    return null;
  }

  return {
    blob: pngBlob,
    extension: "png"
  };
}

async function exportChartBlob(chart, settings) {
  if (chart?.pairSvgRefs?.unique?.current && chart?.pairSvgRefs?.total?.current) {
    return exportSingleSampleFigureBlob(chart, settings);
  }

  if (chart?.svgRef?.current && chart?.legendRef?.current) {
    return exportSvgChartWithLegendBlob(chart.svgRef.current, chart.legendRef.current, settings);
  }

  return exportSvgChartBlob(chart?.svgRef?.current, settings, {
    pathifyText: chart?.pathifyText !== false
  });
}

export async function exportChartBundle(charts, settings, bundleName) {
  const zip = new JSZip();

  for (const chart of charts) {
    const result = await exportChartBlob(chart, settings);

    if (result?.blob) {
      zip.file(`${chart.fileStem}.${result.extension}`, result.blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${bundleName}.zip`);
}

export async function exportSingleChart(chart, settings, fileStem) {
  const result = await exportChartBlob(chart, settings);

  if (!result?.blob) {
    return;
  }

  downloadBlob(result.blob, `${fileStem}.${result.extension}`);
}
