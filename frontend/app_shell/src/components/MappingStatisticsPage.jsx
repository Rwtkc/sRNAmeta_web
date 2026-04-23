import { useRef } from "react";
import MappingExportPanel from "./MappingExportPanel";
import MappingMultiSampleView from "./MappingMultiSampleView";
import MappingSingleSampleView from "./MappingSingleSampleView";
import {
  buildExportRowsFromJobs,
  formatNumber,
  getStackedChartLayout
} from "./mappingStatisticsData";

function buildChartExports({
  isMultiReady,
  uniqueTagsSvgRef,
  totalReadsSvgRef,
  uniqueTagsLegendRef,
  totalReadsLegendRef
}) {
  return [
    {
      svgRef: uniqueTagsSvgRef,
      legendRef: isMultiReady ? uniqueTagsLegendRef : null,
      fileStem: "srnameta_unique_tags_mapping"
    },
    {
      svgRef: totalReadsSvgRef,
      legendRef: isMultiReady ? totalReadsLegendRef : null,
      fileStem: "srnameta_total_reads_mapping"
    }
  ];
}

function MappingSidebar({
  config,
  isReady,
  isSingleReady,
  isMultiReady,
  rows,
  exportRows,
  totalReads,
  totalUniqueTags,
  refs
}) {
  return (
    <aside className="mapping-statistics-sidebar">
      <section className="mapping-panel mapping-panel--sidebar">
        <p className="mapping-panel__eyebrow">
          {config.eyebrow || "Mapping Statistics"}
        </p>
        <h1 className="mapping-panel__title">RNA Class Mapping</h1>
        <p className="mapping-panel__copy">
          Review read and unique-tag mapping across RNA classes, including
          miRNA, tRNA, rRNA, snRNA, snoRNA, RFAM ncRNA, mRNA, lncRNA, and
          other mapped classes.
        </p>
        {!config.jobId ? (
          <p className="mapping-sidebar__hint">
            Enter one or more Job IDs in Load Data, then click Save to enable Mapping Statistics.
          </p>
        ) : null}
        {isReady ? (
          <MappingExportPanel
            charts={buildChartExports({
              isMultiReady,
              ...refs
            })}
            bundleName="srnameta_mapping_statistics"
            figureChart={
              isSingleReady
                ? {
                    pairSvgRefs: {
                      unique: refs.uniqueTagsSvgRef,
                      total: refs.totalReadsSvgRef
                    },
                    rows
                  }
                : null
            }
            figureFileStem={isSingleReady ? "srnameta_mapping_statistics" : null}
            exportRows={exportRows}
            totalReads={totalReads}
            totalUniqueTags={totalUniqueTags}
            csvFileName="srnameta_mapping_statistics.csv"
          />
        ) : null}
      </section>
    </aside>
  );
}

function MappingIntro({ config, jobIds, isReady }) {
  return (
    <section className="mapping-panel mapping-panel--intro">
      <p className="mapping-panel__eyebrow">Mapping Workspace</p>
      <h2 className="mapping-main__title">
        {config.title || "RNA Class Mapping Statistics"}
      </h2>
      <p className="mapping-main__copy">
        {config.description || "Review read and unique-tag mapping statistics across RNA classes."}
      </p>
      {config.jobId || isReady ? (
        <div className="mapping-total-grid mapping-total-grid--snapshot">
          {config.jobSummary ? (
            <div className="mapping-total-card mapping-total-card--job">
              <span>{jobIds.length > 1 ? "Job IDs" : "Job ID"}</span>
              <strong>{config.jobSummary}</strong>
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
  );
}

function MappingOutput({
  config,
  isSingleReady,
  isMultiReady,
  rows,
  jobs,
  totalReads,
  totalUniqueTags,
  stackedPanelStyle,
  refs
}) {
  const shouldShowEmptyMessage = config.status && config.status !== "empty";

  return (
    <section className="mapping-panel mapping-panel--canvas">
      <p className="mapping-panel__eyebrow">Analysis Output</p>
      {isSingleReady ? (
        <MappingSingleSampleView
          rows={rows}
          totalReads={totalReads}
          totalUniqueTags={totalUniqueTags}
          uniqueTagsSvgRef={refs.uniqueTagsSvgRef}
          totalReadsSvgRef={refs.totalReadsSvgRef}
          stackedPanelStyle={stackedPanelStyle}
        />
      ) : isMultiReady ? (
        <MappingMultiSampleView
          jobs={jobs}
          uniqueTagsSvgRef={refs.uniqueTagsSvgRef}
          totalReadsSvgRef={refs.totalReadsSvgRef}
          uniqueTagsLegendRef={refs.uniqueTagsLegendRef}
          totalReadsLegendRef={refs.totalReadsLegendRef}
        />
      ) : shouldShowEmptyMessage ? (
        <div className="mapping-result-card mapping-result-card--info">
          <p>{config.message || "Mapping statistics are not available."}</p>
        </div>
      ) : null}
    </section>
  );
}

export default function MappingStatisticsPage({ config }) {
  const uniqueTagsSvgRef = useRef(null);
  const totalReadsSvgRef = useRef(null);
  const uniqueTagsLegendRef = useRef(null);
  const totalReadsLegendRef = useRef(null);
  const jobIds = Array.isArray(config.jobIds)
    ? config.jobIds
    : config.jobIds
      ? [config.jobIds]
      : [];
  const rows = config.rows || [];
  const jobs = config.jobs || [];
  const totalReads = Number(config.totalReads || 0);
  const totalUniqueTags = Number(config.totalUniqueTags || 0);
  const isSingleReady = config.status === "ready" && rows.length > 0;
  const isMultiReady = config.status === "ready" && jobs.length > 1;
  const isReady = isSingleReady || isMultiReady;
  const exportRows = isMultiReady ? buildExportRowsFromJobs(jobs) : rows;
  const stackedLayout = isMultiReady ? getStackedChartLayout(jobs.length) : null;
  const stackedPanelStyle = stackedLayout
    ? {
        "--mapping-plot-left": `${(stackedLayout.chartLeft / stackedLayout.viewBoxWidth) * 100}%`,
        "--mapping-plot-right": `${(stackedLayout.chartRight / stackedLayout.viewBoxWidth) * 100}%`
      }
    : undefined;
  const refs = {
    uniqueTagsSvgRef,
    totalReadsSvgRef,
    uniqueTagsLegendRef,
    totalReadsLegendRef
  };

  return (
    <div className="page-shell mapping-statistics-shell">
      <div className="mapping-statistics-workspace">
        <MappingSidebar
          config={config}
          isReady={isReady}
          isSingleReady={isSingleReady}
          isMultiReady={isMultiReady}
          rows={rows}
          exportRows={exportRows}
          totalReads={totalReads}
          totalUniqueTags={totalUniqueTags}
          refs={refs}
        />
        <section className="mapping-statistics-main">
          <MappingIntro config={config} jobIds={jobIds} isReady={isReady} />
          <MappingOutput
            config={config}
            isSingleReady={isSingleReady}
            isMultiReady={isMultiReady}
            rows={rows}
            jobs={jobs}
            totalReads={totalReads}
            totalUniqueTags={totalUniqueTags}
            stackedPanelStyle={stackedPanelStyle}
            refs={refs}
          />
        </section>
      </div>
    </div>
  );
}
