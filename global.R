app_root <- normalizePath(getwd(), winslash = "/", mustWork = TRUE)

app_path <- function(...) {
  file.path(app_root, ...)
}

srnameta_is_linux <- identical(Sys.info()[["sysname"]], "Linux")

srnameta_default_job_root <- function() {
  if (srnameta_is_linux) {
    "/public/liuqi/wwwdata/sncRNAbench/results"
  } else {
    "D:/OBS录像/桌面/sRNAmeta_dir"
  }
}

srnameta_default_support_root <- function() {
  if (srnameta_is_linux) {
    app_path("support")
  } else {
    "D:/OBS录像/桌面/sRNAmeta_dir"
  }
}

srnameta_default_reference_db_root <- function() {
  if (srnameta_is_linux) {
    "/public/liuqi/wwwdb/sncRNAbench/tRNA"
  } else {
    "D:/OBS录像/桌面/sRNAmeta_dir/reference_db"
  }
}

srnameta_job_root <- normalizePath(
  Sys.getenv("SRNAMETA_JOB_ROOT", unset = srnameta_default_job_root()),
  winslash = "/",
  mustWork = FALSE
)

srnameta_support_root <- normalizePath(
  Sys.getenv("SRNAMETA_SUPPORT_ROOT", unset = srnameta_default_support_root()),
  winslash = "/",
  mustWork = FALSE
)

srnameta_reference_db_root <- normalizePath(
  Sys.getenv("SRNAMETA_REFERENCE_DB_ROOT", unset = srnameta_default_reference_db_root()),
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

srnameta_support_path <- function(...) {
  file.path(srnameta_support_root, ...)
}

srnameta_reference_db_path <- function(...) {
  file.path(srnameta_reference_db_root, ...)
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
