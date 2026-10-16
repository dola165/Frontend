import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/theme.css';
import '../../design/tokens.css';
import './navigation-study.css';
import { NavigationStudy } from './NavigationStudy';

// F11 study for the owner. Separate from App, authentication and APIs; delete it once the owner has chosen.
createRoot(document.getElementById('root')!).render(<StrictMode><NavigationStudy /></StrictMode>);
