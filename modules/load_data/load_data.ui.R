mod_load_data_ui <- function(id) {
  ns <- NS(id)

  tagList(
    tags$section(
      class = "load-data-module",
      react_shell_host(
        id = ns("app_shell_root"),
        config = load_data_shell_config(
          data_source_input_id = ns("data_source"),
          job_id_input_id = ns("job_id")
        )
      )
    )
  )
}
