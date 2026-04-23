import { useEffect, useMemo, useState } from "react";
import { notifyResultsRendered, publishAnalysisLockState } from "../bridge/progressDocking";
import {
  CustomSelect,
  JobGroupingModal,
  MatrixFilePicker,
  MatrixPreviewTable,
  SamplePairingModal
} from "./LoadDataShared";
import {
  MAX_DIFFERENTIAL_JOB_IDS,
  buildJobGroupingRows,
  buildSamplePairManifest,
  buildSamplePairRows,
  limitDifferentialJobIds,
  normalizeSamplePairRows,
  parseJobIds,
  parseMatrixHeader,
  parseMatrixPreview,
  samplesForRole
} from "./loadDataUtils";

const defaultSummary = [
  { label: "Source", value: "Input Job ID" },
  { label: "Job IDs", value: "Not provided" },
  { label: "sncRNA Type", value: "miRNA" },
  { label: "Matrix", value: "No matrix selected" },
  { label: "Species", value: "Human" },
  { label: "Groups", value: "Not configured" }
];

const defaultNotes = [
  "Use an existing job ID to restore a previous run.",
  "Choose one sncRNA type first. Job ID differential analysis reads only that type-specific stat table from each saved Job ID.",
  "Job ID differential analysis uses at most the first four Job IDs and requires at least two Control and two Treatment assignments before a merged matrix is built.",
  "Upload a raw count matrix and assign Control and Treatment samples before running differential analysis."
];

const dataSourceOptions = [
  { value: "jobid", label: "Input Job ID" },
  { value: "matrix", label: "Expression Matrix Settings" }
];

const speciesOptions = [
  { value: "human", label: "Human" },
  { value: "mouse", label: "Mouse" },
  { value: "rice", label: "Rice" },
  { value: "maize", label: "Maize" }
];

const sncRnaTypeOptions = [
  { value: "miRNA", label: "miRNA" },
  { value: "isomiR", label: "isomiR" },
  { value: "phasiRNA", label: "phasiRNA" },
  { value: "piRNA", label: "piRNA" },
  { value: "tRF", label: "tRF" },
  { value: "tRNA", label: "tRNA" },
  { value: "snRNA", label: "snRNA" },
  { value: "snoRNA", label: "snoRNA" },
  { value: "rRNA", label: "rRNA" }
];

const sampleRoleOptions = [
  { value: "Unused", label: "Excluded" },
  { value: "Control", label: "Control" },
  { value: "Treatment", label: "Treatment" }
];

const jobGroupOptions = [
  { value: "Control", label: "Control" },
  { value: "Treatment", label: "Treatment" }
];

