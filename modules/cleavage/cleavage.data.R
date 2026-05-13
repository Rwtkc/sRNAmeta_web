`%||%` <- function(left, right) {
  if (is.null(left)) {
    right
  } else {
    left
  }
}

cleavage_empty_result <- function(message = "Save a Job ID in Load Data, then run cleavage analysis.") {
  list(
    status = "empty",
    message = message,
    summary = list(),
    visualization = list(),
    exportBundle = list(),
    parameters = list(),
    requestId = NULL,
    outputDir = NULL
  )
}

cleavage_error_result <- function(message, request_id = NULL, output_dir = NULL) {
  list(
    status = "error",
    message = message,
    summary = list(),
    visualization = list(),
    exportBundle = list(),
    parameters = list(),
    requestId = request_id,
    outputDir = output_dir
  )
}

cleavage_ready_result <- function(
  message,
  summary,
  visualization = list(),
  export_bundle = list(),
  parameters = list(),
  request_id = NULL,
  output_dir = NULL
) {
  list(
    status = "ready",
    message = message,
    summary = summary %||% list(),
    visualization = visualization %||% list(),
    exportBundle = export_bundle %||% list(),
    parameters = parameters %||% list(),
    requestId = request_id,
    outputDir = output_dir
  )
}

cleavage_parse_job_ids <- function(value) {
  value <- trimws(as.character(value %||% ""))

  if (!nzchar(value)) {
    return(character())
  }

  job_ids <- unlist(strsplit(value, "[,，;\r\n\t ]+"))
  job_ids <- trimws(job_ids)
  unique(job_ids[nzchar(job_ids)])
}

cleavage_species_code <- function(value) {
  normalized <- tolower(trimws(as.character(value %||% "")))
  lookup <- c(
    human = "hsa",
    hsa = "hsa",
    mouse = "mmu",
    mmu = "mmu",
    rice = "osa",
    osa = "osa",
    maize = "zma",
    zma = "zma"
  )

  lookup[[normalized]] %||% normalized
}

cleavage_default_script_path <- function() {
  app_path("support", "cleavage", "srnameta_trna_cleavage_scoring.R")
}

cleavage_rscript_path <- function() {
  configured <- Sys.getenv("SRNAMETA_RSCRIPT", unset = "")

  if (nzchar(configured)) {
    return(configured)
  }

  candidates <- c(
    file.path(R.home("bin"), "Rscript"),
    file.path(R.home("bin"), "Rscript.exe"),
    Sys.which("Rscript"),
    Sys.which("Rscript.exe")
  )
  candidates <- candidates[nzchar(candidates)]

  existing <- candidates[file.exists(candidates)]

  if (length(existing)) {
    return(existing[[1]])
  }

  candidates[[1]] %||% "Rscript"
}

cleavage_script_path <- function() {
  Sys.getenv("SRNAMETA_CLEAVAGE_SCRIPT", unset = cleavage_default_script_path())
}

cleavage_reference_paths <- function(species) {
  code <- cleavage_species_code(species)
  if (srnameta_is_linux) {
    reference_dir <- srnameta_reference_db_path()
  } else {
    reference_dir <- srnameta_reference_db_path(code)
  }

  list(
    speciesCode = code,
    mature = file.path(reference_dir, sprintf("%s.mature.fa", code)),
    structure = file.path(reference_dir, sprintf("%s.structure.gff", code))
  )
}

cleavage_job_files <- function(job_id) {
  job_dir <- srnameta_job_path(job_id)
  temp_dir <- file.path(job_dir, "temp")

  list(
    jobDir = job_dir,
    tempDir = temp_dir,
    inputBam = file.path(temp_dir, "tRNA1.bam"),
    treatedBam = file.path(temp_dir, "tRNA2.bam"),
    inputBai = file.path(temp_dir, "tRNA1.bam.bai"),
    treatedBai = file.path(temp_dir, "tRNA2.bam.bai"),
    inputBg = file.path(temp_dir, "tRNA1.bam.bg"),
    treatedBg = file.path(temp_dir, "tRNA2.bam.bg"),
    controlReadCoverage = file.path(temp_dir, "tRNA1.bam.readcoverage.txt")
  )
}

cleavage_output_root <- function() {
  app_path("tmp", "cleavage")
}

cleavage_timestamp_string <- function(value = NULL) {
  numeric_value <- suppressWarnings(as.numeric(value %||% NA_real_))

  if (!is.finite(numeric_value)) {
    return(NULL)
  }

  format(floor(numeric_value), scientific = FALSE, trim = TRUE)
}

