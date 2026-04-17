source(app_path("shared", "react_bridge.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "welcome", "welcome.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "welcome", "welcome.ui.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "load_data", "load_data.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "load_data", "load_data.ui.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.data.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.adapter.R"), local = TRUE, encoding = "UTF-8")
source(app_path("modules", "mapping_statistics", "mapping_statistics.ui.R"), local = TRUE, encoding = "UTF-8")

if (!"app-static" %in% names(shiny::resourcePaths()) && file.exists(app_path("logo.webp"))) {
  shiny::addResourcePath("app-static", app_root)
}

react_shell_asset_tags <- function() {
  asset_dir <- app_path("www", "react", "app_shell", "assets")
  css_file <- file.path(asset_dir, "app-shell.css")
  js_file <- file.path(asset_dir, "app-shell.js")
  asset_tags <- list()

  asset_version <- function(path) {
    if (!file.exists(path)) {
      return(NULL)
    }

    unname(tools::md5sum(path))
  }

  if (file.exists(css_file)) {
    css_version <- asset_version(css_file)
    css_href <- "react/app_shell/assets/app-shell.css"

    if (!is.null(css_version)) {
      css_href <- sprintf("%s?v=%s", css_href, css_version)
    }

    asset_tags <- c(
      asset_tags,
      list(tags$link(rel = "stylesheet", href = css_href))
    )
  }

  if (file.exists(js_file)) {
    js_version <- asset_version(js_file)
    js_src <- "react/app_shell/assets/app-shell.js"

    if (!is.null(js_version)) {
      js_src <- sprintf("%s?v=%s", js_src, js_version)
    }

    asset_tags <- c(
      asset_tags,
      list(tags$script(type = "module", src = js_src))
    )
  }

  tagList(asset_tags)
}

app_head_resources <- function() {
  tags$head(
    tags$title("sRNAmeta"),
    tags$meta(charset = "utf-8"),
    tags$meta(name = "viewport", content = "width=device-width, initial-scale=1"),
    tags$link(rel = "stylesheet", href = "css/app.css"),
    react_shell_asset_tags()
  )
}

ui <- shinyUI(
  tagList(
    navbarPage(
      title = "sRNAmeta",
      id = "main_navbar",
      selected = "welcome",
      header = app_head_resources(),
      tabPanel("Welcome", value = "welcome", mod_welcome_ui("welcome")),
      tabPanel("Load Data", value = "load_data", mod_load_data_ui("load_data")),
      tabPanel(
        "Mapping Statistics",
        value = "mapping_statistics",
        mod_mapping_statistics_ui("mapping_statistics")
      )
    ),
    tags$footer(
      class = "rm-footer",
      "sRNAmeta | Rice Research Institute, Guangdong Academy of Agricultural Sciences | Guangzhou, Guangdong, China | 2026"
    )
  )
)
