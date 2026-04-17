import { useEffect, useId, useRef, useState } from "react";

const defaultSummary = [
  { label: "Source", value: "Input Job ID" },
  { label: "Job ID", value: "Not provided" },
  { label: "Matrix", value: "No matrix selected" }
];

const defaultNotes = [
  "Use an existing job ID to restore a previous run.",
  "Upload an expression matrix when starting a new analysis.",
  "Backend validation and analysis execution will be connected later."
];

const dataSourceOptions = [
  { value: "jobid", label: "Input Job ID" },
  { value: "matrix", label: "Upload Expression Matrix" }
];

function CustomSelect({ label, options, value, defaultValue, onChange }) {
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || defaultValue);

  const selectedOption =
    options.find((option) => option.value === selectedValue) || options[0];

  useEffect(() => {
    if (value) {
      setSelectedValue(value);
    }
  }, [value]);

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
    <label className="load-field">
      <span>{label}</span>
      <div
        ref={rootRef}
        className={`load-select ${isOpen ? "is-open" : ""}`}
      >
        <button
          id={fieldId}
          type="button"
          className="load-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={() => {
            setIsOpen((open) => !open);
          }}
        >
          <span>{selectedOption.label}</span>
          <span className="load-select__chevron" aria-hidden="true" />
        </button>

        {isOpen ? (
          <div className="load-select__menu" role="presentation">
            <ul
              id={listboxId}
              className="load-select__listbox"
              role="listbox"
              aria-labelledby={fieldId}
            >
              {options.map((option) => {
                const isSelected = option.value === selectedValue;

                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className={`load-select__option ${
                        isSelected ? "is-selected" : ""
                      }`}
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedValue(option.value);
                        onChange?.(option.value);
                        setIsOpen(false);
                      }}
                    >
                      {option.label}
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

function MatrixFilePicker({ label, fileName }) {
  return (
    <div className="load-file-picker">
      <span className="load-file-picker__label">{label}</span>
      <div className="load-file-picker__row">
        <button
          type="button"
          className="load-file-picker__button"
        >
          Choose file
        </button>
        <span
          className={`load-file-picker__summary ${
            fileName ? "" : "load-file-picker__summary--empty"
          }`}
        >
          {fileName || "No matrix selected"}
        </span>
      </div>
    </div>
  );
}

export default function LoadDataPage({ config }) {
  const [dataSource, setDataSource] = useState("jobid");
  const [jobId, setJobId] = useState("");
  const [matrixFileName] = useState("");
  const demoJobId = config.demoJobId || "tpAXtbvFhKwPAuOw";
  const summary = [
    {
      label: "Source",
      value: dataSource === "jobid" ? "Input Job ID" : "Upload Matrix"
    },
    {
      label: "Job ID",
      value: dataSource === "jobid" && jobId ? jobId : "Not provided"
    },
    {
      label: "Matrix",
      value:
        dataSource === "matrix" && matrixFileName
          ? matrixFileName
          : "No matrix selected"
    }
  ];
  const notes = config.notes?.length ? config.notes : defaultNotes;

  function updateDataSource(value) {
    setDataSource(value);

    if (window.Shiny && config.dataSourceInputId) {
      window.Shiny.setInputValue(config.dataSourceInputId, value, {
        priority: "event"
      });
    }
  }

  function updateJobId(value) {
    setJobId(value);

    if (window.Shiny && config.jobIdInputId) {
      window.Shiny.setInputValue(config.jobIdInputId, value, {
        priority: "event"
      });
    }
  }

  function loadDemoJob() {
    updateDataSource("jobid");
    updateJobId(demoJobId);
  }

  return (
    <div className="load-data-page">
      <div className="load-data-workspace">
        <aside className="load-data-sidebar" aria-labelledby="load-data-title">
          <section className="load-panel load-panel--sidebar">
            <p className="load-panel__eyebrow">
              {config.eyebrow || "Choose Data Source"}
            </p>
            <h1 id="load-data-title">{config.title || "Load Data"}</h1>
            <p className="load-panel__copy">
              {config.description ||
                "Prepare BED files and species context before running sRNAmeta analysis."}
            </p>

            <div className="load-form-preview" aria-label="Load data controls">
              <CustomSelect
                label="1. Data source"
                options={dataSourceOptions}
                value={dataSource}
                defaultValue="jobid"
                onChange={updateDataSource}
              />

              {dataSource === "jobid" ? (
                <label className="load-field">
                  <span>2. Job ID</span>
                  <input
                    value={jobId}
                    placeholder="Paste existing job ID"
                    onChange={(event) => {
                      updateJobId(event.target.value);
                    }}
                  />
                </label>
              ) : (
                <>
                  <label className="load-field">
                    <span>2. Species</span>
                    <input placeholder="Select or type species" />
                  </label>
                  <MatrixFilePicker
                    label="3. Expression matrix"
                    fileName={matrixFileName}
                  />
                </>
              )}

              <div className="load-actions">
                <button type="button">Save</button>
                <button
                  type="button"
                  className="load-actions__secondary"
                  onClick={loadDemoJob}
                >
                  Demo
                </button>
              </div>
            </div>
          </section>
        </aside>

        <section className="load-data-main" aria-label="Session details">
          <section className="load-panel load-panel--summary">
            <p className="load-panel__eyebrow">Session Summary</p>
            <h2>Current input state</h2>
            <div className="load-summary-grid">
              {summary.map((item) => (
                <div className="load-summary-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="load-panel load-panel--guide">
            <p className="load-panel__eyebrow">Workflow Notes</p>
            <h2>Before analysis</h2>
            <ul className="load-guide-list">
              {notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </section>
      </div>
    </div>
  );
}