cleavage_output_dir <- function(job_id, request_id = NULL) {
  run_id <- cleavage_timestamp_string(request_id)

  if (
    length(run_id) != 1L ||
    is.na(run_id) ||
    !nzchar(run_id) ||
    identical(run_id, "NA")
  ) {
    run_id <- cleavage_timestamp_string(as.numeric(Sys.time()) * 1000)
  }

  file.path(cleavage_output_root(), job_id, run_id)
}

cleavage_prepare_output_dir <- function(job_id, request_id = NULL) {
  output_dir <- cleavage_output_dir(job_id, request_id)

  if (dir.exists(output_dir)) {
    unlink(output_dir, recursive = TRUE, force = TRUE)
  }

  dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)
  output_dir
}

cleavage_normalize_request_id <- function(value = NULL) {
  cleavage_timestamp_string(value)
}

cleavage_cleanup_dir <- function(path) {
  path <- trimws(as.character(path %||% ""))

  if (!nzchar(path)) {
    return(invisible(FALSE))
  }

  root <- normalizePath(cleavage_output_root(), winslash = "/", mustWork = FALSE)
  target <- normalizePath(path, winslash = "/", mustWork = FALSE)
  is_within_root <- identical(target, root) || startsWith(target, paste0(root, "/"))

  if (!is_within_root || !dir.exists(path)) {
    return(invisible(FALSE))
  }

  unlink(path, recursive = TRUE, force = TRUE)
  invisible(TRUE)
}

cleavage_required_paths <- function(job_files, reference_paths, script_path, rscript_path) {
  c(
    setNames(unname(unlist(job_files[c(
      "inputBam",
      "treatedBam",
      "inputBai",
      "treatedBai",
      "inputBg",
      "treatedBg",
      "controlReadCoverage"
    )])), c(
      "Input BAM",
      "Treated BAM",
      "Input BAM index",
      "Treated BAM index",
      "Input coverage BG",
      "Treated coverage BG",
      "Control read coverage"
    )),
    c(
      "Reference mature FASTA" = reference_paths$mature,
      "Reference structure GFF" = reference_paths$structure,
      "Cleavage R script" = script_path,
      "Rscript executable" = rscript_path
    )
  )
}

cleavage_missing_paths_message <- function(paths) {
  missing <- names(paths)[!file.exists(paths)]

  if (!length(missing)) {
    return("")
  }

  sprintf(
    "Missing required cleavage inputs: %s.",
    paste(missing, collapse = ", ")
  )
}

cleavage_sanitize_request <- function(request) {
  request <- request %||% list()

  numeric_value <- function(name, default) {
    value <- suppressWarnings(as.numeric(request[[name]] %||% default))

    if (!is.finite(value)) {
      stop(sprintf("Invalid value for %s.", name), call. = FALSE)
    }

    value
  }

  list(
    cleavageRatio = numeric_value("cleavageRatio", 0.2),
    pvalue = numeric_value("pvalue", 0.05),
    foldChange = numeric_value("foldChange", 6),
    inputBaseCoverage = numeric_value("inputBaseCoverage", 10),
    treatedCountCutoff = numeric_value("treatedCountCutoff", 10),
    nonNoise = numeric_value("nonNoise", 3),
    requestedAt = suppressWarnings(as.numeric(request$requestedAt %||% NA_real_))
  )
}

cleavage_count_table_rows <- function(path) {
  if (!file.exists(path)) {
    return(0L)
  }

  lines <- readLines(path, warn = FALSE, encoding = "UTF-8")

  max(length(lines) - 1L, 0L)
}

cleavage_count_lines <- function(path) {
  if (!file.exists(path)) {
    return(0L)
  }

  sum(nzchar(trimws(readLines(path, warn = FALSE, encoding = "UTF-8"))))
}

cleavage_read_fasta_map <- function(path) {
  lines <- readLines(path, warn = FALSE, encoding = "UTF-8")
  headers <- grep("^>", lines)

  if (!length(headers)) {
    return(list())
  }

  entries <- vector("list", length(headers))

  for (index in seq_along(headers)) {
    start <- headers[[index]]
    end <- if (index < length(headers)) headers[[index + 1]] - 1L else length(lines)
    header <- sub("^>", "", lines[[start]])
    name <- sub("\\|.*$", "", trimws(header))
    sequence_lines <- lines[(start + 1L):end]
    sequence_lines <- sequence_lines[nzchar(sequence_lines)]
    entries[[index]] <- list(
      name = name,
      sequence = toupper(paste(sequence_lines, collapse = ""))
    )
  }

  stats::setNames(lapply(entries, `[[`, "sequence"), vapply(entries, `[[`, character(1), "name"))
}

