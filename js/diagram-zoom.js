/* diagram-zoom.js — click-to-zoom / pan lightbox for Mermaid diagrams and figures.
 * No dependencies. Marks .mermaid, .figure and .gallery figure as zoomable, and on
 * click opens a fullscreen overlay with wheel-zoom, drag-pan and toolbar controls.
 */
(function () {
  'use strict';

  var overlay, stage, content, captionEl;
  var scale = 1, tx = 0, ty = 0, minScale = 0.05, maxScale = 16;
  var natW = 0, natH = 0;
  var dragging = false, moved = false, sx = 0, sy = 0, stx = 0, sty = 0;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'zoom-overlay';
    overlay.innerHTML =
      '<div class="zoom-stage"><div class="zoom-content"></div></div>' +
      '<div class="zoom-toolbar">' +
        '<button data-act="out" title="Zoom out">−</button>' +
        '<button data-act="reset" title="Fit to screen">⤢</button>' +
        '<button data-act="in" title="Zoom in">+</button>' +
        '<button data-act="close" title="Close (Esc)">✕</button>' +
      '</div>' +
      '<div class="zoom-caption"></div>';
    document.body.appendChild(overlay);
    stage = overlay.querySelector('.zoom-stage');
    content = overlay.querySelector('.zoom-content');
    captionEl = overlay.querySelector('.zoom-caption');

    overlay.querySelector('.zoom-toolbar').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'close') return close();
      if (a === 'reset') return fit();
      zoomAroundCenter(a === 'in' ? 1.3 : 1 / 1.3);
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      zoomAroundPoint(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    stage.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
      stage.classList.add('grabbing');
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      tx = stx + (e.clientX - sx); ty = sty + (e.clientY - sy);
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) moved = true;
      apply();
    });
    function endDrag() { dragging = false; stage.classList.remove('grabbing'); }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('click', function (e) {
      if (!moved && e.target === stage) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') zoomAroundCenter(1.3);
      else if (e.key === '-') zoomAroundCenter(1 / 1.3);
      else if (e.key === '0') fit();
    });
  }

  function apply() {
    content.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function zoomAroundPoint(factor, px, py) {
    var ns = clamp(scale * factor, minScale, maxScale);
    tx = px - (px - tx) * (ns / scale);
    ty = py - (py - ty) * (ns / scale);
    scale = ns; apply();
  }
  function zoomAroundCenter(factor) {
    zoomAroundPoint(factor, stage.clientWidth / 2, stage.clientHeight / 2);
  }

  function fit() {
    var vw = stage.clientWidth, vh = stage.clientHeight;
    scale = Math.min((vw * 0.94) / natW, (vh * 0.84) / natH);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    minScale = Math.min(0.05, scale * 0.5);
    tx = (vw - natW * scale) / 2;
    ty = (vh - natH * scale) / 2;
    apply();
  }

  function natSize(node) {
    if (node.tagName.toLowerCase() === 'svg') {
      var vb = node.getAttribute('viewBox');
      if (vb) {
        var p = vb.split(/[\s,]+/).map(Number);
        if (p.length === 4 && p[2] > 0) return { w: p[2], h: p[3] };
      }
      var w = parseFloat(node.getAttribute('width')) || node.getBoundingClientRect().width;
      var h = parseFloat(node.getAttribute('height')) || node.getBoundingClientRect().height;
      return { w: w || 800, h: h || 600 };
    }
    return {
      w: node.naturalWidth || node.getBoundingClientRect().width || 800,
      h: node.naturalHeight || node.getBoundingClientRect().height || 600
    };
  }

  function openZoom(node, caption) {
    var n = natSize(node);
    natW = n.w; natH = n.h;
    var clone = node.cloneNode(true);
    if (clone.tagName.toLowerCase() === 'svg') {
      clone.removeAttribute('width');
      clone.removeAttribute('height');
      clone.style.maxWidth = 'none';
    }
    content.innerHTML = '';
    content.style.width = natW + 'px';
    content.style.height = natH + 'px';
    content.appendChild(clone);
    captionEl.textContent = caption || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    fit();
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    content.innerHTML = '';
  }

  function markZoomable() {
    document.querySelectorAll('.mermaid, .figure, .gallery figure').forEach(function (el) {
      el.classList.add('zoomable');
    });
  }

  function init() {
    buildOverlay();
    markZoomable();
    // re-mark after Mermaid finishes (class persists, but harmless to repeat)
    setTimeout(markZoomable, 800);
    setTimeout(markZoomable, 2000);

    document.addEventListener('click', function (e) {
      if (overlay.classList.contains('open')) return;
      if (e.target.closest('a')) return; // don't hijack links (e.g. figcaption links)
      var host = e.target.closest('.mermaid, .figure, .gallery figure');
      if (!host) return;
      var node = host.querySelector('svg') || host.querySelector('img');
      if (!node) return;
      var cap = host.querySelector('figcaption');
      e.preventDefault();
      openZoom(node, cap ? cap.textContent.trim() : '');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
