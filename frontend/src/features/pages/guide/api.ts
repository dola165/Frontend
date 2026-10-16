import { appLanguage } from '../../../utils/formatting';
import type { SetupKey } from '../model/kinds';

export interface PetAnswer { step: SetupKey | null; answer: string | null }

/** Ask the sandbox's pet guide; a slow or missing model gives an empty answer and the pet keeps its scripted line. */
export async function askPet(question: string): Promise<PetAnswer> {
  try {
    const response = await fetch('/api/sandbox/pet-guide', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, lang: appLanguage() === 'ka' ? 'ka' : 'en' }), signal: AbortSignal.timeout(12000),
    });
    return response.ok ? await response.json() as PetAnswer : { step: null, answer: null };
  } catch { return { step: null, answer: null }; }
}
