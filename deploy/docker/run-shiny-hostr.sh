#!/usr/bin/env bash
set -euo pipefail

: "${APP_DIR:=/share/shiny/sRNAmeta}"
: "${HOST_R_BIN:=/home/shiny/miniconda3/envs/sRNAmeta_web/bin/R}"
: "${JOB_ROOT:=/public/liuqi/wwwdata/sncRNAbench/results}"
: "${SUPPORT_ROOT:=/share/shiny/sRNAmeta/support}"
: "${SHINY_PORT:=3838}"

if [[ ! -x "${HOST_R_BIN}" ]]; then
  echo "Host R binary not found or not executable: ${HOST_R_BIN}" >&2
  exit 1
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "sRNAmeta app directory not found: ${APP_DIR}" >&2
  exit 1
fi

if [[ ! -d "${JOB_ROOT}" ]]; then
  echo "sRNAmeta job root not found: ${JOB_ROOT}" >&2
  exit 1
fi

if [[ ! -d "${SUPPORT_ROOT}" ]]; then
  echo "sRNAmeta support root not found: ${SUPPORT_ROOT}" >&2
  exit 1
fi

mkdir -p "${APP_DIR}/tmp"
cd "${APP_DIR}"

export SRNAMETA_JOB_ROOT="${JOB_ROOT}"
export SRNAMETA_SUPPORT_ROOT="${SUPPORT_ROOT}"

exec "${HOST_R_BIN}" --quiet -e "options(shiny.host='0.0.0.0', shiny.port=${SHINY_PORT}); shiny::runApp('${APP_DIR}', host='0.0.0.0', port=${SHINY_PORT}, launch.browser=FALSE)"
