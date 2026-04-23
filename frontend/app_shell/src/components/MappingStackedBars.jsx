import { useRef, useState } from "react";
import MappingTypeLegend from "./MappingTypeLegend";
import {
  flattenJobRows,
  formatNumber,
  formatPercent,
  getStackedChartLayout,
  getTypeColor,
  sortRowsByType
} from "./mappingStatisticsData";

export default function MappingStackedBars({
  jobs,
  valueKey,
  totalKey,
  chartLabel,
  primaryLabel,
  secondaryKey,
  secondaryLabel,
  svgRef,
  legendRef
}) {
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  const [activeItem, setActiveItem] = useState(null);
  const layout = getStackedChartLayout(jobs.length);
  const orderedTypes = Array.from(
    new Map(
      sortRowsByType(flattenJobRows(jobs)).map((row) => [
        row.type,
        { type: row.type, label: row.label }
      ])
    ).values()
  );
  const axisTicks = [0, 25, 50, 75, 100];

  function updateTooltipPosition(clientX, clientY) {
    const chartNode = chartRef.current;
    const tooltipNode = tooltipRef.current;

    if (!chartNode || !tooltipNode) {
      return;
    }

    const chartRect = chartNode.getBoundingClientRect();
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const viewportPadding = 12;
    const preferredRightX = clientX + 20;
    const preferredLeftX = clientX - tooltipRect.width - 18;
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

  function showTooltip(item, event) {
    setActiveItem(item);
    window.requestAnimationFrame(() => {
      updateTooltipPosition(event.clientX, event.clientY);
    });
  }

  return (
    <div className="mapping-stacked-chart" ref={chartRef}>
      <div
        ref={tooltipRef}
        className="mapping-chart__tooltip"
        data-visible={activeItem ? "true" : "false"}
      >
        {activeItem ? (
          <>
            <div className="mapping-chart__tooltip-label">{activeItem.label}</div>
            <div className="mapping-chart__tooltip-row">
              <span>Job ID</span>
              <strong>{activeItem.jobId}</strong>
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>{primaryLabel}</span>
              <strong>{formatNumber(activeItem.primaryValue)}</strong>
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>Percent</span>
              <strong>{formatPercent(activeItem.percent)}</strong>
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>{secondaryLabel}</span>
              <strong>{formatNumber(activeItem.secondaryValue)}</strong>
            </div>
          </>
        ) : null}
      </div>
      <div className="mapping-stacked-chart__export">
        <svg
          ref={svgRef}
          className="mapping-stacked-chart__svg"
          viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
          data-export-bottom={layout.chartBottom + 28}
          role="img"
          aria-label={chartLabel}
        >
          <title>{chartLabel}</title>
          {axisTicks.map((tick) => {
            const y = layout.chartBottom - (layout.chartHeight * tick) / 100;

            return (
              <g key={tick}>
                <line
                  x1={layout.chartLeft - 7}
                  x2={layout.chartLeft}
                  y1={y}
                  y2={y}
                  className="mapping-stacked-chart__tick"
                />
                <line
                  x1={layout.chartLeft}
                  x2={layout.viewBoxWidth - layout.chartRight}
                  y1={y}
                  y2={y}
                  className="mapping-stacked-chart__grid"
                />
                <text
                  x={layout.chartLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="mapping-stacked-chart__axis"
                >
                  {tick}%
                </text>
              </g>
            );
          })}
          <line
            x1={layout.chartLeft}
            x2={layout.chartLeft}
            y1={layout.chartTop}
            y2={layout.chartBottom}
            className="mapping-stacked-chart__baseline"
          />
          <line
            x1={layout.chartLeft}
            x2={layout.viewBoxWidth - layout.chartRight}
            y1={layout.chartBottom}
            y2={layout.chartBottom}
            className="mapping-stacked-chart__baseline"
          />
          {jobs.map((job, jobIndex) => {
            const centerX =
              layout.chartLeft + layout.stepWidth * jobIndex + layout.stepWidth / 2;
            const barX = centerX - layout.barWidth / 2;
            const rows = sortRowsByType(job.rows || []);
            const totalValue = Number(job[totalKey] || 0);
            let cursorY = layout.chartBottom;

            return (
              <g key={job.jobId}>
                <text
                  x={centerX}
                  y="45"
                  textAnchor="middle"
                  className="mapping-stacked-chart__total"
                >
                  {formatNumber(job[totalKey])}
                </text>
                {rows.map((row, rowIndex) => {
                  const value = Number(row[valueKey] || 0);
                  const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
                  const height = Math.max(0, (layout.chartHeight * percent) / 100);
                  const y = cursorY - height;

                  cursorY -= height;

                  if (height <= 0) {
                    return null;
                  }

                  return (
                    <rect
                      key={`${job.jobId}-${row.type}`}
                      className={`mapping-stacked-chart__segment ${
                        activeItem?.jobId === job.jobId && activeItem?.label === row.label
                          ? "is-active"
                          : ""
                      }`}
                      x={barX}
                      y={y}
                      width={layout.barWidth}
                      height={height}
                      fill={getTypeColor(row.type, rowIndex)}
                      onMouseEnter={(event) => {
                        showTooltip(
                          {
                            jobId: job.jobId,
                            label: row.label,
                            percent,
                            primaryValue: row[valueKey],
                            secondaryValue: row[secondaryKey]
                          },
                          event
                        );
                      }}
                      onMouseMove={(event) => {
                        showTooltip(
                          {
                            jobId: job.jobId,
                            label: row.label,
                            percent,
                            primaryValue: row[valueKey],
                            secondaryValue: row[secondaryKey]
                          },
                          event
                        );
                      }}
                      onMouseLeave={() => {
                        setActiveItem(null);
                      }}
                    />
                  );
                })}
                <text
                  x={centerX}
                  y={layout.chartBottom + 22}
                  textAnchor="middle"
                  className="mapping-stacked-chart__job"
                >
                  {`JobID${jobIndex + 1}`}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mapping-stacked-chart__legend-shell">
          <MappingTypeLegend items={orderedTypes} legendRef={legendRef} />
        </div>
      </div>
    </div>
  );
}
