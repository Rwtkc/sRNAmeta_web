mod_load_data_server <- function(id) {
  moduleServer(id, function(input, output, session) {
    list(
      job_id = reactive({
        job_id <- input$job_id

        if (is.null(job_id)) {
          return("")
        }

        trimws(job_id)
      }),
      data_source = reactive({
        data_source <- input$data_source

        if (is.null(data_source)) {
          return("jobid")
        }

        data_source
      })
    )
  })
}
