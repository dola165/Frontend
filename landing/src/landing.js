// The lock sends a wrong password back to the same address with #wrong.
if (location.hash === '#wrong') {
  const note = document.getElementById('pass-wrong');
  const field = document.getElementById('pass');
  note.hidden = false;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', note.id);
  history.replaceState(null, '', location.pathname + location.search);
  field.focus();
}
