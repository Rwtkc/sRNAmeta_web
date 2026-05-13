load_data_demo_matrix_payload <- function() {
  demo_file <- srnameta_support_path("hsa_synthetic_raw_counts_6samples.txt")

  if (!file.exists(demo_file)) {
    return(NULL)
  }

  file_text <- tryCatch(
    paste(readLines(demo_file, warn = FALSE, encoding = "UTF-8"), collapse = "\n"),
    error = function(...) NULL
  )

  if (is.null(file_text) || !nzchar(trimws(file_text))) {
    return(NULL)
  }

  first_line <- strsplit(file_text, "\r\n|\n|\r", perl = TRUE)[[1]][1]
  sample_names <- trimws(strsplit(first_line, "\t", fixed = TRUE)[[1]])
  sample_names <- sample_names[-1]

  list(
    fileName = "hsa_synthetic_raw_counts_6samples.txt",
    fileText = file_text,
    species = "human",
    sncRnaType = "miRNA",
    sampleNames = sample_names,
    samplePairing = list(
      list(sampleName = "Control_1", groupRole = "Control"),
      list(sampleName = "Control_2", groupRole = "Control"),
      list(sampleName = "Control_3", groupRole = "Control"),
      list(sampleName = "Treatment_1", groupRole = "Treatment"),
      list(sampleName = "Treatment_2", groupRole = "Treatment"),
      list(sampleName = "Treatment_3", groupRole = "Treatment")
    )
  )
}

load_data_shell_config <- function(
  data_source_input_id = NULL,
  job_id_input_id = NULL,
  species_input_id = NULL,
  control_samples_input_id = NULL,
  treatment_samples_input_id = NULL,
  matrix_file_name_input_id = NULL,
  matrix_file_text_input_id = NULL,
  matrix_sample_names_input_id = NULL,
  sample_pairing_input_id = NULL,
  save_request_input_id = NULL,
  progress_slot_id = "load-data-progress",
  current_state = list(),
  save_status = "idle",
  save_message = "",
  save_version = 0L
) {
  demo_matrix <- load_data_demo_matrix_payload()

  list(
    view = "load-data",
    loadData = list(
      eyebrow = "Choose Data Source",
      title = "Load Data",
      description = "Resume an existing job ID or configure expression matrix settings before running differential analysis.",
      dataSourceInputId = data_source_input_id,
      jobIdInputId = job_id_input_id,
      speciesInputId = species_input_id,
      controlSamplesInputId = control_samples_input_id,
      treatmentSamplesInputId = treatment_samples_input_id,
      matrixFileNameInputId = matrix_file_name_input_id,
      matrixFileTextInputId = matrix_file_text_input_id,
      matrixSampleNamesInputId = matrix_sample_names_input_id,
      samplePairingInputId = sample_pairing_input_id,
      saveRequestInputId = save_request_input_id,
      progressSlotId = progress_slot_id,
      demoJobId = "JZgI17o5fuq82WhF",
      demoJobSpecies = "human",
      demoJobSncRnaType = "miRNA",
      demoMatrix = demo_matrix,
      currentState = current_state,
      saveStatus = save_status,
      saveMessage = save_message,
      saveVersion = save_version,
      summary = list(
        list(label = "Source", value = "Input Job ID"),
        list(label = "Job IDs", value = "Not provided"),
        list(label = "sncRNA Type", value = "miRNA"),
        list(label = "Matrix", value = "No matrix selected"),
        list(label = "Species", value = "Human"),
        list(label = "Groups", value = "Not configured")
      ),
      notes = c(
        "Use Save in Job ID mode to update Mapping Statistics and to validate whether Differential Analysis can build a merged matrix.",
        "Choose one sncRNA type first. Job ID differential analysis reads only that type-specific stat table from each saved Job ID.",
        "Expression Matrix Settings saves the selected sncRNA type together with the uploaded matrix.",
        "Differential Analysis from Job IDs uses at most the first four Job IDs and requires at least two Control and two Treatment Job IDs before a matrix is built.",
        "Upload a raw count matrix and assign Control and Treatment samples before running differential analysis with replicated samples."
      )
    )
  )
}
