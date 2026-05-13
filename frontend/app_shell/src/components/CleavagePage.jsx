import { useEffect, useMemo, useRef, useState } from "react";
import { notifyResultsRendered, publishAnalysisLockState } from "../bridge/progressDocking";
import { CleavageExportPanel } from "./CleavageExportPanel";
import { useD3Chart } from "./differentialAnalysisCharts";
import { drawCleavageChart } from "./cleavageCharts";

const numericFields = [
  {
    key: "cleavageRatio",
    label: "1. Cleavage ratio",
    step: "0.001",
    min: "0"
  },
  {
    key: "pvalue",
    label: "2. P-value",
    step: "0.001",
    min: "0"
  },
  {
    key: "foldChange",
    label: "3. Fold change",
    step: "0.1",
    min: "0"
  },
  {
    key: "inputBaseCoverage",
    label: "4. Input base coverage",
    step: "1",
    min: "0"
  },
  {
    key: "treatedCountCutoff",
    label: "5. Treated count cutoff",
    step: "1",
    min: "0"
  },
  {
    key: "nonNoise",
    label: "6. Non-noise threshold",
    step: "1",
    min: "0"
  }
];

function buildInitialValues(defaults = {}) {
  return {
    cleavageRatio: String(defaults.cleavageRatio ?? 0.2),
    pvalue: String(defaults.pvalue ?? 0.05),
    foldChange: String(defaults.foldChange ?? 6),
    inputBaseCoverage: String(defaults.inputBaseCoverage ?? 10),
    treatedCountCutoff: String(defaults.treatedCountCutoff ?? 10),
    nonNoise: String(defaults.nonNoise ?? 3)
  };
}

function CleavageChart({ entry, onRenderingChange }) {
  const { ref, isRendering } = useD3Chart(
    (element, renderState) => drawCleavageChart(element, entry, renderState),
    [entry?.id, entry?.length, JSON.stringify(entry?.annotations || []), JSON.stringify(entry?.points || [])]
  );

  useEffect(() => {
    if (typeof onRenderingChange === "function") {
      onRenderingChange(Boolean(entry) && isRendering);
    }
  }, [entry, isRendering, onRenderingChange]);

  if (!entry) {
    return <div className="diff-empty-plot">Cleavage plot will appear after analysis.</div>;
  }

  return (
    <div className="cleavage-chart-shell">
      <div className="srnameta-d3-card cleavage-chart-card">
        <div className="srnameta-d3-host" ref={ref} />
        {isRendering ? <div className="srnameta-d3-loading">Preparing cleavage plot...</div> : null}
      </div>
    </div>
  );
}

