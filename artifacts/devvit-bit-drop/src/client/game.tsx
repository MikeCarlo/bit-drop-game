import '@bitdrop/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@bitdrop/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
