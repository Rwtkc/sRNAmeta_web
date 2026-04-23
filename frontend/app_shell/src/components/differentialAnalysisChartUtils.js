import * as d3 from "d3";

export function positionTooltip(tooltip, container, event) {
  const tooltipNode = tooltip.node();

  if (!tooltipNode) {
    return;
  }

  const [pointerX, pointerY] = d3.pointer(event, container);
  const containerRect = container.getBoundingClientRect();
  const tooltipWidth = tooltipNode.offsetWidth || 0;
  const tooltipHeight = tooltipNode.offsetHeight || 0;
  const viewportPadding = 8;
  const desiredLeft = containerRect.left + pointerX + 14;
  const desiredTop = containerRect.top + pointerY - 10;
  const clampedLeft = Math.max(
    viewportPadding,
    Math.min(desiredLeft, window.innerWidth - tooltipWidth - viewportPadding)
  );
  const clampedTop = Math.max(
    viewportPadding,
    Math.min(desiredTop, window.innerHeight - tooltipHeight - viewportPadding)
  );

  tooltip
    .style("left", `${clampedLeft - containerRect.left}px`)
    .style("top", `${clampedTop - containerRect.top}px`);
}

export function ensureNumericDomain(values, fallback = [-1, 1]) {
  const numericValues = values.filter((value) => Number.isFinite(value));

  if (!numericValues.length) {
    return fallback;
  }

  const minValue = d3.min(numericValues);
  const maxValue = d3.max(numericValues);

  if (minValue === maxValue) {
    const delta = Math.max(Math.abs(minValue) * 0.15, 1);
    return [minValue - delta, maxValue + delta];
  }

  return [minValue, maxValue];
}

export function buildLegendCounts(data) {
  const counts = { Up: 0, Non: 0, Down: 0 };

  (data || []).forEach((item) => {
    const status = String(item?.status || "Non");

    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1;
    }
  });

  return counts;
}

export function differentialStatusColor(status) {
  switch (status) {
    case "Up":
      return "#84a900";
    case "Down":
      return "#265dff";
    default:
      return "#7d9092";
  }
}

export function sampleGroupColor(group) {
  if (group === "Treatment") {
    return "#265dff";
  }

  return "#84a900";
}

export function sampleMetaHtml(column) {
  return [
    `<div class="srnameta-d3-tooltip__title">${column.displaySample}</div>`,
    column.actualSample
      ? `<div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Actual:</span><span class="srnameta-d3-tooltip__value">${column.actualSample}</span></div>`
      : "",
    `<div class="srnameta-d3-tooltip__row"><span class="srnameta-d3-tooltip__key">Group:</span><span class="srnameta-d3-tooltip__value">${column.group || "Sample"}</span></div>`
  ]
    .filter(Boolean)
    .join("");
}

export function shortSampleLabel(name, group, groupIndex, fallbackIndex) {
  const normalizedName = String(name || "");
  const explicitGroupMatch = normalizedName.match(/^(control|treatment)[_\-\s]*(\d+)$/i);

  if (explicitGroupMatch) {
    return `${explicitGroupMatch[1].slice(0, 1).toUpperCase()}${explicitGroupMatch[2]}`;
  }

  if (normalizedName.length <= 8) {
    return normalizedName;
  }

  const prefix = group === "Treatment" ? "T" : group === "Control" ? "C" : "S";
  return `${prefix}${groupIndex || fallbackIndex + 1}`;
}

export function valueDomain(values) {
  const numeric = values.filter((value) => Number.isFinite(value));

  if (!numeric.length) {
    return [-1, 0, 1];
  }

  let minValue = d3.min(numeric);
  let maxValue = d3.max(numeric);

  if (minValue === maxValue) {
    const delta = Math.max(Math.abs(minValue) * 0.2, 1);
    minValue -= delta;
    maxValue += delta;
  }

  if (minValue < 0 && maxValue > 0) {
    return [minValue, 0, maxValue];
  }

  return [minValue, d3.median(numeric), maxValue];
}

export function roundedColorDomain(domain) {
  const finiteDomain = domain.filter((value) => Number.isFinite(value));

  if (!finiteDomain.length) {
    return [-1, 0, 1];
  }

  let minValue = Math.floor(finiteDomain[0] * 10) / 10;
  let maxValue = Math.ceil(finiteDomain[finiteDomain.length - 1] * 10) / 10;

  if (minValue === maxValue) {
    const delta = Math.max(Math.abs(minValue) * 0.1, 0.1);
    minValue -= delta;
    maxValue += delta;
  }

  if (minValue < 0 && maxValue > 0) {
    return [minValue, 0, maxValue];
  }

  return [minValue, (minValue + maxValue) / 2, maxValue];
}

export function computeLabelStep(labelCount, maxLabels = 40) {
  if (!Number.isFinite(labelCount) || labelCount <= maxLabels) {
    return 1;
  }

  return Math.max(1, Math.ceil(labelCount / maxLabels));
}

export function bandSelection(domain, scale, startPx, endPx) {
  const minPx = Math.min(startPx, endPx);
  const maxPx = Math.max(startPx, endPx);
  const selected = [];

  domain.forEach((key, index) => {
    const position = scale(key);
    const bandWidth = scale.bandwidth();

    if (!Number.isFinite(position)) {
      return;
    }

    const bandStart = position;
    const bandEnd = position + bandWidth;

    if (bandEnd >= minPx && bandStart <= maxPx) {
      selected.push(index);
    }
  });

  if (!selected.length) {
    return null;
  }

  return {
    start: selected[0] + 1,
    end: selected[selected.length - 1] + 1
  };
}

export function drawPlotFrame(target, width, height) {
  target
    .append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", "#000000")
    .attr("stroke-width", 1);

  target
    .append("line")
    .attr("x1", width)
    .attr("x2", width)
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#000000")
    .attr("stroke-width", 1);

  target
    .append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", height)
    .attr("y2", height)
    .attr("stroke", "#000000")
    .attr("stroke-width", 1);

  target
    .append("line")
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#000000")
    .attr("stroke-width", 1);
}
