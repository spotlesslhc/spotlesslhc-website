// Esc closes the desktop Services dropdown (it opens on hover or focus) and puts focus back on "Services".
// The "shut" class hides it until the mouse leaves, or focus leaves or re-enters the dropdown.
document.querySelectorAll('.nav-drop').forEach(d => {
  const link = d.querySelector('a');
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !(d.matches(':hover') || d.contains(document.activeElement))) return;
    d.classList.add('shut');
    if (d.contains(document.activeElement)) link.focus();
  });
  const reset = e => { if (!d.contains(e.relatedTarget)) d.classList.remove('shut'); };
  d.addEventListener('focusin', reset);
  d.addEventListener('focusout', reset);
  d.addEventListener('mouseleave', () => d.classList.remove('shut'));
});
