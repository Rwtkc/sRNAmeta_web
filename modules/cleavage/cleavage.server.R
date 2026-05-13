mod_cleavage_server <- function(id, data_source, job_id, species) {
  moduleServer(id, function(input, output, session) {
    analysis_result <- reactiveVal(cleavage_empty_result())
    last_load_data_signature <- reactiveVal(NULL)
    tracked_output_dirs <- reactiveVal(character())

    track_output_dir <- function(path) {
      path <- trimws(as.character(path %||% ""))

      if (!nzchar(path)) {
        return(invisible(NULL))
      }

      tracked_output_dirs(unique(c(tracked_output_dirs(), path)))
      invisible(path)
    }

    untrack_output_dir <- function(path) {
      path <- trimws(as.character(path %||% ""))

      if (!nzchar(path)) {
        return(invisible(NULL))
      }

      tracked_output_dirs(setdiff(tracked_output_dirs(), path))
      invisible(path)
    }

    cleanup_output_dir <- function(path) {
      cleavage_cleanup_dir(path)
      untrack_output_dir(path)
      invisible(path)
    }

    session$onSessionEnded(function() {
      paths <- isolate(tracked_output_dirs())

      for (path in unique(paths[nzchar(paths)])) {
        cleavage_cleanup_dir(path)
      }
    })

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
        cleanup_output_dir(analysis_result()$outputDir %||% NULL)
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
      previous_output_dir <- analysis_result()$outputDir %||% NULL
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

      track_output_dir(result$outputDir %||% NULL)

      if (identical(result$status, "ready")) {
        progress$set(
          value = 0.99,
          message = "Running Cleavage Analysis",
          detail = "99% | Rendering cleavage visualization"
        )
      } else if (identical(result$status, "error")) {
        progress$set(
          value = 1,
          message = "Cleavage Analysis Failed",
          detail = "100% | Unable to complete cleavage analysis"
        )
      }

      analysis_result(result)

      if (nzchar(trimws(as.character(previous_output_dir %||% ""))) &&
          !identical(previous_output_dir, result$outputDir %||% NULL)) {
        cleanup_output_dir(previous_output_dir)
      }
    }, ignoreInit = TRUE)
  })
}
