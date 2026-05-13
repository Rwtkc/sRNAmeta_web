import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  bandSelection,
  buildLegendCounts,
  computeLabelStep,
  differentialStatusColor,
  drawPlotFrame,
  ensureNumericDomain,
  positionTooltip,
  roundedColorDomain,
  sampleGroupColor,
  sampleMetaHtml,
  shortSampleLabel,
  valueDomain
} from "./differentialAnalysisChartUtils";

export function useD3Chart(drawChart, deps) {
  const ref = useRef(null);
  const renderedWidthRef = useRef(0);
  const lastRenderReasonRef = useRef(null);
  const lastRenderAtRef = useRef(0);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!ref.current) {
      return undefined;
    }

    let cleanup;
    let frameId = null;
    const chartRoot = ref.current;

    const renderChart = (reason = "data") => {
      if (!chartRoot) {
        setIsRendering(false);
        return;
      }

      if (typeof cleanup === "function") {
        cleanup();
      }

      renderedWidthRef.current = Math.round(chartRoot.clientWidth || 0);
      lastRenderReasonRef.current = reason;
      lastRenderAtRef.current =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      cleanup = drawChart(chartRoot, {
        animate: reason !== "resize",
        reason
      });
      setIsRendering(false);
    };

    const scheduleRender = (reason = "data") => {
      setIsRendering(reason !== "resize");

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;
        renderChart(reason);
      });
    };

    scheduleRender("initial");

    let observer;
    const handleWindowResize = () => {
      const nextWidth = Math.round(chartRoot.clientWidth || 0);

      if (nextWidth && nextWidth !== renderedWidthRef.current) {
        scheduleRender("resize");
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        const nextWidth = Math.round(entries[0]?.contentRect?.width || chartRoot.clientWidth || 0);

        if (nextWidth && nextWidth !== renderedWidthRef.current) {
          const now =
            typeof performance !== "undefined" && typeof performance.now === "function"
              ? performance.now()
              : Date.now();
          const widthDelta = Math.abs(nextWidth - renderedWidthRef.current);
          const justRenderedInitially =
            lastRenderReasonRef.current === "initial" &&
            now - lastRenderAtRef.current < 500;
          const likelyScrollbarOrLayoutShift = justRenderedInitially && widthDelta <= 24;

          if (likelyScrollbarOrLayoutShift) {
            renderedWidthRef.current = nextWidth;
            return;
          }

          scheduleRender("resize");
        }
      });
      observer.observe(chartRoot);
    } else {
      window.addEventListener("resize", handleWindowResize);
    }

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", handleWindowResize);
      }

      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, isRendering };
}

export function normalizeDifferentialVolcanoData(points = []) {
  return (points || []).map((item) => ({
    gene: String(item?.gene || ""),
    x: Number(item?.log2FoldChange),
    y: Number(item?.negLog10Padj),
    pvalue: Number(item?.pvalue),
    padj: Number(item?.padj),
    status:
      item?.status === "up" ? "Up" : item?.status === "down" ? "Down" : "Non"
  }));
}

export function normalizeDifferentialHeatmap(heatmap) {
  const rows = Array.isArray(heatmap?.genes) ? heatmap.genes.map((value) => String(value ?? "")) : [];
  const groupCounts = { Control: 0, Treatment: 0, Sample: 0 };
  const columns = Array.isArray(heatmap?.samples)
    ? heatmap.samples.map((sample, index) => {
        const displaySample = String(sample?.name || `Sample ${index + 1}`);
        const group = String(sample?.group || "").toLowerCase() === "treatment" ? "Treatment" : "Control";
        groupCounts[group] = (groupCounts[group] || 0) + 1;

        return {
          key: displaySample,
          displaySample,
          axisLabel: shortSampleLabel(displaySample, group, groupCounts[group], index),
          actualSample: String(sample?.name || ""),
          actualRna: "",
          actualRibo: "",
          group
        };
      })
    : [];
  const cellMap = new Map(
    (heatmap?.cells || []).map((cell) => [`${cell.gene}|||${cell.sample}`, Number(cell.value)])
  );
  const matrix = rows.map((gene) =>
    columns.map((column) => {
      const value = cellMap.get(`${gene}|||${column.displaySample}`);
      return Number.isFinite(value) ? value : 0;
    })
  );

  return {
    title: "Differential Expression Heatmap",
    subtitle: `${rows.length.toLocaleString()} genes x ${columns.length} samples`,
    signature: `${rows.join("|")}__${columns.map((column) => column.displaySample).join("|")}`,
    palette: ["#265dff", "#f8fbf6", "#84a900"],
    rows,
    columns,
    matrix,
    showRowLabels: false,
    brushEnabled: false
  };
}

