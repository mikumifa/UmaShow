import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import KeepAlive, { AliveScope } from 'react-activation';
import MonitorDashboard from 'renderer/ui/MonitorDashboard';
import 'tailwindcss/tailwind.css';
import RaceDataPage from 'renderer/ui/RaceDataPage';
import HiddenNavigator from 'renderer/components/HiddenNavigator';
import RaceList from 'renderer/ui/RaceList';
import RaceStats from 'renderer/ui/RaceStats';
import TrainingHistory from 'renderer/ui/TrainingHistory';
import LeaderboardAnalysis from 'renderer/ui/LeaderboardAnalysis';
import AutoResearch from 'renderer/ui/AutoResearch';
import SuccessionPlanner from 'renderer/ui/SuccessionPlanner';
import AppMenuBar from 'renderer/components/AppMenuBar';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <style>
        {`
          img {
            -webkit-user-drag: none;
          }
          input,
          select,
          textarea,
          [contenteditable='true'] {
            pointer-events: auto;
            user-select: text !important;
            -webkit-user-select: text !important;
            -webkit-app-region: no-drag;
          }
          .app-drag-region {
            -webkit-app-region: drag;
          }
          .app-no-drag {
            -webkit-app-region: no-drag;
          }
          .app-route-content .min-h-screen {
            min-height: calc(100vh - 2.25rem);
          }
          .app-route-content .h-screen {
            height: calc(100vh - 2.25rem);
          }
        `}
      </style>
      <Router>
        <AliveScope>
          <HiddenNavigator />
          <AppMenuBar />
          <div className="app-route-content">
            <Routes>
              <Route
                path="/"
                element={
                  <KeepAlive name="Dashboard" cacheKey="Dashboard">
                    <MonitorDashboard />
                  </KeepAlive>
                }
              />
              <Route
                path="/races"
                element={
                  <KeepAlive name="RaceList" cacheKey="RaceList">
                    <RaceList />
                  </KeepAlive>
                }
              />
              <Route path="/race" element={<RaceDataPage />} />
              <Route
                path="/training-history"
                element={
                  <KeepAlive name="TrainingHistory" cacheKey="TrainingHistory">
                    <TrainingHistory />
                  </KeepAlive>
                }
              />
              <Route
                path="/race-stats"
                element={
                  <KeepAlive name="RaceStats" cacheKey="RaceStats">
                    <RaceStats />
                  </KeepAlive>
                }
              />
              <Route
                path="/loh"
                element={
                  <KeepAlive
                    name="LeaderboardAnalysis"
                    cacheKey="LeaderboardAnalysis"
                  >
                    <LeaderboardAnalysis />
                  </KeepAlive>
                }
              />
              <Route
                path="/auto-research"
                element={
                  <KeepAlive name="AutoResearch" cacheKey="AutoResearch">
                    <AutoResearch />
                  </KeepAlive>
                }
              />
              <Route
                path="/succession"
                element={
                  <KeepAlive
                    name="SuccessionPlanner"
                    cacheKey="SuccessionPlanner"
                  >
                    <SuccessionPlanner />
                  </KeepAlive>
                }
              />
              <Route
                path="/leaderboard-analysis"
                element={
                  <KeepAlive
                    name="LeaderboardAnalysis"
                    cacheKey="LeaderboardAnalysis"
                  >
                    <LeaderboardAnalysis />
                  </KeepAlive>
                }
              />
            </Routes>
          </div>
        </AliveScope>
      </Router>
    </div>
  );
}
