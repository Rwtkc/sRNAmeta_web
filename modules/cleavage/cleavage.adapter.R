`%||%` <- function(left, right) {
  if (is.null(left)) {
    right
  } else {
    left
  }
}

cleavage_species_label <- function(value) {
  labels <- c(
    human = "Human",
    mouse = "Mouse",
    rice = "Rice",
    maize = "Maize"
  )

  labels[[value]] %||% "Not selected"
}

cleavage_default_parameters <- function() {
  list(
    cleavageRatio = 0.2,
    pvalue = 0.05,
    foldChange = 6,
    inputBaseCoverage = 10,
    treatedCountCutoff = 10,
    nonNoise = 3
  )
}

cleavage_is_ready <- function(data_source = "jobid", job_id = "") {
  identical(trimws(as.character(data_source %||% "")), "jobid") &&
    length(cleavage_parse_job_ids(job_id)) == 1L
}

cleavage_status_message <- function(data_source = "jobid", job_id = "") {
  if (!identical(trimws(as.character(data_source %||% "")), "jobid")) {
    return("Save a Job ID in Load Data before running cleavage analysis.")
  }

  job_ids <- cleavage_parse_job_ids(job_id)

  if (length(job_ids) > 1L) {
    return("Cleavage currently supports exactly one saved Job ID in Load Data.")
  }

  is_ready <- length(job_ids) == 1L

  if (is_ready) {
    return("Load Data is saved in Job ID mode. Adjust parameters here before running cleavage analysis.")
  }

  "Save a Job ID in Load Data before running cleavage analysis."
}

cleavage_shell_config <- function(
  data_source = "jobid",
  job_id = "",
  species = "human",
  result = cleavage_empty_result(),
  run_request_input_id = NULL,
  progress_slot_id = "cleavage-analysis-progress"
) {
  ready <- cleavage_is_ready(data_source = data_source, job_id = job_id)

  list(
    view = "cleavage",
    cleavage = list(
      eyebrow = "Cleavage Analysis",
      title = "Cleavage",
      description = "Run cleavage scoring against the saved Job ID workflow and generate figure-ready outputs.",
      status = if (ready) "ready" else "disabled",
      message = cleavage_status_message(data_source = data_source, job_id = job_id),
      loadDataSettings = list(
        dataSource = data_source %||% "jobid",
        jobId = job_id %||% "",
        species = species %||% "human",
        speciesLabel = cleavage_species_label(species %||% "human")
      ),
      defaults = cleavage_default_parameters(),
      runRequestInputId = run_request_input_id,
      progressSlotId = progress_slot_id,
      result = result
    )
  )
}
