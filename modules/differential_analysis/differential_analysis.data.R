differential_analysis_empty_result <- function(message = "Upload a count matrix and run a differential method to generate results.") {
  list(
    status = "empty",
    message = message,
    summary = list(),
    volcano = list(),
    heatmap = list(genes = list(), samples = list(), cells = list()),
    table = list(),
    targetNetwork = differential_target_network_empty_result()
  )
}

differential_analysis_error_result <- function(message, request_id = NULL, heatmap_request_id = NULL) {
  list(
    status = "error",
    message = message,
    summary = list(
      requestId = request_id,
      heatmapRequestId = heatmap_request_id
    ),
    volcano = list(),
    heatmap = list(genes = list(), samples = list(), cells = list()),
    table = list(),
    targetNetwork = differential_target_network_empty_result(message)
  )
}

differential_progress_set <- function(progress, value, message, detail) {
  if (is.null(progress)) {
    return(invisible(NULL))
  }

  progress$set(
    value = value,
    message = message,
    detail = detail
  )

  invisible(NULL)
}

differential_analysis_sanitize_request <- function(request) {
  if (is.null(request) || !is.list(request)) {
    return(list())
  }

  list(
    fileName = request$fileName %||% "",
    species = request$species %||% "human",
    method = request$method %||% "DESeq2",
    controlSamples = request$controlSamples %||% "",
    treatmentSamples = request$treatmentSamples %||% "",
    log2fc = request$log2fc %||% log2(2),
    padj = request$padj %||% 0.05,
    topGenes = request$topGenes %||% 2000,
    sampleNames = request$sampleNames %||% list(),
    sncRnaType = request$sncRnaType %||% "miRNA"
  )
}

differential_prepare_analysis_cache <- function(analysis, request, groups) {
  list(
    result_data = analysis$result,
    normalized = analysis$normalized,
    groups = groups,
    request = differential_analysis_sanitize_request(request)
  )
}

`%||%` <- function(left, right) {
  if (is.null(left)) {
    right
  } else {
    left
  }
}

differential_method_label <- function(method) {
  switch(
    method,
    DESeq2 = "DESeq2",
    edgeR = "edgeR",
    student_t_test = "Student's t-test",
    wilcoxon_signed_rank = "Wilcoxon signed-rank test",
    method
  )
}

differential_parse_sample_list <- function(value) {
  value <- trimws(as.character(value %||% ""))

  if (!nzchar(value)) {
    return(character())
  }

  samples <- unlist(strsplit(value, "[,，;\r\n\t ]+"))
  samples <- trimws(samples)
  samples[nzchar(samples)]
}

differential_detect_separator <- function(text) {
  first_line <- strsplit(text, "\r\n|\n|\r", perl = TRUE)[[1]][[1]]

  if (grepl(",", first_line, fixed = TRUE)) {
    return(",")
  }

  if (grepl("\t", first_line, fixed = TRUE)) {
    return("\t")
  }

  ""
}

