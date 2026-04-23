mapping_statistics_shell_config <- function(job_id = "") {
  stats <- read_mapping_statistics(job_id)
  job_summary <- if (length(stats$job_ids) > 1) {
    sprintf("%d job IDs", length(stats$job_ids))
  } else {
    stats$job_id
  }

  list(
    view = "mapping-statistics",
    mappingStatistics = list(
      eyebrow = "Mapping Statistics",
      title = "RNA Class Mapping Statistics",
      description = if (identical(stats$mode, "multi")) {
        "Compare read and unique-tag mapping statistics across saved Job IDs."
      } else {
        "Review read and unique-tag mapping statistics across RNA classes."
      },
      mode = stats$mode,
      status = stats$status,
      message = stats$message,
      jobId = stats$job_id,
      jobIds = unname(stats$job_ids),
      jobSummary = job_summary,
      sourceFile = stats$file,
      rows = stats$rows,
      jobs = stats$jobs,
      totalReads = stats$total_reads,
      totalUniqueTags = stats$total_unique_tags
    )
  )
}
