import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import MonitorDashboard from './MonitorDashboard';
import 'tailwindcss/tailwind.css';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MonitorDashboard />} />
      </Routes>
    </Router>
  );
}
