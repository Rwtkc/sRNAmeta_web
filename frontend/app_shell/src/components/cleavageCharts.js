import * as d3 from "d3";
import { ensureNumericDomain, positionTooltip } from "./differentialAnalysisChartUtils";

const annotationPalette = {
  codon: "#ff3b30",
  Dloop: "#7e57c2",
  Aloop: "#2e9d59",
  Tloop: "#2563eb"
};

function layoutAnnotations(annotations = [], xScale) {
  const sorted = [...(annotations || [])]
    .map((annotation) => ({
      ...annotation,
      start: Number(annotation?.start),
      end: Number(annotation?.end),
      type: String(annotation?.type || "")
    }))
    .filter((annotation) => Number.isFinite(annotation.start) && Number.isFinite(annotation.end))
    .sort((left, right) => left.start - right.start);

  const laneEnds = [];

  return sorted.map((annotation) => {
    const xStart = xScale(annotation.start);
    const xEnd = xScale(annotation.end) + xScale.bandwidth();
    let lane = laneEnds.findIndex((laneEnd) => xStart > laneEnd + 18);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(xEnd);
    } else {
      laneEnds[lane] = xEnd;
    }

    return {
      ...annotation,
      lane,
      xStart,
      xEnd
    };
  });
}

function annotationColorMap(annotations = []) {
  const colorMap = new Map();

  (annotations || []).forEach((annotation) => {
    const start = Number(annotation?.start);
    const end = Number(annotation?.end);
    const color = annotationPalette[annotation?.type] || "#202020";

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return;
    }

    for (let position = start; position <= end; position += 1) {
      colorMap.set(position, color);
    }
  });

  return colorMap;
}

