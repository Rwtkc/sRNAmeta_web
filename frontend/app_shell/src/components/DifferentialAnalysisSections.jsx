import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  drawDifferentialHeatmap,
  drawDifferentialVolcanoChart,
  normalizeDifferentialHeatmap,
  normalizeDifferentialVolcanoData,
  useD3Chart
} from "./differentialAnalysisCharts";
import {
  analysisStages,
  buildHeatmapSubset,
  createIndexRange,
  formatFoldChangeFromLog2,
  formatNumber,
  formatPValue,
  parseGeneIds,
  statusLabels,
  statusPriority
} from "./differentialAnalysisUtils";

export function CustomSelect({ label, options, value, onChange }) {
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <label className="diff-field">
      <span>{label}</span>
      <div ref={rootRef} className={`diff-select ${isOpen ? "is-open" : ""}`}>
        <button
          id={fieldId}
          type="button"
          className="diff-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={() => {
            setIsOpen((open) => !open);
          }}
        >
          <span>
            {selectedOption.label}
            {selectedOption.scientificName ? (
              <small>{selectedOption.scientificName}</small>
            ) : null}
          </span>
          <span className="diff-select__chevron" aria-hidden="true" />
        </button>
        {isOpen ? (
          <div className="diff-select__menu" role="presentation">
            <ul id={listboxId} className="diff-select__listbox" role="listbox">
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className={`diff-select__option ${isSelected ? "is-selected" : ""}`}
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                    >
                      <span>{option.label}</span>
                      {option.scientificName ? <small>{option.scientificName}</small> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </label>
  );
}

export function ParameterSection({ title, isOpen, onToggle, children }) {
  return (
    <section className={`diff-param-section ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="diff-param-section__header"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="diff-param-section__heading">
          <strong>{title}</strong>
        </span>
        <span className="diff-param-section__chevron" aria-hidden="true" />
      </button>
      {isOpen ? <div className="diff-param-section__body">{children}</div> : null}
    </section>
  );
}

function VolcanoPlot({ points = [], thresholds, summary }) {
  const normalizedPoints = useMemo(() => normalizeDifferentialVolcanoData(points), [points]);
  const { ref, isRendering } = useD3Chart(
    (element, renderState) =>
      drawDifferentialVolcanoChart(
        element,
        normalizedPoints,
        thresholds,
        summary,
        renderState
      ),
    [normalizedPoints, thresholds.log2fc, thresholds.padj, summary?.plottedGenes, summary?.totalGenes]
  );

  if (!normalizedPoints.length) {
    return <div className="diff-empty-plot">Volcano plot will appear after analysis.</div>;
  }

  return (
    <div className="diff-volcano-shell">
      <div className="srnameta-d3-card">
        <div className="srnameta-d3-host" ref={ref} />
        {isRendering ? <div className="srnameta-d3-loading">Preparing volcano plot...</div> : null}
      </div>
    </div>
  );
}

function DetailValue({ label, value }) {
  return (
    <div className="diff-heatmap-selection__item">
      <span className="diff-heatmap-selection__label">{label}</span>
      <span className="diff-heatmap-selection__value">{value || "NA"}</span>
    </div>
  );
}

function Heatmap({
  heatmap,
  detailMode,
  appliedGeneIds,
  isLoading,
  pendingTopGenes,
  onLoadingComplete,
  onRenderStateChange
}) {
  const normalizedHeatmap = useMemo(() => normalizeDifferentialHeatmap(heatmap), [heatmap]);
  const [selection, setSelection] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const fallbackColumns = normalizedHeatmap.columns.length || heatmap?.samples?.length || 0;

  useEffect(() => {
    setSelection(null);
    setSelectedCell(null);
  }, [normalizedHeatmap.signature]);

  const mainHeatmap = useMemo(
    () => ({
      ...normalizedHeatmap,
      title: "Main Heatmap",
      brushEnabled: detailMode === "area",
      showRowLabels: false
    }),
    [detailMode, normalizedHeatmap]
  );

  const detailState = useMemo(() => {
    if (!normalizedHeatmap.rows.length || !normalizedHeatmap.columns.length) {
      return {
        heatmap: normalizedHeatmap,
        summary: "",
        modeLabel: "",
        emptyMessage: "Heatmap will appear after significant or high-effect genes are available."
      };
    }

    if (detailMode === "genes") {
      const requestedGeneIds = parseGeneIds(appliedGeneIds);

      if (!requestedGeneIds.length) {
        return {
          heatmap: buildHeatmapSubset(normalizedHeatmap, [], null, "genes-empty"),
          summary: "",
          modeLabel: "Gene IDs",
          emptyMessage: ""
        };
      }

      const geneIndexMap = new Map(
        normalizedHeatmap.rows.map((gene, index) => [gene, index])
      );
      const matchedRows = requestedGeneIds
        .map((gene) => geneIndexMap.get(gene))
        .filter((index) => Number.isInteger(index));
      const uniqueMatchedRows = Array.from(new Set(matchedRows));

      if (!uniqueMatchedRows.length) {
        return {
          heatmap: buildHeatmapSubset(normalizedHeatmap, [], null, "genes-missing"),
          summary: "",
          modeLabel: "Gene IDs",
          emptyMessage: "None of the requested Gene IDs are present in the main heatmap."
        };
      }

      return {
        heatmap: {
          ...buildHeatmapSubset(normalizedHeatmap, uniqueMatchedRows, null, "genes"),
          title: "Detail Heatmap"
        },
        summary: `${uniqueMatchedRows.length.toLocaleString()} matched genes x ${normalizedHeatmap.columns.length} samples`,
        modeLabel: "Gene IDs",
        emptyMessage: ""
      };
    }

    if (!selection) {
      return {
        heatmap: buildHeatmapSubset(normalizedHeatmap, [], null, "area-empty"),
        summary: "",
        modeLabel: "Brush Selection",
        emptyMessage: ""
      };
    }

    const rowIndexes = createIndexRange(selection.rowStart - 1, selection.rowEnd - 1);
    const columnIndexes = createIndexRange(selection.colStart - 1, selection.colEnd - 1);

    if (!rowIndexes.length || !columnIndexes.length) {
      return {
        heatmap: buildHeatmapSubset(normalizedHeatmap, [], null, "area-invalid"),
        summary: "",
        modeLabel: "Brush Selection",
        emptyMessage: "The selected heatmap area did not contain any visible cells."
      };
    }

    return {
      heatmap: {
        ...buildHeatmapSubset(normalizedHeatmap, rowIndexes, columnIndexes, "area"),
        title: "Detail Heatmap"
      },
      summary: `${rowIndexes.length.toLocaleString()} selected genes x ${columnIndexes.length} samples`,
      modeLabel: "Brush Selection",
      emptyMessage: ""
    };
  }, [appliedGeneIds, detailMode, normalizedHeatmap, selection]);

  useEffect(() => {
    setSelectedCell(null);
  }, [detailMode, detailState.heatmap.signature]);

  const { ref: mainRef, isRendering: mainRendering } = useD3Chart(
    (element, renderState) =>
      drawDifferentialHeatmap(
        element,
        mainHeatmap,
        {
          chartHeight: 780,
          onCellClick: setSelectedCell,
          onBrushSelection: detailMode === "area" ? setSelection : undefined
        },
        renderState
      ),
    [detailMode, mainHeatmap.signature, isLoading]
  );

  const { ref: detailRef, isRendering: detailRendering } = useD3Chart(
    (element, renderState) =>
      drawDifferentialHeatmap(
        element,
        detailState.heatmap,
        {
          chartHeight: 780,
          emptyMessage: detailState.emptyMessage,
          onCellClick: setSelectedCell
        },
        renderState
      ),
    [detailState.emptyMessage, detailState.heatmap.signature, isLoading]
  );

  const isRenderingAny = isLoading || mainRendering || detailRendering;

  useEffect(() => {
    onRenderStateChange?.(isRenderingAny);

    return () => {
      onRenderStateChange?.(false);
    };
  }, [isRenderingAny, onRenderStateChange]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    if (!normalizedHeatmap.rows.length || mainRendering || detailRendering) {
      return;
    }

    onLoadingComplete?.();
  }, [
    detailRendering,
    isLoading,
    mainRendering,
    normalizedHeatmap.rows.length,
    onLoadingComplete
  ]);

  if (isLoading) {
    return (
      <div className="diff-heatmap-shell">
        <div className="diff-heatmap-workspace">
          <div className="diff-heatmap-results">
            <div className="diff-heatmap-charts">
              <div className="srnameta-d3-card diff-heatmap-chart-card">
                <div className="diff-heatmap-card__header">
                  <div>
                    <h4 className="srnameta-d3-card__title">
                      {`Main Heatmap (${formatNumber(pendingTopGenes, 0)} genes x ${formatNumber(fallbackColumns, 0)} samples)`}
                    </h4>
                    <p className="diff-heatmap-note">
                      {`Showing the top ${formatNumber(pendingTopGenes, 0)} ranked genes.`}
                    </p>
                  </div>
                </div>
                <div className="srnameta-clustering-host">
                  <div className="srnameta-clustering-loading srnameta-clustering-loading--standalone">
                    Loading heatmap...
                  </div>
                </div>
              </div>

              <div className="srnameta-d3-card diff-heatmap-chart-card">
                <div className="diff-heatmap-card__header">
                  <div>
                    <h4 className="srnameta-d3-card__title">Detail Heatmap</h4>
                    <p className="diff-heatmap-note" />
                  </div>
                </div>
                <div className="srnameta-clustering-host" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!normalizedHeatmap.rows.length || !normalizedHeatmap.columns.length) {
    return (
      <div className="diff-empty-plot">
        Heatmap will appear after significant or high-effect genes are available.
      </div>
    );
  }

  return (
    <div className="diff-heatmap-shell">
      <div className="diff-heatmap-workspace">
        <div className="diff-heatmap-results">
          <div className="diff-heatmap-charts">
            <div className="srnameta-d3-card diff-heatmap-chart-card">
              <div className="diff-heatmap-card__header">
                <div>
                  <h4 className="srnameta-d3-card__title">
                    {`Main Heatmap${mainHeatmap.subtitle ? ` (${mainHeatmap.subtitle})` : ""}`}
                  </h4>
                  <p className="diff-heatmap-note">
                    {`Showing the top ${normalizedHeatmap.rows.length.toLocaleString()} ranked genes.`}
                  </p>
                </div>
              </div>
              <div className="srnameta-clustering-host">
                <div ref={mainRef} className="srnameta-d3-host" />
                {mainRendering ? <div className="srnameta-clustering-loading">Rendering main heatmap...</div> : null}
              </div>
            </div>

            <div className="srnameta-d3-card diff-heatmap-chart-card">
              <div className="diff-heatmap-card__header">
                <div>
                  <h4 className="srnameta-d3-card__title">
                    {`Detail Heatmap${detailState.heatmap.subtitle ? ` (${detailState.heatmap.subtitle})` : ""}`}
                  </h4>
                  <p className="diff-heatmap-note">
                    {detailState.modeLabel ? `${detailState.modeLabel}. ` : ""}
                    {detailState.summary || detailState.emptyMessage}
                  </p>
                </div>
              </div>
              <div className="srnameta-clustering-host">
                <div ref={detailRef} className="srnameta-d3-host" />
                {detailRendering ? <div className="srnameta-clustering-loading">Rendering detail heatmap...</div> : null}
              </div>
            </div>
          </div>

          <div className="diff-heatmap-selection srnameta-d3-card">
            <div className="diff-heatmap-selection__header">
              <div>
                <h4 className="srnameta-d3-card__title">Detail Selection</h4>
                <p className="diff-heatmap-note">
                  {detailState.modeLabel ? `${detailState.modeLabel}. ` : ""}
                  {detailState.summary || detailState.emptyMessage || "Brush the main heatmap or switch to Gene IDs."}
                </p>
              </div>
            </div>
            {selectedCell ? (
              <div className="diff-heatmap-selection__grid">
                <DetailValue label="Gene ID" value={selectedCell.gene} />
                <DetailValue label="Sample" value={selectedCell.displaySample} />
                <DetailValue label="Actual" value={selectedCell.actualSample} />
                <DetailValue label="Group" value={selectedCell.group} />
                <DetailValue
                  label="Value"
                  value={Number.isFinite(selectedCell.value) ? selectedCell.value.toFixed(4) : "NA"}
                />
              </div>
            ) : (
              <p className="diff-heatmap-selection__empty">
                Click a cell in the main or detail heatmap to inspect its value and sample mapping.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResultSummary({ result }) {
  const summary = result?.summary || {};
  const cards = [
    { label: "Method", value: summary.method || "NA" },
    { label: "Genes tested", value: formatNumber(summary.totalGenes, 0) },
    { label: "Upregulated", value: formatNumber(summary.upGenes, 0) },
    { label: "Downregulated", value: formatNumber(summary.downGenes, 0) }
  ];

  return (
    <div className="diff-summary-grid">
      {cards.map((card) => (
        <div className="diff-summary-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </div>
  );
}

function pageWindow(currentPage, totalPages) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function ResultTable({ rows = [], page, pageSize, onPageChange }) {
  const [draftSearch, setDraftSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageInput, setPageInput] = useState(String(page));
  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const sortedRows = [...rows].sort((left, right) => {
      const statusRank = statusPriority(left.status) - statusPriority(right.status);

      if (statusRank !== 0) {
        return statusRank;
      }

      const leftPadj = Number.isFinite(Number(left.padj)) ? Number(left.padj) : Number.POSITIVE_INFINITY;
      const rightPadj = Number.isFinite(Number(right.padj)) ? Number(right.padj) : Number.POSITIVE_INFINITY;

      if (leftPadj !== rightPadj) {
        return leftPadj - rightPadj;
      }

      return Math.abs(Number(right.log2FoldChange || 0)) - Math.abs(Number(left.log2FoldChange || 0));
    });

    if (!normalizedSearch) {
      return sortedRows;
    }

    return sortedRows.filter((row) =>
      [row.gene, statusLabels[row.status] || row.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [rows, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleRows = filteredRows.slice(startIndex, startIndex + pageSize);
  const firstRow = filteredRows.length ? startIndex + 1 : 0;
  const lastRow = Math.min(startIndex + pageSize, filteredRows.length);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  if (!rows.length) {
    return (
      <div className="diff-empty-plot">
        Run differential analysis to populate the result table.
      </div>
    );
  }

  return (
    <div className="diff-data-panel">
      <form
        className="diff-data-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setSearchTerm(draftSearch.trim());
          onPageChange(1);
        }}
      >
        <label className="diff-search-field">
          <span>Search</span>
          <input
            type="search"
            value={draftSearch}
            placeholder="ID or status"
            onChange={(event) => {
              setDraftSearch(event.target.value);
            }}
          />
        </label>
        <button type="submit" className="diff-apply-button">
          Apply
        </button>
      </form>
      {!filteredRows.length ? (
        <div className="diff-empty-plot">No IDs matched the current search.</div>
      ) : (
        <div className="diff-table-shell">
          <table className="diff-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Base mean</th>
                <th>Fold change</th>
                <th>Adjusted p-value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.gene}>
                  <td>{row.gene}</td>
                  <td>{formatNumber(row.baseMean, 2)}</td>
                  <td>{formatFoldChangeFromLog2(row.log2FoldChange, 3)}</td>
                  <td>{formatPValue(row.padj)}</td>
                  <td>
                    <span className={`diff-status diff-status--${row.status}`}>
                      {statusLabels[row.status] || row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="diff-data-footer">
        <div className="diff-data-footer__summary">
          <span>
            Showing {formatNumber(firstRow, 0)}-{formatNumber(lastRow, 0)} of{" "}
            {formatNumber(filteredRows.length, 0)} IDs
          </span>
          {filteredRows.length !== rows.length ? (
            <small>Total: {formatNumber(rows.length, 0)} IDs</small>
          ) : null}
        </div>
        <div className="diff-pagination" aria-label="Result table pagination">
          <button type="button" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)}>
            Prev
          </button>
          {pageWindow(safePage, totalPages).map((pageNumber) => (
            <button
              type="button"
              key={pageNumber}
              className={pageNumber === safePage ? "is-active" : ""}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next
          </button>
          <form
            className="diff-pagination__jump"
            onSubmit={(event) => {
              event.preventDefault();
              const nextPage = Math.min(
                totalPages,
                Math.max(1, Number.parseInt(pageInput, 10) || 1)
              );
              setPageInput(String(nextPage));
              onPageChange(nextPage);
            }}
          >
            <span>Page</span>
            <input
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => {
                setPageInput(event.target.value.replace(/[^\d]/g, ""));
              }}
            />
            <button type="submit">Go</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function StageTabs({ activeStage, isReady, onChange }) {
  const activeIndex = Math.max(0, analysisStages.findIndex((stage) => stage.key === activeStage));

  return (
    <div className="diff-stage-progress">
      <div className="diff-stage-tabs" role="tablist" aria-label="Differential analysis sections">
        {analysisStages.map((stage, index) => (
          <button
            type="button"
            key={stage.key}
            role="tab"
            aria-selected={activeStage === stage.key}
            className={[
              "diff-stage-tab",
              activeStage === stage.key ? "is-active" : "",
              isReady && index <= activeIndex ? "is-complete" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(stage.key)}
          >
            {stage.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StagePanels({
  activeStage,
  isReady,
  isError,
  result,
  thresholds,
  tablePage,
  tablePageSize,
  setTablePage,
  detailMode,
  appliedGeneIds,
  heatmapLoading,
  pendingTopGenes,
  onHeatmapLoadingComplete,
  onHeatmapRenderStateChange
}) {
  if (isError) {
    return (
      <div className="diff-result-message diff-result-message--error">
        {result.message || "Differential analysis failed."}
      </div>
    );
  }

  if (!isReady) {
    const placeholder = {
      data: "Run differential analysis to view paginated results.",
      volcano: "Volcano plot will appear after analysis.",
      heatmap: "Heatmap will appear after analysis."
    };

    return <div className="diff-empty-plot">{placeholder[activeStage]}</div>;
  }

  return (
    <div className="diff-stage-panels">
      <div className={`diff-stage-panel ${activeStage === "data" ? "is-active" : "is-hidden"}`}>
        <ResultTable
          rows={result.table || []}
          page={tablePage}
          pageSize={tablePageSize}
          onPageChange={setTablePage}
        />
      </div>
      <div className={`diff-stage-panel ${activeStage === "volcano" ? "is-active" : "is-hidden"}`}>
        <VolcanoPlot
          points={result.volcano || []}
          thresholds={thresholds}
          summary={result.summary || {}}
        />
      </div>
      <div className={`diff-stage-panel ${activeStage === "heatmap" ? "is-active" : "is-hidden"}`}>
        <Heatmap
          heatmap={result.heatmap}
          detailMode={detailMode}
          appliedGeneIds={appliedGeneIds}
          isLoading={heatmapLoading}
          pendingTopGenes={pendingTopGenes}
          onLoadingComplete={onHeatmapLoadingComplete}
          onRenderStateChange={onHeatmapRenderStateChange}
        />
      </div>
    </div>
  );
}
