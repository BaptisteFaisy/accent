import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { enregistrerServiceWorker } from './pwa';
import './index.css';

const conteneur = document.getElementById('root');
if (!conteneur) throw new Error('#root absent');

createRoot(conteneur).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA (RNF-08) : échec silencieux, l'app fonctionne parfaitement sans SW.
void enregistrerServiceWorker();
