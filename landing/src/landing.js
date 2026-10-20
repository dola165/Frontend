// The gate on app.grasskickz.com sends a wrong password back here with ?wrong=1.
// The team link (#team) also shows the field on small screens, and the gate
// keeps that link when it sends someone back.
const form = document.querySelector('.gate');

if (form) {
  const field = form.elements.namedItem('password');
  const via = form.elements.namedItem('via');
  const note = document.getElementById('gate-error');
  const onTeamLink = () => location.hash === '#team';
  const syncTeamLink = () => document.documentElement.classList.toggle('show-gate', onTeamLink());

  syncTeamLink();
  addEventListener('hashchange', syncTeamLink);
  form.addEventListener('submit', () => {
    via.value = onTeamLink() ? 'team' : '';
  });

  if (new URLSearchParams(location.search).get('wrong') === '1') {
    note.hidden = false;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', note.id);
    field.focus();
    history.replaceState(null, '', location.pathname + location.hash);
    field.addEventListener('input', () => {
      note.hidden = true;
      field.removeAttribute('aria-invalid');
    }, { once: true });
  }
}
