mod_mapping_statistics_server <- function(id, job_id) {
  moduleServer(id, function(input, output, session) {
    output$mapping_shell <- renderUI({
      react_shell_host(
        id = session$ns("app_shell_root"),
        config = mapping_statistics_shell_config(job_id())
      )
    })
  })
}

