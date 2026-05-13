mod_cleavage_server <- function(id, data_source, job_id, species) {
  moduleServer(id, function(input, output, session) {
    analysis_result <- reactiveVal(cleavage_empty_result())
    last_load_data_signature <- reactiveVal(NULL)

    observe({
      current_signature <- list(
        data_source = data_source(),
        job_id = job_id(),
        species = species()
      )
      previous_signature <- last_load_data_signature()

      if (is.null(previous_signature)) {
        last_load_data_signature(current_signature)
        return()
      }

      if (!identical(previous_signature, current_signature)) {
        analysis_result(
          cleavage_empty_result("Load Data settings changed. Run cleavage analysis again.")
        )
        last_load_data_signature(current_signature)
      }
    })

    observe({
      session$sendCustomMessage(
        "srnameta:update-shell-config",
        list(
          id = session$ns("app_shell_root"),
          config = cleavage_shell_config(
            data_source = data_source(),
            job_id = job_id(),
            species = species(),
            result = analysis_result(),
            run_request_input_id = session$ns("run_request"),
            progress_slot_id = session$ns("progress_slot")
          )
        )
      )
    })

    observeEvent(input$run_request, {
      progress <- shiny::Progress$new(session = session, min = 0, max = 1)
      on.exit(progress$close(), add = TRUE)

      progress$set(
        value = 0,
        message = "Running Cleavage Analysis",
        detail = "0% | Initializing analysis workspace"
      )

      result <- tryCatch(
        run_cleavage_analysis(
          request = input$run_request,
          data_source = data_source(),
          job_id = job_id(),
          species = species(),
          progress = progress
        ),
        error = function(error) {
          cleavage_error_result(error$message, request_id = input$run_request$requestedAt %||% NULL)
        }
      )

      if (identical(result$status, "ready")) {
        progress$set(
          value = 1,
          message = "Running Cleavage Analysis",
          detail = "100% | Cleavage analysis results are ready"
        )
      } else if (identical(result$status, "error")) {
        progress$set(
          value = 1,
          message = "Cleavage Analysis Failed",
          detail = "100% | Unable to complete cleavage analysis"
        )
      }

      analysis_result(result)
    }, ignoreInit = TRUE)
  })
}
