source(app_path("shared", "react_bridge.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "welcome", "welcome.server.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "load_data", "load_data.server.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.data.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.server.R"), local = TRUE, encoding = "UTF-8")

server <- function(input, output, session) {
  mod_welcome_server("welcome")
  load_data <- mod_load_data_server("load_data")
  mod_mapping_statistics_server("mapping_statistics", job_id = load_data$job_id)
}
