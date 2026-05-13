mod_cleavage_ui <- function(id) {
  ns <- NS(id)

  tagList(
    tags$section(
      class = "cleavage-module",
      react_shell_host(
        id = ns("app_shell_root"),
        config = cleavage_shell_config(
          run_request_input_id = ns("run_request"),
          progress_slot_id = ns("progress_slot")
        )
      )
    )
  )
}
