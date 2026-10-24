// src/main.tsx
// Entry point — mounts the React app into the DOM.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme, getInitialTheme } from './lib/theme';

// Initialize theme (defaults to light mode)
applyTheme(getInitialTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
