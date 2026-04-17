load_data_shell_config <- function(data_source_input_id = NULL, job_id_input_id = NULL) {
  list(
    view = "load-data",
    loadData = list(
      eyebrow = "Choose Data Source",
      title = "Load Data",
      description = "Resume an existing job ID or upload an expression matrix before running sRNAmeta analysis.",
      dataSourceInputId = data_source_input_id,
      jobIdInputId = job_id_input_id,
      demoJobId = "tpAXtbvFhKwPAuOw",
      summary = list(
        list(label = "Source", value = "Input Job ID"),
        list(label = "Job ID", value = "Not provided"),
        list(label = "Matrix", value = "No matrix selected")
      ),
      notes = c(
        "Use an existing job ID to restore a previous run.",
        "Upload an expression matrix when starting a new analysis.",
        "Backend validation and analysis execution will be connected in later modules."
      )
    )
  )
}
