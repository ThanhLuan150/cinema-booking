import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/i18n';
import { App } from '@/app/App';
import { Providers } from '@/app/providers';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);
