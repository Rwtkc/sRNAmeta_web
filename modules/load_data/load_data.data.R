`%||%` <- function(left, right) {
  if (is.null(left)) {
    right
  } else {
    left
  }
}

load_data_default_saved_state <- function() {
  list(
    data_source = "jobid",
    job_id = "",
    species = "human",
    sncrna_type = "miRNA",
    control_samples = "",
    treatment_samples = "",
    matrix_file_name = "",
    matrix_file_text = "",
    matrix_sample_names = character(),
    sample_pairing = list(),
    job_grouping = list(),
    detected_species = "",
    used_job_ids = character(),
    ignored_job_ids = character()
  )
}

load_data_default_feedback <- function() {
  list(
    status = "idle",
    message = "",
    version = 0L
  )
}

load_data_parse_job_ids <- function(value) {
  value <- trimws(as.character(value %||% ""))

  if (!nzchar(value)) {
    return(character())
  }

  job_ids <- unlist(strsplit(value, "[,，;\r\n\t ]+"))
  job_ids <- trimws(job_ids)
  job_ids <- job_ids[nzchar(job_ids)]

  unique(job_ids)
}

load_data_max_differential_job_ids <- function() {
  4L
}

load_data_limit_differential_job_ids <- function(job_ids) {
  utils::head(job_ids, load_data_max_differential_job_ids())
}

load_data_species_dictionary <- function() {
  list(
    human = c("human", "hsa", "homo sapiens"),
    mouse = c("mouse", "mmu", "mus musculus"),
    rice = c("rice", "osa", "oryza sativa"),
    maize = c("maize", "zma", "zea mays")
  )
}

load_data_normalize_species <- function(value) {
  normalized <- tolower(trimws(as.character(value %||% "")))

  if (!nzchar(normalized)) {
    return("")
  }

  dictionary <- load_data_species_dictionary()

  for (species_name in names(dictionary)) {
    if (normalized %in% dictionary[[species_name]]) {
      return(species_name)
    }
  }

  ""
}

load_data_species_label <- function(value) {
  labels <- c(
    human = "Human",
    mouse = "Mouse",
    rice = "Rice",
    maize = "Maize"
  )

  labels[[value]] %||% value
}

load_data_sncrna_type_dictionary <- function() {
  list(
    miRNA = c("mirna"),
    isomiR = c("isomir"),
    phasiRNA = c("phasirna"),
    piRNA = c("pirna"),
    tRF = c("trf"),
    tRNA = c("trna"),
    snRNA = c("snrna"),
    snoRNA = c("snorna"),
    rRNA = c("rrna")
  )
}

load_data_normalize_sncrna_type <- function(value) {
  normalized <- tolower(trimws(as.character(value %||% "")))

  if (!nzchar(normalized)) {
    return("")
  }

  dictionary <- load_data_sncrna_type_dictionary()

  for (type_name in names(dictionary)) {
    if (normalized %in% dictionary[[type_name]]) {
      return(type_name)
    }
  }

  ""
}

load_data_sncrna_type_label <- function(value) {
  normalized <- load_data_normalize_sncrna_type(value)

  if (!nzchar(normalized)) {
    return("")
  }

  normalized
}

load_data_parse_sample_list <- function(value) {
  value <- trimws(as.character(value %||% ""))

  if (!nzchar(value)) {
    return(character())
  }

  samples <- unlist(strsplit(value, "[,，;\r\n\t ]+"))
  samples <- trimws(samples)
  samples[nzchar(samples)]
}

load_data_role_rows_to_strings <- function(rows) {
  if (!length(rows)) {
    return(list(control = "", treatment = ""))
  }

  normalized_rows <- Filter(function(row) {
    is.list(row) && nzchar(trimws(as.character(row$sampleName %||% "")))
  }, rows)

  control <- vapply(normalized_rows, function(row) {
    if (identical(row$groupRole %||% "", "Control")) {
      trimws(as.character(row$sampleName))
    } else {
      ""
    }
  }, character(1))
  treatment <- vapply(normalized_rows, function(row) {
    if (identical(row$groupRole %||% "", "Treatment")) {
      trimws(as.character(row$sampleName))
    } else {
      ""
    }
  }, character(1))

  list(
    control = paste(control[nzchar(control)], collapse = ", "),
    treatment = paste(treatment[nzchar(treatment)], collapse = ", ")
  )
}

