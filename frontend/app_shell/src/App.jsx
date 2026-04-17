import LoadDataPage from "./components/LoadDataPage";
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
        ) : view === "mapping-statistics" ? (
          <MappingStatisticsPage config={config.mappingStatistics || {}} />
        ) : (
          <WelcomePage hero={config.hero || {}} />
        )}
      </main>
    </div>
  );
}
