import LoadDataPage from "./components/LoadDataPage";
import CleavagePage from "./components/CleavagePage";
import DifferentialAnalysisPage from "./components/DifferentialAnalysisPage";
import MappingStatisticsPage from "./components/MappingStatisticsPage";
import WelcomePage from "./components/WelcomePage";

export default function App({ config = {} }) {
  const view = config.view || "welcome";

  return (
    <div className="shell-app">
      <div className="shell-atmosphere" aria-hidden="true" />
      <main className="shell-main">
        {view === "load-data" ? (
          <LoadDataPage config={config.loadData || {}} />
        ) : view === "cleavage" ? (
          <CleavagePage config={config.cleavage || {}} />
        ) : view === "differential-analysis" ? (
          <DifferentialAnalysisPage config={config.differentialAnalysis || {}} />
        ) : view === "mapping-statistics" ? (
          <MappingStatisticsPage config={config.mappingStatistics || {}} />
        ) : (
          <WelcomePage hero={config.hero || {}} />
        )}
      </main>
    </div>
  );
}