load_data_build_pair_rows <- function(sample_names, control_samples, treatment_samples) {
  control_set <- unique(load_data_parse_sample_list(control_samples))
  treatment_set <- unique(load_data_parse_sample_list(treatment_samples))

  lapply(sample_names, function(sample_name) {
    list(
      sampleName = sample_name,
      groupRole = if (sample_name %in% control_set) {
        "Control"
      } else if (sample_name %in% treatment_set) {
        "Treatment"
      } else {
        "Unused"
      }
    )
  })
}

load_data_build_job_grouping <- function(job_ids, incoming_rows = list()) {
  selected_job_ids <- load_data_limit_differential_job_ids(job_ids)
  existing_roles <- list()
  split_index <- max(1, floor(length(selected_job_ids) / 2))

  if (length(incoming_rows)) {
    for (row in incoming_rows) {
      sample_name <- trimws(as.character(row$sampleName %||% ""))
      group_role <- trimws(as.character(row$groupRole %||% ""))

      if (nzchar(sample_name) && nzchar(group_role)) {
        existing_roles[[sample_name]] <- group_role
      }
    }
  }

  lapply(seq_along(selected_job_ids), function(index) {
    job_id <- selected_job_ids[[index]]
    default_role <- if (index <= split_index) "Control" else "Treatment"

    list(
      sampleName = job_id,
      groupRole = existing_roles[[job_id]] %||% default_role
    )
  })
}

load_data_read_status_json <- function(job_path) {
  status_file <- file.path(job_path, "status.json")

  if (!file.exists(status_file)) {
    return(NULL)
  }

  tryCatch(
    jsonlite::fromJSON(status_file, simplifyVector = TRUE),
    error = function(...) NULL
  )
}

load_data_read_parameter_species <- function(job_path) {
  parameter_file <- file.path(job_path, "parameters.txt")

  if (!file.exists(parameter_file)) {
    return("")
  }

  lines <- tryCatch(readLines(parameter_file, warn = FALSE, encoding = "UTF-8"), error = function(...) character())

  if (!length(lines)) {
    return("")
  }

  species_line <- grep("^Species\\s*:", lines, value = TRUE, ignore.case = TRUE)

  if (!length(species_line)) {
    return("")
  }

  trimws(sub("^Species\\s*:\\s*", "", species_line[[1]], ignore.case = TRUE))
}

load_data_job_completion <- function(job_path) {
  status_payload <- load_data_read_status_json(job_path)

  if (is.list(status_payload)) {
    current <- tolower(trimws(as.character(status_payload$current %||% "")))
    message <- tolower(trimws(as.character(status_payload$message %||% "")))

    if (grepl("job complete", current, fixed = TRUE) || grepl("job completed", message, fixed = TRUE)) {
      return(list(complete = TRUE, source = "status.json"))
    }
  }

  log_file <- file.path(job_path, "log.txt")

  if (!file.exists(log_file)) {
    return(list(complete = FALSE, source = "none"))
  }

  log_lines <- tryCatch(readLines(log_file, warn = FALSE, encoding = "UTF-8"), error = function(...) character())
  last_line <- if (length(log_lines)) tolower(trimws(log_lines[[length(log_lines)]])) else ""

  list(
    complete = grepl("job completed", last_line, fixed = TRUE),
    source = if (grepl("job completed", last_line, fixed = TRUE)) "log.txt" else "none"
  )
}

load_data_job_species <- function(job_path) {
  status_payload <- load_data_read_status_json(job_path)

  if (is.list(status_payload)) {
    normalized_from_status <- load_data_normalize_species(status_payload$species %||% "")

    if (nzchar(normalized_from_status)) {
      return(list(
        species = normalized_from_status,
        source = "status.json",
        raw = as.character(status_payload$species %||% "")
      ))
    }
  }

  parameter_species <- load_data_read_parameter_species(job_path)
  normalized_from_parameter <- load_data_normalize_species(parameter_species)

  if (nzchar(normalized_from_parameter)) {
    return(list(
      species = normalized_from_parameter,
      source = "parameters.txt",
      raw = parameter_species
    ))
  }

  list(species = "", source = "none", raw = "")
}

load_data_find_duplicate_genes <- function(count_frame) {
  if (is.null(count_frame) || !nrow(count_frame)) {
    return(character())
  }

  normalized_genes <- trimws(as.character(count_frame$gene %||% ""))
  normalized_genes <- normalized_genes[nzchar(normalized_genes)]

  unique(normalized_genes[duplicated(normalized_genes) | duplicated(normalized_genes, fromLast = TRUE)])
}

