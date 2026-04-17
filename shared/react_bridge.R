react_shell_json <- function(config) {
  jsonlite::toJSON(
    config,
    auto_unbox = TRUE,
    null = "null",
    na = "null"
  )
}

react_shell_host <- function(id, config, class = NULL) {
  tags$div(
    id = id,
    class = paste(c("app-shell-root", class), collapse = " "),
    `data-shell-config` = react_shell_json(config)
  )
}

