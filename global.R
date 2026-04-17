app_root <- normalizePath(getwd(), winslash = "/", mustWork = TRUE)

app_path <- function(...) {
  file.path(app_root, ...)
}

srnameta_job_root <- normalizePath(
  Sys.getenv("SRNAMETA_JOB_ROOT", unset = "D:/OBS录像/桌面/sRNAmeta_dir"),
  winslash = "/",
  mustWork = FALSE
)

srnameta_job_path <- function(job_id) {
  job_id <- trimws(as.character(job_id))

  if (!nzchar(job_id) || !grepl("^[A-Za-z0-9._-]+$", job_id)) {
    stop("Invalid job ID.", call. = FALSE)
  }

  file.path(srnameta_job_root, job_id)
}

required_packages <- c("shiny", "jsonlite")

invisible(
  lapply(
    required_packages,
    function(package) {
      if (!requireNamespace(package, quietly = TRUE)) {
        stop(sprintf("Required R package is missing: %s", package), call. = FALSE)
      }
    }
  )
)
