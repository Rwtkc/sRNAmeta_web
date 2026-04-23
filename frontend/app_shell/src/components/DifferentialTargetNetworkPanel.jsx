import { useEffect, useMemo, useState } from "react";

function formatInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "0";
}

function formatScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : "NA";
}

function pageWindow(currentPage, totalPages) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function DifferentialTargetNetworkPanel({ targetNetwork }) {
  const status = targetNetwork?.status || "empty";
  const summary = targetNetwork?.summary || {};
  const rows = Array.isArray(targetNetwork?.rows) ? targetNetwork.rows : [];
  const stringUrl = targetNetwork?.stringUrl || "";
  const hasRows = status === "ready" && rows.length > 0;
  const [draftSearch, setDraftSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const pageSize = 10;

  useEffect(() => {
    setDraftSearch("");
    setSearchTerm("");
    setPage(1);
    setPageInput("1");
  }, [targetNetwork]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const orderedRows = [...rows].sort((left, right) => {
      const supportDifference = Number(right.supportMirnas || 0) - Number(left.supportMirnas || 0);
      if (supportDifference !== 0) {
        return supportDifference;
      }

      const bestLeft = Number.isFinite(Number(left.bestWeightedContextScore))
        ? Number(left.bestWeightedContextScore)
        : Number.POSITIVE_INFINITY;
      const bestRight = Number.isFinite(Number(right.bestWeightedContextScore))
        ? Number(right.bestWeightedContextScore)
        : Number.POSITIVE_INFINITY;

      if (bestLeft !== bestRight) {
        return bestLeft - bestRight;
      }

      return String(left.gene || "").localeCompare(String(right.gene || ""));
    });

    if (!normalizedSearch) {
      return orderedRows;
    }

    return orderedRows.filter((row) =>
      [
        row.gene,
        row.geneId,
        row.exampleMirnas
      ]
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

  return (
    <section className="diff-panel diff-panel--target-network">
      <p className="diff-panel__eyebrow">Target Gene Network</p>
      <div className="diff-target-network__header">
        <div>
          <h2 className="diff-target-network__title">STRING target genes</h2>
          <p className="diff-target-network__copy">
            Differential miRNAs are mapped to predicted target genes before building a STRING gene list.
          </p>
        </div>
        {stringUrl ? (
          <a
            className="diff-target-network__link"
            href={stringUrl}
            target="_blank"
            rel="noreferrer"
          >
            Query all in STRING
          </a>
        ) : null}
      </div>

      {hasRows ? (
        <>
          <div className="diff-summary-grid diff-summary-grid--target-network">
            <div className="diff-summary-card">
              <span>Differential miRNAs</span>
              <strong>{formatInteger(summary.differentialMirnas)}</strong>
            </div>
            <div className="diff-summary-card">
              <span>Mapped miRNAs</span>
              <strong>{formatInteger(summary.mappedMirnas)}</strong>
            </div>
            <div className="diff-summary-card">
              <span>Target genes</span>
              <strong>{formatInteger(summary.targetGenes)}</strong>
            </div>
            <div className="diff-summary-card">
              <span>Genes sent to STRING</span>
              <strong>{formatInteger(summary.stringGenes)}</strong>
            </div>
          </div>

          <div className="diff-data-panel">
            <form
              className="diff-data-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchTerm(draftSearch.trim());
                setPage(1);
              }}
            >
              <label className="diff-search-field">
                <span>Search</span>
                <input
                  type="search"
                  value={draftSearch}
                  placeholder="Gene symbol, Ensembl ID, or miRNA"
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
              <div className="diff-empty-plot">No target genes matched the current search.</div>
            ) : (
              <div className="diff-table-shell">
                <table className="diff-table diff-table--target-network">
                  <thead>
                    <tr>
                      <th>Gene symbol</th>
                      <th>Ensembl ID</th>
                      <th>Support miRNAs</th>
                      <th>Up miRNAs</th>
                      <th>Down miRNAs</th>
                      <th>Best weighted context++ score</th>
                      <th>Mean weighted context++ score</th>
                      <th>Example miRNAs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={`${row.gene}::${row.geneId || ""}`}>
                        <td>
                          {row.stringUrl ? (
                            <a
                              className="diff-target-network__gene-link"
                              href={row.stringUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.gene}
                            </a>
                          ) : (
                            row.gene
                          )}
                        </td>
                        <td>{row.geneId || "NA"}</td>
                        <td>{formatInteger(row.supportMirnas)}</td>
                        <td>{formatInteger(row.upMirnas)}</td>
                        <td>{formatInteger(row.downMirnas)}</td>
                        <td>{formatScore(row.bestWeightedContextScore)}</td>
                        <td>{formatScore(row.meanWeightedContextScore)}</td>
                        <td>{row.exampleMirnas || "NA"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="diff-data-footer">
              <div className="diff-data-footer__summary">
                <span>
                  Showing {formatInteger(firstRow)}-{formatInteger(lastRow)} of {formatInteger(filteredRows.length)} target genes
                </span>
                {filteredRows.length !== rows.length ? (
                  <small>Total: {formatInteger(rows.length)} target genes</small>
                ) : null}
              </div>
              <div className="diff-pagination" aria-label="Target gene table pagination">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Prev
                </button>
                {pageWindow(safePage, totalPages).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    className={pageNumber === safePage ? "is-active" : ""}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setPage(safePage + 1)}
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
                    setPage(nextPage);
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
        </>
      ) : (
        <div className={`diff-target-network__message diff-target-network__message--${status}`}>
          {targetNetwork?.message || "Run differential analysis to prepare target genes for STRING."}
        </div>
      )}
    </section>
  );
}
