import { useEffect, useRef, useState } from "react";
import { notifyResultsRendered, publishAnalysisLockState } from "../bridge/progressDocking";
import { DifferentialExportPanel } from "./DifferentialExportPanel";
import { DifferentialTargetNetworkPanel } from "./DifferentialTargetNetworkPanel";
import {
  CustomSelect,
  ParameterSection,
  ResultSummary,
  StagePanels,
  StageTabs
} from "./DifferentialAnalysisSections";
import { foldChangeToLog2, resolveFoldChangeInput } from "./differentialAnalysisUtils";

function parseSampleNames(value) {
  return String(value || "")
    .split(/[\s,，;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMethodRequirementMessage(method, controlCount, treatmentCount) {
  if (method === "wilcoxon_signed_rank") {
    if (controlCount < 2 || treatmentCount < 2) {
      return "Wilcoxon signed-rank test requires at least two Control and two Treatment samples.";
    }

    if (controlCount !== treatmentCount) {
      return "Wilcoxon signed-rank test requires equal numbers of Control and Treatment samples because it runs as a paired test in saved input order.";
    }

    return "";
  }

  if (controlCount < 2 || treatmentCount < 2) {
    const methodLabel = method === "student_t_test" ? "Student's t-test" : method;
    return `${methodLabel} requires at least two Control and two Treatment samples.`;
  }

  return "";
}

export default function DifferentialAnalysisPage({ config }) {
  const lastRequest = config.lastRequest || {};
  const loadDataSettings = config.loadDataSettings || {};
  const incomingResult = config.result || { status: "empty" };
  const [method, setMethod] = useState(lastRequest.method || config.defaultMethod || "DESeq2");
  const [foldChange, setFoldChange] = useState(resolveFoldChangeInput(lastRequest, config));
  const [padj, setPadj] = useState(String(lastRequest.padj || config.defaultPadj || 0.05));
  const [clientMessage, setClientMessage] = useState("");
  const [activeStage, setActiveStage] = useState("data");
  const [tablePage, setTablePage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailMode, setDetailMode] = useState("area");
  const [geneIdsDraft, setGeneIdsDraft] = useState("");
  const [appliedGeneIds, setAppliedGeneIds] = useState("");
  const [topGenes, setTopGenes] = useState(String(lastRequest.topGenes || config.defaultTopGenes || 2000));
  const [analysisSettingsOpen, setAnalysisSettingsOpen] = useState(true);
  const [heatmapSettingsOpen, setHeatmapSettingsOpen] = useState(true);
  const [displayResult, setDisplayResult] = useState(incomingResult);
  const [isHeatmapRefreshing, setIsHeatmapRefreshing] = useState(false);
  const [pendingTopGenes, setPendingTopGenes] = useState(
    Number.parseInt(String(lastRequest.topGenes || config.defaultTopGenes || 2000), 10) || 2000
  );
  const [pendingAnalysisRequestId, setPendingAnalysisRequestId] = useState(null);
  const [pendingHeatmapRequestId, setPendingHeatmapRequestId] = useState(null);
  const [isHeatmapChartRendering, setIsHeatmapChartRendering] = useState(false);
  const stageContentRef = useRef(null);
  const methodOptions = config.methodOptions || [];
  const result = displayResult;
  const isReady = result.status === "ready";
  const isError = result.status === "error";
  const showOutputState = isReady || isError;
  const controlSamples = loadDataSettings.controlSamples || "";
  const treatmentSamples = loadDataSettings.treatmentSamples || "";
  const fileName = loadDataSettings.fileName || "";
  const savedSampleNames = Array.isArray(loadDataSettings.sampleNames)
    ? loadDataSettings.sampleNames.filter(Boolean)
    : [];
  const controlSampleList = parseSampleNames(controlSamples);
  const treatmentSampleList = parseSampleNames(treatmentSamples);
  const hasMatrixSource = Boolean(fileName) || savedSampleNames.length > 0;
  const hasSavedMatrix =
    hasMatrixSource &&
    controlSampleList.length > 0 &&
    treatmentSampleList.length > 0;
  const methodRequirementMessage = getMethodRequirementMessage(
    method,
    controlSampleList.length,
    treatmentSampleList.length
  );
  const meetsMethodRequirements = methodRequirementMessage === "";
  const configuredLog2fc = Number(result.summary?.log2fc);
  const inputLog2fc = foldChangeToLog2(foldChange);
  const startMessage = !hasMatrixSource
    ? "Run Load Data first to save the expression matrix before starting differential analysis."
    : !hasSavedMatrix
      ? "Assign Control and Treatment samples in Load Data before starting differential analysis."
      : !meetsMethodRequirements
        ? methodRequirementMessage
        : "";
  const tablePageSize = 10;
  const thresholds = {
    log2fc: Number.isFinite(configuredLog2fc)
        ? configuredLog2fc
      : Number.isFinite(inputLog2fc)
        ? inputLog2fc
        : Math.log2(2),
    padj: Number(result.summary?.padj || padj || 0.05)
  };
  const displayedAnalysisRequestId = Number(result.summary?.requestId);
  const displayedHeatmapRequestId = Number(result.summary?.heatmapRequestId);

  useEffect(() => {
    const incomingAnalysisRequestId = Number(incomingResult.summary?.requestId);
    const incomingHeatmapRequestId = Number(incomingResult.summary?.heatmapRequestId);

    if (isHeatmapRefreshing) {
      if (incomingResult.status === "error") {
        setDisplayResult(incomingResult);
        setIsHeatmapRefreshing(false);
        setPendingHeatmapRequestId(null);
        return;
      }

      if (
        incomingResult.status === "ready" &&
        Number.isFinite(incomingHeatmapRequestId) &&
        incomingHeatmapRequestId === pendingHeatmapRequestId
      ) {
        setDisplayResult(incomingResult);
      }

      return;
    }

    if (
      isSubmitting &&
      Number.isFinite(pendingAnalysisRequestId) &&
      incomingResult.status === "ready" &&
      incomingAnalysisRequestId !== pendingAnalysisRequestId
    ) {
      return;
    }

    if (
      isSubmitting &&
      incomingResult.status === "error" &&
      Number.isFinite(pendingAnalysisRequestId) &&
      Number.isFinite(incomingAnalysisRequestId) &&
      incomingAnalysisRequestId !== pendingAnalysisRequestId
    ) {
      return;
    }

    if (!isHeatmapRefreshing) {
      setDisplayResult(incomingResult);
      return;
    }
  }, [
    incomingResult,
    isHeatmapRefreshing,
    isSubmitting,
    pendingAnalysisRequestId,
    pendingHeatmapRequestId
  ]);

  useEffect(() => {
    if (!isSubmitting) {
      return undefined;
    }

    const requestMatches =
      Number.isFinite(pendingAnalysisRequestId) &&
      displayedAnalysisRequestId === pendingAnalysisRequestId;

    if (!(requestMatches && (result.status === "ready" || result.status === "error"))) {
      return undefined;
    }

    let frameId = 0;

    const finalize = () => {
      const contentRoot = stageContentRef.current;
      const hasRenderableContent = Boolean(
        contentRoot?.querySelector(".diff-table, .srnameta-d3-host svg, .diff-result-message")
      );

      if (!hasRenderableContent) {
        frameId = window.requestAnimationFrame(finalize);
        return;
      }

      setIsSubmitting(false);
      setPendingAnalysisRequestId(null);
      publishAnalysisLockState(false);
      notifyResultsRendered();
    };

    frameId = window.requestAnimationFrame(finalize);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [displayedAnalysisRequestId, isSubmitting, pendingAnalysisRequestId, result.status]);

  useEffect(() => {
    setTablePage(1);
    if (isReady) {
      setActiveStage("data");
    }
  }, [isReady, result.summary?.totalGenes]);

  useEffect(() => {
    setDetailMode("area");
    setGeneIdsDraft("");
    setAppliedGeneIds("");
    const nextTopGenes = result.summary?.topGenes || lastRequest.topGenes || config.defaultTopGenes || 2000;
    setTopGenes(String(nextTopGenes));
    setPendingTopGenes(Number.parseInt(String(nextTopGenes), 10) || 2000);
  }, [result.heatmap?.genes?.length, result.summary?.totalGenes]);

  useEffect(() => {
    if (activeStage === "heatmap") {
      setHeatmapSettingsOpen(true);
    }
  }, [activeStage]);

  function buildAnalysisRequest() {
    const log2FoldChangeCutoff = foldChangeToLog2(foldChange);

    if (log2FoldChangeCutoff === null) {
      setClientMessage("Fold change must be a positive number.");
      return null;
    }

    const resolvedTopGenes = Number.parseInt(String(topGenes || "").trim(), 10);

    if (!Number.isFinite(resolvedTopGenes) || resolvedTopGenes < 10) {
      setClientMessage("Top genes must be an integer of at least 10.");
      return null;
    }

    return {
      method,
      log2fc: log2FoldChangeCutoff,
      padj,
      topGenes: resolvedTopGenes,
      requestedAt: Date.now()
    };
  }

  function submitAnalysisRequest({ clearResults, nextStage }) {
    if (!hasMatrixSource) {
      setClientMessage("Upload a raw count matrix in Load Data first.");
      return;
    }

    if (!controlSampleList.length || !treatmentSampleList.length) {
      setClientMessage("Assign Control and Treatment samples in Load Data first.");
      return;
    }

    if (!meetsMethodRequirements) {
      setClientMessage(methodRequirementMessage);
      return;
    }

    const request = buildAnalysisRequest();

    if (!request) {
      return;
    }

    if (window.Shiny && config.analysisRequestInputId) {
      setIsSubmitting(true);
      setPendingAnalysisRequestId(request.requestedAt);
      if (clearResults) {
        setDisplayResult({ status: "empty" });
      }
      setActiveStage(nextStage);
      setTablePage(1);
      setClientMessage("");
      publishAnalysisLockState(
        true,
        config.progressSlotId || null,
        "Run differential analysis"
      );
      window.Shiny.setInputValue(config.analysisRequestInputId, request, {
        priority: "event"
      });
    } else {
      setClientMessage("Shiny is not available in this preview context.");
    }
  }

  function runAnalysis() {
    submitAnalysisRequest({
      clearResults: true,
      nextStage: "data"
    });
  }

  function handleStageChange(nextStage) {
    setActiveStage(nextStage);
  }

  function applyTopGenes() {
    const resolvedTopGenes = Number.parseInt(String(topGenes || "").trim(), 10);

    if (!Number.isFinite(resolvedTopGenes) || resolvedTopGenes < 10) {
      setClientMessage("Top genes must be an integer of at least 10.");
      return;
    }

    if (!isReady) {
      setClientMessage("Run differential analysis before refreshing the heatmap.");
      return;
    }

    if (window.Shiny && config.heatmapRefreshInputId) {
      const refreshRequestId = Date.now();
      setClientMessage("");
      setActiveStage("heatmap");
      setIsHeatmapRefreshing(true);
      setPendingTopGenes(resolvedTopGenes);
      setPendingHeatmapRequestId(refreshRequestId);
      setDisplayResult((currentResult) => {
        if (!currentResult || currentResult.status !== "ready") {
          return currentResult;
        }

        return {
          ...currentResult,
          heatmap: {
            genes: [],
            samples: currentResult.heatmap?.samples || [],
            cells: []
          }
        };
      });
      window.Shiny.setInputValue(
        config.heatmapRefreshInputId,
        {
          topGenes: resolvedTopGenes,
          requestedAt: refreshRequestId
        },
        { priority: "event" }
      );
    } else {
      setClientMessage("Shiny is not available in this preview context.");
    }
  }

  return (
    <div className="diff-page">
      <div className="diff-workspace">
        <aside className="diff-sidebar">
          <section className="diff-panel diff-panel--sidebar">
            <p className="diff-panel__eyebrow">{config.eyebrow || "Differential Expression"}</p>
            <h1>{config.title || "Differential Analysis"}</h1>
            <p className="diff-panel__copy">
              {config.description ||
                "Run a differential method using the count matrix and sample groups saved in Load Data."}
            </p>

            <div className="diff-form">
              <ParameterSection
                title="Differential Analysis"
                isOpen={analysisSettingsOpen}
                onToggle={() => {
                  setAnalysisSettingsOpen((open) => !open);
                }}
              >
                <CustomSelect
                  label="1. Analysis engine"
                  options={methodOptions}
                  value={method}
                  onChange={setMethod}
                />
                <label className="diff-field">
                  <span>2. Fold change</span>
                  <input
                    aria-label="Fold change cutoff"
                    value={foldChange}
                    inputMode="decimal"
                    onChange={(event) => {
                      setFoldChange(event.target.value);
                    }}
                  />
                </label>
                <label className="diff-field">
                  <span>3. Adjusted p-value</span>
                  <input
                    aria-label="Adjusted p-value cutoff"
                    value={padj}
                    inputMode="decimal"
                    onChange={(event) => {
                      setPadj(event.target.value);
                    }}
                  />
                </label>
              </ParameterSection>
              {activeStage === "heatmap" ? (
                <ParameterSection
                  title="Heatmap"
                  isOpen={heatmapSettingsOpen}
                  onToggle={() => {
                    setHeatmapSettingsOpen((open) => !open);
                  }}
                >
                  <div className="diff-sidebar-detail">
                    <CustomSelect
                      label="1. Source"
                      options={[
                        { value: "area", label: "Brush Selection" },
                        { value: "genes", label: "Gene IDs" }
                      ]}
                      value={detailMode}
                      onChange={(nextMode) => {
                        setDetailMode(nextMode);
                        if (nextMode === "area") {
                          setGeneIdsDraft("");
                          setAppliedGeneIds("");
                        }
                      }}
                    />
                    <label className="diff-field diff-field--textarea">
                      <span>2. Gene IDs</span>
                      <textarea
                        value={geneIdsDraft}
                        placeholder="Enter Gene IDs when Source = Gene IDs"
                        disabled={detailMode !== "genes"}
                        onChange={(event) => {
                          setGeneIdsDraft(event.target.value);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="diff-apply-button"
                      disabled={detailMode !== "genes" || isHeatmapRefreshing || isHeatmapChartRendering}
                      onClick={() => {
                        setAppliedGeneIds(geneIdsDraft);
                      }}
                    >
                      Apply
                    </button>
                    <label className="diff-field">
                      <span>3. Top genes</span>
                      <input
                        aria-label="Top genes for heatmap"
                        inputMode="numeric"
                        value={topGenes}
                        onChange={(event) => {
                          setTopGenes(event.target.value.replace(/[^\d]/g, ""));
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="diff-apply-button"
                      disabled={isSubmitting || isHeatmapRefreshing || isHeatmapChartRendering}
                      onClick={applyTopGenes}
                    >
                      Apply
                    </button>
                  </div>
                </ParameterSection>
              ) : null}
              {clientMessage ? <p className="diff-client-message">{clientMessage}</p> : null}
              <button
                type="button"
                className="diff-run-button"
                disabled={
                  isSubmitting ||
                  isHeatmapRefreshing ||
                  isHeatmapChartRendering ||
                  !hasSavedMatrix ||
                  !meetsMethodRequirements
                }
                data-srnameta-analysis-trigger="true"
                data-srnameta-analysis-owner={config.progressSlotId || ""}
                onClick={runAnalysis}
              >
                Run differential analysis
              </button>
              {startMessage ? <p className="diff-start-message">{startMessage}</p> : null}
              {isReady ? (
                <DifferentialExportPanel
                  activeStage={activeStage}
                  result={result}
                  stageContentRef={stageContentRef}
                  disabled={isSubmitting || isHeatmapRefreshing || isHeatmapChartRendering}
                />
              ) : null}
            </div>
          </section>
        </aside>

        <section className="diff-main">
          <section className="diff-panel diff-panel--intro">
            <p className="diff-panel__eyebrow">Analysis Workspace</p>
            <h2 className="diff-main__title">
              {config.title || "Differential Analysis"}
            </h2>
            <p className="diff-main__copy">
              {config.description ||
                "Run DESeq2, edgeR, Student's t-test, or Wilcoxon signed-rank test using the count matrix and sample groups saved in Load Data."}
            </p>
            {isReady ? <ResultSummary result={result} /> : null}
          </section>

          <section className="diff-panel diff-panel--output">
            <p className="diff-panel__eyebrow">Analysis Output</p>
            <div
              className="diff-progress-slot"
              data-srnameta-progress-slot={config.progressSlotId || "differential-analysis-progress"}
            />
            {showOutputState ? (
              <>
                <StageTabs activeStage={activeStage} isReady={isReady} onChange={handleStageChange} />
                <div className="diff-stage-content" role="tabpanel">
                  <div ref={stageContentRef}>
                    <StagePanels
                      activeStage={activeStage}
                      isReady={isReady}
                      isError={isError}
                      result={result}
                      thresholds={thresholds}
                      tablePage={tablePage}
                      tablePageSize={tablePageSize}
                      setTablePage={setTablePage}
                      detailMode={detailMode}
                      appliedGeneIds={appliedGeneIds}
                      heatmapLoading={isHeatmapRefreshing}
                      pendingTopGenes={pendingTopGenes}
                      onHeatmapLoadingComplete={() => {
                        setIsHeatmapRefreshing(false);
                        setPendingHeatmapRequestId(null);
                      }}
                      onHeatmapRenderStateChange={setIsHeatmapChartRendering}
                    />
                  </div>
                </div>
              </>
            ) : isSubmitting ? null : (
              <div className="diff-stage-content diff-stage-content--idle" aria-hidden="true" />
            )}
          </section>

          {isReady && activeStage === "data" ? (
            <DifferentialTargetNetworkPanel targetNetwork={result.targetNetwork} />
          ) : null}
        </section>
      </div>
    </div>
  );
}
