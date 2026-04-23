import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseMatrixHeader } from "./loadDataUtils";

export function MatrixFilePicker({ label, fileName, onFileLoaded }) {
  const inputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");

      onFileLoaded({
        fileName: file.name,
        fileText: text,
        sampleNames: parseMatrixHeader(text)
      });
    };
    reader.readAsText(file);
  }

  return (
    <div className="load-file-picker">
      <span className="load-file-picker__label">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={handleFileChange}
      />
      <div className="load-file-picker__row">
        <button
          type="button"
          className="load-file-picker__button"
          onClick={() => {
            inputRef.current?.click();
          }}
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

export function CustomSelect({
  label,
  options,
  value,
  defaultValue,
  onChange
}) {
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || defaultValue);
  const selectedOption =
    options.find((option) => option.value === selectedValue)
    || options[0];

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

export function CompactSelect({ options, value, onChange, ariaLabel }) {
  const fieldId = useId();
  const listboxId = `${fieldId}-listbox`;
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);

  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function updateMenuPosition() {
      const trigger = rootRef.current?.querySelector(".load-select__trigger--compact");

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const estimatedMenuHeight = options.length * 42 + 14;
      const viewportGap = 8;
      const shouldOpenUp =
        window.innerHeight - rect.bottom < estimatedMenuHeight + viewportGap &&
        rect.top > estimatedMenuHeight + viewportGap;

      setMenuPosition({
        position: "fixed",
        top: shouldOpenUp
          ? `${Math.max(viewportGap, rect.top - estimatedMenuHeight - 6)}px`
          : `${rect.bottom + 6}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`
      });
    }

    function handlePointerDown(event) {
      const isInTrigger = rootRef.current?.contains(event.target);
      const isInMenu = menuRef.current?.contains(event.target);

      if (!isInTrigger && !isInMenu) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    updateMenuPosition();
    const animationFrame = window.requestAnimationFrame(updateMenuPosition);

    window.addEventListener("resize", updateMenuPosition);
    document.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateMenuPosition);
      document.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, options.length]);

  const menu = (
    <div
      ref={menuRef}
      className="load-select__menu load-select__menu--compact"
      role="presentation"
      style={menuPosition || undefined}
    >
      <ul
        id={listboxId}
        className="load-select__listbox load-select__listbox--compact"
        role="listbox"
        aria-labelledby={fieldId}
      >
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                className={`load-select__option load-select__option--compact ${
                  isSelected ? "is-selected" : ""
                }`}
                aria-selected={isSelected}
                onClick={() => {
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
  );

  return (
    <div
      ref={rootRef}
      className={`load-select load-select--compact ${isOpen ? "is-open" : ""}`}
    >
      <button
        id={fieldId}
        type="button"
        className="load-select__trigger load-select__trigger--compact"
        aria-label={ariaLabel}
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

      {isOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}

export function SamplePairingModal({
  pairRows,
  setPairRows,
  onClose,
  canApply,
  sampleRoleOptions
}) {
  const [query, setQuery] = useState("");
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );
  const [remPixels, setRemPixels] = useState(() => {
    if (typeof window === "undefined") {
      return 16;
    }

    return parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  });
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return pairRows;
    }

    return pairRows.filter((row) => row.sampleName.toLowerCase().includes(normalizedQuery));
  }, [pairRows, query]);
  const controlCount = pairRows.filter((row) => row.groupRole === "Control").length;
  const treatmentCount = pairRows.filter((row) => row.groupRole === "Treatment").length;
  const unusedCount = pairRows.length - controlCount - treatmentCount;
  const dialogLayout = useMemo(() => {
    const cardWidth = 16 * remPixels;
    const cardGap = 0.75 * remPixels;
    const dialogPadding = 2.5 * remPixels;
    const sizingBuffer = 2 * remPixels;
    const maxDialogWidth = viewportWidth * 0.8;
    const minDialogWidth = Math.min(26 * remPixels, maxDialogWidth);
    const visibleSampleCount = filteredRows.length;
    const maxContentWidth = Math.max(cardWidth, maxDialogWidth - dialogPadding - sizingBuffer);
    const maxColumns = Math.max(
      1,
      Math.floor((maxContentWidth + cardGap) / (cardWidth + cardGap))
    );
    const columns = Math.max(1, Math.min(visibleSampleCount || 1, maxColumns));
    const contentWidth =
      visibleSampleCount > 0
        ? columns * cardWidth +
          Math.max(columns - 1, 0) * cardGap +
          dialogPadding +
          sizingBuffer
        : minDialogWidth;

    return {
      columns,
      width: Math.min(maxDialogWidth, Math.max(minDialogWidth, contentWidth))
    };
  }, [filteredRows.length, remPixels, viewportWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleResize() {
      setViewportWidth(window.innerWidth);
      setRemPixels(parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  function updateRole(sampleName, groupRole) {
    setPairRows((current) =>
      current.map((entry) =>
        entry.sampleName === sampleName ? { ...entry, groupRole } : entry
      )
    );
  }

  function setVisibleRole(groupRole) {
    const visibleSamples = new Set(filteredRows.map((row) => row.sampleName));

    setPairRows((current) =>
      current.map((entry) =>
        visibleSamples.has(entry.sampleName) ? { ...entry, groupRole } : entry
      )
    );
  }

  const modal = (
    <div className="load-sample-modal">
      <div className="load-sample-modal__backdrop" onClick={onClose} />
      <div
        className="load-sample-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Configure samples"
        style={{
          "--load-sample-columns": dialogLayout.columns,
          width: `${dialogLayout.width}px`
        }}
      >
        <div className="load-sample-modal__header">
          <div>
            <h3>Configure Samples</h3>
            <p>
              Search samples, assign Control or Treatment, and exclude any columns that should stay out of the analysis.
            </p>
          </div>
          <button type="button" className="load-sample-modal__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="load-sample-modal__body">
          <div className="load-sample-modal__toolbar">
            <label className="load-sample-modal__search">
              <span>Search samples</span>
              <input
                value={query}
                placeholder="Type part of a sample name"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
            </label>
            <div className="load-sample-modal__bulk-actions" aria-label="Bulk role actions">
              <button type="button" onClick={() => setVisibleRole("Control")}>
                Visible as Control
              </button>
              <button type="button" onClick={() => setVisibleRole("Treatment")}>
                Visible as Treatment
              </button>
              <button type="button" onClick={() => setVisibleRole("Unused")}>
                Visible as Excluded
              </button>
            </div>
          </div>
          <div className="load-sample-modal__stats">
            <span>{pairRows.length} detected</span>
            <span>{controlCount} Control</span>
            <span>{treatmentCount} Treatment</span>
            <span>{unusedCount} Excluded</span>
          </div>
          <div className="load-sample-modal__pair-grid">
            {filteredRows.map((row) => (
              <div key={row.sampleName} className="load-sample-modal__pair-row">
                <div className="load-sample-modal__pair-sample">{row.sampleName}</div>
                <CompactSelect
                  options={sampleRoleOptions}
                  value={row.groupRole}
                  ariaLabel={`${row.sampleName} sample role`}
                  onChange={(nextValue) => {
                    updateRole(row.sampleName, nextValue);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="load-sample-modal__hint">
            Save requires at least two Control and two Treatment samples. Samples marked Excluded stay in the uploaded matrix but are left out of differential analysis.
          </div>
        </div>

        <div className="load-sample-modal__footer">
          <span />
          <button type="button" disabled={!canApply} onClick={onClose}>
            Apply Pairing
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
}

export function JobGroupingModal({
  pairRows,
  setPairRows,
  onClose,
  canApply,
  jobGroupOptions
}) {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return pairRows;
    }

    return pairRows.filter((row) => row.sampleName.toLowerCase().includes(normalizedQuery));
  }, [pairRows, query]);
  const controlCount = pairRows.filter((row) => row.groupRole === "Control").length;
  const treatmentCount = pairRows.filter((row) => row.groupRole === "Treatment").length;

  function updateRole(sampleName, groupRole) {
    setPairRows((current) =>
      current.map((entry) =>
        entry.sampleName === sampleName ? { ...entry, groupRole } : entry
      )
    );
  }

  function setVisibleRole(groupRole) {
    const visibleSamples = new Set(filteredRows.map((row) => row.sampleName));

    setPairRows((current) =>
      current.map((entry) =>
        visibleSamples.has(entry.sampleName) ? { ...entry, groupRole } : entry
      )
    );
  }

  const modal = (
    <div className="load-sample-modal">
      <div className="load-sample-modal__backdrop" onClick={onClose} />
      <div
        className="load-sample-modal__dialog load-sample-modal__dialog--job-grouping"
        role="dialog"
        aria-modal="true"
        aria-label="Configure samples"
      >
        <div className="load-sample-modal__header">
          <div>
            <h3>Configure Samples</h3>
            <p>
              Search Job IDs and assign each sample to the Control or Treatment group before saving.
            </p>
          </div>
          <button type="button" className="load-sample-modal__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="load-sample-modal__body load-sample-modal__body--job-grouping">
          <div className="load-sample-modal__toolbar load-sample-modal__toolbar--job-grouping">
            <label className="load-sample-modal__search">
              <span>Search Job IDs</span>
              <input
                value={query}
                placeholder="Type part of a Job ID"
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
              />
            </label>
            <div className="load-sample-modal__bulk-actions" aria-label="Bulk role actions">
              <button type="button" onClick={() => setVisibleRole("Control")}>
                Visible as Control
              </button>
              <button type="button" onClick={() => setVisibleRole("Treatment")}>
                Visible as Treatment
              </button>
            </div>
          </div>
          <div className="load-sample-modal__stats">
            <span>{pairRows.length} detected</span>
            <span>{controlCount} Control</span>
            <span>{treatmentCount} Treatment</span>
          </div>
          <div className="load-sample-modal__pair-grid load-sample-modal__pair-grid--job-grouping">
            {filteredRows.map((row) => (
              <div key={row.sampleName} className="load-sample-modal__pair-row">
                <div className="load-sample-modal__pair-sample">{row.sampleName}</div>
                <CompactSelect
                  options={jobGroupOptions}
                  value={row.groupRole}
                  ariaLabel={`${row.sampleName} job group`}
                  onChange={(nextValue) => {
                    updateRole(row.sampleName, nextValue);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="load-sample-modal__hint">
            Differential Analysis uses at most the first four Job IDs. Save requires at least two Control and two Treatment Job IDs before it can build a merged matrix.
          </div>
        </div>

        <div className="load-sample-modal__footer">
          <span />
          <button type="button" disabled={!canApply} onClick={onClose}>
            Apply Samples
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
}

export function MatrixPreviewTable({ fileName, preview }) {
  if (!preview?.header?.length) {
    return null;
  }

  return (
    <section className="load-panel load-panel--preview">
      <p className="load-panel__eyebrow">Expression Matrix</p>
      <h2>First 10 rows</h2>
      <p className="load-panel__copy load-panel__copy--compact">
        {fileName || "Uploaded matrix"}
      </p>
      <div className="load-matrix-preview" role="region" aria-label="Expression matrix preview">
        <table className="load-matrix-table">
          <thead>
            <tr>
              {preview.header.map((column, index) => (
                <th key={`${column || "column"}-${index}`}>{column || `Column ${index + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
