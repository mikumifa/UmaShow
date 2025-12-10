import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HiddenNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    window.electron.utils.navigation.onNavigate(({ path, state }) => {
      navigate(path, { state });
    });
  }, []);

  return null; // 不渲染任何东西
}
