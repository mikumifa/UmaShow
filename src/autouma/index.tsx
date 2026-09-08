import { createRoot } from 'react-dom/client';
import AutoUmaApp from './App';
import { initializeAutoUmaBridge } from './mobile/bridge';

const container = document.getElementById('root') as HTMLElement;

initializeAutoUmaBridge()
  .then(() => {
    createRoot(container).render(<AutoUmaApp />);
  })
  .catch((error) => {
    const detail = String((error as Error)?.message || error || '未知错误');
    container.innerHTML = `
      <main style="padding:24px;font-family:sans-serif;color:#334155">
        <h1 style="font-size:18px">AutoUma 初始化失败</h1>
        <p style="line-height:1.6">${detail.replace(/[&<>"']/g, (value) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[value] || value))}</p>
      </main>
    `;
  });
