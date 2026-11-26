import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <LanguageProvider>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </LanguageProvider>
  </AppErrorBoundary>
);