export default function LoadDataPage({ config }) {
  const currentState = config.currentState || {};
  const dataSource = currentState.dataSource || "jobid";
  const jobId = currentState.jobId || "";
  const species = currentState.species || "human";
  const sncRnaType = currentState.sncRnaType || "";
  const matrixFileName = currentState.matrixFileName || "";
  const matrixFileText = currentState.matrixFileText || "";
  const matrixSampleNames = Array.isArray(currentState.matrixSampleNames)
    ? currentState.matrixSampleNames.filter(Boolean)
    : [];
  const samplePairing = Array.isArray(currentState.samplePairing)
    ? currentState.samplePairing
    : [];
  const saveStatus = config.saveStatus || "idle";
  const saveMessage = config.saveMessage || "";
  const saveVersion = Number(config.saveVersion || 0);
  const demoJobSpecies = config.demoJobSpecies || "human";
  const demoJobSncRnaType = config.demoJobSncRnaType || "miRNA";
  const [draftDataSource, setDraftDataSource] = useState(currentState.dataSource || "jobid");
  const [draftJobId, setDraftJobId] = useState(currentState.jobId || "");
  const [draftSpecies, setDraftSpecies] = useState(currentState.species || "human");
  const [draftSncRnaType, setDraftSncRnaType] = useState(currentState.sncRnaType || "miRNA");
  const [draftMatrixFileName, setDraftMatrixFileName] = useState(currentState.matrixFileName || "");
  const [draftMatrixFileText, setDraftMatrixFileText] = useState(currentState.matrixFileText || "");
  const [draftMatrixSampleNames, setDraftMatrixSampleNames] = useState(
    Array.isArray(currentState.matrixSampleNames) ? currentState.matrixSampleNames.filter(Boolean) : []
  );
  const [draftSamplePairing, setDraftSamplePairing] = useState([]);
  const [draftJobGrouping, setDraftJobGrouping] = useState([]);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isJobGroupingModalOpen, setIsJobGroupingModalOpen] = useState(false);
  const [pendingSaveRequestId, setPendingSaveRequestId] = useState(null);
  const [pendingSaveVersion, setPendingSaveVersion] = useState(null);
  const demoJobId = config.demoJobId || "JZgI17o5fuq82WhF";
  const demoMatrix = config.demoMatrix || null;
  const parsedJobIds = parseJobIds(jobId);
  const parsedDraftJobIds = parseJobIds(draftJobId);
  const differentialJobIds = useMemo(() => limitDifferentialJobIds(parsedJobIds), [parsedJobIds]);
  const differentialDraftJobIds = useMemo(
    () => limitDifferentialJobIds(parsedDraftJobIds),
    [parsedDraftJobIds]
  );
  const ignoredDraftJobIds = useMemo(
    () => parsedDraftJobIds.slice(differentialDraftJobIds.length),
    [differentialDraftJobIds.length, parsedDraftJobIds]
  );
  const savedControlCount = samplePairing.filter((row) => row.groupRole === "Control").length;
  const savedTreatmentCount = samplePairing.filter((row) => row.groupRole === "Treatment").length;
  const draftPairManifest = useMemo(
    () => buildSamplePairManifest(draftSamplePairing, draftMatrixSampleNames),
    [draftMatrixSampleNames, draftSamplePairing]
  );
  const draftPairingSummary = useMemo(() => {
    if (!draftMatrixSampleNames.length) {
      return "Upload a matrix to detect samples.";
    }

    if (!draftPairManifest) {
      return `${draftMatrixSampleNames.length} samples detected. Select at least 2 Control and 2 Treatment samples.`;
    }

    const controlCount = draftPairManifest.filter((row) => row.group_role === "Control").length;
    const treatmentCount = draftPairManifest.filter((row) => row.group_role === "Treatment").length;
    const unusedCount = draftMatrixSampleNames.length - draftPairManifest.length;
    return `${draftPairManifest.length} selected | Control ${controlCount} | Treatment ${treatmentCount} | Excluded ${unusedCount}`;
  }, [draftMatrixSampleNames.length, draftPairManifest]);
  const draftJobGroupingSummary = useMemo(() => {
    if (!parsedDraftJobIds.length) {
      return "Enter Job IDs to assign Control and Treatment groups.";
    }

    if (!draftSncRnaType) {
      return ignoredDraftJobIds.length
        ? `You can save ${parsedDraftJobIds.length} Job IDs now for Mapping Statistics. Differential Analysis uses only the first ${MAX_DIFFERENTIAL_JOB_IDS} Job IDs.`
        : "You can save Job IDs now for Mapping Statistics.";
    }

    const draftControlCount = draftJobGrouping.filter((row) => row.groupRole === "Control").length;
    const draftTreatmentCount = draftJobGrouping.filter((row) => row.groupRole === "Treatment").length;

    if (differentialDraftJobIds.length < MAX_DIFFERENTIAL_JOB_IDS) {
      return `Differential Analysis from Job IDs uses up to the first ${MAX_DIFFERENTIAL_JOB_IDS} Job IDs and needs at least four Job IDs so each group has at least two samples.`;
    }

    if (draftControlCount < 2 || draftTreatmentCount < 2) {
      return `${ignoredDraftJobIds.length ? `Only the first ${MAX_DIFFERENTIAL_JOB_IDS} Job IDs are used for Differential Analysis. ` : ""}Assign at least two Job IDs to Control and at least two Job IDs to Treatment. Current selection: ${draftControlCount} Control / ${draftTreatmentCount} Treatment.`;
    }

    return ignoredDraftJobIds.length
      ? `${parsedDraftJobIds.length} Job IDs entered | Differential Analysis uses first ${MAX_DIFFERENTIAL_JOB_IDS} | ${draftControlCount} Control / ${draftTreatmentCount} Treatment`
      : `${differentialDraftJobIds.length} Job IDs selected | ${draftControlCount} Control / ${draftTreatmentCount} Treatment`;
  }, [
    differentialDraftJobIds.length,
    draftJobGrouping,
    draftSncRnaType,
    ignoredDraftJobIds.length,
    parsedDraftJobIds.length
  ]);
  const canConfigurePairing = draftMatrixSampleNames.length > 0;
  const isJobGroupingTypeMissing =
    draftDataSource === "jobid" &&
    parsedDraftJobIds.length > 0 &&
    !draftSncRnaType;
  const draftJobGroupingIsReady =
    !isJobGroupingTypeMissing &&
    differentialDraftJobIds.length >= MAX_DIFFERENTIAL_JOB_IDS &&
    draftJobGrouping.filter((row) => row.groupRole === "Control").length >= 2 &&
    draftJobGrouping.filter((row) => row.groupRole === "Treatment").length >= 2;
  const canConfigureJobGrouping = parsedDraftJobIds.length > 0;
  const canSaveJobId =
    draftDataSource === "jobid" &&
    Boolean(draftSpecies.trim()) &&
    parsedDraftJobIds.length > 0;
  const canSaveMatrix =
    draftDataSource === "matrix" &&
    Boolean(draftSpecies.trim()) &&
    Boolean(draftSncRnaType.trim()) &&
    Boolean(draftMatrixFileName.trim()) &&
    Boolean(draftMatrixFileText.trim()) &&
    draftMatrixSampleNames.length > 0 &&
    Boolean(draftPairManifest);
  const canSave = canSaveJobId || canSaveMatrix;
  const matrixPreview = useMemo(
    () => (matrixFileText ? parseMatrixPreview(matrixFileText, 10) : null),
    [matrixFileText]
  );
  const showMatrixPreview = Boolean(matrixPreview);
  const summary = [
    {
      label: "Source",
      value: dataSource === "jobid" ? "Input Job ID" : "Expression Matrix Settings"
    },
    {
      label: "Job IDs",
      value:
        dataSource === "jobid" && parsedJobIds.length > 0
          ? parsedJobIds.length === 1
            ? parsedJobIds[0]
            : parsedJobIds.length > differentialJobIds.length
              ? `${parsedJobIds.length} job IDs (${differentialJobIds.length} used for Differential Analysis)`
              : `${parsedJobIds.length} job IDs`
          : "Not provided"
    },
    {
      label: "sncRNA Type",
      value: sncRnaTypeOptions.find((option) => option.value === sncRnaType)?.label || "miRNA"
    },
    {
      label: "Matrix",
      value: matrixFileName || "No matrix selected"
    },
    {
      label: "Species",
      value: speciesOptions.find((option) => option.value === species)?.label || "Not selected"
    },
    {
      label: "Groups",
      value:
        savedControlCount + savedTreatmentCount > 0
          ? `${savedControlCount} control / ${savedTreatmentCount} treatment`
          : "Not configured"
    }
  ];
  const notes = config.notes?.length ? config.notes : defaultNotes;

  useEffect(() => {
    setDraftDataSource(currentState.dataSource || "jobid");
    setDraftJobId(currentState.jobId || "");
    setDraftSpecies(currentState.species || "human");
    setDraftSncRnaType(currentState.sncRnaType || "miRNA");
    setDraftMatrixFileName(currentState.matrixFileName || "");
    setDraftMatrixFileText(currentState.matrixFileText || "");
    setDraftMatrixSampleNames(
      Array.isArray(currentState.matrixSampleNames) ? currentState.matrixSampleNames.filter(Boolean) : []
    );
    setDraftSamplePairing(Array.isArray(currentState.samplePairing) ? currentState.samplePairing : []);
    setDraftJobGrouping(
      buildJobGroupingRows(
        parseJobIds(currentState.jobId || ""),
        Array.isArray(currentState.jobGrouping) ? currentState.jobGrouping : []
      )
    );
  }, [saveVersion]);

  useEffect(() => {
    setDraftJobGrouping((current) => buildJobGroupingRows(parsedDraftJobIds, current));
  }, [draftJobId]);

  useEffect(() => {
    if (
      !pendingSaveRequestId ||
      pendingSaveVersion == null ||
      saveVersion <= pendingSaveVersion
    ) {
      return;
    }

    publishAnalysisLockState(false);
    notifyResultsRendered();
    setPendingSaveRequestId(null);
    setPendingSaveVersion(null);
  }, [pendingSaveRequestId, pendingSaveVersion, saveVersion]);

  function updateDataSource(value) {
    setDraftDataSource(value);
  }

  function updateJobId(value) {
    setDraftJobId(value);
  }

  function submitSaveRequest(overrides = {}) {
    if (!window.Shiny || !config.saveRequestInputId) {
      return;
    }

    const nextDataSource = overrides.dataSource || draftDataSource;
    const nextJobId = overrides.jobId ?? draftJobId;
    const nextSpecies = overrides.species || draftSpecies;
    const nextSncRnaType = overrides.sncRnaType ?? draftSncRnaType;
    const nextMatrixFileName = overrides.matrixFileName ?? draftMatrixFileName;
    const nextMatrixFileText = overrides.matrixFileText ?? draftMatrixFileText;
    const nextMatrixSampleNames = overrides.matrixSampleNames ?? draftMatrixSampleNames;
    const nextSamplePairing = overrides.samplePairing ?? draftSamplePairing;
    const nextJobGrouping = overrides.jobGrouping ?? draftJobGrouping;
    const nextPairManifest =
      nextDataSource === "matrix"
        ? buildSamplePairManifest(nextSamplePairing, nextMatrixSampleNames)
        : [];
    const requestId = Date.now();

    window.Shiny.setInputValue(
      config.saveRequestInputId,
      {
        dataSource: nextDataSource,
        jobId: nextJobId,
        species: nextSpecies,
        sncRnaType: nextSncRnaType,
        matrixFileName: nextDataSource === "matrix" ? nextMatrixFileName : "",
        matrixFileText: nextDataSource === "matrix" ? nextMatrixFileText : "",
        matrixSampleNames: nextDataSource === "matrix" ? nextMatrixSampleNames : [],
        samplePairing: nextDataSource === "matrix" ? nextSamplePairing : [],
        controlSamples: nextDataSource === "matrix" ? samplesForRole(nextPairManifest, "Control") : "",
        treatmentSamples: nextDataSource === "matrix" ? samplesForRole(nextPairManifest, "Treatment") : "",
        jobGrouping: nextDataSource === "jobid" ? nextJobGrouping : [],
        requestedAt: requestId
      },
      {
        priority: "event"
      }
    );

    setPendingSaveRequestId(requestId);
    setPendingSaveVersion(saveVersion);
    publishAnalysisLockState(
      true,
      config.progressSlotId || null,
      nextDataSource === "jobid" ? "Build job ID matrix" : "Save expression matrix"
    );
  }

  function loadDemoJob() {
    setDraftDataSource("jobid");
    setDraftSpecies(demoJobSpecies);
    setDraftSncRnaType(demoJobSncRnaType);
    setDraftJobId(demoJobId);
    setDraftJobGrouping(buildJobGroupingRows(parseJobIds(demoJobId), []));
  }

  function loadDemoMatrix() {
    if (!demoMatrix?.fileText || !demoMatrix?.fileName) {
      return;
    }

    const demoSampleNames =
      demoMatrix.sampleNames?.length ? demoMatrix.sampleNames : parseMatrixHeader(demoMatrix.fileText);
    const demoPairRows = normalizeSamplePairRows(demoSampleNames, demoMatrix.samplePairing || []);

    setDraftDataSource("matrix");
    setDraftSpecies(demoMatrix.species || "human");
    setDraftSncRnaType(demoMatrix.sncRnaType || "miRNA");
    setDraftMatrixFileName(demoMatrix.fileName);
    setDraftMatrixFileText(demoMatrix.fileText);
    setDraftMatrixSampleNames(demoSampleNames);
    setDraftSamplePairing(demoPairRows);
    setDraftJobId("");
    submitSaveRequest({
      dataSource: "matrix",
      jobId: "",
      species: demoMatrix.species || "human",
      sncRnaType: demoMatrix.sncRnaType || "miRNA",
      matrixFileName: demoMatrix.fileName,
      matrixFileText: demoMatrix.fileText,
      matrixSampleNames: demoSampleNames,
      samplePairing: demoPairRows
    });
  }

  function updateMatrixFile(file) {
    setDraftMatrixFileName(file.fileName);
    setDraftMatrixFileText(file.fileText);
    setDraftMatrixSampleNames(file.sampleNames);
    setDraftSamplePairing((current) => buildSamplePairRows(file.sampleNames, current));
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
                "Resume an existing job ID or configure expression matrix settings before running differential analysis."}
            </p>

            <div className="load-form-preview" aria-label="Load data controls">
              <CustomSelect
                label="1. Data source"
                options={dataSourceOptions}
                value={draftDataSource}
                defaultValue="jobid"
                onChange={updateDataSource}
              />

              <CustomSelect
                label="2. Species"
                options={speciesOptions}
                value={draftSpecies}
                defaultValue="human"
                onChange={setDraftSpecies}
              />

              {draftDataSource === "jobid" ? (
                <>
                  <label className="load-field">
                    <span>3. Job IDs</span>
                    <textarea
                      value={draftJobId}
                      rows={4}
                      placeholder="Paste one or more job IDs, separated by commas, Chinese commas, or line breaks"
                      onChange={(event) => {
                        updateJobId(event.target.value);
                      }}
                    />
                  </label>
                  <CustomSelect
                    label="4. sncRNA type"
                    options={sncRnaTypeOptions}
                    value={draftSncRnaType}
                    defaultValue="miRNA"
                    onChange={setDraftSncRnaType}
                  />
                  <div className="load-field load-field--job-grouping">
                    <span>5. Differential groups</span>
                    <div className="load-sample-config">
                      <div
                        className={
                          draftJobGroupingIsReady
                            ? "load-sample-config__summary"
                            : `load-sample-config__hint${
                                isJobGroupingTypeMissing ? " load-sample-config__hint--alert" : ""
                              }`
                        }
                      >
                        {draftJobGroupingSummary}
                      </div>
                      <button
                        type="button"
                        className={`load-sample-config__button${
                          canConfigureJobGrouping && !draftJobGroupingIsReady
                            ? " load-sample-config__button--attention"
                            : ""
                        }`}
                        disabled={!canConfigureJobGrouping}
                        onClick={() => {
                          setDraftJobGrouping((current) =>
                            buildJobGroupingRows(parsedDraftJobIds, current)
                          );
                          setIsJobGroupingModalOpen(true);
                        }}
                      >
                        Configure Samples
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <CustomSelect
                    label="3. sncRNA type"
                    options={sncRnaTypeOptions}
                    value={draftSncRnaType}
                    defaultValue="miRNA"
                    onChange={setDraftSncRnaType}
                  />
                  <MatrixFilePicker
                    label="4. Raw count matrix"
                    fileName={draftMatrixFileName}
                    onFileLoaded={updateMatrixFile}
                  />
                  <div className="load-field load-field--sample-pairing">
                    <span>5. Sample Groups</span>
                    <div className="load-sample-config">
                      <div
                        className={
                          draftPairManifest
                            ? "load-sample-config__summary"
                            : "load-sample-config__hint"
                        }
                      >
                        {draftPairingSummary}
                      </div>
                      <button
                        type="button"
                        className={`load-sample-config__button${
                          canConfigurePairing && !draftPairManifest
                            ? " load-sample-config__button--attention"
                            : ""
                        }`}
                        disabled={!canConfigurePairing}
                        onClick={() => {
                          setDraftSamplePairing((current) =>
                            buildSamplePairRows(draftMatrixSampleNames, current)
                          );
                          setIsPairingModalOpen(true);
                        }}
                      >
                        Configure Samples
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="load-actions">
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => {
                    submitSaveRequest();
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="load-actions__secondary"
                  onClick={() => {
                    if (draftDataSource === "matrix") {
                      loadDemoMatrix();
                      return;
                    }

                    loadDemoJob();
                  }}
                >
                  Demo
                </button>
              </div>
              {saveMessage ? (
                <p className={`load-save-status load-save-status--${saveStatus}`}>
                  {saveMessage}
                </p>
              ) : null}
            </div>
          </section>
        </aside>

        <section className="load-data-main" aria-label="Session details">
          <div
            className="load-progress-slot"
            data-srnameta-progress-slot={config.progressSlotId || "load-data-progress"}
          />
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

          {showMatrixPreview ? (
            <MatrixPreviewTable fileName={matrixFileName} preview={matrixPreview} />
          ) : (
            <section className="load-panel load-panel--guide">
              <p className="load-panel__eyebrow">Workflow Notes</p>
              <h2>Before analysis</h2>
              <ul className="load-guide-list">
                {notes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </div>
      {isPairingModalOpen ? (
        <SamplePairingModal
          pairRows={draftSamplePairing}
          setPairRows={setDraftSamplePairing}
          sampleRoleOptions={sampleRoleOptions}
          canApply={Boolean(draftPairManifest)}
          onClose={() => {
            setIsPairingModalOpen(false);
          }}
        />
      ) : null}
      {isJobGroupingModalOpen ? (
        <JobGroupingModal
          pairRows={draftJobGrouping}
          setPairRows={setDraftJobGrouping}
          jobGroupOptions={jobGroupOptions}
          canApply={Boolean(draftJobGrouping.length)}
          onClose={() => {
            setIsJobGroupingModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
