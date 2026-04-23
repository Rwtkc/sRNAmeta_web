import { useState } from "react";
import {
  defaultExportSettings,
  exportChartBundle,
  exportDifferentialAnalysisCsvBundle,
  exportSingleChart,
  normalizeDpiValue
} from "./differentialAnalysisExport";

function resolveActiveFigureCharts(rootElement, activeStage) {
  const activePanel = rootElement?.querySelector(".diff-stage-panel.is-active");

  if (!activePanel) {
    return [];
  }

  if (activeStage === "volcano") {
    const volcanoSvg = activePanel.querySelector(".srnameta-d3-host svg");

    return volcanoSvg
      ? [
          {
            fileStem: "srnameta_differential_volcano",
            pathifyText: false,
            svgRef: { current: volcanoSvg }
          }
        ]
      : [];
  }

  if (activeStage === "heatmap") {
    return Array.from(activePanel.querySelectorAll(".diff-heatmap-chart-card"))
      .map((card, index) => {
        const svg = card.querySelector(".srnameta-d3-host svg");
        const title = card.querySelector(".srnameta-d3-card__title")?.textContent || "";
        const isDetail = /detail/i.test(title);
        const fileStem = isDetail
          ? "srnameta_differential_detail_heatmap"
          : index === 0
            ? "srnameta_differential_main_heatmap"
            : `srnameta_differential_heatmap_${index + 1}`;

        return svg
          ? {
              fileStem,
              pathifyText: false,
              svgRef: { current: svg }
            }
          : null;
      })
      .filter(Boolean);
  }

  return [];
}

export function DifferentialExportPanel({ activeStage, result, stageContentRef, disabled }) {
  const [settings, setSettings] = useState(defaultExportSettings);
  const [isFigureExporting, setIsFigureExporting] = useState(false);
  const [isDataExporting, setIsDataExporting] = useState(false);
  const [dpiHint, setDpiHint] = useState("");
  const isExporting = isFigureExporting || isDataExporting;
  const hasData = Array.isArray(result?.table) && result.table.length > 0;
  const targetRows = Array.isArray(result?.targetNetwork?.rows) ? result.targetNetwork.rows : [];
  const canExportFigure = !disabled && (activeStage === "volcano" || activeStage === "heatmap");

  function updateSetting(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function normalizeDpiSetting() {
    setSettings((current) => {
      const normalized = normalizeDpiValue(current.dpi);
      setDpiHint(normalized.hint);

      return {
        ...current,
        dpi: normalized.value
      };
    });
  }

  async function handleFigureExport() {
    if (
      activeStage === "heatmap" &&
      stageContentRef.current?.querySelector(".diff-stage-panel.is-active .srnameta-clustering-loading")
    ) {
      return;
    }

    const normalized = normalizeDpiValue(settings.dpi);

    if (settings.format !== "pdf") {
      setDpiHint(normalized.hint);
    }

    setSettings((current) => ({
      ...current,
      dpi: normalized.value
    }));
    setIsFigureExporting(true);

    try {
      const charts = resolveActiveFigureCharts(stageContentRef.current, activeStage);
      const normalizedSettings = {
        ...settings,
        dpi: normalized.value
      };

      if (charts.length === 1) {
        await exportSingleChart(charts[0], normalizedSettings, charts[0].fileStem);
      } else if (charts.length > 1) {
        await exportChartBundle(charts, normalizedSettings, "srnameta_differential_heatmaps");
      }
    } finally {
      setIsFigureExporting(false);
    }
  }

  async function handleDataExport() {
    setIsDataExporting(true);

    try {
      await exportDifferentialAnalysisCsvBundle(result.table || [], targetRows);
    } finally {
      setIsDataExporting(false);
    }
  }

  return (
    <section className="mapping-export-panel diff-export-panel" aria-label="Export differential analysis">
      <div className="mapping-export-panel__header">
        <h2>Export</h2>
        <span aria-hidden="true">⌃</span>
      </div>
      <div className="mapping-export-panel__body">
        <p className="mapping-export-panel__eyebrow">Export Figure</p>
        <div className="mapping-export-field">
          <span>Format</span>
          <div className="mapping-export-format" role="radiogroup" aria-label="Export figure format">
            <button
              className={`mapping-export-format__option ${
                settings.format === "png" ? "is-active" : ""
              }`}
              type="button"
              disabled={isExporting}
              onClick={() => {
                updateSetting("format", "png");
              }}
            >
              PNG
            </button>
            <button
              className={`mapping-export-format__option ${
                settings.format === "pdf" ? "is-active" : ""
              }`}
              type="button"
              disabled={isExporting}
              onClick={() => {
                updateSetting("format", "pdf");
              }}
            >
              PDF
            </button>
          </div>
        </div>
        <label className="mapping-export-field">
          <span>Resolution (DPI)</span>
          <input
            type="text"
            inputMode="numeric"
            value={settings.dpi}
            disabled={settings.format === "pdf" || isExporting}
            onChange={(event) => {
              setDpiHint("");
              updateSetting("dpi", event.target.value);
            }}
            onBlur={normalizeDpiSetting}
          />
        </label>
        {settings.format !== "pdf" && dpiHint ? (
          <small className="mapping-export-field__hint mapping-export-field__hint--warning">
            {dpiHint}
          </small>
        ) : null}
        {settings.format === "pdf" ? (
          <small className="mapping-export-field__hint">
            PDF does not support DPI settings.
          </small>
        ) : null}
        {activeStage === "data" ? (
          <small className="mapping-export-field__hint">
            Switch to Volcano Plot or Heatmap to export a figure.
          </small>
        ) : null}
        <button
          className={`mapping-export-panel__button ${isFigureExporting ? "is-loading" : ""}`}
          type="button"
          disabled={isExporting || !canExportFigure}
          onClick={handleFigureExport}
        >
          {isFigureExporting ? (
            <>
              <span className="mapping-export-panel__spinner" aria-hidden="true" />
              Exporting...
            </>
          ) : activeStage === "heatmap" ? (
            "Export Heatmap"
          ) : (
            "Export Figure"
          )}
        </button>
        <div className="mapping-export-panel__divider" />
        <p className="mapping-export-panel__eyebrow">Export Data</p>
        <div className="mapping-export-field">
          <span>Format</span>
          <div className="mapping-export-field__static">ZIP (CSV bundle)</div>
        </div>
        <button
          className={`mapping-export-panel__button ${isDataExporting ? "is-loading" : ""}`}
          type="button"
          disabled={isExporting || disabled || !hasData}
          onClick={handleDataExport}
        >
          {isDataExporting ? (
            <>
              <span className="mapping-export-panel__spinner" aria-hidden="true" />
              Exporting...
            </>
          ) : (
            "Export ZIP"
          )}
        </button>
      </div>
    </section>
  );
}