cleavage_read_structure_map <- function(path) {
  structure_table <- utils::read.delim(
    path,
    header = FALSE,
    sep = "\t",
    stringsAsFactors = FALSE,
    quote = "",
    comment.char = ""
  )

  if (!nrow(structure_table)) {
    return(list())
  }

  names(structure_table)[1:5] <- c("tRNA", "source", "feature", "start", "end")
  structure_table$feature <- gsub("_", "", structure_table$feature)
  structure_table <- structure_table[structure_table$feature %in% c("codon", "Dloop", "Aloop", "Tloop"), , drop = FALSE]

  split(
    lapply(seq_len(nrow(structure_table)), function(index) {
      row <- structure_table[index, , drop = FALSE]
      list(
        type = row$feature[[1]],
        start = as.integer(row$start[[1]]),
        end = as.integer(row$end[[1]])
      )
    }),
    structure_table$tRNA
  )
}

cleavage_build_visualization <- function(output_dir, reference_paths, parameters) {
  figure_path <- file.path(output_dir, "figure_data.txt")

  if (!file.exists(figure_path)) {
    return(list())
  }

  figure_data <- utils::read.delim(
    figure_path,
    header = TRUE,
    sep = "\t",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  if (!nrow(figure_data) || !"tRNA" %in% names(figure_data)) {
    return(list())
  }

  sequence_map <- cleavage_read_fasta_map(reference_paths$mature)
  structure_map <- cleavage_read_structure_map(reference_paths$structure)
  trna_ids <- unique(figure_data$tRNA)
  entries <- lapply(trna_ids, function(trna_id) {
    subset <- figure_data[figure_data$tRNA == trna_id, , drop = FALSE]
    subset <- subset[order(as.integer(subset$site)), , drop = FALSE]
    sequence <- as.character(sequence_map[[trna_id]] %||% "")
    sequence_letters <- if (nzchar(sequence)) strsplit(sequence, "", fixed = TRUE)[[1]] else character()

    points <- lapply(seq_len(nrow(subset)), function(index) {
      row <- subset[index, , drop = FALSE]
      raw_score <- suppressWarnings(as.numeric(row$faivalue_foldChange[[1]]))
      pvalue <- suppressWarnings(as.numeric(row$pvalue[[1]]))
      display_score <- raw_score

      if (!is.finite(display_score)) {
        display_score <- 0
      }

      if (!is.finite(pvalue) || display_score < parameters$nonNoise || pvalue >= parameters$pvalue) {
        display_score <- 0
      }

      list(
        site = as.integer(row$site[[1]]),
        score = raw_score,
        displayScore = display_score,
        pvalue = pvalue,
        coverageInput = suppressWarnings(as.numeric(row$coverage_input[[1]])),
        countInput = suppressWarnings(as.numeric(row$count_input[[1]])),
        cleavageInput = suppressWarnings(as.numeric(row$faivalue_input[[1]])),
        coverageTreated = suppressWarnings(as.numeric(row$coverage_treated[[1]])),
        countTreated = suppressWarnings(as.numeric(row$count_treated[[1]])),
        cleavageTreated = suppressWarnings(as.numeric(row$faivalue_treated[[1]])),
        base = if (as.integer(row$site[[1]]) <= length(sequence_letters)) sequence_letters[[as.integer(row$site[[1]])]] else ""
      )
    })

    list(
      id = trna_id,
      sequence = sequence,
      length = nchar(sequence),
      annotations = structure_map[[trna_id]] %||% list(),
      points = points
    )
  })

  list(
    entries = entries,
    defaultTrna = trna_ids[[1]],
    signature = paste(trna_ids, collapse = "|")
  )
}

cleavage_collect_summary <- function(output_dir, species_code) {
  txt_files <- list.files(output_dir, pattern = "\\.txt$", full.names = TRUE)
  json_files <- list.files(output_dir, pattern = "\\.json$", full.names = TRUE)
  trna_list_path <- file.path(output_dir, "tRNA_list.txt")
  trna_count <- cleavage_count_lines(trna_list_path)

  list(
    speciesCode = species_code,
    chartCount = trna_count,
    txtCount = length(txt_files),
    jsonCount = length(json_files),
    figureRows = cleavage_count_table_rows(file.path(output_dir, "figure_data.txt")),
    zeroRows = cleavage_count_table_rows(file.path(output_dir, "clean_result_control_iszero.txt")),
    nonZeroRows = cleavage_count_table_rows(file.path(output_dir, "clean_result_control_notzero.txt")),
    hasZip = file.exists(file.path(output_dir, "results.zip"))
  )
}

cleavage_read_export_text <- function(path) {
  if (!file.exists(path)) {
    return(NULL)
  }

  paste(readLines(path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}

cleavage_read_export_csv <- function(path) {
  if (!file.exists(path)) {
    return(NULL)
  }

  table_data <- utils::read.delim(
    path,
    header = TRUE,
    sep = "\t",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  output <- character()
  connection <- textConnection("output", "w", local = TRUE)
  on.exit(close(connection), add = TRUE)

  utils::write.table(
    table_data,
    file = connection,
    sep = ",",
    quote = TRUE,
    row.names = FALSE,
    col.names = TRUE
  )

  paste(output, collapse = "\n")
}

cleavage_collect_export_bundle <- function(output_dir, job_id = NULL) {
  source_name <- "figure_data.txt"
  export_name <- "figure_data.csv"
  content <- cleavage_read_export_csv(file.path(output_dir, source_name))
  resolved_job_id <- job_id %||% basename(dirname(output_dir))

  list(
    jobId = resolved_job_id,
    filename = sprintf("srnameta_cleavage_%s_figure_data.csv", resolved_job_id),
    file = list(
      name = export_name,
      content = content %||% ""
    )
  )
}

cleavage_progress_set <- function(progress, value, detail, message = "Running Cleavage Analysis") {
  if (is.null(progress)) {
    return(invisible(NULL))
  }

  progress$set(
    value = value,
    message = message,
    detail = detail
  )
}

cleavage_progress_detail <- function(percent, text) {
  sprintf("%d%% | %s", as.integer(round(percent * 100)), text)
}

cleavage_run_script_with_progress <- function(rscript_path, args, progress, log_file) {
  activity_labels <- c(
    "Launching cleavage scoring engine",
    "Reading BAM-derived coverage tracks",
    "Computing per-site cleavage scores",
    "Filtering non-noise cleavage candidates",
    "Writing figure-ready cleavage tables"
  )

  if (!requireNamespace("processx", quietly = TRUE)) {
    cleavage_progress_set(
      progress,
      0.45,
      cleavage_progress_detail(0.45, "Cleavage scoring script is running")
    )

    status <- suppressWarnings(
      system2(
        rscript_path,
        args = args,
        stdout = log_file,
        stderr = log_file,
        wait = TRUE
      )
    )

    return(list(
      status = status,
      output = character(),
      error = character()
    ))
  }

  process <- processx::process$new(
    command = rscript_path,
    args = args,
    stdout = "|",
    stderr = "|",
    cleanup = TRUE,
    windows_hide_window = TRUE
  )

  output_lines <- character()
  error_lines <- character()
  start_time <- Sys.time()
  last_progress_value <- 0.45

  on.exit({
    if (process$is_alive()) {
      process$kill()
    }
  }, add = TRUE)

  while (process$is_alive()) {
    Sys.sleep(0.4)

    output_lines <- c(output_lines, process$read_output_lines())
    error_lines <- c(error_lines, process$read_error_lines())

    elapsed <- as.numeric(difftime(Sys.time(), start_time, units = "secs"))
    raw_progress <- 0.45 + min(0.39, elapsed * 0.008)
    progress_value <- max(last_progress_value, raw_progress)
    progress_value <- min(progress_value, 0.84)
    activity_index <- min(length(activity_labels), max(1L, floor(elapsed / 4) + 1L))
    activity_label <- activity_labels[[activity_index]]

    cleavage_progress_set(
      progress,
      progress_value,
      cleavage_progress_detail(progress_value, activity_label)
    )

    last_progress_value <- progress_value
  }

  output_lines <- c(output_lines, process$read_output_lines())
  error_lines <- c(error_lines, process$read_error_lines())
  combined_lines <- c(output_lines, error_lines)

  if (length(combined_lines)) {
    writeLines(combined_lines, con = log_file, useBytes = TRUE)
  } else {
    writeLines(character(), con = log_file, useBytes = TRUE)
  }

  list(
    status = process$get_exit_status() %||% 1L,
    output = output_lines,
    error = error_lines
  )
}

run_cleavage_analysis <- function(request, data_source, job_id, species, progress = NULL) {
  sanitized <- cleavage_sanitize_request(request)
  request_id <- cleavage_normalize_request_id(sanitized$requestedAt)

  if (!identical(trimws(as.character(data_source %||% "")), "jobid")) {
    return(cleavage_error_result(
      "Cleavage analysis currently supports only the saved Job ID mode from Load Data.",
      request_id = request_id
    ))
  }

  job_ids <- cleavage_parse_job_ids(job_id)

  if (length(job_ids) != 1L) {
    return(cleavage_error_result(
      "Cleavage analysis requires exactly one saved Job ID in Load Data.",
      request_id = request_id
    ))
  }

  cleavage_progress_set(
    progress,
    0.08,
    cleavage_progress_detail(0.08, "Resolving saved Job ID inputs")
  )

  job_files <- cleavage_job_files(job_ids[[1]])
  output_dir <- cleavage_prepare_output_dir(job_ids[[1]], request_id)
  reference_paths <- cleavage_reference_paths(species)
  script_path <- cleavage_script_path()
  rscript_path <- cleavage_rscript_path()
  required_paths <- cleavage_required_paths(job_files, reference_paths, script_path, rscript_path)
  missing_message <- cleavage_missing_paths_message(required_paths)

  if (nzchar(missing_message)) {
    cleavage_cleanup_dir(output_dir)
    return(cleavage_error_result(missing_message, request_id = request_id))
  }

  cleavage_progress_set(
    progress,
    0.16,
    cleavage_progress_detail(0.16, "Checking BAM, index, and coverage files")
  )

  cleavage_progress_set(
    progress,
    0.24,
    cleavage_progress_detail(0.24, "Validating reference FASTA and structure annotation")
  )

  cleavage_progress_set(
    progress,
    0.32,
    cleavage_progress_detail(0.32, "Preparing writable cleavage output workspace")
  )

  log_file <- tempfile(pattern = "srnameta-cleavage-", fileext = ".log")
  on.exit(unlink(log_file), add = TRUE)

  args <- c(
    script_path,
    reference_paths$mature,
    reference_paths$structure,
    job_files$inputBam,
    job_files$treatedBam,
    output_dir,
    format(sanitized$cleavageRatio, scientific = FALSE, trim = TRUE),
    format(sanitized$pvalue, scientific = FALSE, trim = TRUE),
    format(sanitized$foldChange, scientific = FALSE, trim = TRUE),
    job_files$controlReadCoverage,
    format(sanitized$inputBaseCoverage, scientific = FALSE, trim = TRUE),
    format(sanitized$treatedCountCutoff, scientific = FALSE, trim = TRUE),
    format(sanitized$nonNoise, scientific = FALSE, trim = TRUE)
  )

  cleavage_progress_set(
    progress,
    0.4,
    cleavage_progress_detail(0.4, "Preparing cleavage scoring command")
  )

  script_result <- cleavage_run_script_with_progress(
    rscript_path = rscript_path,
    args = args,
    progress = progress,
    log_file = log_file
  )
  status <- script_result$status

  if (!identical(status, 0L)) {
    log_lines <- if (file.exists(log_file)) {
      readLines(log_file, warn = FALSE, encoding = "UTF-8")
    } else {
      character()
    }
    tail_lines <- tail(log_lines[nzchar(trimws(log_lines))], 8)
    detail <- if (length(tail_lines)) {
      paste(tail_lines, collapse = " ")
    } else {
      "The cleavage R script exited with a non-zero status."
    }

    return(cleavage_error_result(
      sprintf("Cleavage analysis failed. %s", detail),
      request_id = request_id,
      output_dir = output_dir
    ))
  }

  cleavage_progress_set(
    progress,
    0.88,
    cleavage_progress_detail(0.88, "Reading cleavage result tables")
  )

  summary <- cleavage_collect_summary(output_dir, reference_paths$speciesCode)

  cleavage_progress_set(
    progress,
    0.94,
    cleavage_progress_detail(0.94, "Preparing browser visualization data")
  )

  visualization <- cleavage_build_visualization(output_dir, reference_paths, sanitized)

  cleavage_progress_set(
    progress,
    0.96,
    cleavage_progress_detail(0.96, "Preparing export bundle")
  )

  export_bundle <- cleavage_collect_export_bundle(output_dir, job_ids[[1]])

  cleavage_progress_set(
    progress,
    0.98,
    cleavage_progress_detail(0.98, "Finalizing cleavage output")
  )

  cleavage_ready_result(
    "Cleavage analysis completed.",
    summary = summary,
    visualization = visualization,
    export_bundle = export_bundle,
    parameters = sanitized,
    request_id = request_id,
    output_dir = output_dir
  )
}
