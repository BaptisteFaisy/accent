import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const conteneur = document.getElementById('root');
if (!conteneur) throw new Error('#root absent');

createRoot(conteneur).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
