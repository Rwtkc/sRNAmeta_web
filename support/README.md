sRNAmeta support files

Place app-level support files here on Linux deployments.

Required for the current demo and target-gene workflow:
- `hsa_synthetic_raw_counts_6samples.txt`
- `Conserved_Site_Context_Scores.hsa.txt` or `Conserved_Site_Context_Scores.txt`

These files are resolved through `SRNAMETA_SUPPORT_ROOT`.
When `SRNAMETA_SUPPORT_ROOT` is not set on Linux, the app defaults to this `support/` directory under the project root.
