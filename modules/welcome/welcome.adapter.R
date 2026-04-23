welcome_shell_config <- function() {
  logo_src <- NULL

  if (file.exists(app_path("logo.webp"))) {
    logo_src <- "app-static/logo.webp"
  }

  list(
    view = "welcome",
    hero = list(
      eyebrow = "Small RNA Analysis",
      title = "sRNAmeta",
      description = "A focused interface for small RNA data loading, mapping statistics, and differential analysis.",
      supporting = "Load data first, then move through mapping statistics and differential analysis with a consistent workflow.",
      logoSrc = logo_src,
      badges = c("Small RNA", "Load Data", "Mapping Statistics", "Differential Analysis")
    )
  )
}
