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

parse_mapping_job_ids <- function(job_id_input) {
  job_id_input <- trimws(as.character(job_id_input))

  if (!nzchar(job_id_input)) {
    return(character())
  }

  job_ids <- unlist(strsplit(job_id_input, "[,，;\r\n\t ]+"))
  job_ids <- trimws(job_ids)
  job_ids <- job_ids[nzchar(job_ids)]

  unique(job_ids)
}

read_single_mapping_statistics <- function(job_id) {
  job_id <- trimws(as.character(job_id))

  if (!nzchar(job_id)) {
    return(list(
      status = "empty",
      message = "Enter one or more Job IDs in Load Data to view mapping statistics.",
      job_id = "",
      file = NULL,
      rows = list(),
      total_reads = 0,
      total_unique_tags = 0
    ))
  }

  job_path <- tryCatch(
    srnameta_job_path(job_id),
    error = function(error) {
      error
    }
  )

  if (inherits(job_path, "error")) {
    return(list(
      status = "invalid-job-id",
      message = sprintf("Invalid Job ID: %s.", job_id),
      job_id = job_id,
      file = NULL,
      rows = list(),
      total_reads = 0,
      total_unique_tags = 0
    ))
  }

  file_path <- file.path(job_path, "allmappingstat.txt")

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

read_mapping_statistics <- function(job_id_input) {
  job_ids <- parse_mapping_job_ids(job_id_input)

  if (length(job_ids) == 0) {
    return(list(
      status = "empty",
      mode = "single",
      message = "Enter one or more Job IDs in Load Data to view mapping statistics.",
      job_id = "",
      job_ids = character(),
      file = NULL,
      rows = list(),
      jobs = list(),
      total_reads = 0,
      total_unique_tags = 0
    ))
  }

  if (length(job_ids) == 1) {
    stats <- read_single_mapping_statistics(job_ids[[1]])
    stats$mode <- "single"
    stats$job_ids <- job_ids
    stats$jobs <- list(
      list(
        jobId = stats$job_id,
        sourceFile = stats$file,
        rows = stats$rows,
        totalReads = stats$total_reads,
        totalUniqueTags = stats$total_unique_tags
      )
    )
    return(stats)
  }

  stats_list <- lapply(job_ids, read_single_mapping_statistics)
  invalid_index <- which(vapply(stats_list, function(item) item$status != "ready", logical(1)))

  if (length(invalid_index) > 0) {
    invalid_stats <- stats_list[[invalid_index[[1]]]]
    invalid_stats$mode <- "multi"
    invalid_stats$job_ids <- job_ids
    invalid_stats$jobs <- list()
    invalid_stats$message <- sprintf(
      "Failed while loading multiple Job IDs. %s",
      invalid_stats$message
    )
    return(invalid_stats)
  }

  jobs <- lapply(stats_list, function(stats) {
    list(
      jobId = stats$job_id,
      sourceFile = stats$file,
      rows = stats$rows,
      totalReads = stats$total_reads,
      totalUniqueTags = stats$total_unique_tags
    )
  })

  list(
    status = "ready",
    mode = "multi",
    message = sprintf("Loaded mapping statistics for %d Job IDs.", length(job_ids)),
    job_id = paste(job_ids, collapse = ", "),
    job_ids = job_ids,
    file = NULL,
    rows = list(),
    jobs = jobs,
    total_reads = sum(vapply(stats_list, function(item) item$total_reads, numeric(1))),
    total_unique_tags = sum(vapply(stats_list, function(item) item$total_unique_tags, numeric(1)))
  )
}
