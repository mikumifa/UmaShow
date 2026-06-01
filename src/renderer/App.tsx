import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import KeepAlive, { AliveScope } from 'react-activation';
import MonitorDashboard from 'renderer/ui/MonitorDashboard';
import 'tailwindcss/tailwind.css';
import RaceDataPage from 'renderer/ui/RaceDataPage';
import HiddenNavigator from 'renderer/components/HiddenNavigator';
import RaceList from 'renderer/ui/RaceList';
import RaceStats from 'renderer/ui/RaceStats';
import TrainingHistory from 'renderer/ui/TrainingHistory';

export default function App() {
  return (
    <div className="min-h-screen select-none">
      <style>
        {`
          img {
            user-select: none;
            -webkit-user-select: none;
            -webkit-user-drag: none;
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
          </Routes>
        </AliveScope>
      </Router>
    </div>
  );
}
