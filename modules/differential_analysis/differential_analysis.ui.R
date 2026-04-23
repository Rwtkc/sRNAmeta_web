mod_differential_analysis_ui <- function(id) {
  ns <- NS(id)

  tagList(
    tags$section(
      class = "differential-analysis-module",
      react_shell_host(
        id = ns("app_shell_root"),
        config = differential_analysis_shell_config(
          analysis_request_input_id = ns("analysis_request"),
          progress_slot_id = ns("progress_slot")
        )
      )
    )
  )
}