export function drawCleavageChart(container, chartData, renderState = {}) {
  const root = d3.select(container);
  root.selectAll("*").remove();
  root.style("position", "relative");

  const points = Array.isArray(chartData?.points)
    ? chartData.points.filter((item) => Number.isFinite(Number(item?.site)))
    : [];

  if (!points.length) {
    root.append("div").attr("class", "srnameta-d3-empty").text("No cleavage plot data available.");
    return undefined;
  }

  const width = container.clientWidth || 960;
  const height = 560;
  const margin = { top: 116, right: 28, bottom: 112, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxSite = d3.max(points, (item) => Number(item.site)) || 1;
  const siteDomain = d3.range(1, maxSite + 1);
  const maxDisplayScore = d3.max(points, (item) => Number(item.displayScore)) || 0;
  const x = d3.scaleBand().domain(siteDomain).range([0, innerWidth]).paddingInner(0).paddingOuter(0);
  const y = d3.scaleLinear().domain([0, ensureNumericDomain([0, maxDisplayScore], [0, 5])[1]]).nice().range([innerHeight, 0]);
  const tooltip = root.append("div").attr("class", "srnameta-d3-tooltip").style("opacity", 0);
  const svg = root.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("class", "srnameta-d3-chart");
  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const shouldAnimate = renderState.animate !== false;
  const colorMap = annotationColorMap(chartData?.annotations);
  const sequence = String(chartData?.sequence || "").split("");
  const xCenter = (site) => (x(Number(site)) ?? 0) + x.bandwidth() / 2;

  svg
    .append("text")
    .attr("x", 0)
    .attr("y", 14)
    .attr("class", "srnameta-d3-chart-title srnameta-d3-chart-title--qc")
    .text(`Cleavage Score | ${chartData?.id || "tRNA"} | ${points.length.toLocaleString()} positions`);

  chart
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "#fbfcf8")
    .attr("stroke", "#d7e0bf");

  const annotationFillLayer = chart.append("g");
  chart
    .append("g")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", (value) => y(value))
    .attr("y2", (value) => y(value))
    .attr("stroke", "#dde5cf")
    .attr("stroke-dasharray", "3 5");

  const annotationLayer = chart.append("g");
  const annotationLayout = layoutAnnotations(chartData?.annotations || [], x);
  const annotationBaseY = -18;
  const annotationLaneHeight = 22;
  annotationLayout.forEach((annotation) => {
    const start = annotation.start;
    const end = annotation.end;
    const label = annotation.type;
    const color = annotationPalette[label] || "#202020";
    const laneY = annotationBaseY - annotation.lane * annotationLaneHeight;

    annotationFillLayer
      .append("rect")
      .attr("x", annotation.xStart)
      .attr("y", 0)
      .attr("width", Math.max(annotation.xEnd - annotation.xStart, x.bandwidth()))
      .attr("height", innerHeight)
      .attr("fill", color)
      .attr("opacity", 0.08);

    annotationLayer
      .append("line")
      .attr("x1", annotation.xStart)
      .attr("x2", annotation.xEnd)
      .attr("y1", laneY + 16)
      .attr("y2", laneY + 16)
      .attr("stroke", color)
      .attr("stroke-width", 1.2)
      .attr("opacity", 0.7);

    annotationLayer
      .append("text")
      .attr("x", annotation.xStart + (annotation.xEnd - annotation.xStart) / 2)
      .attr("y", laneY + 10)
      .attr("text-anchor", "middle")
      .attr("fill", color)
      .attr("font-size", 10)
      .attr("font-weight", 700)
      .text(label);
  });

  const line = d3
    .line()
    .x((item) => xCenter(item.site))
    .y((item) => y(Number(item.displayScore) || 0))
    .curve(d3.curveMonotoneX);

  const path = chart
    .append("path")
    .datum(points)
    .attr("fill", "none")
    .attr("stroke", "#638700")
    .attr("stroke-width", 2.5)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("d", line);

  if (shouldAnimate) {
    const totalLength = path.node()?.getTotalLength?.() || 0;

    if (totalLength > 0) {
      path
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
    }
  }

  const hoverGroup = chart.append("g");
  hoverGroup
    .selectAll("circle")
    .data(points)
    .join("circle")
    .attr("cx", (item) => xCenter(item.site))
    .attr("cy", (item) => y(Number(item.displayScore) || 0))
    .attr("r", 3.2)
    .attr("fill", (item) => colorMap.get(Number(item.site)) || "#638700")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1)
    .attr("opacity", 0.94)
    .on("mouseenter", function onEnter(event, item) {
      d3.select(this).attr("r", 5).attr("stroke", "#17292f").attr("stroke-width", 1.3);
      tooltip
        .style("opacity", 1)
        .html(
          `<div class="srnameta-d3-tooltip__title">${chartData?.id || "tRNA"} | Site ${item.site}</div>
           <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Base:</span><span class="srnameta-d3-tooltip__value">${item.base || "NA"}</span></div>
           <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Displayed score:</span><span class="srnameta-d3-tooltip__value">${d3.format(".3f")(Number(item.displayScore) || 0)}</span></div>
           <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Raw score:</span><span class="srnameta-d3-tooltip__value">${d3.format(".3f")(Number(item.score) || 0)}</span></div>
           <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">p-value:</span><span class="srnameta-d3-tooltip__value">${d3.format(".3g")(Number(item.pvalue) || 0)}</span></div>
           <div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Input/Treated counts:</span><span class="srnameta-d3-tooltip__value">${item.countInput ?? 0} / ${item.countTreated ?? 0}</span></div>`
        );
      positionTooltip(tooltip, container, event);
    })
    .on("mousemove", (event) => {
      positionTooltip(tooltip, container, event);
    })
    .on("mouseleave", function onLeave() {
      d3.select(this).attr("r", 3.2).attr("stroke", "#ffffff").attr("stroke-width", 1);
      tooltip.style("opacity", 0);
    });

  chart
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues(siteDomain).tickSizeOuter(0).tickFormat((value) => sequence[value - 1] || ""))
    .call((axis) =>
      axis
        .selectAll("text")
        .attr("class", "srnameta-d3-axis-tick")
        .attr("fill", (value) => colorMap.get(Number(value)) || "#17292f")
        .attr("font-size", maxSite > 90 ? 7 : 9)
    )
    .call((axis) => axis.selectAll("line").attr("stroke", "#cad4b2"))
    .call((axis) => axis.select(".domain").attr("stroke", "#b8c39e"));

  chart
    .append("g")
    .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
    .call((axis) => axis.selectAll("text").attr("class", "srnameta-d3-axis-tick"))
    .call((axis) => axis.selectAll("line").attr("stroke", "#cad4b2"))
    .call((axis) => axis.select(".domain").attr("stroke", "#b8c39e"));

  svg
    .append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", 500)
    .attr("text-anchor", "middle")
    .attr("class", "srnameta-d3-axis-label")
    .text("Mature tRNA sequence position");

  svg
    .append("text")
    .attr("transform", `translate(18 ${margin.top + innerHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .attr("class", "srnameta-d3-axis-label")
    .text("Cleavage score");

  return () => {
    tooltip.remove();
  };
}
