mapping_statistics_label <- function(type) {
  labels <- c(
    miRNA = "miRNA",
    tRNA = "tRNA",
    rRNA = "rRNA",
    snRNA = "snRNA",
    snoRNA = "snoRNA",
    other_Rfam = "other RFAM ncRNA",
    mRNA = "mRNA",
    lncRNA = "lncRNA",
    circRNA = "circRNA",
    piRNA = "piRNA",
    other = "other mapping",
    non_mapping = "non-mapping"
  )

  ifelse(type %in% names(labels), unname(labels[type]), type)
}

read_mapping_statistics <- function(job_id) {
  job_id <- trimws(as.character(job_id))

  if (!nzchar(job_id)) {
    return(list(
      status = "empty",
      message = "Enter a Job ID in Load Data to view mapping statistics.",
      job_id = "",
      file = NULL,
      rows = list(),
      total_reads = 0,
      total_unique_tags = 0
    ))
  }

  file_path <- file.path(srnameta_job_path(job_id), "allmappingstat.txt")

  if (!file.exists(file_path)) {
    return(list(
      status = "missing",
      message = sprintf("Cannot find allmappingstat.txt for Job ID %s.", job_id),
      job_id = job_id,
      file = file_path,
      rows = list(),
      total_reads = 0,
      total_unique_tags = 0
    ))
  }

  raw_data <- tryCatch(
    utils::read.table(
      file_path,
      header = FALSE,
      sep = "",
      stringsAsFactors = FALSE,
      col.names = c("type", "unique_tags", "total_reads")
    ),
    error = function(error) {
      error
    }
  )

  if (inherits(raw_data, "error")) {
    return(list(
      status = "error",
      message = sprintf("Failed to read allmappingstat.txt: %s", raw_data$message),
      job_id = job_id,
      file = file_path,
      rows = list(),
      total_reads = 0,
      total_unique_tags = 0
    ))
  }

  raw_data$unique_tags <- suppressWarnings(as.numeric(raw_data$unique_tags))
  raw_data$total_reads <- suppressWarnings(as.numeric(raw_data$total_reads))
  raw_data <- raw_data[!is.na(raw_data$total_reads) & raw_data$total_reads > 0, , drop = FALSE]

  total_reads <- sum(raw_data$total_reads)
  total_unique_tags <- sum(raw_data$unique_tags, na.rm = TRUE)

  if (nrow(raw_data) == 0 || total_reads <= 0) {
    return(list(
      status = "empty-data",
      message = "allmappingstat.txt does not contain positive mapping counts.",
      job_id = job_id,
      file = file_path,
      rows = list(),
      total_reads = 0,
      total_unique_tags = 0
    ))
  }

  raw_data$label <- mapping_statistics_label(raw_data$type)
  raw_data$percent <- raw_data$total_reads / total_reads * 100
  raw_data <- raw_data[order(raw_data$total_reads, decreasing = TRUE), , drop = FALSE]

  rows <- lapply(seq_len(nrow(raw_data)), function(index) {
    list(
      type = raw_data$type[[index]],
      label = raw_data$label[[index]],
      uniqueTags = raw_data$unique_tags[[index]],
      totalReads = raw_data$total_reads[[index]],
      percent = raw_data$percent[[index]]
    )
  })

  list(
    status = "ready",
    message = "Mapping statistics loaded.",
    job_id = job_id,
    file = file_path,
    rows = rows,
    total_reads = total_reads,
    total_unique_tags = total_unique_tags
  )
}