load_data_selected_stat_file <- function(job_path, sncrna_type) {
  normalized_type <- load_data_normalize_sncrna_type(sncrna_type)

  if (!nzchar(normalized_type)) {
    stop("Choose one sncRNA type before clicking Save.", call. = FALSE)
  }

  expected_name <- sprintf("%s_stat_table.result", normalized_type)
  direct_path <- file.path(job_path, expected_name)

  if (file.exists(direct_path)) {
    return(direct_path)
  }

  stat_files <- list.files(
    job_path,
    pattern = "stat_table\\.result$",
    full.names = TRUE
  )

  if (!length(stat_files)) {
    stop("Cannot find any *stat_table.result files in the selected Job ID directory.", call. = FALSE)
  }

  normalized_names <- tolower(basename(stat_files))
  matched_index <- which(normalized_names == tolower(expected_name))

  if (length(matched_index)) {
    return(stat_files[[matched_index[[1]]]])
  }

  stop(
    sprintf(
      "Cannot find %s for the selected Job ID.",
      expected_name
    ),
    call. = FALSE
  )
}

load_data_read_stat_table_counts <- function(file_path) {
  lines <- tryCatch(
    readLines(file_path, warn = FALSE, encoding = "UTF-8"),
    error = function(error) {
      stop(sprintf("Failed to read %s: %s", basename(file_path), error$message), call. = FALSE)
    }
  )

  if (!length(lines)) {
    return(data.frame(gene = character(), count = numeric(), stringsAsFactors = FALSE))
  }

  matches <- regexec("^\\S+\\s+(\\S+)\\s+(\\S+)", lines, perl = TRUE)
  parsed <- regmatches(lines, matches)
  valid_matches <- Filter(function(entry) length(entry) >= 3, parsed)

  if (!length(valid_matches)) {
    stop(sprintf("%s does not contain the expected identifier and count columns.", basename(file_path)), call. = FALSE)
  }

  gene_names <- vapply(valid_matches, `[[`, character(1), 2)
  counts <- suppressWarnings(as.numeric(vapply(valid_matches, `[[`, character(1), 3)))
  keep_rows <- nzchar(gene_names) & is.finite(counts) & counts >= 0

  if (!any(keep_rows)) {
    return(data.frame(gene = character(), count = numeric(), stringsAsFactors = FALSE))
  }

  data.frame(
    gene = gene_names[keep_rows],
    count = round(counts[keep_rows]),
    stringsAsFactors = FALSE
  )
}

load_data_collect_job_counts <- function(job_id, sncrna_type, progress = NULL, progress_value = NULL, progress_detail = NULL) {
  if (!is.null(progress) && !is.null(progress_value) && !is.null(progress_detail)) {
    progress$set(
      value = progress_value,
      message = "Building Job ID Matrix",
      detail = progress_detail
    )
  }

  job_path <- srnameta_job_path(job_id)

  if (!dir.exists(job_path)) {
    stop(sprintf("Job directory does not exist: %s.", job_id), call. = FALSE)
  }

  completion <- load_data_job_completion(job_path)

  if (!isTRUE(completion$complete)) {
    stop(sprintf("Job ID %s is not complete.", job_id), call. = FALSE)
  }

  species_info <- load_data_job_species(job_path)

  if (!nzchar(species_info$species)) {
    stop(sprintf("Cannot determine species for Job ID %s.", job_id), call. = FALSE)
  }

  selected_file <- tryCatch(
    load_data_selected_stat_file(job_path, sncrna_type),
    error = function(error) {
      stop(sprintf("Job ID %s: %s", job_id, error$message), call. = FALSE)
    }
  )
  selected_counts <- load_data_read_stat_table_counts(selected_file)

  if (is.null(selected_counts) || !nrow(selected_counts)) {
    stop(
      sprintf(
        "No numeric expression counts were found in %s for Job ID %s.",
        basename(selected_file),
        job_id
      ),
      call. = FALSE
    )
  }

  duplicate_genes <- load_data_find_duplicate_genes(selected_counts)

  if (length(duplicate_genes)) {
    duplicate_preview <- paste(utils::head(duplicate_genes, 3), collapse = ", ")
    duplicate_suffix <- if (length(duplicate_genes) > 3) ", ..." else ""

    stop(
      sprintf(
        "Job ID %s contains duplicate identifiers in %s. Examples: %s%s.",
        job_id,
        basename(selected_file),
        duplicate_preview,
        duplicate_suffix
      ),
      call. = FALSE
    )
  }

  list(
    job_id = job_id,
    species = species_info$species,
    species_source = species_info$source,
    counts = selected_counts,
    source_file = basename(selected_file)
  )
}

