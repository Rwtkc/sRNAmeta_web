differential_species_options <- function() {
  list(
    list(value = "human", label = "Human", scientificName = "Homo sapiens"),
    list(value = "mouse", label = "Mouse", scientificName = "Mus musculus"),
    list(value = "rice", label = "Rice", scientificName = "Oryza sativa"),
    list(value = "maize", label = "Maize", scientificName = "Zea mays")
  )
}

differential_method_options <- function() {
  list(
    list(value = "DESeq2", label = "DESeq2"),
    list(value = "edgeR", label = "edgeR"),
    list(value = "student_t_test", label = "Student's t-test"),
    list(value = "wilcoxon_signed_rank", label = "Wilcoxon signed-rank test")
  )
}

differential_analysis_shell_config <- function(
  analysis_request_input_id,
  heatmap_refresh_input_id = NULL,
  progress_slot_id = "differential-analysis-progress",
  result = differential_analysis_empty_result(),
  last_request = list(),
  load_data_settings = list()
) {
  list(
    view = "differential-analysis",
    differentialAnalysis = list(
      eyebrow = "Differential Expression",
      title = "Differential Analysis",
      description = "Run DESeq2, edgeR, Student's t-test, or Wilcoxon signed-rank test using the count matrix and sample groups saved in Load Data.",
      analysisRequestInputId = analysis_request_input_id,
      heatmapRefreshInputId = heatmap_refresh_input_id,
      progressSlotId = progress_slot_id,
      methodOptions = differential_method_options(),
      defaultSpecies = "human",
      defaultMethod = "DESeq2",
      defaultFoldChange = 2,
      defaultLog2fc = log2(2),
      defaultPadj = 0.05,
      result = result,
      lastRequest = last_request,
      loadDataSettings = load_data_settings
    )
  )
}
