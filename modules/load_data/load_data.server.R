mod_load_data_server <- function(id) {
  moduleServer(id, function(input, output, session) {
    saved_state <- reactiveVal(load_data_default_saved_state())
    save_feedback <- reactiveVal(load_data_default_feedback())

    observe({
      feedback <- save_feedback()
      state <- saved_state()

      session$sendCustomMessage(
        "srnameta:update-shell-config",
        list(
          id = session$ns("app_shell_root"),
          config = load_data_shell_config(
            data_source_input_id = session$ns("data_source"),
            job_id_input_id = session$ns("job_id"),
            species_input_id = session$ns("species"),
            control_samples_input_id = session$ns("control_samples"),
            treatment_samples_input_id = session$ns("treatment_samples"),
            matrix_file_name_input_id = session$ns("matrix_file_name"),
            matrix_file_text_input_id = session$ns("matrix_file_text"),
            matrix_sample_names_input_id = session$ns("matrix_sample_names"),
            sample_pairing_input_id = session$ns("sample_pairing"),
            save_request_input_id = session$ns("save_request"),
            progress_slot_id = session$ns("progress_slot"),
            current_state = list(
              dataSource = state$data_source,
              jobId = state$job_id,
              species = state$species,
              sncRnaType = state$sncrna_type,
              controlSamples = state$control_samples,
              treatmentSamples = state$treatment_samples,
              matrixFileName = state$matrix_file_name,
              matrixFileText = state$matrix_file_text,
              matrixSampleNames = as.list(state$matrix_sample_names),
              samplePairing = state$sample_pairing,
              jobGrouping = state$job_grouping,
              detectedSpecies = state$detected_species,
              usedJobIds = as.list(state$used_job_ids),
              ignoredJobIds = as.list(state$ignored_job_ids)
            ),
            save_status = feedback$status,
            save_message = feedback$message,
            save_version = feedback$version
          )
        )
      )
    })

    observeEvent(input$save_request, {
      payload <- input$save_request
      current_feedback <- save_feedback()
      next_version <- as.integer(current_feedback$version %||% 0L) + 1L
      next_state <- load_data_default_saved_state()
      next_feedback <- list(
        status = "error",
        message = "Unable to save the current Load Data settings.",
        version = next_version
      )

      tryCatch({
        requested_source <- trimws(as.character(payload$dataSource %||% "jobid"))

        if (identical(requested_source, "matrix")) {
          prepared <- load_data_prepare_matrix_state(payload)
        } else {
          progress <- shiny::Progress$new(session = session, min = 0, max = 1)
          on.exit(progress$close(), add = TRUE)
          prepared <- load_data_prepare_job_state(payload, progress = progress)
          progress$set(
            value = 1,
            message = "Building Job ID Matrix",
            detail = "100% | Merged matrix is ready"
          )
        }

        next_state <- prepared$state
        next_feedback <- prepared$feedback
        next_feedback$version <- next_version
      }, error = function(error) {
        requested_source <- trimws(as.character(payload$dataSource %||% "jobid"))
        next_state$data_source <- requested_source
        next_state$job_id <- trimws(as.character(payload$jobId %||% ""))
        next_state$species <- load_data_normalize_species(payload$species %||% "")
        next_state$sncrna_type <- load_data_normalize_sncrna_type(payload$sncRnaType %||% "")

        if (!nzchar(next_state$species)) {
          next_state$species <- "human"
        }

        parsed_job_ids <- load_data_parse_job_ids(next_state$job_id)
        next_state$used_job_ids <- load_data_limit_differential_job_ids(parsed_job_ids)
        next_state$ignored_job_ids <- if (length(parsed_job_ids) > length(next_state$used_job_ids)) {
          parsed_job_ids[seq.int(length(next_state$used_job_ids) + 1L, length(parsed_job_ids))]
        } else {
          character()
        }
        next_state$job_grouping <- load_data_build_job_grouping(
          parsed_job_ids,
          payload$jobGrouping %||% list()
        )
        next_feedback <<- list(
          status = "error",
          message = error$message,
          version = next_version
        )
      })

      saved_state(next_state)
      save_feedback(next_feedback)
    }, ignoreInit = TRUE)

    list(
      job_id = reactive({
        saved_state()$job_id %||% ""
      }),
      data_source = reactive({
        saved_state()$data_source %||% "jobid"
      }),
      species = reactive({
        saved_state()$species %||% "human"
      }),
      sncrna_type = reactive({
        saved_state()$sncrna_type %||% "miRNA"
      }),
      control_samples = reactive({
        saved_state()$control_samples %||% ""
      }),
      treatment_samples = reactive({
        saved_state()$treatment_samples %||% ""
      }),
      matrix_file_name = reactive({
        saved_state()$matrix_file_name %||% ""
      }),
      matrix_file_text = reactive({
        saved_state()$matrix_file_text %||% ""
      }),
      matrix_sample_names = reactive({
        saved_state()$matrix_sample_names %||% character()
      }),
      sample_pairing = reactive({
        saved_state()$sample_pairing %||% list()
      })
    )
  })
}
