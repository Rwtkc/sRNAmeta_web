import { useState } from "react";
import {
  defaultExportSettings,
  exportChartBundle,
  exportMappingStatisticsCsv,
  exportSingleChart,
  normalizeDpiValue
} from "./mappingStatisticsExport";

export default function MappingExportPanel({
  charts,
  bundleName,
  figureChart,
  figureFileStem,
  exportRows,
  totalReads,
  totalUniqueTags,
  csvFileName
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [settings, setSettings] = useState(defaultExportSettings);
  const [isFigureExporting, setIsFigureExporting] = useState(false);
  const [isDataExporting, setIsDataExporting] = useState(false);
  const [dpiHint, setDpiHint] = useState("");
  const isExporting = isFigureExporting || isDataExporting;

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
      const normalizedSettings = {
        ...settings,
        dpi: normalized.value
      };

      if (figureChart && figureFileStem) {
        await exportSingleChart(figureChart, normalizedSettings, figureFileStem);
      } else {
        await exportChartBundle(charts, normalizedSettings, bundleName);
      }
    } finally {
      setIsFigureExporting(false);
    }
  }

  function handleDataExport() {
    setIsDataExporting(true);

    try {
      exportMappingStatisticsCsv(
        exportRows,
        totalReads,
        totalUniqueTags,
        csvFileName
      );
    } finally {
      setIsDataExporting(false);
    }
  }

  return (
    <section className={`mapping-export-panel${isOpen ? " is-open" : ""}`} aria-label="Export unique tags chart">
      <button
        type="button"
        className="mapping-export-panel__header mapping-export-panel__header--toggle"
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
          <div className="mapping-export-format" role="radiogroup" aria-label="Export format">
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
        <button
          className={`mapping-export-panel__button ${
            isFigureExporting ? "is-loading" : ""
          }`}
          type="button"
          disabled={isExporting}
          onClick={handleFigureExport}
        >
          {isFigureExporting ? (
            <>
              <span className="mapping-export-panel__spinner" aria-hidden="true" />
              Exporting...
            </>
          ) : (
            figureChart && figureFileStem ? "Export Figure" : "Export ZIP"
          )}
        </button>
        <div className="mapping-export-panel__divider" />
        <p className="mapping-export-panel__eyebrow">Export Data</p>
        <div className="mapping-export-field">
          <span>Format</span>
          <div className="mapping-export-field__static">CSV</div>
        </div>
        <button
          className={`mapping-export-panel__button ${
            isDataExporting ? "is-loading" : ""
          }`}
          type="button"
          disabled={isExporting}
          onClick={handleDataExport}
        >
          {isDataExporting ? (
            <>
              <span className="mapping-export-panel__spinner" aria-hidden="true" />
              Exporting...
            </>
          ) : (
            "Export CSV"
          )}
        </button>
        </div>
      ) : null}
    </section>
  );
}
