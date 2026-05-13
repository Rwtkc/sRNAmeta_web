source(app_path("shared", "react_bridge.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "welcome", "welcome.server.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "load_data", "load_data.data.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "load_data", "load_data.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "load_data", "load_data.server.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.data.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.server.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "cleavage", "cleavage.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "cleavage", "cleavage.data.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "cleavage", "cleavage.server.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "differential_analysis", "differential_analysis.data.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "differential_analysis", "differential_analysis.target_network.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "differential_analysis", "differential_analysis.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "differential_analysis", "differential_analysis.server.R"), local = TRUE, encoding = "UTF-8")

server <- function(input, output, session) {
  mod_welcome_server("welcome")
  load_data <- mod_load_data_server("load_data")
  mod_mapping_statistics_server("mapping_statistics", job_id = load_data$job_id)
  mod_cleavage_server(
    "cleavage",
    data_source = load_data$data_source,
    job_id = load_data$job_id,
    species = load_data$species
  )
  mod_differential_analysis_server(
    "differential_analysis",
    species = load_data$species,
    sncrna_type = load_data$sncrna_type,
    control_samples = load_data$control_samples,
    treatment_samples = load_data$treatment_samples,
    matrix_file_name = load_data$matrix_file_name,
    matrix_file_text = load_data$matrix_file_text,
    matrix_sample_names = load_data$matrix_sample_names
  )
}
