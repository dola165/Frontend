// Synthetic family: two children the coach acts for as a parent. Shown only to a browser that
// carries the `gk-sandbox-family=1` cookie, so the coach's own views stay as they are. All fictional.
const year = new Date().getFullYear();
export const FAMILY = [
  { id: 9101, name: 'Nino Gelashvili', dateOfBirth: `${year - 9}-05-14`, gender: 'FEMALE' },
  { id: 9102, name: 'Saba Gelashvili', dateOfBirth: `${year - 12}-02-03`, gender: 'MALE' },
];
export const familyRequest = headers => /(?:^|;\s*)gk-sandbox-family=1(?:;|$)/.test(String(headers?.cookie ?? ''));
