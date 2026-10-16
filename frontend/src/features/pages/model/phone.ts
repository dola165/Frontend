/**
 * A phone number as people write it, from the compact form a backend stores: a Georgian mobile is
 * "+995 599 12 34 56". Any other number stays as it was typed.
 */
export function phoneDisplay(value: string): string {
  const georgian = /^\+?995(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(value.replace(/[\s-]/g, ''));
  return georgian ? `+995 ${georgian[1]} ${georgian[2]} ${georgian[3]} ${georgian[4]}` : value;
}
