// Shared behaviour for projects/*.html: mobile menu, click-to-load YouTube, image lightbox.
(() => {
  const nav = document.querySelector('.site-nav');
  const toggle = nav && nav.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', String(nav.classList.toggle('open')));
    });
  }

  // The YouTube player (~1 MB) loads only on click; without JS the link opens YouTube.
  document.querySelectorAll('a.yt[data-yt]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(link.dataset.yt)}?autoplay=1&rel=0`;
      frame.title = link.dataset.title || 'YouTube video';
      frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      link.replaceWith(frame);
      frame.focus();
    });
  });

  const zoomLinks = document.querySelectorAll('a[data-zoom]');
  if (!zoomLinks.length || typeof HTMLDialogElement !== 'function') return;
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lightbox-close';
  close.setAttribute('aria-label', 'Close image');
  close.textContent = '\u00d7';
  const img = document.createElement('img');
  dialog.append(close, img);
  document.body.append(dialog);
  dialog.addEventListener('click', (event) => {
    if (event.target !== img) dialog.close();
  });
  zoomLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const thumb = link.querySelector('img');
      img.src = link.href;
      img.alt = thumb ? thumb.alt : '';
      dialog.showModal();
    });
  });
})();
