import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { SoundProvider } from './hooks/useSound.jsx';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './components/RetroWindow.css';
import './sections/sections.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SoundProvider>
        <App />
      </SoundProvider>
    </BrowserRouter>
  </StrictMode>,
);
