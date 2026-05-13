#1.library the R packages
suppressPackageStartupMessages(library("data.table"))
suppressPackageStartupMessages(library("GenomicAlignments"))
suppressPackageStartupMessages(library("seqinr"))
suppressPackageStartupMessages(library("jsonlite"))
suppressPackageStartupMessages(library("Biostrings")) #new code

#2. Input parameters
args <- commandArgs(TRUE)
tRNASeqFile <- args[1]#成熟tRNA参考序列的文件路径
tRNAStructre<-args[2]#tRNA 结构的gff文件
inputFile <- args[3] #$resultTemp/tRNA1.bam
tracFile <- args[4] #$resultTemp/tRNA2.bam
outdir <- args[5] #$resultdir
#type <- args[6]#tRNA #去掉这个参数，因为所有的都是tRNA
cleavageratio <- as.numeric(args[6])
#cleavageratio <- 0.0001
pvalue_threshold <-as.numeric(args[7])
#pvalue_threshold<-0.05
foldChange<-as.numeric(args[8])
#foldChange<-1
controlreadcoverage<- args[9]
input_basecoverage_value<-as.numeric(args[10])
#input_basecoverage_value<-0
count_treated_value<-as.numeric(args[11])
#count_treated_value<-0
nonnoise_value<-as.numeric(args[12])
#print (nonnoise_value)
#nonnoise_value<-0

safe_split_part <- function(value, index) {
  parts <- strsplit(as.character(value %||% ""), "\\|", fixed = FALSE)
  vapply(parts, function(entry) {
    if (length(entry) >= index) {
      entry[[index]]
    } else {
      ""
    }
  }, character(1))
}

`%||%` <- function(left, right) {
  if (is.null(left)) {
    right
  } else {
    left
  }
}

