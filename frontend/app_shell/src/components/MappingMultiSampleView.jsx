import MappingStackedBars from "./MappingStackedBars";

function MappingChartPanel({ title, children }) {
  return (
    <section className="mapping-chart-panel">
      <div className="mapping-chart-panel__header">
        <h3 className="mapping-chart-panel__title">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function MappingMultiSampleView({
  jobs,
  uniqueTagsSvgRef,
  totalReadsSvgRef,
  uniqueTagsLegendRef,
  totalReadsLegendRef
}) {
  return (
    <div className="mapping-output-grid">
      <div className="mapping-chart-frame">
        <div className="mapping-chart-pair">
          <MappingChartPanel title="Based on unique tags">
            <MappingStackedBars
              jobs={jobs}
              valueKey="uniqueTags"
              totalKey="totalUniqueTags"
              centerLabel="Unique tags share"
              chartLabel="RNA mapping statistics stacked bar chart based on unique tags"
              primaryLabel="Unique tags"
              secondaryKey="totalReads"
              secondaryLabel="Reads"
              svgRef={uniqueTagsSvgRef}
              legendRef={uniqueTagsLegendRef}
            />
          </MappingChartPanel>
          <MappingChartPanel title="Based on total reads count">
            <MappingStackedBars
              jobs={jobs}
              valueKey="totalReads"
              totalKey="totalReads"
              centerLabel="Total reads share"
              chartLabel="RNA mapping statistics stacked bar chart based on total reads count"
              primaryLabel="Reads"
              secondaryKey="uniqueTags"
              secondaryLabel="Unique tags"
              svgRef={totalReadsSvgRef}
              legendRef={totalReadsLegendRef}
            />
          </MappingChartPanel>
        </div>
      </div>
    </div>
  );
}
