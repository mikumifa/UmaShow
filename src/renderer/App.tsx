import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import KeepAlive, { AliveScope } from 'react-activation';
import MonitorDashboard from './MonitorDashboard';
import 'tailwindcss/tailwind.css';
import RaceDataPage from './RaceDataPage';
import HiddenNavigator from '../components/HiddenNavigator';
import RaceList from './RaceList';

export default function App() {
  return (
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
  );
}
