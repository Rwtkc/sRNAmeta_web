mod_welcome_ui <- function(id) {
  ns <- NS(id)

  tagList(
    tags$section(
      class = "welcome-module",
      react_shell_host(
        id = ns("app_shell_root"),
        config = welcome_shell_config()
      )
    )
  )
}

