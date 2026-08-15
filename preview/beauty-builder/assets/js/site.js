const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');

if (toggle && nav) {
  const closeNav = () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  };

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeNav();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNav();
      toggle.focus();
    }
  });
}

const filename = window.location.pathname.split('/').pop() || 'index.html';
const sectionPages = {
  'microneedling.html': 'treatments.html',
  'skin-classic.html': 'treatments.html',
  'get-glowing-peel.html': 'treatments.html',
  'elaine-brennan-peel.html': 'treatments.html'
};
const activePage = sectionPages[filename] || filename;
document.querySelectorAll('.site-nav a[href]').forEach((link) => {
  const linkPage = new URL(link.href, window.location.href).pathname.split('/').pop() || 'index.html';
  if (linkPage === activePage) link.setAttribute('aria-current', 'page');
});

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = new Date().getFullYear();
});
