// Shared behaviour for projects/*.html: mobile menu, projects menu, click-to-load YouTube, image lightbox.
(() => {
  const nav = document.querySelector('.site-nav');
  const toggle = nav && nav.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', String(nav.classList.toggle('open')));
    });
  }

  // Same groups and order as the Projects section of home.html; update both when adding a project.
  const PROJECTS = [
    ['Featured work', [
      ['72ns-gateway.html', '72ns Gateway'],
      ['wifi-har-versal.html', 'Wi-Fi HAR on the Versal AI Engine'],
      ['sma.html', 'SMA Engine'],
      ['cognitive-silo.html', 'Cognitive Silo'],
    ]],
    ['AMD designs & FPGA', [
      ['versal-ethernet.html', 'Versal Ethernet designs'],
      ['zcu102-ethernet.html', 'ZCU102 Ethernet designs'],
      ['cummings-fifo.html', 'Asynchronous FIFO'],
      ['workstation.html', 'Workstation build'],
    ]],
    ['Systems & hardware', [
      ['https://collide-o-scope-msu.github.io/', 'WRECKS senior design'],
      ['dc-dc-dissection.html', 'DC-DC converter teardown'],
      ['covid-drone.html', 'COVID-19 drone'],
    ]],
    ['Sandbox', [
      ['hack-computer-basys3.html', 'NAND to Tetris on a Basys3'],
      ['rc-plane.html', 'Shark Aero RC plane'],
      ['har-wifi-radar.html', 'Wi-Fi vs. radar HAR'],
      ['soil-moisture-logger.html', 'Soil-moisture logger'],
      ['line-follower-pic24.html', 'Line follower (dsPIC33)'],
      ['iot-temp-monitor.html', 'T.A.A.F.U. fan unit'],
      ['video-player.html', 'Video Player Pro'],
      ['diy-rth-drone.html', 'DIY return-to-home drone'],
      ['analog-line-follower.html', 'Analog line follower'],
    ]],
  ];
  const PARENT_PAGE = {
    'sma-architecture.html': 'sma.html',
    'cognitive-silo-architecture.html': 'cognitive-silo.html',
    'dc-dc-gallery.html': 'dc-dc-dissection.html',
  };

  const projectsLink = nav && nav.querySelector('.nav-links a[href$="home.html#page-3"]');
  if (projectsLink) {
    const file = location.pathname.split('/').pop();
    const here = PARENT_PAGE[file] || file;
    const item = projectsLink.parentElement;
    item.classList.add('nav-projects', 'is-current');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-projects-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'projects-menu');
    button.append('Projects');
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    button.append(caret);

    const menu = document.createElement('div');
    menu.className = 'projects-menu';
    menu.id = 'projects-menu';
    menu.hidden = true;
    const grid = document.createElement('div');
    grid.className = 'projects-menu-grid';
    for (const [title, entries] of PROJECTS) {
      const group = document.createElement('div');
      const heading = document.createElement('p');
      heading.className = 'projects-menu-title';
      heading.textContent = title;
      const list = document.createElement('ul');
      for (const [href, label] of entries) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        if (/^https?:/.test(href)) {
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent += ' \u2197';
        }
        if (href === here) link.setAttribute('aria-current', 'page');
        const li = document.createElement('li');
        li.append(link);
        list.append(li);
      }
      group.append(heading, list);
      grid.append(group);
    }
    const all = document.createElement('a');
    all.className = 'projects-menu-all';
    all.href = projectsLink.getAttribute('href');
    all.textContent = 'All projects on the home page \u2192';
    menu.append(grid, all);
    projectsLink.replaceWith(button);
    item.append(menu);

    const setOpen = (open) => {
      menu.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    };
    // Hover opens the menu on desktop; click, tap and keyboard work everywhere.
    const canHover = window.matchMedia('(hover: hover) and (min-width: 861px)');
    let hoverTimer;
    let openedByHoverAt = 0;
    item.addEventListener('mouseenter', () => {
      if (!canHover.matches) return;
      clearTimeout(hoverTimer);
      if (menu.hidden) {
        setOpen(true);
        openedByHoverAt = Date.now();
      }
    });
    item.addEventListener('mouseleave', () => {
      if (!canHover.matches) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (!item.contains(document.activeElement)) setOpen(false);
      }, 200);
    });
    button.addEventListener('click', () => {
      if (Date.now() - openedByHoverAt < 400) return;
      setOpen(menu.hidden);
    });
    item.addEventListener('focusout', (event) => {
      if (!item.contains(event.relatedTarget) && !item.matches(':hover')) setOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (!item.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !menu.hidden) {
        setOpen(false);
        button.focus();
      }
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
