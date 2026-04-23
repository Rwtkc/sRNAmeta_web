mod_differential_analysis_server <- function(
  id,
  species,
  sncrna_type,
  control_samples,
  treatment_samples,
  matrix_file_name,
  matrix_file_text,
  matrix_sample_names
) {
  moduleServer(id, function(input, output, session) {
    analysis_result <- reactiveVal(differential_analysis_empty_result())
    last_request <- reactiveVal(list())
    analysis_cache <- reactiveVal(NULL)
    last_load_data_signature <- reactiveVal(NULL)

    observe({
      current_signature <- list(
        species = species(),
        sncrna_type = sncrna_type(),
        control_samples = control_samples(),
        treatment_samples = treatment_samples(),
        matrix_file_name = matrix_file_name(),
        matrix_file_text = matrix_file_text(),
        matrix_sample_names = matrix_sample_names()
      )
      previous_signature <- last_load_data_signature()

      if (is.null(previous_signature)) {
        last_load_data_signature(current_signature)
        return()
      }

      if (!identical(previous_signature, current_signature)) {
        analysis_cache(NULL)
        last_request(list())
        analysis_result(
          differential_analysis_empty_result("Load Data settings changed. Run differential analysis again.")
        )
        last_load_data_signature(current_signature)
      }
    })

    observe({
      session$sendCustomMessage(
        "srnameta:update-shell-config",
        list(
          id = session$ns("app_shell_root"),
          config = differential_analysis_shell_config(
            analysis_request_input_id = session$ns("analysis_request"),
            heatmap_refresh_input_id = session$ns("heatmap_refresh"),
            progress_slot_id = session$ns("progress_slot"),
            result = analysis_result(),
            last_request = last_request(),
            load_data_settings = list(
              species = species(),
              sncRnaType = sncrna_type(),
              controlSamples = control_samples(),
              treatmentSamples = treatment_samples(),
              fileName = matrix_file_name(),
              sampleNames = as.list(matrix_sample_names())
            )
          )
        )
      )
    })

    observeEvent(input$analysis_request, {
      request <- input$analysis_request
      request$species <- species()
      request$sncRnaType <- sncrna_type()
      request$controlSamples <- control_samples()
      request$treatmentSamples <- treatment_samples()
      request$fileName <- matrix_file_name()
      request$fileText <- matrix_file_text()
      request$sampleNames <- as.list(matrix_sample_names())

      last_request(differential_analysis_sanitize_request(request))
      progress <- shiny::Progress$new(session = session, min = 0, max = 1)
      on.exit(progress$close(), add = TRUE)

      progress$set(
        value = 0,
        message = "Running Differential Analysis",
        detail = "0% | Initializing analysis workspace"
      )

      result <- run_differential_analysis(request, progress = progress)

      if (identical(result$status, "error")) {
        analysis_cache(NULL)
        progress$set(
          value = 1,
          message = "Differential Analysis Failed",
          detail = "100% | Unable to complete analysis"
        )
      } else {
        analysis_cache(attr(result, "analysis_cache", exact = TRUE))
        progress$set(
          value = 1,
          message = "Running Differential Analysis",
          detail = "100% | Differential analysis results are ready"
        )
      }

      analysis_result(result)
    }, ignoreInit = TRUE)

    observeEvent(input$heatmap_refresh, {
      request <- input$heatmap_refresh
      current_request <- last_request()
      updated_request <- differential_analysis_sanitize_request(
        utils::modifyList(current_request %||% list(), list(topGenes = request$topGenes %||% current_request$topGenes))
      )

      refreshed_result <- differential_refresh_heatmap_result(
        analysis_cache(),
        analysis_result(),
        list(
          topGenes = updated_request$topGenes,
          requestedAt = request$requestedAt %||% NULL
        )
      )

      if (!identical(refreshed_result$status, "error")) {
        last_request(updated_request)
      }

      analysis_result(refreshed_result)
    }, ignoreInit = TRUE)
  })
}
