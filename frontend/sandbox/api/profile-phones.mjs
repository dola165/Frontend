// Invented sandbox data only. The phone each person adds on their own profile for colleagues (the owner, 28 October
// 2026): the profile read returns it to the person only, and Club office › Staff shows it to fellow staff unless they
// hide it there. Never a sign-in phone.
const phones = new Map();

export const profilePhone = id => phones.get(Number(id)) ?? null;

/** As PUT /users/me checks it: digits with an optional +, and spaces, dashes or brackets. Empty removes it. */
export function setProfilePhone(id, typed) {
  const phone = String(typed).trim().replace(/\s+/g, ' ');
  if (!phone) { phones.delete(Number(id)); return { phone: null }; }
  const digits = phone.replace(/\D/g, '').length;
  if (!/^\+?[\d ()-]+$/.test(phone) || digits < 6 || digits > 15 || phone.length > 32) return { error: 'Enter a phone number colleagues can call, such as +995 555 12 34 56.' };
  phones.set(Number(id), phone);
  return { phone };
}

/** Whole years from a birth date, or -1 when there is none (as the server's MinorPolicy). */
export const ageOf = dateOfBirth => {
  if (!dateOfBirth) return -1;
  const born = new Date(dateOfBirth), now = new Date();
  return now.getFullYear() - born.getFullYear() - (now < new Date(now.getFullYear(), born.getMonth(), born.getDate()) ? 1 : 0);
};
