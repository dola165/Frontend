import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OverviewStudy } from './OverviewStudy';
import './overview-study.css';

// Deliberately separate from App, authentication, APIs and the production entry.
createRoot(document.getElementById('root')!).render(<StrictMode><OverviewStudy /></StrictMode>);
