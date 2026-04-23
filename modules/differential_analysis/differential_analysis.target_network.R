.srnameta_target_annotation_cache <- new.env(parent = emptyenv())

differential_target_network_empty_result <- function(message = "Run differential analysis to prepare target genes for STRING.") {
  list(
    status = "empty",
    message = message,
    summary = list(),
    rows = list(),
    stringUrl = NULL
  )
}

differential_target_species_options <- function() {
  list(
    human = list(
      label = "Human",
      taxId = "9606",
      mirnaPrefix = "hsa-",
      stringSpecies = "9606"
    ),
    mouse = list(
      label = "Mouse",
      taxId = "10090",
      mirnaPrefix = "mmu-",
      stringSpecies = "10090"
    )
  )
}

differential_target_annotation_path <- function() {
  candidates <- c(
    file.path(srnameta_job_root, "Conserved_Site_Context_Scores.txt"),
    file.path(srnameta_job_root, "Conserved_Site_Context_Scores.hsa.txt")
  )
  existing <- candidates[file.exists(candidates)]

  if (!length(existing)) {
    return(candidates[[1]])
  }

  existing[[1]]
}

differential_target_annotation_data <- function() {
  path <- differential_target_annotation_path()

  if (!file.exists(path)) {
    stop("Conserved_Site_Context_Scores.txt was not found under the sRNAmeta job root.", call. = FALSE)
  }

  info <- file.info(path)
  cache_key <- normalizePath(path, winslash = "/", mustWork = FALSE)
  cache_stamp <- sprintf("%s:%s", info$size %||% 0, as.numeric(info$mtime %||% 0))
  cached <- .srnameta_target_annotation_cache[[cache_key]]

  if (is.list(cached) && identical(cached$stamp, cache_stamp)) {
    return(cached$data)
  }

  raw_table <- utils::read.delim(
    path,
    sep = "\t",
    header = TRUE,
    stringsAsFactors = FALSE,
    check.names = FALSE,
    quote = ""
  )

  required_columns <- c(
    "Gene ID",
    "Gene Symbol",
    "Gene Tax ID",
    "miRNA",
    "context++ score",
    "weighted context++ score"
  )
  missing_columns <- setdiff(required_columns, colnames(raw_table))

  if (length(missing_columns)) {
    stop(
      sprintf(
        "Target annotation file is missing required columns: %s.",
        paste(missing_columns, collapse = ", ")
      ),
      call. = FALSE
    )
  }

  annotation <- data.frame(
    geneId = trimws(as.character(raw_table[["Gene ID"]])),
    geneSymbol = trimws(as.character(raw_table[["Gene Symbol"]])),
    geneTaxId = trimws(as.character(raw_table[["Gene Tax ID"]])),
    mirna = trimws(as.character(raw_table[["miRNA"]])),
    contextScore = suppressWarnings(as.numeric(raw_table[["context++ score"]])),
    weightedContextScore = suppressWarnings(as.numeric(raw_table[["weighted context++ score"]])),
    stringsAsFactors = FALSE
  )
  annotation <- annotation[nzchar(annotation$geneId) & nzchar(annotation$mirna), , drop = FALSE]
  .srnameta_target_annotation_cache[[cache_key]] <- list(
    stamp = cache_stamp,
    data = annotation
  )

  annotation
}

differential_target_string_url <- function(genes, species_info) {
  genes <- unique(trimws(as.character(genes)))
  genes <- genes[nzchar(genes)]

  if (!length(genes) || is.null(species_info$stringSpecies)) {
    return(NULL)
  }

  identifiers <- utils::URLencode(paste(genes, collapse = "\r"), reserved = TRUE)
  sprintf(
    "https://string-db.org/cgi/network?species=%s&identifiers=%s&caller_identity=sRNAmeta",
    species_info$stringSpecies,
    identifiers
  )
}

differential_target_string_identifier <- function(gene_id = "", gene_symbol = "") {
  clean_gene_id <- trimws(as.character(gene_id %||% ""))
  clean_gene_symbol <- trimws(as.character(gene_symbol %||% ""))

  if (nzchar(clean_gene_id)) {
    return(sub("\\.[0-9]+$", "", clean_gene_id))
  }

  clean_gene_symbol
}

