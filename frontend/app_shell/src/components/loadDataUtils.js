export const MAX_DIFFERENTIAL_JOB_IDS = 4;

export function parseJobIds(value) {
  return [
    ...new Set(
      (value || "")
        .split(/[\s,，;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

export function limitDifferentialJobIds(jobIds) {
  return (jobIds || []).slice(0, MAX_DIFFERENTIAL_JOB_IDS);
}

export function parseMatrixHeader(text) {
  const firstLine = (text || "").split(/\r\n|\n|\r/).find(Boolean) || "";
  const delimiter = firstLine.includes(",") ? "," : firstLine.includes("\t") ? "\t" : /\s+/;
  const columns = firstLine.split(delimiter).map((item) => item.trim()).filter(Boolean);

  return columns.slice(1);
}

export function parseMatrixPreview(text, rowLimit = 10) {
  const lines = String(text || "")
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  const firstLine = lines[0];
  const delimiter = firstLine.includes(",") ? "," : firstLine.includes("\t") ? "\t" : /\s+/;
  const splitLine = (line) =>
    line
      .split(delimiter)
      .map((item) => item.trim())
      .filter((item, index, array) => !(delimiter instanceof RegExp && item === "" && index < array.length - 1));

  const header = splitLine(firstLine);
  const rows = lines.slice(1, rowLimit + 1).map(splitLine);
  const columnCount = Math.max(header.length, ...rows.map((row) => row.length));
  const normalizedHeader = Array.from({ length: columnCount }, (_, index) => header[index] || "");
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] || "")
  );

  return {
    header: normalizedHeader,
    rows: normalizedRows
  };
}

export function buildSamplePairRows(sampleNames, existingRows = []) {
  const existingBySample = new Map(existingRows.map((row) => [row.sampleName, row]));

  return sampleNames.map((sampleName) => {
    const existing = existingBySample.get(sampleName);

    return {
      sampleName,
      groupRole: existing?.groupRole || "Unused"
    };
  });
}

export function buildJobGroupingRows(jobIds, existingRows = []) {
  const differentialJobIds = limitDifferentialJobIds(jobIds);
  const existingBySample = new Map(existingRows.map((row) => [row.sampleName, row]));
  const splitIndex = Math.max(1, Math.floor(differentialJobIds.length / 2));

  return differentialJobIds.map((sampleName, index) => {
    const existing = existingBySample.get(sampleName);

    return {
      sampleName,
      groupRole: existing?.groupRole || (index < splitIndex ? "Control" : "Treatment")
    };
  });
}

export function buildSamplePairManifest(pairRows, sampleNames) {
  if (!sampleNames.length || pairRows.length !== sampleNames.length) {
    return null;
  }

  const expectedSamples = new Set(sampleNames);
  const rowSamples = pairRows.map((row) => row.sampleName);

  if (new Set(rowSamples).size !== rowSamples.length) {
    return null;
  }

  if (!rowSamples.every((sample) => expectedSamples.has(sample))) {
    return null;
  }

  const roles = pairRows.map((row) => row.groupRole || "Unused");

  if (!roles.every((role) => role === "Control" || role === "Treatment" || role === "Unused")) {
    return null;
  }

  const selectedRows = pairRows.filter(
    (row) => row.groupRole === "Control" || row.groupRole === "Treatment"
  );
  const controlCount = selectedRows.filter((row) => row.groupRole === "Control").length;
  const treatmentCount = selectedRows.filter((row) => row.groupRole === "Treatment").length;

  if (controlCount < 2 || treatmentCount < 2) {
    return null;
  }

  return selectedRows.map((row) => ({
    sample_name: row.sampleName,
    group_role: row.groupRole
  }));
}

export function samplesForRole(pairManifest, role) {
  return (pairManifest || [])
    .filter((row) => row.group_role === role)
    .map((row) => row.sample_name)
    .join(", ");
}

export function normalizeSamplePairRows(sampleNames, pairRows = []) {
  const pairMap = new Map(pairRows.map((row) => [row.sampleName, row.groupRole]));

  return sampleNames.map((sampleName) => ({
    sampleName,
    groupRole: pairMap.get(sampleName) || "Unused"
  }));
}
