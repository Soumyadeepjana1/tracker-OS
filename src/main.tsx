import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { store } from '@/store/store';
import { timerStore } from '@/store/timer';
import { applyTheme } from '@/store/defaults';

/**
 * Entry point.
 *
 * Nothing is awaited before the first paint: the store boots asynchronously and
 * the shell renders a skeleton until IndexedDB has been read, which keeps the
 * very first paint fast even with a large database.
 */
const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing from index.html');

applyTheme(store.getState().settings.theme);
timerStore.hydrate();
void store.init();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