load_data_matrix_text <- function(matrix_frame, first_column_name = "Gene") {
  header <- paste(c(first_column_name, colnames(matrix_frame)[-1]), collapse = "\t")
  body <- vapply(seq_len(nrow(matrix_frame)), function(index) {
    paste(
      c(
        as.character(matrix_frame[[1]][[index]]),
        vapply(matrix_frame[index, -1, drop = FALSE], as.character, character(1))
      ),
      collapse = "\t"
    )
  }, character(1))

  paste(c(header, body), collapse = "\n")
}

load_data_prepare_matrix_state <- function(payload) {
  sample_names <- unlist(payload$matrixSampleNames %||% character(), use.names = FALSE)
  sample_names <- trimws(as.character(sample_names))
  sample_names <- sample_names[nzchar(sample_names)]
  matrix_file_name <- trimws(as.character(payload$matrixFileName %||% ""))
  matrix_file_text <- as.character(payload$matrixFileText %||% "")
  species <- load_data_normalize_species(payload$species %||% "")
  sncrna_type <- load_data_normalize_sncrna_type(payload$sncRnaType %||% "")
  control_samples <- trimws(as.character(payload$controlSamples %||% ""))
  treatment_samples <- trimws(as.character(payload$treatmentSamples %||% ""))
  sample_pairing <- payload$samplePairing %||% list()

  if (!nzchar(species)) {
    species <- "human"
  }

  if (!nzchar(sncrna_type)) {
    stop("Choose one sncRNA type before clicking Save.", call. = FALSE)
  }

  state <- load_data_default_saved_state()
  state$data_source <- "matrix"
  state$species <- species
  state$sncrna_type <- sncrna_type
  state$matrix_file_name <- matrix_file_name
  state$matrix_file_text <- matrix_file_text
  state$matrix_sample_names <- sample_names
  state$control_samples <- control_samples
  state$treatment_samples <- treatment_samples
  state$sample_pairing <- sample_pairing

  list(
    state = state,
    feedback = list(
      status = "ready",
      message = "",
      version = 0L
    )
  )
}

