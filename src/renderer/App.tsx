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

export default function App() {
  return (
    <div className="min-h-screen font-sans">
      <style>
        {`
          img {
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
          }
          input,
          textarea,
          [contenteditable='true'] {
            user-select: text;
            -webkit-user-select: text;
          }
        `}
      </style>
      <Router>
        <AliveScope>
          <HiddenNavigator />
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
        </AliveScope>
      </Router>
    </div>
  );
}
