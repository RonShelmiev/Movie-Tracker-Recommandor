import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { CatalogueProvider } from './lib/catalogue';
import { CloudProvider } from './lib/cloudsync';
import { UpdateBanner } from './components/UpdateBanner';
import { StoreProvider } from './lib/store';
// Order matters and is load-bearing. global.css used to @import layout.css
// at the top, which put every layout.css media query BEHIND global.css's
// unconditional rules — so `.h1`, `.chip`, `.btn`, `.meta` and the rest kept
// their desktop sizes on a phone however the mobile block was written.
// Listing them here puts layout.css last, where the responsive rules belong.
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogueProvider>
      <StoreProvider>
        {/* Inside both: sync reads the store and writes the film cache. */}
        <CloudProvider>
          <UpdateBanner />
          <HashRouter>
            <App />
          </HashRouter>
        </CloudProvider>
      </StoreProvider>
    </CatalogueProvider>
  </StrictMode>,
);
