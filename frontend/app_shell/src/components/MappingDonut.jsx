import { useRef, useState } from "react";
import {
  chartColors,
  donutSegmentPath,
  formatNumber,
  formatPercent,
  TAU
} from "./mappingStatisticsData";

export default function MappingDonut({
  rows,
  totalValue,
  valueKey,
  centerLabel,
  chartLabel,
  primaryLabel,
  secondaryKey,
  secondaryLabel,
  svgRef
}) {
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(null);
  let cursor = -Math.PI / 2;
  const activeItem = activeIndex === null ? null : rows[activeIndex];
  const activeValue = activeItem ? Number(activeItem[valueKey] || 0) : 0;
  const activePercent =
    activeItem && totalValue > 0 ? (activeValue / totalValue) * 100 : 0;

  function updateTooltipPosition(clientX, clientY) {
    const chartNode = chartRef.current;
    const tooltipNode = tooltipRef.current;

    if (!chartNode || !tooltipNode) {
      return;
    }

    const chartRect = chartNode.getBoundingClientRect();
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const viewportPadding = 12;
    const preferredRightX = clientX + 26;
    const preferredLeftX = clientX - tooltipRect.width - 22;
    const nextViewportX =
      preferredRightX + tooltipRect.width > window.innerWidth - viewportPadding
        ? Math.max(viewportPadding, preferredLeftX)
        : preferredRightX;
    const nextViewportY = Math.min(
      Math.max(viewportPadding, clientY - tooltipRect.height / 2),
      window.innerHeight - tooltipRect.height - viewportPadding
    );

    tooltipNode.style.left = `${nextViewportX - chartRect.left}px`;
    tooltipNode.style.top = `${nextViewportY - chartRect.top}px`;
  }

  function showTooltip(index, event) {
    const clientX = event.clientX;
    const clientY = event.clientY;

    setActiveIndex(index);
    window.requestAnimationFrame(() => {
      updateTooltipPosition(clientX, clientY);
    });
  }

  return (
    <div className="mapping-chart" ref={chartRef}>
      <div
        ref={tooltipRef}
        className="mapping-chart__tooltip"
        data-visible={activeItem ? "true" : "false"}
      >
        {activeItem ? (
          <>
            <div className="mapping-chart__tooltip-label">
              {activeItem.label}
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>{primaryLabel}</span>
              <strong>{formatNumber(activeValue)}</strong>
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>Percent</span>
              <strong>{formatPercent(activePercent)}</strong>
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>{secondaryLabel}</span>
              <strong>{formatNumber(activeItem[secondaryKey])}</strong>
            </div>
          </>
        ) : null}
      </div>
      <svg
        ref={svgRef}
        className="mapping-chart__svg"
        viewBox="0 0 240 240"
        role="img"
        aria-label={chartLabel}
      >
        <title>{chartLabel}</title>
        <circle
          cx="120"
          cy="120"
          r="91"
          fill="none"
          stroke="rgba(132, 169, 0, 0.12)"
          strokeWidth="28"
        />
        {rows.map((item, index) => {
          const value = Number(item[valueKey] || 0);
          const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
          const angle = totalValue > 0 ? (value / totalValue) * TAU : 0;
          const startAngle = cursor;
          const endAngle = cursor + angle;
          const midAngle = startAngle + angle / 2;
          const isActive = activeIndex === index;
          const activeOffset = isActive ? 7 : 0;
          cursor = endAngle;

          return (
            <path
              key={item.type}
              className={`mapping-chart__segment ${isActive ? "is-active" : ""}`}
              d={donutSegmentPath(startAngle, endAngle, 104, 66)}
              fill={chartColors[index % chartColors.length]}
              stroke="#fffef8"
              strokeWidth="1.5"
              style={{
                "--segment-offset-x": `${Math.cos(midAngle) * activeOffset}px`,
                "--segment-offset-y": `${Math.sin(midAngle) * activeOffset}px`
              }}
              role="img"
              tabIndex="0"
              aria-label={`${item.label}: ${formatPercent(percent)}, ${formatNumber(
                item.totalReads
              )} reads, ${formatNumber(item.uniqueTags)} tags`}
              onBlur={() => {
                setActiveIndex(null);
              }}
              onFocus={() => {
                setActiveIndex(index);
              }}
              onMouseEnter={(event) => {
                showTooltip(index, event);
              }}
              onMouseMove={(event) => {
                showTooltip(index, event);
              }}
              onMouseLeave={() => {
                setActiveIndex(null);
              }}
            />
          );
        })}
        <text
          x="120"
          y="113"
          fill="#626d5f"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="10"
          fontWeight="800"
          textAnchor="middle"
        >
          {centerLabel}
        </text>
        <text
          x="120"
          y="134"
          fill="#262d24"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fontSize="15"
          fontWeight="900"
          textAnchor="middle"
        >
          {formatNumber(totalValue)}
        </text>
      </svg>
    </div>
  );
}