normalize_cleavage_result <- function(result_frame) {
  result_df <- as.data.frame(result_frame, stringsAsFactors = FALSE, check.names = FALSE)
  row_count <- nrow(result_df)
  tRNA_values <- if ("tRNA" %in% names(result_df)) {
    as.character(result_df$tRNA)
  } else {
    rep("", row_count)
  }
  parts <- strsplit(tRNA_values, "|", fixed = TRUE)

  part_at <- function(index) {
    vapply(parts, function(entry) {
      if (length(entry) >= index) {
        entry[[index]]
      } else {
        ""
      }
    }, character(1))
  }

  part_count <- lengths(parts)
  location <- ifelse(part_count >= 4, part_at(3), ifelse(part_count >= 2, part_at(2), ""))
  trna_length <- ifelse(part_count >= 4, part_at(4), ifelse(part_count >= 3, part_at(3), ""))
  location <- gsub("\\(([-+])\\)-", "\\1", location)

  chr <- ifelse(grepl(":", location, fixed = TRUE), sub(":.*$", "", location), "")
  location_tail <- ifelse(grepl(":", location, fixed = TRUE), sub("^[^:]*:", "", location), "")
  chr_start <- ifelse(nzchar(location_tail), sub("-.*$", "", location_tail), "")
  chr_end <- ifelse(grepl("-", location_tail, fixed = TRUE), sub(":.*$", "", sub("^.*-", "", location_tail)), "")
  strand <- ifelse(grepl(":[+-]$", location), sub("^.*:", "", location), "")

  parsed <- data.frame(
    tRNAid = part_at(1),
    tRNAid_GtRNAdb = ifelse(part_count >= 4, part_at(2), ""),
    chr = chr,
    chr_start = chr_start,
    chr_end = chr_end,
    strand = strand,
    length = trna_length,
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  remaining_cols <- setdiff(colnames(result_df), "tRNA")
  cbind(parsed, result_df[, remaining_cols, drop = FALSE])
}

write_clean_cleavage_bundle <- function(result_frame, txt_path, json_path) {
  clean_frame <- normalize_cleavage_result(result_frame)
  write.table(clean_frame, file = txt_path, quote = FALSE, row.names = FALSE, col.names = TRUE, sep = "\t")
  jsonlite::write_json(clean_frame, json_path)
}

fisher_greater_pvalue <- function(cov1, count1, cov2, count2) {
  phyper(
    count2 - 1,
    count2 + cov2,
    count1 + cov1,
    count2 + count1,
    lower.tail = FALSE
  )
}

extract_collapsed_frequency <- function(read_names) {
  read_names <- as.character(read_names)
  collapsed_suffix <- sub("^.*_x", "", read_names, perl = TRUE)
  collapsed_flag <- grepl("_x[0-9]+$", read_names, perl = TRUE)
  frequencies <- suppressWarnings(as.numeric(collapsed_suffix))
  frequencies[!collapsed_flag | !is.finite(frequencies) | frequencies <= 0] <- 1
  frequencies
}

#tRNASeqFile <- "/public/liuqi/wwwdb/sncRNAbench/tRNA/mmu.mature.fa"
#tRNAStructre<-"/public/liuqi/wwwdb/sncRNAbench/tRNA/mmu.structure.gff"
#inputFile <- "./data/results/K2mGuzSUNXf6T1Cl/temp/tRNA1.bam"
#tracFile <- "./data/results/K2mGuzSUNXf6T1Cl/temp/tRNA2.bam"
#outdir <- "./data/results/K2mGuzSUNXf6T1Cl"
#cleavageratio <- 0.2
#pvalue_threshold <-0.05
#foldChange<-6
#controlreadcoverage<- "./data/results/K2mGuzSUNXf6T1Cl/temp/tRNA1.bam.readcoverage.txt"
#input_basecoverage_value<-10
#count_treated_value<-10
#nonnoise_value <- 3


#3. Analyze
#3.1 读取成熟tRNA序列，成生tRNA id及对应1，2，3这样的列表
transcript_seqs <- read.fasta(tRNASeqFile, seqtype = 'DNA', as.string = T)
transcript_seqs <- data.table(tRNA=names(transcript_seqs), seq=as.character(transcript_seqs))
transcript_seqs[,tRNA:=sub("\\s.*$","",tRNA, perl=T)]

data_summary <- function(tRNA, seq) {
  len <- length(unlist(strsplit(seq,"")))
  cc <- data.table(tRNA=tRNA,start=1:len)
  return(cc)
}
cct <- mapply(data_summary,transcript_seqs$tRNA,transcript_seqs$seq,SIMPLIFY = FALSE)
allsites <- rbindlist(cct)
#3.2 计算cleavage值
#get_coverage计算覆盖度函数
  get_coverage <- function(bamfile) {
  filename <- gsub('\\..*', '', bamfile)
  param <- ScanBamParam(flag = scanBamFlag(), simpleCigar = FALSE, reverseComplement = FALSE, tag = 'nM', tagFilter = list(), what = character(0), mapqFilter=1)
  aat <- readGAlignments(bamfile, index=paste(bamfile, '.bai', sep = ''), use.names=TRUE, param <- param, with.which_label=FALSE)
  readNames <- names(aat)
  names(aat) <- NULL
  reads <- as.data.table(aat)
  reads[,rn:=readNames]
  reads <- reads[strand=="+",]

  reads[,freq := extract_collapsed_frequency(rn)]

  coverage_table <- reads[, .(count=sum(freq)), by=list(seqnames,strand,start)]
  #setnames(coverage_table, c('N'), c('count'))
  coverage_table[,end:=start]
  # Release memory
  rm(reads)
  gc()
  countfile <- paste0(bamfile,".bg")
  bg <- setDT(read.table(countfile, head=F,sep="\t",as.is=T))
  setnames(bg,c("seqnames","start","end","coverage"))
  bg[,start := start+1]
  #bg[,sncRNA:=gsub("\\|.*$", "", seqnames)]
  bg[,tRNA := seqnames]
  setkey(coverage_table,seqnames,start,end)
  setkey(bg,seqnames,start,end)
  tc = foverlaps(coverage_table, bg, nomatch=0L)
  tc[,c("seqnames","start","end","i.end","strand"):=NULL]  #修改version2 的代码：tc[,c("seqnames","i.start","end","i.end","strand"):=NULL]
  tc[,faivalue := count/coverage]
  setnames(tc,c("i.start"),c("start"))    #在version2 的基础上增加一行代码
  tc <- merge(allsites,tc,by=c("tRNA","start"),all.x=T)
  tc[is.na(faivalue),faivalue := 0]
  tc[is.na(coverage),coverage := 0]
  tc[is.na(count),count := 0]
  #if(filename == "WTDN2") {
  #  tc[count<3,faivalue := 0]
  #  tc[faivalue<0.1,faivalue := 0]
  #}
  #tc[,sample:=filename]
  return(tc)
}
#计算 
tc1 <- get_coverage(inputFile)
tc2 <- get_coverage(tracFile)
dy <- merge(tc1,tc2,by=c("tRNA","start"))
dy[,faifc:=log2(faivalue.y/faivalue.x)]
#3.3 The condition that control is 0
basecoverage<-setDT(read.table(file=controlreadcoverage))
setnames(basecoverage,c("tRNA","start","coverage_input"))
#提取对照是0，处理组不是0的结果
data_control_is0<-dy[-which(dy$start==1),] #起始位置肯定不是cleavage位点，这种情况要删除掉。
data_control_is0<-data_control_is0[which(data_control_is0$faifc==Inf),]
##合并
data_control_is0_tc = merge(basecoverage,data_control_is0,by=c("tRNA","start"))#
data_control_is0_tc[,c("coverage.x","faifc"):=NULL]
setnames(data_control_is0_tc,c("count.x","faivalue.x","coverage.y","count.y","faivalue.y"),c("count_input","faivalue_input","coverage_treated","count_treated","faivalue_treated"))
data_control_is0_tc_result<-data_control_is0_tc[coverage_input>input_basecoverage_value]
data_control_is0_tc_result[, pvalue := fisher_greater_pvalue(coverage_input, count_input, coverage_treated, count_treated)]
data_control_is0_tc_result<-data_control_is0_tc_result[pvalue<pvalue_threshold]
data_control_is0_tc_result[transcript_seqs, trnaseq:=i.seq, on=.(tRNA)]
data_control_is0_tc_result[, peakseq := toupper(substr(trnaseq, start-4, start+2))]
data_control_is0_tc_result<- data_control_is0_tc_result[nchar(peakseq) >=7]
#data_control_is0_tc_result[, Gandcleavage := toupper(substr(trnaseq, start-1,start ))]
data_control_is0_tc_result[, modificationbase := toupper(substr(trnaseq, start-1,start-1))]
#data_control_is0_tc_result_1 <- subset(data_control_is0_tc_result, modificationbase  == "G")
#data_control_is0_tc_result_1[,modificationbase :=NULL]

data_control_is0_tc_result[,faivalue_treated := signif(faivalue_treated,4)]
data_control_is0_tc_result[,pvalue := signif(pvalue,4)] #signif定义有几位有效数字。
setnames(data_control_is0_tc_result,c('start'),c('site'))
write.table(data_control_is0_tc_result, file=paste0(outdir,"/result_control_iszero.txt"),quote=F, row.names=F, col.names=T, sep="\t")

#####################new code(for obtain the motif_zero.fasta)################
# 合并 tRNAid 和 site 列，创建新的 ID 列
data_control_is0_tc_result[, sequence_id := paste(tRNA, site, sep = "|")]
# 提取上下游 10bp 的序列
data_control_is0_tc_result[, extracted_seq := toupper(substr(trnaseq, site-11, site+9))]
# 确保序列长度为21bp
data_control_is0_tc_result <- data_control_is0_tc_result[nchar(extracted_seq) == 21]
# 创建 DNAStringSet 对象
sequences <- DNAStringSet(data_control_is0_tc_result$extracted_seq)
names(sequences) <- data_control_is0_tc_result$sequence_id
# 将 DNAStringSet 对象写入 FASTA 文件
writeXStringSet(sequences, filepath =paste0(outdir,"/motif_zero.fasta"))
##############################################################################


write_clean_cleavage_bundle(
  data_control_is0_tc_result,
  txt_path = paste0(outdir, "/clean_result_control_iszero.txt"),
  json_path = paste0(outdir, "/clean_result_control_iszero.json")
)


#################################################################################################################

dy[is.infinite(faifc),faifc := 0]
dy[is.na(faifc),faifc := 0]
setnames(dy, c('tRNA','site','coverage_input','count_input','faivalue_input','coverage_treated', 'count_treated','faivalue_treated',"faivalue_foldChange"))

###########################
#我添加了一列type1以方便作图
options(bitmapType='cairo') #用这个来解决服务器不能画图的问题么？
dy[,type0:=sub("\\|.*","",tRNA)]
dy[,type1:=gsub("chr\\S+?-(\\w+)$","\\1",type0)]
dy[,"type0" := NULL]

dy_figure_pre<-dy
#加上pvalue这列是为了方便后面画图是把pvalue>0.05的峰过滤掉，不需要的话就删除
#write.table(dy_figure_pre, file=paste0(outdir,"/dy_figure_pre3.txt"),quote=F, row.names=F, col.names=T, sep="\t")

dy_figure_pre[, pvalue := fisher_greater_pvalue(coverage_input, count_input, coverage_treated, count_treated)]
#write.table(dy_figure_pre, file=paste0(outdir,"/dy_figure_pre2.txt"),quote=F, row.names=F, col.names=T, sep="\t")
########5. control is not 0， 结果输出
#list output
dy <- dy[faivalue_foldChange>foldChange,]#the default value of foldChange is 6

dy <- dy[count_treated > count_treated_value ]  #count_treated_value默认值为10；cleavageratio默认值为0.2
dy <- dy[faivalue_treated > cleavageratio]
#dy_figure<-dy #准备移动位置

dy[transcript_seqs, tRNAseq:=i.seq, on=.(tRNA)]
dy[, peakseq := toupper(substr(tRNAseq, site-4, site+2))]
#dy[, Gandcleavage := toupper(substr(tRNAseq, site-1, site))]
dy[, modificationbase  := toupper(substr(tRNAseq, site-1,site-1))]
#dy<-subset(dy, modificationbase  == "G")
#dy[,modificationbase :=NULL]


#dy[,"tRNAseq" := NULL]

dy <- dy[nchar(peakseq) >=7] #按照提取的特征不应该都是7个碱基么
dy[, pvalue := fisher_greater_pvalue(coverage_input, count_input, coverage_treated, count_treated)]
#dy <- dy[pvalue<0.001]
dy <- dy[pvalue<pvalue_threshold]#此版本加了这样一行代码

dy_figure<-dy

dy[,faivalue_input := signif(faivalue_input,4)]
dy[,faivalue_treated := signif(faivalue_treated,4)]
dy[,faivalue_foldChange := signif(faivalue_foldChange,4)]
dy[,pvalue := signif(pvalue,4)] #signif定义有几位有效数字。
#singif保留：signif(6.03253,3) 结果是6.03；signif(603253,3) 结果是603000
#dy[,tRNAtype := type] #此版本去掉了这一行因为所有的都是tRNA
dy[,type1:=NULL]

write.table(dy, file=paste0(outdir,"/result_control_notzero.txt"),quote=F, row.names=F, col.names=T, sep="\t")

#jsonlite::write_json(dy,paste0(outdir,"/result_control_notzero.json"))

#####################new code(for obtain the motif_notzero.fasta)################
# 合并 tRNAid 和 site 列，创建新的 ID 列
dy[, sequence_id := paste(tRNA, site, sep = "|")]
# 提取上下游 10bp 的序列
dy[, extracted_seq := toupper(substr(tRNAseq, site-11, site+9))]
# 确保序列长度为21bp
dy <- dy[nchar(extracted_seq) == 21]
# 创建 DNAStringSet 对象
sequences <- DNAStringSet(dy$extracted_seq)
names(sequences) <- dy$sequence_id
# 将 DNAStringSet 对象写入 FASTA 文件
writeXStringSet(sequences, filepath =paste0(outdir,"/motif_notzero.fasta"))
##############################################################################

###################################################################
write_clean_cleavage_bundle(
  dy,
  txt_path = paste0(outdir, "/clean_result_control_notzero.txt"),
  json_path = paste0(outdir, "/clean_result_control_notzero.json")
)

#############################6. 作图数据输出#######################################
bb=data.table(tRNA=unique(dy_figure[,tRNA]))
dy_figure=dy_figure_pre[bb,on=.(tRNA)]
dy_figure[,tRNA:=sub("\\|.*","",tRNA)]

write.table(dy_figure, file=paste0(outdir,"/figure_data.txt"),quote=F, row.names=F, col.names=T, sep="\t")

tRNA_names <- unique(dy_figure$tRNA)
output_file <- file.path(outdir, "tRNA_list.txt")
writeLines(tRNA_names, con = output_file)

resultTxt <- dir(outdir, full.names = TRUE, pattern = ".txt$")
resultCsv <- dir(outdir, full.names = TRUE, pattern = ".csv$")
resultJson <- dir(outdir, full.names = TRUE, pattern = ".json$")
resultFasta <- dir(outdir, full.names = TRUE, pattern = ".fasta$")


#get_log_status("Job completed", "100")
