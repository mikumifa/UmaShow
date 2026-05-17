import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import KeepAlive, { AliveScope } from 'react-activation';
import MonitorDashboard from 'renderer/ui/MonitorDashboard';
import 'tailwindcss/tailwind.css';
import RaceDataPage from 'renderer/ui/RaceDataPage';
import HiddenNavigator from 'renderer/components/HiddenNavigator';
import RaceList from 'renderer/ui/RaceList';

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
          </Routes>
        </AliveScope>
      </Router>
    </div>
  );
}
