import './game-entry.css';
import '@bitdrop/index.css';

import { connectRealtime } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@bitdrop/App';

window.__bitdropConnectRealtime = (channel, onMessage) => {
  const conn = connectRealtime({ channel, onMessage });
  return {
    disconnect: () => {
      void conn.disconnect();
    },
  };
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
