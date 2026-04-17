mod_mapping_statistics_ui <- function(id) {
  ns <- NS(id)

  tagList(
    tags$section(
      class = "mapping-statistics-module",
      uiOutput(ns("mapping_shell"))
    )
  )
}

