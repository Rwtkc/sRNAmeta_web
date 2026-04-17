welcome_shell_config <- function() {
  logo_src <- NULL

  if (file.exists(app_path("logo.webp"))) {
    logo_src <- "app-static/logo.webp"
  }

  list(
    view = "welcome",
    hero = list(
      eyebrow = "Small RNA Modification Analysis",
      title = "sRNAmeta",
      description = "A focused interface for small RNA modification data loading, quality orientation, and downstream analysis.",
      supporting = "Start with clean BED inputs and species context before connecting the analysis modules.",
      logoSrc = logo_src,
      badges = c("Small RNA", "Modification Sites", "BED Inputs", "Shiny + React")
    )
  )
}
