/** Local visual QA only: renders in-memory data without requesting any service. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AgentHubFixture, type AgentHubFixtureVariant } from './AgentHubFixture';
import { apiClient } from '../../../api/axiosConfig';
import i18n from '../../../i18n';
import '../../../index.css';
import '../../../styles/product-identity.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    throw new Error('Local development fixture only');
}
apiClient.defaults.adapter = async () => { throw new Error('Agent visual fixture does not permit service requests'); };
const params = new URLSearchParams(location.search);
const language = params.get('lang') === 'ka' ? 'ka' : 'en';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
document.documentElement.lang = language;
await i18n.changeLanguage(language);
const variants: AgentHubFixtureVariant[] = ['ready', 'empty', 'error', 'loading', 'protected'];
const requested = params.get('case') as AgentHubFixtureVariant;
const variant = variants.includes(requested) ? requested : 'ready';
createRoot(document.getElementById('root')!).render(<MemoryRouter><AgentHubFixture variant={variant} /></MemoryRouter>);