export function drawDifferentialVolcanoChart(container, data, thresholds, summary, renderState = {}) {
  const root = d3.select(container);
  root.selectAll("*").remove();
  root.style("position", "relative");
  const plotData = (data || []).filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y));

  if (!plotData.length) {
    root.append("div").attr("class", "srnameta-d3-empty").text("No volcano data available.");
    return undefined;
  }

  const width = container.clientWidth || 960;
  const height = 600;
  const margin = { top: 68, right: 28, bottom: 64, left: 76 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const svg = root.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("class", "srnameta-d3-chart");
  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const tooltip = root.append("div").attr("class", "srnameta-d3-tooltip").style("opacity", 0);
  const legendItems = ["Up", "Non", "Down"];
  const legendCounts = buildLegendCounts(plotData);
  const xDomain = ensureNumericDomain(plotData.map((item) => item.x), [-2, 2]);
  const yDomain = [0, ensureNumericDomain(plotData.map((item) => item.y), [0, 4])[1]];
  const x = d3.scaleLinear().domain(xDomain).nice().range([0, innerWidth]);
  const y = d3.scaleLinear().domain(yDomain).nice().range([innerHeight, 0]);
  const shouldAnimate = renderState.animate !== false;

  svg
    .append("text")
    .attr("x", 0)
    .attr("y", 12)
    .attr("class", "srnameta-d3-chart-title srnameta-d3-chart-title--qc")
    .text("Differential Expression Volcano Plot");

  if (x(0) >= 0 && x(0) <= innerWidth) {
    chart
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#b6c8cf")
      .attr("stroke-dasharray", "6 6");
  }

  if (y(0) >= 0 && y(0) <= innerHeight) {
    chart
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#b6c8cf")
      .attr("stroke-dasharray", "6 6");
  }

  [-Number(thresholds?.log2fc || 0), Number(thresholds?.log2fc || 0)]
    .filter((value) => Number.isFinite(value) && value !== 0)
    .forEach((value) => {
      chart
        .append("line")
        .attr("x1", x(value))
        .attr("x2", x(value))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", "#8fa1a7")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "6 6");
    });

  if (Number.isFinite(Number(thresholds?.padj)) && Number(thresholds.padj) > 0) {
    const thresholdY = -Math.log10(Number(thresholds.padj));

    if (Number.isFinite(thresholdY)) {
      chart
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y(thresholdY))
        .attr("y2", y(thresholdY))
        .attr("stroke", "#8fa1a7")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "6 6");
    }
  }

  const points = chart
    .selectAll("circle")
    .data(plotData)
    .enter()
    .append("circle")
    .attr("cx", (item) => x(item.x))
    .attr("cy", (item) => y(item.y))
    .attr("r", 0)
    .attr("fill", (item) => differentialStatusColor(item.status))
    .attr("opacity", (item) => (item.status === "Non" ? 0.5 : 0.78))
    .on("mouseenter", function(event, item) {
      d3.select(this).attr("opacity", 1).attr("stroke", "#17292f").attr("stroke-width", 1.2);
      tooltip
        .style("opacity", 1)
        .html(
          `<div class="srnameta-d3-tooltip__title">${item.gene}</div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Status:</span><span class="srnameta-d3-tooltip__value">${item.status}</span></div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">log2FC:</span><span class="srnameta-d3-tooltip__value">${d3.format(".3f")(item.x)}</span></div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">-log10 Significance:</span><span class="srnameta-d3-tooltip__value">${d3.format(".3f")(item.y)}</span></div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">padj:</span><span class="srnameta-d3-tooltip__value">${d3.format(".3g")(item.padj)}</span></div>`
        );
      positionTooltip(tooltip, container, event);
    })
    .on("mousemove", function(event) {
      positionTooltip(tooltip, container, event);
    })
    .on("mouseleave", function(event, item) {
      d3.select(this)
        .attr("opacity", item.status === "Non" ? 0.5 : 0.78)
        .attr("stroke", "none");
      tooltip.style("opacity", 0);
    });

  if (shouldAnimate) {
    points
      .transition()
      .duration(720)
      .ease(d3.easeCubicOut)
      .attr("r", 4.6);
  } else {
    points.attr("r", 4.6);
  }

  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0))
    .call((axis) => axis.select(".domain").attr("stroke", "#000"))
    .call((axis) => axis.selectAll(".tick line").attr("stroke", "#000"))
    .call((axis) => axis.selectAll("text").attr("class", "srnameta-d3-axis-tick"));

  chart
    .append("g")
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
    .call((axis) => axis.select(".domain").attr("stroke", "#000"))
    .call((axis) => axis.selectAll("text").attr("class", "srnameta-d3-axis-tick"));

  svg
    .append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .attr("class", "srnameta-d3-caption srnameta-d3-caption--library")
    .text("log2 Fold Change");

  svg
    .append("text")
    .attr("transform", `translate(18, ${margin.top + innerHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .attr("class", "srnameta-d3-caption srnameta-d3-caption--library")
    .text("-log10 Significance");

  const legendItemWidth = 136;
  const legend = svg
    .append("g")
    .attr("transform", `translate(${Math.max((width - legendItemWidth * legendItems.length) / 2, margin.left)}, 28)`);

  legendItems.forEach((item, index) => {
    const group = legend.append("g").attr("transform", `translate(${index * legendItemWidth}, 0)`);
    group
      .append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("rx", 6)
      .attr("fill", differentialStatusColor(item));
    group
      .append("text")
      .attr("x", 24)
      .attr("y", 13)
      .attr("class", "srnameta-d3-legend srnameta-d3-legend--library")
      .text(`${item} (${legendCounts[item] ?? 0})`);
  });

  if (summary?.plottedGenes && summary?.totalGenes && summary.plottedGenes < summary.totalGenes) {
    root
      .append("div")
      .attr("class", "srnameta-chart-copy")
      .text(
        `Showing ${Number(summary.plottedGenes).toLocaleString()} of ${Number(summary.totalGenes).toLocaleString()} genes in the display set.`
      );
  }

  return () => {
    tooltip.remove();
  };
}

export function drawDifferentialHeatmap(container, heatmap, options = {}, renderState = {}) {
  const root = d3.select(container);
  root.selectAll("*").remove();
  root.style("position", "relative");
  const chartHeight = Number(options.chartHeight) || 780;

  const rows = heatmap?.rows || [];
  const columns = heatmap?.columns || [];
  const matrix = heatmap?.matrix || [];

  if (!rows.length || !columns.length || !matrix.length) {
    root
      .style("min-height", `${chartHeight}px`)
      .append("div")
      .attr("class", "srnameta-d3-empty srnameta-d3-empty--heatmap")
      .text(options.emptyMessage ?? "");
    return undefined;
  }

  const width = container.clientWidth || 960;
  const colorLegendWidth = 16;
  const colorLegendGap = 24;
  const colorLegendTickGap = 8;
  const colorLegendTickWidth = 40;
  const showRowLabels = heatmap.showRowLabels === true;
  const longestRowLabel = d3.max(rows, (label) => String(label || "").length) || 0;
  const leftMargin = showRowLabels
    ? Math.min(200, Math.max(94, longestRowLabel * 7.2))
    : 24;
  const resolvedChartHeight = Number(options.chartHeight)
    || (showRowLabels ? Math.min(980, Math.max(500, rows.length * 14 + 240)) : 780);
  const margin = {
    top: 78,
    right: colorLegendWidth + colorLegendGap + colorLegendTickGap + colorLegendTickWidth + 22,
    bottom: 68,
    left: leftMargin
  };
  const annotationHeight = 18;
  const annotationGap = 10;
  const innerWidth = Math.max(120, width - margin.left - margin.right);
  const innerHeight = Math.max(180, resolvedChartHeight - margin.top - margin.bottom);
  const heatmapHeight = Math.max(120, innerHeight - annotationHeight - annotationGap);
  const shouldAnimate = renderState.animate !== false;
  const flatValues = matrix.flat().filter((value) => Number.isFinite(value));
  const colorDomain = roundedColorDomain(valueDomain(flatValues));
  const colorScale = d3
    .scaleLinear()
    .domain(colorDomain)
    .range(heatmap.palette?.length >= 3 ? heatmap.palette.slice(0, 3) : ["#265dff", "#ffffff", "#84a900"])
    .clamp(true);
  const tooltip = root.append("div").attr("class", "srnameta-d3-tooltip").style("opacity", 0);
  const columnDomain = columns.map((column) => column.displaySample);
  const rowDomain = rows.slice();
  const x = d3.scaleBand().domain(columnDomain).range([0, innerWidth]).paddingInner(0.01).paddingOuter(0);
  const y = d3.scaleBand().domain(rowDomain).range([0, heatmapHeight]).paddingInner(0).paddingOuter(0);
  const labelStep = computeLabelStep(rows.length, 42);

  const svg = root
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${resolvedChartHeight}`)
    .attr("class", "srnameta-d3-chart");

  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const annotation = chart.append("g").attr("class", "srnameta-clustering-annotation");
  const legendItems = [
    { label: "Treatment", color: sampleGroupColor("Treatment") },
    { label: "Control", color: sampleGroupColor("Control") }
  ];
  const legendItemWidth = 132;
  const legendTotalWidth = legendItems.length * legendItemWidth;
  const legendOffsetX = Math.max(0, (innerWidth - legendTotalWidth) / 2);
  const legend = annotation
    .append("g")
    .attr("class", "srnameta-clustering-legend")
    .attr("transform", `translate(${legendOffsetX},-10)`);

  const legendItem = legend
    .selectAll("g")
    .data(legendItems)
    .enter()
    .append("g")
    .attr("class", "srnameta-clustering-legend__item")
    .attr("transform", (_, index) => `translate(${index * legendItemWidth},0)`);

  legendItem
    .append("rect")
    .attr("x", 0)
    .attr("y", -11)
    .attr("width", 16)
    .attr("height", 10)
    .attr("rx", 2)
    .attr("fill", (item) => item.color)
    .attr("stroke", "rgba(0, 0, 0, 0.18)")
    .attr("stroke-width", 0.5);

  legendItem
    .append("text")
    .attr("x", 24)
    .attr("y", -3)
    .attr("class", "srnameta-d3-caption srnameta-d3-caption--library")
    .text((item) => item.label);

  const sampleBand = annotation.append("g").attr("class", "srnameta-clustering-sample-band");

  sampleBand
    .selectAll("rect")
    .data(columns)
    .enter()
    .append("rect")
    .attr("x", (column) => x(column.displaySample) || 0)
    .attr("y", 0)
    .attr("width", Math.max(1, x.bandwidth()))
    .attr("height", annotationHeight)
    .attr("rx", 2)
    .attr("fill", (column) => sampleGroupColor(column.group))
    .attr("opacity", 0.88)
    .style("cursor", "help")
    .on("mouseenter", function(event, column) {
      tooltip
        .style("opacity", 1)
        .html(
          `<div class="srnameta-d3-tooltip__title">${column.displaySample}</div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Group:</span><span class="srnameta-d3-tooltip__value">${column.group}</span></div>`
        );
      positionTooltip(tooltip, container, event);
    })
    .on("mousemove", function(event) {
      positionTooltip(tooltip, container, event);
    })
    .on("mouseleave", function() {
      tooltip.style("opacity", 0);
    });

  const plot = chart.append("g").attr("transform", `translate(0,${annotationHeight + annotationGap})`);

  plot
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", heatmapHeight)
    .attr("fill", "#ffffff")
    .attr("stroke", "#000000")
    .attr("stroke-width", 1);

  const cells = [];
  matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const column = columns[columnIndex];

      if (!column) {
        return;
      }

      cells.push({
        gene: rows[rowIndex],
        value,
        rowIndex,
        columnIndex,
        column
      });
    });
  });

  const cellRects = plot
    .append("g")
    .selectAll("rect")
    .data(cells)
    .enter()
    .append("rect")
    .attr("x", (cell) => x(cell.column.displaySample) || 0)
    .attr("y", (cell) => y(cell.gene) || 0)
    .attr("width", Math.max(1, x.bandwidth()))
    .attr("height", Math.max(1, y.bandwidth()))
    .attr("fill", (cell) => colorScale(cell.value))
    .style("cursor", typeof options.onCellClick === "function" ? "pointer" : "help")
    .on("mouseenter", function(event, cell) {
      d3.select(this).attr("stroke", "#202020").attr("stroke-width", 1.2);
      tooltip
        .style("opacity", 1)
        .html(
          `<div class="srnameta-d3-tooltip__title">${cell.gene}</div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Sample:</span><span class="srnameta-d3-tooltip__value">${cell.column.displaySample}</span></div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Group:</span><span class="srnameta-d3-tooltip__value">${cell.column.group}</span></div>
          <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Value:</span><span class="srnameta-d3-tooltip__value">${d3.format(".4f")(cell.value)}</span></div>`
        );
      positionTooltip(tooltip, container, event);
    })
    .on("mousemove", function(event) {
      positionTooltip(tooltip, container, event);
    })
    .on("mouseleave", function() {
      d3.select(this).attr("stroke", "none").attr("stroke-width", 0);
      tooltip.style("opacity", 0);
    })
    .on("click", function(event, cell) {
      if (typeof options.onCellClick === "function") {
        options.onCellClick({
          gene: cell.gene,
          displaySample: cell.column.displaySample,
          actualSample: cell.column.actualSample,
          actualRna: cell.column.actualRna,
          actualRibo: cell.column.actualRibo,
          group: cell.column.group,
          value: cell.value
        });
      }
    });

  if (shouldAnimate) {
    cellRects
      .attr("opacity", 0)
      .transition()
      .duration(420)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1);
  }

  const xAxis = chart.append("g").attr("transform", `translate(0,${annotationHeight + annotationGap + heatmapHeight})`);

  xAxis
    .selectAll("text")
    .data(columns)
    .enter()
    .append("text")
    .attr("x", (column) => (x(column.displaySample) || 0) + x.bandwidth() / 2)
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .attr("class", "srnameta-d3-axis-tick")
    .attr("font-size", 12)
    .style("cursor", "help")
    .text((column) => column.axisLabel || column.displaySample)
    .on("mouseenter", function(event, column) {
      tooltip
        .style("opacity", 1)
        .html(sampleMetaHtml(column));
      positionTooltip(tooltip, container, event);
    })
    .on("mousemove", function(event) {
      positionTooltip(tooltip, container, event);
    })
    .on("mouseleave", function() {
      tooltip.style("opacity", 0);
    });

  if (showRowLabels) {
    const yAxis = chart.append("g").attr("transform", `translate(-10,${annotationHeight + annotationGap})`);

    yAxis
      .selectAll("text")
      .data(rows.filter((_, index) => index % labelStep === 0))
      .enter()
      .append("text")
      .attr("x", 0)
      .attr("y", (label) => (y(label) || 0) + Math.max(y.bandwidth() / 2, 6))
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("class", "srnameta-d3-axis-tick")
      .attr("font-size", 11)
      .text((label) => label);
  }

  if (heatmap.brushEnabled && typeof options.onBrushSelection === "function") {
    const brush = d3
      .brush()
      .extent([[0, 0], [innerWidth, heatmapHeight]])
      .on("end", ({ selection }) => {
        if (!selection) {
          return;
        }

        const xSelection = bandSelection(columnDomain, x, selection[0][0], selection[1][0]);
        const ySelection = bandSelection(rowDomain, y, selection[0][1], selection[1][1]);

        if (!xSelection || !ySelection) {
          plot.select(".srnameta-clustering-brush").call(brush.move, null);
          return;
        }

        options.onBrushSelection({
          rowStart: ySelection.start,
          rowEnd: ySelection.end,
          colStart: xSelection.start,
          colEnd: xSelection.end,
          nonce: Date.now()
        });

        plot.select(".srnameta-clustering-brush").call(brush.move, null);
      });

    const brushGroup = plot.append("g").attr("class", "srnameta-clustering-brush");
    brushGroup.call(brush);
    brushGroup
      .selectAll(".selection")
      .attr("fill", "rgba(38, 93, 255, 0.3)")
      .attr("stroke", "#265dff")
      .attr("stroke-width", 1.7)
      .attr("shape-rendering", "crispEdges");
    brushGroup.selectAll(".handle").attr("display", "none");
    brushGroup.selectAll(".overlay").style("cursor", "crosshair");
  }

  drawPlotFrame(plot.append("g").attr("class", "srnameta-clustering-frame"), innerWidth, heatmapHeight);

  const colorLegendHeight = Math.min(Math.max(heatmapHeight * 0.44, 160), 320);
  const colorLegendY = annotationHeight + annotationGap + Math.max((heatmapHeight - colorLegendHeight) / 2, 0);
  const colorLegendX = margin.left + innerWidth + colorLegendGap;
  const colorLegendScale = d3
    .scaleLinear()
    .domain([colorDomain[0], colorDomain[colorDomain.length - 1]])
    .range([colorLegendHeight, 0]);
  const colorLegendMin = colorDomain[0];
  const colorLegendMax = colorDomain[colorDomain.length - 1];
  const colorLegendTicks = d3
    .range(5)
    .map((index) => colorLegendMin + ((colorLegendMax - colorLegendMin) * index) / 4);
  svg
    .append("text")
    .attr("x", colorLegendX + colorLegendWidth / 2)
    .attr("y", colorLegendY - 12)
    .attr("text-anchor", "middle")
    .attr("class", "srnameta-d3-caption srnameta-d3-caption--library")
    .text("Value");

  const colorLegendSteps = 160;
  const colorLegendGroup = svg.append("g").attr("class", "diff-heatmap-colorbar");

  colorLegendGroup
    .selectAll("rect")
    .data(d3.range(colorLegendSteps))
    .enter()
    .append("rect")
    .attr("x", colorLegendX)
    .attr("y", (stepIndex) => colorLegendY + (stepIndex * colorLegendHeight) / colorLegendSteps)
    .attr("width", colorLegendWidth)
    .attr("height", colorLegendHeight / colorLegendSteps + 0.25)
    .attr("fill", (stepIndex) => {
      const ratio = 1 - stepIndex / Math.max(colorLegendSteps - 1, 1);
      const value =
        colorLegendMin + (colorLegendMax - colorLegendMin) * ratio;

      return colorScale(value);
    });

  colorLegendGroup
    .append("rect")
    .attr("x", colorLegendX)
    .attr("y", colorLegendY)
    .attr("width", colorLegendWidth)
    .attr("height", colorLegendHeight)
    .attr("fill", "none")
    .attr("stroke", "#000000")
    .attr("stroke-opacity", 0.34)
    .attr("stroke-width", 1.5);

  svg
    .append("g")
    .attr("transform", `translate(${colorLegendX + colorLegendWidth},${colorLegendY})`)
    .call(
      d3
        .axisRight(colorLegendScale)
        .tickValues(colorLegendTicks)
        .tickSize(6)
        .tickFormat((value) => d3.format(".2f")(value))
    )
    .call((axis) => axis.select(".domain").remove())
    .call((axis) => axis.selectAll("line").attr("stroke", "#000"))
    .call((axis) => axis.selectAll("text").attr("class", "srnameta-d3-axis-tick"));

  return () => {
    tooltip.remove();
  };
}
