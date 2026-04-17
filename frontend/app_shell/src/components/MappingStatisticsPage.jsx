import { useRef, useState } from "react";

const chartColors = [
  "#5e742d",
  "#84a900",
  "#a8c64a",
  "#265dff",
  "#6f8cff",
  "#222a1e",
  "#64715a",
  "#b4bfaa",
  "#d3dfc5",
  "#99a986",
  "#516041",
  "#c8d85f"
];

const TAU = Math.PI * 2;

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function polarToCartesian(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function donutSegmentPath(startAngle, endAngle, outerRadius, innerRadius) {
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

function MappingDonut({ rows, totalReads }) {
  const chartRef = useRef(null);
  const tooltipRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(null);
  let cursor = -Math.PI / 2;
  const activeItem = activeIndex === null ? null : rows[activeIndex];

  function updateTooltipPosition(clientX, clientY) {
    const chartNode = chartRef.current;
    const tooltipNode = tooltipRef.current;

    if (!chartNode || !tooltipNode) {
      return;
    }

    const chartRect = chartNode.getBoundingClientRect();
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const pointerX = clientX - chartRect.left;
    const pointerY = clientY - chartRect.top;
    const rightX = pointerX + 26;
    const leftX = pointerX - tooltipRect.width - 22;
    const nextX =
      rightX + tooltipRect.width > chartRect.width
        ? Math.max(12, leftX)
        : rightX;
    const nextY = Math.min(
      Math.max(12, pointerY - tooltipRect.height / 2),
      chartRect.height - tooltipRect.height - 12
    );

    tooltipNode.style.left = `${nextX}px`;
    tooltipNode.style.top = `${nextY}px`;
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
              <span>Reads</span>
              <strong>{formatNumber(activeItem.totalReads)}</strong>
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>Percent</span>
              <strong>{formatPercent(activeItem.percent)}</strong>
            </div>
            <div className="mapping-chart__tooltip-row">
              <span>Tags</span>
              <strong>{formatNumber(activeItem.uniqueTags)}</strong>
            </div>
          </>
        ) : null}
      </div>
      <svg
        className="mapping-chart__svg"
        viewBox="0 0 240 240"
        role="img"
        aria-label="RNA mapping statistics donut chart"
      >
        <circle
          cx="120"
          cy="120"
          r="91"
          fill="none"
          stroke="rgba(132, 169, 0, 0.12)"
          strokeWidth="28"
        />
        {rows.map((item, index) => {
          const value = Number(item.totalReads || 0);
          const angle = totalReads > 0 ? (value / totalReads) * TAU : 0;
          const startAngle = cursor;
          const endAngle = cursor + angle;
          cursor = endAngle;

          return (
            <path
              key={item.type}
              className={`mapping-chart__segment ${
                activeIndex === index ? "is-active" : ""
              }`}
              d={donutSegmentPath(startAngle, endAngle, 104, 66)}
              fill={chartColors[index % chartColors.length]}
              role="img"
              tabIndex="0"
              aria-label={`${item.label}: ${formatPercent(item.percent)}, ${formatNumber(
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
      </svg>
      <div className="mapping-chart__center">
        <span>Total reads</span>
        <strong>{formatNumber(totalReads)}</strong>
      </div>
    </div>
  );
}

export default function MappingStatisticsPage({ config }) {
  const rows = config.rows || [];
  const totalReads = Number(config.totalReads || 0);
  const isReady = config.status === "ready" && rows.length > 0;
  const shouldShowEmptyMessage = config.status && config.status !== "empty";

  return (
    <div className="page-shell mapping-statistics-shell">
      <div className="mapping-statistics-workspace">
        <aside className="mapping-statistics-sidebar">
          <section className="mapping-panel mapping-panel--sidebar">
            <p className="mapping-panel__eyebrow">
              {config.eyebrow || "RNA Type Mapping"}
            </p>
            <h1 className="mapping-panel__title">RNA Type Mapping</h1>
            <p className="mapping-panel__copy">
              Tags mapping statistics on different types of RNAs, including miRNA,
              tRNA, rRNA, snRNA, snoRNA, RFAM ncRNA, mRNA, lncRNA, and other
              mapping classes.
            </p>
            {!config.jobId ? (
              <p className="mapping-sidebar__hint">
                Enter a Job ID in Load Data first to enable Mapping Statistics.
              </p>
            ) : null}
          </section>
        </aside>

        <section className="mapping-statistics-main">
          <section className="mapping-panel mapping-panel--intro">
            <p className="mapping-panel__eyebrow">Mapping Workspace</p>
            <h2 className="mapping-main__title">
              {config.title || "Tags Mapping Statistics"}
            </h2>
            <p className="mapping-main__copy">
              {config.description ||
                "Tags mapping statistics on different RNA classes."}
            </p>
            {config.jobId || isReady ? (
              <div className="mapping-total-grid mapping-total-grid--snapshot">
                {config.jobId ? (
                  <div className="mapping-total-card mapping-total-card--job">
                    <span>Job ID</span>
                    <strong>{config.jobId}</strong>
                  </div>
                ) : null}
                {isReady ? (
                  <>
                    <div className="mapping-total-card">
                      <span>Total reads</span>
                      <strong>{formatNumber(config.totalReads)}</strong>
                    </div>
                    <div className="mapping-total-card">
                      <span>Unique tags</span>
                      <strong>{formatNumber(config.totalUniqueTags)}</strong>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="mapping-panel mapping-panel--canvas">
            <p className="mapping-panel__eyebrow">Analysis Output</p>
            {isReady ? (
              <div className="mapping-output-grid">
                <div className="mapping-chart-frame">
                  <MappingDonut rows={rows} totalReads={totalReads} />
                </div>
                <div className="mapping-legend">
                  {rows.map((item, index) => (
                    <div className="mapping-legend__item" key={item.type}>
                      <span
                        className="mapping-legend__swatch"
                        style={{
                          backgroundColor: chartColors[index % chartColors.length]
                        }}
                      />
                      <div className="mapping-legend__label">
                        <strong>{item.label}</strong>
                        <span>{formatNumber(item.totalReads)} reads</span>
                      </div>
                      <div className="mapping-legend__metric">
                        <strong>{formatPercent(item.percent)}</strong>
                        <span>{formatNumber(item.uniqueTags)} tags</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : shouldShowEmptyMessage ? (
              <div className="mapping-result-card mapping-result-card--info">
                <p>{config.message || "Mapping statistics are not available."}</p>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </div>
  );
}
