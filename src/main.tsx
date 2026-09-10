import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { CatalogueProvider } from './lib/catalogue';
import { StoreProvider } from './lib/store';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogueProvider>
      <StoreProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StoreProvider>
    </CatalogueProvider>
  </StrictMode>,
);
