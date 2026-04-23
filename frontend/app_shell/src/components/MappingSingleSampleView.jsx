import MappingDonut from "./MappingDonut";
import {
  chartColors,
  formatNumber,
  formatPercent
} from "./mappingStatisticsData";

function MappingChartPanel({ title, stackedPanelStyle, children }) {
  return (
    <section
      className="mapping-chart-panel mapping-chart-panel--stacked"
      style={stackedPanelStyle}
    >
      <div className="mapping-chart-panel__header">
        <h3 className="mapping-chart-panel__title">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function MappingSingleSampleView({
  rows,
  totalReads,
  totalUniqueTags,
  uniqueTagsSvgRef,
  totalReadsSvgRef,
  stackedPanelStyle
}) {
  return (
    <div className="mapping-output-grid">
      <div className="mapping-chart-frame">
        <div className="mapping-chart-pair">
          <MappingChartPanel
            title="Based on unique tags"
            stackedPanelStyle={stackedPanelStyle}
          >
            <MappingDonut
              rows={rows}
              totalValue={totalUniqueTags}
              valueKey="uniqueTags"
              centerLabel="Unique tags"
              chartLabel="RNA mapping statistics donut chart based on unique tags"
              primaryLabel="Unique tags"
              secondaryKey="totalReads"
              secondaryLabel="Reads"
              svgRef={uniqueTagsSvgRef}
            />
          </MappingChartPanel>
          <MappingChartPanel
            title="Based on total reads count"
            stackedPanelStyle={stackedPanelStyle}
          >
            <MappingDonut
              rows={rows}
              totalValue={totalReads}
              valueKey="totalReads"
              centerLabel="Total reads"
              chartLabel="RNA mapping statistics donut chart based on total reads count"
              primaryLabel="Reads"
              secondaryKey="uniqueTags"
              secondaryLabel="Unique tags"
              svgRef={totalReadsSvgRef}
            />
          </MappingChartPanel>
        </div>
      </div>
      <div className="mapping-legend">
        {rows.map((item, index) => {
          const readsPercent =
            totalReads > 0 ? (Number(item.totalReads || 0) / totalReads) * 100 : 0;
          const tagsPercent =
            totalUniqueTags > 0
              ? (Number(item.uniqueTags || 0) / totalUniqueTags) * 100
              : 0;

          return (
            <div className="mapping-legend__item" key={item.type}>
              <div className="mapping-legend__heading">
                <span
                  className="mapping-legend__swatch"
                  style={{
                    backgroundColor: chartColors[index % chartColors.length]
                  }}
                />
                <strong>{item.label}</strong>
              </div>
              <div className="mapping-legend__stats">
                <div className="mapping-legend__stat">
                  <span>Total reads {formatNumber(item.totalReads)} reads</span>
                  <strong>{formatPercent(readsPercent)}</strong>
                </div>
                <div className="mapping-legend__stat">
                  <span>Unique tags {formatNumber(item.uniqueTags)} tags</span>
                  <strong>{formatPercent(tagsPercent)}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
