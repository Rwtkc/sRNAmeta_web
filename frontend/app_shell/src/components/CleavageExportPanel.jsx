import { useState } from "react";
import {
  defaultExportSettings,
  exportSingleChart,
  normalizeDpiValue
} from "./differentialAnalysisExport";
import { downloadBlob } from "./mappingExportCore";

function buildCleavageFileStem(selectedEntry) {
  const normalizedId = String(selectedEntry?.id || "figure")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `srnameta_cleavage_${normalizedId || "figure"}`;
}

function resolveActiveCleavageChart(rootElement, selectedEntry) {
  const svg = rootElement?.querySelector(".cleavage-chart-card .srnameta-d3-host svg");

  if (!svg) {
    return null;
  }

  return {
    fileStem: buildCleavageFileStem(selectedEntry),
    pathifyText: false,
    svgRef: { current: svg }
  };
}

export function CleavageExportPanel({ chartHostRef, selectedEntry, result, disabled }) {
  const [isOpen, setIsOpen] = useState(true);
  const [settings, setSettings] = useState(defaultExportSettings);
  const [isFigureExporting, setIsFigureExporting] = useState(false);
  const [isDataExporting, setIsDataExporting] = useState(false);
  const [dpiHint, setDpiHint] = useState("");
  const isExporting = isFigureExporting || isDataExporting;
  const canExportFigure = !disabled && Boolean(selectedEntry);
  const exportBundle = result?.exportBundle || {};
  const exportFile = exportBundle.file || null;
  const canExportData =
    !disabled &&
    Boolean(exportFile?.name) &&
    typeof exportFile?.content === "string" &&
    exportFile.content.length > 0;

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
    const chart = resolveActiveCleavageChart(chartHostRef.current, selectedEntry);

    if (!chart) {
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
      await exportSingleChart(
        chart,
        {
          ...settings,
          dpi: normalized.value
        },
        chart.fileStem
      );
    } finally {
      setIsFigureExporting(false);
    }
  }

  async function handleDataExport() {
    if (!canExportData) {
      return;
    }

    setIsDataExporting(true);

    try {
      const textBlob = new Blob([exportFile.content], {
        type: "text/plain;charset=utf-8"
      });
      downloadBlob(
        textBlob,
        exportBundle.filename || exportFile.name || "srnameta_cleavage_figure_data.txt"
      );
    } finally {
      setIsDataExporting(false);
    }
  }

  return (
    <section
      className={`mapping-export-panel cleavage-export-panel${isOpen ? " is-open" : ""}`}
      aria-label="Export cleavage figure"
    >
      <button
        type="button"
        className="mapping-export-panel__header cleavage-export-panel__toggle"
        aria-expanded={isOpen ? "true" : "false"}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <h2>Export</h2>
        <span className="diff-param-section__chevron" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="mapping-export-panel__body">
          <p className="mapping-export-panel__eyebrow">Export Figure</p>
          <div className="mapping-export-field">
            <span>Format</span>
            <div className="mapping-export-format" role="radiogroup" aria-label="Export cleavage figure format">
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
          {!selectedEntry ? (
            <small className="mapping-export-field__hint">
              Run cleavage analysis and select a tRNA before exporting.
            </small>
          ) : null}
          <button
            className={`mapping-export-panel__button ${isFigureExporting ? "is-loading" : ""}`}
            type="button"
            disabled={!canExportFigure || isExporting}
            onClick={handleFigureExport}
          >
            {isFigureExporting ? (
              <>
                <span className="mapping-export-panel__spinner" aria-hidden="true" />
                Exporting...
              </>
            ) : (
              "Export Figure"
            )}
          </button>
          <div className="mapping-export-panel__divider" />
          <p className="mapping-export-panel__eyebrow">Export Data</p>
          <div className="mapping-export-field">
            <span>Format</span>
            <div className="mapping-export-field__static">CSV</div>
          </div>
          {!canExportData ? (
            <small className="mapping-export-field__hint">
              Run cleavage analysis before exporting figure data.
            </small>
          ) : null}
          <button
            className={`mapping-export-panel__button ${isDataExporting ? "is-loading" : ""}`}
            type="button"
            disabled={!canExportData || isExporting}
            onClick={handleDataExport}
          >
            {isDataExporting ? (
              <>
                <span className="mapping-export-panel__spinner" aria-hidden="true" />
                Exporting...
              </>
            ) : (
              "Export Figure Data"
            )}
          </button>
        </div>
      ) : null}
    </section>
  );
}
