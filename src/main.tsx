import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PeaApp } from './PeaApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PeaApp />
  </StrictMode>,
);
