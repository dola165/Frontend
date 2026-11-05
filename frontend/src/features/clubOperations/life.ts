import type { Bootstrap } from './api';

/** Life (private wellbeing) is held back in release 17: without the server's `care.life`, nothing of it shows. */
export const LIFE = 'WELLBEING';

/** The club's tools, records and settings as a person sees them while Life is held back. */
export const withoutLife = (boot: Bootstrap): Bootstrap => ({
  ...boot,
  definitions: boot.definitions.filter(definition => definition.module !== LIFE),
  permissions: boot.permissions.filter(tool => !tool.startsWith(`${LIFE}:`)),
  modules: boot.modules.filter(module => module.id !== LIFE),
  links: boot.links.filter(link => link.module !== LIFE),
  settings: { ...boot.settings, enabled_modules: boot.settings.enabled_modules.filter(module => module !== LIFE) },
});
