mod_load_data_ui <- function(id) {
  ns <- NS(id)

  tagList(
    tags$section(
      class = "load-data-module",
      react_shell_host(
        id = ns("app_shell_root"),
        config = load_data_shell_config(
          data_source_input_id = ns("data_source"),
          job_id_input_id = ns("job_id"),
          species_input_id = ns("species"),
          control_samples_input_id = ns("control_samples"),
          treatment_samples_input_id = ns("treatment_samples"),
          matrix_file_name_input_id = ns("matrix_file_name"),
          matrix_file_text_input_id = ns("matrix_file_text"),
          matrix_sample_names_input_id = ns("matrix_sample_names"),
          sample_pairing_input_id = ns("sample_pairing"),
          save_request_input_id = ns("save_request"),
          progress_slot_id = ns("progress_slot")
        )
      )
    )
  )
}