differential_read_count_matrix <- function(request) {
  file_text <- request$fileText %||% ""
  file_text <- as.character(file_text)

  if (!nzchar(trimws(file_text))) {
    stop("No expression matrix content was received.", call. = FALSE)
  }

  separator <- differential_detect_separator(file_text)
  raw_data <- tryCatch(
    utils::read.table(
      text = file_text,
      header = TRUE,
      sep = separator,
      quote = "\"",
      comment.char = "",
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    error = function(error) {
      stop(sprintf("Failed to parse expression matrix: %s", error$message), call. = FALSE)
    }
  )

  if (ncol(raw_data) < 3) {
    stop("Expression matrix must include one gene ID column and at least two sample columns.", call. = FALSE)
  }

  gene_ids <- trimws(as.character(raw_data[[1]]))
  keep_genes <- nzchar(gene_ids)
  raw_data <- raw_data[keep_genes, , drop = FALSE]
  gene_ids <- make.unique(gene_ids[keep_genes])

  sample_data <- raw_data[, -1, drop = FALSE]
  count_data <- as.data.frame(
    lapply(sample_data, function(column) suppressWarnings(as.numeric(column))),
    check.names = FALSE
  )

  if (anyNA(count_data)) {
    stop("Sample columns must contain numeric raw counts only.", call. = FALSE)
  }

  count_matrix <- as.matrix(count_data)

  if (any(count_matrix < 0, na.rm = TRUE)) {
    stop("Raw counts cannot contain negative values.", call. = FALSE)
  }

  storage.mode(count_matrix) <- "numeric"
  count_matrix <- round(count_matrix)
  rownames(count_matrix) <- gene_ids

  if (nrow(count_matrix) < 2) {
    stop("Expression matrix must contain at least two genes.", call. = FALSE)
  }

  count_matrix
}

differential_resolve_groups <- function(request, sample_names) {
  control_samples <- differential_parse_sample_list(request$controlSamples)
  treatment_samples <- differential_parse_sample_list(request$treatmentSamples)

  if (length(control_samples) == 0 || length(treatment_samples) == 0) {
    stop("Assign Control and Treatment samples in Load Data before running differential analysis.", call. = FALSE)
  }

  missing_samples <- setdiff(c(control_samples, treatment_samples), sample_names)

  if (length(missing_samples) > 0) {
    stop(
      sprintf("These group samples were not found in the matrix: %s.", paste(missing_samples, collapse = ", ")),
      call. = FALSE
    )
  }

  if (length(intersect(control_samples, treatment_samples)) > 0) {
    stop("Control and treatment groups cannot share samples.", call. = FALSE)
  }

  list(
    control = control_samples,
    treatment = treatment_samples,
    ordered = c(control_samples, treatment_samples),
    condition = factor(
      c(rep("control", length(control_samples)), rep("treatment", length(treatment_samples))),
      levels = c("control", "treatment")
    )
  )
}

differential_validate_groups_for_method <- function(groups, method) {
  control_count <- length(groups$control)
  treatment_count <- length(groups$treatment)

  if (method %in% c("DESeq2", "edgeR", "student_t_test") &&
      (control_count < 2 || treatment_count < 2)) {
    stop(
      sprintf("%s requires at least two Control and two Treatment samples.", differential_method_label(method)),
      call. = FALSE
    )
  }

  if (identical(method, "wilcoxon_signed_rank")) {
    if (control_count < 2 || treatment_count < 2) {
      stop("Wilcoxon signed-rank test requires at least two Control and two Treatment samples.", call. = FALSE)
    }

    if (control_count != treatment_count) {
      stop(
        "Wilcoxon signed-rank test requires equal numbers of Control and Treatment samples because it runs as a paired test in saved input order.",
        call. = FALSE
      )
    }
  }
}

differential_check_package <- function(package) {
  if (!requireNamespace(package, quietly = TRUE)) {
    stop(
      sprintf("The Bioconductor package '%s' is required for this analysis. Install it before running this method.", package),
      call. = FALSE
    )
  }
}

differential_run_deseq2 <- function(count_matrix, groups) {
  differential_check_package("DESeq2")

  col_data <- data.frame(
    condition = groups$condition,
    row.names = groups$ordered
  )
  ordered_counts <- count_matrix[, groups$ordered, drop = FALSE]

  dds <- DESeq2::DESeqDataSetFromMatrix(
    countData = ordered_counts,
    colData = col_data,
    design = ~ condition
  )
  dds <- suppressMessages(DESeq2::DESeq(dds, quiet = TRUE))
  result <- as.data.frame(DESeq2::results(
    dds,
    contrast = c("condition", "treatment", "control")
  ))
  normalized_counts <- DESeq2::counts(dds, normalized = TRUE)

  list(
    result = data.frame(
      gene = rownames(result),
      baseMean = result$baseMean,
      log2FoldChange = result$log2FoldChange,
      pvalue = result$pvalue,
      padj = result$padj,
      stringsAsFactors = FALSE
    ),
    normalized = normalized_counts
  )
}

differential_run_edger <- function(count_matrix, groups) {
  differential_check_package("edgeR")

  ordered_counts <- count_matrix[, groups$ordered, drop = FALSE]
  y <- edgeR::DGEList(counts = ordered_counts, group = groups$condition)
  keep <- edgeR::filterByExpr(y, group = groups$condition)

  if (sum(keep) < 2) {
    stop("edgeR filtering removed too many genes. Check that the uploaded matrix contains raw counts with sufficient expression.", call. = FALSE)
  }

  y <- y[keep, , keep.lib.sizes = FALSE]
  y <- edgeR::calcNormFactors(y)
  design <- stats::model.matrix(~ groups$condition)
  y <- edgeR::estimateDisp(y, design)
  fit <- edgeR::glmQLFit(y, design)
  qlf <- edgeR::glmQLFTest(fit, coef = 2)
  result <- as.data.frame(edgeR::topTags(qlf, n = Inf, sort.by = "none"))
  normalized_counts <- edgeR::cpm(y, log = FALSE, normalized.lib.sizes = TRUE)

  list(
    result = data.frame(
      gene = rownames(result),
      baseMean = rowMeans(normalized_counts),
      log2FoldChange = result$logFC,
      pvalue = result$PValue,
      padj = result$FDR,
      stringsAsFactors = FALSE
    ),
    normalized = normalized_counts
  )
}

differential_generic_log2fc <- function(count_matrix, groups) {
  control_means <- rowMeans(count_matrix[, groups$control, drop = FALSE])
  treatment_means <- rowMeans(count_matrix[, groups$treatment, drop = FALSE])

  log2((treatment_means + 1) / (control_means + 1))
}

differential_run_student_t_test <- function(count_matrix, groups) {
  transformed_counts <- log2(count_matrix + 1)
  control_matrix <- transformed_counts[, groups$control, drop = FALSE]
  treatment_matrix <- transformed_counts[, groups$treatment, drop = FALSE]
  log2fc <- differential_generic_log2fc(count_matrix, groups)
  pvalues <- vapply(seq_len(nrow(transformed_counts)), function(index) {
    control_values <- control_matrix[index, ]
    treatment_values <- treatment_matrix[index, ]

    tryCatch(
      stats::t.test(control_values, treatment_values, var.equal = TRUE)$p.value,
      error = function(...) 1
    )
  }, numeric(1))

  list(
    result = data.frame(
      gene = rownames(count_matrix),
      baseMean = rowMeans(count_matrix[, groups$ordered, drop = FALSE]),
      log2FoldChange = log2fc,
      pvalue = pvalues,
      padj = stats::p.adjust(pvalues, method = "BH"),
      stringsAsFactors = FALSE
    ),
    normalized = count_matrix
  )
}

differential_run_wilcoxon_signed_rank <- function(count_matrix, groups) {
  transformed_counts <- log2(count_matrix + 1)
  control_matrix <- transformed_counts[, groups$control, drop = FALSE]
  treatment_matrix <- transformed_counts[, groups$treatment, drop = FALSE]
  log2fc <- differential_generic_log2fc(count_matrix, groups)
  pvalues <- vapply(seq_len(nrow(transformed_counts)), function(index) {
    control_values <- control_matrix[index, ]
    treatment_values <- treatment_matrix[index, ]

    tryCatch(
      stats::wilcox.test(control_values, treatment_values, paired = TRUE, exact = FALSE)$p.value,
      error = function(...) 1
    )
  }, numeric(1))

  list(
    result = data.frame(
      gene = rownames(count_matrix),
      baseMean = rowMeans(count_matrix[, groups$ordered, drop = FALSE]),
      log2FoldChange = log2fc,
      pvalue = pvalues,
      padj = stats::p.adjust(pvalues, method = "BH"),
      stringsAsFactors = FALSE
    ),
    normalized = count_matrix
  )
}

differential_clean_number <- function(value, digits = 4) {
  value <- suppressWarnings(as.numeric(value))

  ifelse(is.finite(value), round(value, digits), NA_real_)
}

differential_status <- function(log2fc, padj, log2fc_threshold, padj_threshold) {
  ifelse(
    !is.na(padj) & padj <= padj_threshold & log2fc >= log2fc_threshold,
    "up",
    ifelse(
      !is.na(padj) & padj <= padj_threshold & log2fc <= -log2fc_threshold,
      "down",
      "not_significant"
    )
  )
}

differential_prepare_heatmap <- function(result_data, normalized_counts, groups, log2fc_threshold, padj_threshold, top_genes = 2000L) {
  if (nrow(result_data) == 0) {
    return(list(genes = list(), samples = list(), cells = list()))
  }

  significant <- !is.na(result_data$padj) &
    result_data$padj <= padj_threshold &
    abs(result_data$log2FoldChange) >= log2fc_threshold
  rank_order <- order(
    !significant,
    result_data$padj,
    -abs(result_data$log2FoldChange),
    na.last = TRUE
  )
  heatmap_genes <- result_data$gene[rank_order]
  heatmap_genes <- heatmap_genes[heatmap_genes %in% rownames(normalized_counts)]
  top_genes <- suppressWarnings(as.integer(top_genes))
  if (!is.finite(top_genes) || top_genes < 10L) {
    top_genes <- 2000L
  }
  heatmap_genes <- head(heatmap_genes, min(top_genes, length(heatmap_genes)))
  if (length(heatmap_genes) == 0) {
    return(list(genes = list(), samples = list(), cells = list()))
  }

  log_counts <- log2(normalized_counts[heatmap_genes, groups$ordered, drop = FALSE] + 1)
  row_means <- rowMeans(log_counts)
  row_sds <- apply(log_counts, 1, stats::sd)
  row_sds[!is.finite(row_sds) | row_sds == 0] <- 1
  z_scores <- sweep(sweep(log_counts, 1, row_means, "-"), 1, row_sds, "/")

  cells <- list()
  index <- 1

  for (gene in rownames(z_scores)) {
    for (sample in colnames(z_scores)) {
      cells[[index]] <- list(
        gene = gene,
        sample = sample,
        value = differential_clean_number(z_scores[gene, sample], 3),
        expression = differential_clean_number(log_counts[gene, sample], 3)
      )
      index <- index + 1
    }
  }

  list(
    genes = unname(rownames(z_scores)),
    samples = lapply(groups$ordered, function(sample) {
      list(
        name = sample,
        group = ifelse(sample %in% groups$control, "control", "treatment")
      )
    }),
    cells = cells
  )
}

differential_prepare_result <- function(analysis, request, count_matrix, groups) {
  log2fc_threshold <- suppressWarnings(as.numeric(request$log2fc %||% log2(2)))
  padj_threshold <- suppressWarnings(as.numeric(request$padj %||% 0.05))
  top_genes <- suppressWarnings(as.integer(request$topGenes %||% 2000L))

  if (!is.finite(log2fc_threshold) || log2fc_threshold < 0) {
    log2fc_threshold <- log2(2)
  }

  if (!is.finite(padj_threshold) || padj_threshold <= 0 || padj_threshold > 1) {
    padj_threshold <- 0.05
  }

  if (!is.finite(top_genes) || top_genes < 10L) {
    top_genes <- 2000L
  }

  result_data <- analysis$result
  result_data$padj[is.na(result_data$padj) & !is.na(result_data$pvalue)] <- 1
  result_data$status <- differential_status(
    result_data$log2FoldChange,
    result_data$padj,
    log2fc_threshold,
    padj_threshold
  )
  result_data <- result_data[order(result_data$padj, -abs(result_data$log2FoldChange), na.last = TRUE), , drop = FALSE]

  volcano_order <- order(
    result_data$status == "not_significant",
    result_data$padj,
    -abs(result_data$log2FoldChange),
    na.last = TRUE
  )
  volcano_data <- result_data[head(volcano_order, min(5000, nrow(result_data))), , drop = FALSE]
  volcano_plot_data <- volcano_data[is.finite(volcano_data$padj), , drop = FALSE]
  table_data <- result_data
  total_genes <- nrow(result_data)
  up_genes <- sum(result_data$status == "up", na.rm = TRUE)
  down_genes <- sum(result_data$status == "down", na.rm = TRUE)
  not_significant_genes <- sum(result_data$status == "not_significant", na.rm = TRUE)

  list(
    status = "ready",
    message = sprintf("Differential analysis completed with %s.", differential_method_label(request$method %||% "DESeq2")),
    summary = list(
      fileName = request$fileName %||% "",
      species = request$species %||% "human",
      method = differential_method_label(request$method %||% "DESeq2"),
      totalGenes = total_genes,
      plottedGenes = nrow(volcano_plot_data),
      upGenes = up_genes,
      downGenes = down_genes,
      notSignificantGenes = not_significant_genes,
      controlSamples = unname(groups$control),
      treatmentSamples = unname(groups$treatment),
      log2fc = log2fc_threshold,
      padj = padj_threshold,
      topGenes = top_genes,
      requestId = request$requestedAt %||% NULL,
      heatmapRequestId = request$requestedAt %||% NULL
    ),
    volcano = lapply(seq_len(nrow(volcano_plot_data)), function(index) {
      row <- volcano_plot_data[index, , drop = FALSE]
      adjusted <- suppressWarnings(as.numeric(row$padj))
      if (!is.finite(adjusted) || adjusted <= 0) {
        adjusted <- .Machine$double.xmin
      }
      list(
        gene = row$gene,
        baseMean = differential_clean_number(row$baseMean),
        log2FoldChange = differential_clean_number(row$log2FoldChange),
        pvalue = differential_clean_number(row$pvalue, 6),
        padj = differential_clean_number(row$padj, 6),
        negLog10Padj = differential_clean_number(-log10(adjusted), 3),
        status = row$status
      )
    }),
    heatmap = differential_prepare_heatmap(
      result_data,
      analysis$normalized,
      groups,
      log2fc_threshold,
      padj_threshold,
      top_genes
    ),
    table = lapply(seq_len(nrow(table_data)), function(index) {
      row <- table_data[index, , drop = FALSE]
      list(
        gene = row$gene,
        baseMean = differential_clean_number(row$baseMean),
        log2FoldChange = differential_clean_number(row$log2FoldChange),
        pvalue = differential_clean_number(row$pvalue, 6),
        padj = differential_clean_number(row$padj, 6),
        status = row$status
      )
    }),
    targetNetwork = differential_prepare_target_network(result_data, request)
  )
}

differential_refresh_heatmap_result <- function(cached_analysis, existing_result, request = list()) {
  if (is.null(cached_analysis) || !is.list(cached_analysis)) {
    return(differential_analysis_error_result(
      "Run differential analysis before refreshing the heatmap.",
      request_id = existing_result$summary$requestId %||% NULL,
      heatmap_request_id = request$requestedAt %||% NULL
    ))
  }

  if (!identical(existing_result$status, "ready")) {
    return(differential_analysis_error_result(
      "Heatmap refresh requires an existing differential analysis result.",
      request_id = existing_result$summary$requestId %||% NULL,
      heatmap_request_id = request$requestedAt %||% NULL
    ))
  }

  merged_request <- utils::modifyList(
    cached_analysis$request %||% list(),
    request %||% list()
  )
  sanitized_request <- differential_analysis_sanitize_request(merged_request)
  updated_result <- existing_result
  updated_result$summary$topGenes <- suppressWarnings(as.integer(sanitized_request$topGenes))
  updated_result$summary$heatmapRequestId <- request$requestedAt %||% updated_result$summary$heatmapRequestId
  updated_result$heatmap <- differential_prepare_heatmap(
    cached_analysis$result_data,
    cached_analysis$normalized,
    cached_analysis$groups,
    suppressWarnings(as.numeric(sanitized_request$log2fc %||% updated_result$summary$log2fc)),
    suppressWarnings(as.numeric(sanitized_request$padj %||% updated_result$summary$padj)),
    sanitized_request$topGenes
  )
  updated_result
}

run_differential_analysis <- function(request, progress = NULL) {
  tryCatch({
    if (is.null(request) || !is.list(request)) {
      stop("Invalid analysis request.", call. = FALSE)
    }

    differential_progress_set(
      progress,
      0.18,
      "Running Differential Analysis",
      "18% | Reading count matrix"
    )
    count_matrix <- differential_read_count_matrix(request)
    differential_progress_set(
      progress,
      0.34,
      "Running Differential Analysis",
      "34% | Resolving sample groups"
    )
    groups <- differential_resolve_groups(request, colnames(count_matrix))
    method <- as.character(request$method %||% "DESeq2")
    differential_validate_groups_for_method(groups, method)

    differential_progress_set(
      progress,
      0.72,
      "Running Differential Analysis",
      sprintf("72%% | Running %s", method)
    )
    analysis <- switch(
      method,
      DESeq2 = differential_run_deseq2(count_matrix, groups),
      edgeR = differential_run_edger(count_matrix, groups),
      student_t_test = differential_run_student_t_test(count_matrix, groups),
      wilcoxon_signed_rank = differential_run_wilcoxon_signed_rank(count_matrix, groups),
      stop(sprintf("Unsupported analysis method: %s.", method), call. = FALSE)
    )

    differential_progress_set(
      progress,
      0.9,
      "Running Differential Analysis",
      "90% | Preparing volcano plot, heatmap, and result table"
    )
    result <- differential_prepare_result(analysis, request, count_matrix, groups)
    attr(result, "analysis_cache") <- differential_prepare_analysis_cache(analysis, request, groups)
    result
  }, error = function(error) {
    differential_analysis_error_result(
      error$message,
      request_id = request$requestedAt %||% NULL,
      heatmap_request_id = request$requestedAt %||% NULL
    )
  })
}
