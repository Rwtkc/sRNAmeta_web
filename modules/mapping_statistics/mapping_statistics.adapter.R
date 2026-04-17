mapping_statistics_shell_config <- function(job_id = "") {
  stats <- read_mapping_statistics(job_id)

  list(
    view = "mapping-statistics",
    mappingStatistics = list(
      eyebrow = "RNA Type Mapping",
      title = "Tags Mapping Statistics",
      description = "Tags mapping statistics on different RNA classes.",
      status = stats$status,
      message = stats$message,
      jobId = stats$job_id,
      sourceFile = stats$file,
      rows = stats$rows,
      totalReads = stats$total_reads,
      totalUniqueTags = stats$total_unique_tags
    )
  )
}