load_data_prepare_job_state <- function(payload, progress = NULL) {
  input_job_id <- trimws(as.character(payload$jobId %||% ""))
  selected_species <- load_data_normalize_species(payload$species %||% "")
  selected_sncrna_type <- load_data_normalize_sncrna_type(payload$sncRnaType %||% "")
  parsed_job_ids <- load_data_parse_job_ids(input_job_id)
  differential_job_ids <- load_data_limit_differential_job_ids(parsed_job_ids)
  ignored_job_ids <- if (length(parsed_job_ids) > length(differential_job_ids)) {
    parsed_job_ids[seq.int(length(differential_job_ids) + 1L, length(parsed_job_ids))]
  } else {
    character()
  }
  state <- load_data_default_saved_state()
  state$data_source <- "jobid"
  state$job_id <- input_job_id
  state$species <- if (nzchar(selected_species)) selected_species else "human"
  state$sncrna_type <- selected_sncrna_type
  state$ignored_job_ids <- ignored_job_ids
  state$used_job_ids <- differential_job_ids
  state$job_grouping <- load_data_build_job_grouping(parsed_job_ids, payload$jobGrouping %||% list())

  if (!length(parsed_job_ids)) {
    stop("Enter at least one Job ID before clicking Save.", call. = FALSE)
  }

  if (is.null(progress)) {
    progress <- list(
      set = function(...) invisible(NULL)
    )
  }

  progress$set(
    value = 0.08,
    message = "Building Job ID Matrix",
    detail = "8% | Validating Job IDs"
  )

  grouping_rows <- load_data_build_job_grouping(parsed_job_ids, payload$jobGrouping %||% list())
  grouping_strings <- load_data_role_rows_to_strings(grouping_rows)
  control_ids <- load_data_parse_sample_list(grouping_strings$control)
  treatment_ids <- load_data_parse_sample_list(grouping_strings$treatment)
  state$control_samples <- grouping_strings$control
  state$treatment_samples <- grouping_strings$treatment
  state$sample_pairing <- grouping_rows
  state$job_grouping <- grouping_rows

  if (!nzchar(selected_sncrna_type)) {
    save_message <- "Saved Job IDs for Mapping Statistics. Choose one sncRNA type to enable Differential Analysis matrix building."

    if (length(ignored_job_ids)) {
      save_message <- sprintf(
        "Saved Job IDs for Mapping Statistics. Differential Analysis uses only the first %d Job IDs; ignored: %s. Choose one sncRNA type to enable Differential Analysis matrix building.",
        load_data_max_differential_job_ids(),
        paste(ignored_job_ids, collapse = ", ")
      )
    }

    return(list(
      state = state,
      feedback = list(
        status = "ready",
        message = save_message,
        version = 0L
      )
    ))
  }

  if (length(control_ids) < 2 || length(treatment_ids) < 2) {
    save_message <- sprintf(
      "Saved Job IDs for Mapping Statistics. Differential Analysis from Job IDs will build a %s matrix after you assign at least two Control and two Treatment Job IDs.",
      load_data_sncrna_type_label(selected_sncrna_type)
    )

    if (length(ignored_job_ids)) {
      save_message <- sprintf(
        "%s Differential Analysis uses only the first %d Job IDs; ignored: %s.",
        save_message,
        load_data_max_differential_job_ids(),
        paste(ignored_job_ids, collapse = ", ")
      )
    }

    return(list(
      state = state,
      feedback = list(
        status = "ready",
        message = save_message,
        version = 0L
      )
    ))
  }

  job_results <- vector("list", length(differential_job_ids))
  progress_start <- 0.18
  progress_span <- 0.54

  for (index in seq_along(differential_job_ids)) {
    progress_value <- progress_start + progress_span * (index / length(differential_job_ids))
    job_results[[index]] <- load_data_collect_job_counts(
      differential_job_ids[[index]],
      selected_sncrna_type,
      progress = progress,
      progress_value = progress_value,
      progress_detail = sprintf(
        "%d%% | Reading %s from %s (%d/%d)",
        round(progress_value * 100),
        load_data_sncrna_type_label(selected_sncrna_type),
        differential_job_ids[[index]],
        index,
        length(differential_job_ids)
      )
    )
  }

  job_species <- unique(vapply(job_results, function(item) item$species, character(1)))

  if (length(job_species) != 1) {
    mismatched_labels <- vapply(job_results, function(item) {
      sprintf("%s = %s", item$job_id, load_data_species_label(item$species))
    }, character(1))
    stop(
      sprintf(
        "The provided Job IDs are not from the same species: %s.",
        paste(mismatched_labels, collapse = "; ")
      ),
      call. = FALSE
    )
  }

  if (!identical(job_species[[1]], state$species)) {
    stop(
      sprintf(
        "Selected species is %s, but the provided Job IDs are %s.",
        load_data_species_label(state$species),
        load_data_species_label(job_species[[1]])
      ),
      call. = FALSE
    )
  }

  progress$set(
    value = 0.76,
    message = "Building Job ID Matrix",
    detail = sprintf("76%% | Merging %s counts", load_data_sncrna_type_label(selected_sncrna_type))
  )

  renamed_counts <- lapply(job_results, function(job_result) {
    job_counts <- job_result$counts
    colnames(job_counts)[[2]] <- job_result$job_id
    job_counts
  })
  merged_matrix <- Reduce(function(left, right) {
    merge(left, right, by = "gene", all = TRUE)
  }, renamed_counts)
  colnames(merged_matrix)[[1]] <- "ID"

  for (column_index in seq.int(2, ncol(merged_matrix))) {
    merged_matrix[[column_index]][is.na(merged_matrix[[column_index]])] <- 0
    merged_matrix[[column_index]] <- round(merged_matrix[[column_index]])
  }

  matrix_totals <- rowSums(merged_matrix[, -1, drop = FALSE])
  merged_matrix <- merged_matrix[order(-matrix_totals, merged_matrix$ID), , drop = FALSE]

  progress$set(
    value = 0.92,
    message = "Building Job ID Matrix",
    detail = "92% | Preparing merged matrix preview"
  )

  state$matrix_file_name <- sprintf(
    "srnameta_job_matrix_%s_%d_samples.tsv",
    load_data_sncrna_type_label(selected_sncrna_type),
    length(differential_job_ids)
  )
  state$matrix_file_text <- load_data_matrix_text(merged_matrix, first_column_name = "ID")
  state$matrix_sample_names <- differential_job_ids
  state$detected_species <- job_species[[1]]

  list(
    state = state,
    feedback = list(
      status = "ready",
      message = "",
      version = 0L
    )
  )
}