export default function CleavagePage({ config }) {
  const defaults = config.defaults || {};
  const incomingResult = config.result || { status: "empty" };
  const [values, setValues] = useState(buildInitialValues(defaults));
  const [clientMessage, setClientMessage] = useState("");
  const [displayResult, setDisplayResult] = useState(incomingResult);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const outputRef = useRef(null);
  const pickerRef = useRef(null);
  const pendingScrollRestoreRef = useRef(null);
  const chartHostRef = useRef(null);

  const result = displayResult;
  const isReadyToRun = config.status === "ready";
  const hasRunRequest = Boolean(config.runRequestInputId);
  const isResultReady = result.status === "ready";
  const isResultError = result.status === "error";
  const showOutputState = isResultReady || isResultError;
  const displayedRequestId = Number(result.requestId);
  const summary = result.summary || {};
  const visualization = result.visualization || {};
  const chartEntries = Array.isArray(visualization.entries) ? visualization.entries : [];
  const [selectedTrna, setSelectedTrna] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [trnaQuery, setTrnaQuery] = useState("");
  const [trnaSearchDraft, setTrnaSearchDraft] = useState("");
  const [isChartRendering, setIsChartRendering] = useState(false);
  const filteredEntries = useMemo(() => {
    const query = trnaQuery.trim().toLowerCase();

    if (!query) {
      return chartEntries;
    }

    return chartEntries.filter((entry) => String(entry?.id || "").toLowerCase().includes(query));
  }, [chartEntries, trnaQuery]);
  const selectedEntry = useMemo(
    () =>
      chartEntries.find((entry) => entry?.id === selectedTrna) ||
      chartEntries.find((entry) => entry?.id === visualization.defaultTrna) ||
      chartEntries[0] ||
      null,
    [chartEntries, selectedTrna, visualization.defaultTrna]
  );

  useEffect(() => {
    setValues(buildInitialValues(defaults));
  }, [defaults]);

  useEffect(() => {
    if (!chartEntries.length) {
      setSelectedTrna("");
      setIsPickerOpen(false);
      setTrnaQuery("");
      setTrnaSearchDraft("");
      return;
    }

    setSelectedTrna((current) => {
      if (current && chartEntries.some((entry) => entry?.id === current)) {
        return current;
      }

      return visualization.defaultTrna || chartEntries[0]?.id || "";
    });
  }, [chartEntries, visualization.defaultTrna]);

  useEffect(() => {
    if (!isPickerOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setIsPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isPickerOpen]);

  useEffect(() => {
    if (pendingScrollRestoreRef.current == null) {
      return undefined;
    }

    const targetY = pendingScrollRestoreRef.current;
    let frameId = 0;
    let frameId2 = 0;

    frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, left: window.scrollX, behavior: "auto" });
      frameId2 = window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, left: window.scrollX, behavior: "auto" });
        pendingScrollRestoreRef.current = null;
      });
    });

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      if (frameId2) {
        window.cancelAnimationFrame(frameId2);
      }
    };
  }, [selectedEntry?.id]);

  useEffect(() => {
    const incomingRequestId = Number(incomingResult.requestId);

    if (
      isSubmitting &&
      Number.isFinite(pendingRequestId) &&
      incomingResult.status === "ready" &&
      incomingRequestId !== pendingRequestId
    ) {
      return;
    }

    if (
      isSubmitting &&
      incomingResult.status === "error" &&
      Number.isFinite(pendingRequestId) &&
      Number.isFinite(incomingRequestId) &&
      incomingRequestId !== pendingRequestId
    ) {
      return;
    }

    setDisplayResult(incomingResult);
  }, [incomingResult, isSubmitting, pendingRequestId]);

  useEffect(() => {
    if (!isSubmitting) {
      return undefined;
    }

    const requestMatches =
      Number.isFinite(pendingRequestId) &&
      displayedRequestId === pendingRequestId;

    if (!(requestMatches && (result.status === "ready" || result.status === "error"))) {
      return undefined;
    }

    let frameId = 0;

    const finalize = () => {
      if (!outputRef.current) {
        frameId = window.requestAnimationFrame(finalize);
        return;
      }

      setIsSubmitting(false);
      setPendingRequestId(null);
      publishAnalysisLockState(false);
      notifyResultsRendered();
    };

    frameId = window.requestAnimationFrame(finalize);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [displayedRequestId, isSubmitting, pendingRequestId, result.status]);

  function updateValue(key, nextValue) {
    setValues((current) => ({
      ...current,
      [key]: nextValue
    }));
  }

  function buildRequest() {
    const request = {
      requestedAt: Date.now()
    };

    for (const field of numericFields) {
      const rawValue = String(values[field.key] || "").trim();
      const numericValue = Number(rawValue);

      if (!rawValue || Number.isNaN(numericValue)) {
        setClientMessage(`${field.label.replace(/^\d+\.\s*/, "")} must be a numeric value.`);
        return null;
      }

      request[field.key] = numericValue;
    }

    return request;
  }

  function runAnalysis() {
    const request = buildRequest();

    if (!request) {
      return;
    }

    if (window.Shiny && config.runRequestInputId) {
      setClientMessage("");
      setIsSubmitting(true);
      setPendingRequestId(request.requestedAt);
      setDisplayResult({ status: "empty" });
      publishAnalysisLockState(
        true,
        config.progressSlotId || null,
        "Run cleavage analysis"
      );
      window.Shiny.setInputValue(config.runRequestInputId, request, {
        priority: "event"
      });
      return;
    }

    setClientMessage("Shiny is not available in this preview context.");
  }

  function handleSelectTrna(nextTrnaId) {
    pendingScrollRestoreRef.current = window.scrollY;
    setSelectedTrna(nextTrnaId);
    setIsPickerOpen(false);
    setTrnaQuery("");
    setTrnaSearchDraft(nextTrnaId);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function handleSearchTrna() {
    const normalizedQuery = trnaSearchDraft.trim();

    setTrnaQuery(normalizedQuery);
    setIsPickerOpen(true);
  }

  function handleApplySearchedTrna() {
    const normalizedQuery = trnaSearchDraft.trim().toLowerCase();

    if (!normalizedQuery) {
      return;
    }

    const exactMatch = chartEntries.find(
      (entry) => String(entry?.id || "").toLowerCase() === normalizedQuery
    );
    const partialMatch =
      exactMatch ||
      chartEntries.find((entry) => String(entry?.id || "").toLowerCase().includes(normalizedQuery));

    if (partialMatch?.id) {
      handleSelectTrna(partialMatch.id);
      return;
    }

    setTrnaQuery(normalizedQuery);
    setIsPickerOpen(true);
  }

  return (
    <div className="diff-page cleavage-page">
      <div className="cleavage-workspace">
        <aside className="cleavage-sidebar">
          <section className="cleavage-panel cleavage-panel--sidebar">
            <p className="cleavage-panel__eyebrow">
              {config.eyebrow || "Cleavage Analysis"}
            </p>
            <h1 className="cleavage-panel__title">{config.title || "Cleavage"}</h1>
            <p className="cleavage-panel__copy">
              {config.description || "Configure cleavage thresholds from saved Job ID data."}
            </p>
            <div className="cleavage-form">
              <section className="cleavage-parameter-section">
                <div className="cleavage-parameter-section__header">
                  <span className="cleavage-parameter-section__heading">
                    <strong>Cleavage Analysis</strong>
                  </span>
                </div>
                <div className="cleavage-parameter-section__body">
                  {numericFields.map((field) => (
                    <label key={field.key} className="cleavage-field">
                      <span>{field.label}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={values[field.key]}
                        onChange={(event) => {
                          updateValue(field.key, event.target.value);
                        }}
                      />
                    </label>
                  ))}
                </div>
              </section>
              <button
                type="button"
                className="cleavage-run-button"
                disabled={!isReadyToRun || isSubmitting || !hasRunRequest}
                data-srnameta-analysis-trigger="true"
                data-srnameta-analysis-owner={config.progressSlotId || ""}
                onClick={runAnalysis}
              >
                Run Cleavage Analysis
              </button>
              {clientMessage ? <p className="cleavage-client-message">{clientMessage}</p> : null}
              <p className="cleavage-sidebar__hint">{config.message}</p>
              {isResultReady ? (
                <CleavageExportPanel
                  chartHostRef={chartHostRef}
                  selectedEntry={selectedEntry}
                  result={result}
                  disabled={isSubmitting || isChartRendering}
                />
              ) : null}
            </div>
          </section>
        </aside>
        <section className="cleavage-main">
          <section className="cleavage-panel cleavage-panel--intro">
            <p className="cleavage-panel__eyebrow">Analysis Workspace</p>
            <h2 className="cleavage-main__title">{config.title || "Cleavage"}</h2>
            <p className="cleavage-main__copy">
              {config.description || "Configure cleavage thresholds from saved Job ID data."}
            </p>
          </section>
          <section className="cleavage-panel cleavage-panel--canvas">
            <p className="cleavage-panel__eyebrow">Analysis Output</p>
            <div
              className="cleavage-progress-slot"
              data-srnameta-progress-slot={config.progressSlotId || "cleavage-analysis-progress"}
            />
            {showOutputState ? (
              <div ref={outputRef} className={`cleavage-result-card cleavage-result-card--${result.status}`}>
                {isResultError ? <p>{result.message}</p> : null}
                {isResultReady ? (
                  <>
                    <div className="cleavage-summary-grid">
                      <div className="load-summary-item">
                        <span>Rendered tRNAs</span>
                        <strong>{summary.chartCount ?? chartEntries.length ?? 0}</strong>
                      </div>
                      <div className="load-summary-item">
                        <span>Figure rows</span>
                        <strong>{summary.figureRows ?? 0}</strong>
                      </div>
                      <div className="load-summary-item">
                        <span>Control zero rows</span>
                        <strong>{summary.zeroRows ?? 0}</strong>
                      </div>
                      <div className="load-summary-item">
                        <span>Control non-zero rows</span>
                        <strong>{summary.nonZeroRows ?? 0}</strong>
                      </div>
                    </div>
                    {chartEntries.length ? (
                      <div ref={chartHostRef} className="cleavage-visualization">
                        <div className="cleavage-visualization__toolbar">
                          <div ref={pickerRef} className="cleavage-visualization__selector">
                            <label htmlFor="cleavage-trna-select">Select tRNA</label>
                            <div className="cleavage-select-toolbar">
                              <button
                                id="cleavage-trna-select"
                                type="button"
                                className="cleavage-select-trigger"
                                aria-haspopup="listbox"
                                aria-expanded={isPickerOpen ? "true" : "false"}
                                onClick={() => {
                                  setIsPickerOpen((current) => !current);
                                  setTrnaQuery("");
                                }}
                              >
                                <span>{selectedEntry?.id || "Select tRNA"}</span>
                                <span
                                  className={`cleavage-select-trigger__chevron${isPickerOpen ? " is-open" : ""}`}
                                  aria-hidden="true"
                                >
                                  ▾
                                </span>
                              </button>
                              <input
                                type="text"
                                className="cleavage-select-searchbar__input"
                                placeholder="Search tRNA ID"
                                value={trnaSearchDraft}
                                onChange={(event) => {
                                  setTrnaSearchDraft(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleApplySearchedTrna();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="cleavage-select-searchbar__button"
                                onClick={handleSearchTrna}
                              >
                                Search
                              </button>
                              <button
                                type="button"
                                className="cleavage-select-searchbar__button cleavage-select-searchbar__button--apply"
                                onClick={handleApplySearchedTrna}
                              >
                                Apply
                              </button>
                            </div>
                            {isPickerOpen ? (
                              <div className="cleavage-select-panel">
                                <div className="cleavage-select-options" role="listbox" aria-label="tRNA options">
                                  {filteredEntries.length ? (
                                    filteredEntries.map((entry) => (
                                      <button
                                        key={entry.id}
                                        type="button"
                                        className={`cleavage-select-option${entry.id === selectedEntry?.id ? " is-active" : ""}`}
                                        onClick={() => handleSelectTrna(entry.id)}
                                      >
                                        {entry.id}
                                      </button>
                                    ))
                                  ) : (
                                    <div className="cleavage-select-empty">No matching tRNA IDs.</div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <div className="cleavage-visualization__meta">
                            <span>{selectedEntry?.length || 0} nt</span>
                            <span>{selectedEntry?.points?.length || 0} sites</span>
                          </div>
                        </div>
                        <CleavageChart entry={selectedEntry} onRenderingChange={setIsChartRendering} />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : isSubmitting ? null : (
              <div ref={outputRef} className="cleavage-stage-content cleavage-stage-content--idle" aria-hidden="true" />
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
