
import { createRoot } from 'react-dom/client';
import App from './app/AppMultiFuel.tsx';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      void navigator.serviceWorker
        .getRegistrations()
        .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
        .then(() => caches.keys())
        .then(cacheNames => Promise.all(cacheNames.map(cacheName => caches.delete(cacheName))))
        .catch(() => {
          // Ignore cleanup errors in development.
        });
      return;
    }

    void navigator.serviceWorker.register('/sw.js');
  });
}