differential_prepare_target_network <- function(result_data, request) {
  sncrna_type <- trimws(as.character(request$sncRnaType %||% ""))
  species <- trimws(as.character(request$species %||% "human"))
  supported_species <- differential_target_species_options()
  species_info <- supported_species[[species]]

  if (!identical(sncrna_type, "miRNA")) {
    return(differential_target_network_empty_result(
      "Target gene to STRING mapping is available only when the saved sncRNA type is miRNA."
    ))
  }

  if (is.null(species_info)) {
    return(differential_target_network_empty_result(
      "Target gene to STRING mapping is currently available only for Human and Mouse."
    ))
  }

  differential_mirnas <- unique(result_data$gene[result_data$status %in% c("up", "down")])

  if (!length(differential_mirnas)) {
    return(differential_target_network_empty_result(
      "No differential miRNAs passed the current fold-change and adjusted p-value thresholds."
    ))
  }

  annotation <- tryCatch(
    differential_target_annotation_data(),
    error = function(error) {
      structure(
        differential_target_network_empty_result(error$message),
        class = "srnameta_target_annotation_error"
      )
    }
  )

  if (inherits(annotation, "srnameta_target_annotation_error")) {
    return(annotation)
  }

  species_annotation <- annotation[
    annotation$geneTaxId == species_info$taxId &
      startsWith(annotation$mirna, species_info$mirnaPrefix),
    ,
    drop = FALSE
  ]

  if (!nrow(species_annotation)) {
    return(differential_target_network_empty_result(
      sprintf(
        "The current target annotation file does not contain %s miRNA target entries.",
        species_info$label
      )
    ))
  }

  mirna_result_rows <- unique(result_data[result_data$status %in% c("up", "down"), c("gene", "log2FoldChange", "padj", "status")])
  colnames(mirna_result_rows)[colnames(mirna_result_rows) == "gene"] <- "mirna"
  matched_targets <- merge(species_annotation, mirna_result_rows, by = "mirna")

  if (!nrow(matched_targets)) {
    return(differential_target_network_empty_result(
      "None of the differential miRNAs matched the current target annotation file."
    ))
  }

  matched_targets$effectiveScore <- ifelse(
    is.finite(matched_targets$weightedContextScore),
    matched_targets$weightedContextScore,
    matched_targets$contextScore
  )
  matched_targets$geneDisplay <- ifelse(
    nzchar(matched_targets$geneSymbol),
    matched_targets$geneSymbol,
    matched_targets$geneId
  )
  matched_targets <- matched_targets[nzchar(matched_targets$geneDisplay), , drop = FALSE]

  pair_order <- order(
    matched_targets$mirna,
    matched_targets$geneDisplay,
    matched_targets$effectiveScore,
    -abs(matched_targets$log2FoldChange),
    na.last = TRUE
  )
  pair_targets <- matched_targets[pair_order, , drop = FALSE]
  pair_targets <- pair_targets[!duplicated(paste(pair_targets$mirna, pair_targets$geneDisplay, sep = "\r")), , drop = FALSE]

  gene_groups <- split(pair_targets, pair_targets$geneDisplay)
  gene_rows <- lapply(gene_groups, function(gene_hits) {
    unique_mirnas <- unique(gene_hits$mirna)
    finite_scores <- gene_hits$effectiveScore[is.finite(gene_hits$effectiveScore)]
    ordered_mirnas <- gene_hits$mirna[order(-abs(gene_hits$log2FoldChange), gene_hits$padj, na.last = TRUE)]
    example_mirnas <- unique(ordered_mirnas)

    list(
      gene = gene_hits$geneDisplay[[1]],
      geneId = gene_hits$geneId[[1]],
      supportMirnas = length(unique_mirnas),
      upMirnas = sum(gene_hits$status == "up", na.rm = TRUE),
      downMirnas = sum(gene_hits$status == "down", na.rm = TRUE),
      bestWeightedContextScore = if (length(finite_scores)) round(min(finite_scores), 3) else NA_real_,
      meanWeightedContextScore = if (length(finite_scores)) round(mean(finite_scores), 3) else NA_real_,
      exampleMirnas = paste(head(example_mirnas, 3), collapse = ", ")
    )
  })

  gene_frame <- do.call(rbind, lapply(gene_rows, as.data.frame, stringsAsFactors = FALSE))
  gene_frame$supportMirnas <- as.integer(gene_frame$supportMirnas)
  gene_frame$upMirnas <- as.integer(gene_frame$upMirnas)
  gene_frame$downMirnas <- as.integer(gene_frame$downMirnas)
  gene_frame$bestWeightedContextScore <- suppressWarnings(as.numeric(gene_frame$bestWeightedContextScore))
  gene_frame$meanWeightedContextScore <- suppressWarnings(as.numeric(gene_frame$meanWeightedContextScore))
  gene_frame <- gene_frame[order(
    -gene_frame$supportMirnas,
    gene_frame$bestWeightedContextScore,
    gene_frame$gene,
    na.last = TRUE
  ), , drop = FALSE]

  string_gene_limit <- min(150L, nrow(gene_frame))
  string_identifiers <- unique(vapply(
    seq_len(nrow(gene_frame)),
    function(index) differential_target_string_identifier(gene_frame$geneId[[index]], gene_frame$gene[[index]]),
    character(1)
  ))
  string_identifiers <- head(string_identifiers[nzchar(string_identifiers)], string_gene_limit)

  list(
    status = "ready",
    message = "",
    summary = list(
      species = species_info$label,
      differentialMirnas = length(differential_mirnas),
      mappedMirnas = length(unique(pair_targets$mirna)),
      targetGenes = nrow(gene_frame),
      stringGenes = length(string_identifiers)
    ),
    rows = lapply(seq_len(nrow(gene_frame)), function(index) {
      row <- gene_frame[index, , drop = FALSE]
      string_identifier <- differential_target_string_identifier(row$geneId[[1]], row$gene[[1]])
      list(
        gene = row$gene[[1]],
        geneId = row$geneId[[1]],
        supportMirnas = row$supportMirnas[[1]],
        upMirnas = row$upMirnas[[1]],
        downMirnas = row$downMirnas[[1]],
        bestWeightedContextScore = row$bestWeightedContextScore[[1]],
        meanWeightedContextScore = row$meanWeightedContextScore[[1]],
        exampleMirnas = row$exampleMirnas[[1]],
        stringUrl = differential_target_string_url(string_identifier, species_info)
      )
    }),
    stringUrl = differential_target_string_url(string_identifiers, species_info)
  )
}
