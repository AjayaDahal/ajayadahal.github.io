/* wifi-har-replay.js — self-contained "live dashboard" replay widget.
 *
 * Plays back a representative AI-Engine feature stream (images/wifi-har/replay.json)
 * so the static portfolio page shows the same activity / breathing / fall metrics the
 * real on-board dashboard (live_dashboard.py) renders — no backend required.
 *
 * Usage:  WifiHarReplay.init('har-dashboard', 'images/wifi-har/replay.json');
 * No libraries, no CDN. Pure DOM + one <canvas>.
 */
(function (global) {
  'use strict';

  var COL = {
    bg: '#0a0e14', panel: '#161d27', border: '#2d3748',
    cyan: '#00d9ff', green: '#00ff9f', blue: '#42a5f5',
    amber: '#ffb020', red: '#ff5470', txt: '#e6e8eb', mut: '#9ca3af'
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function activityColor(a) {
    if (!a) return COL.mut;
    if (a.indexOf('FALL') === 0) return COL.red;
    if (a.indexOf('walking') >= 0 || a.indexOf('moving') >= 0) return COL.cyan;
    if (a.indexOf('breathing') >= 0) return COL.green;
    return COL.mut;
  }

  function build(container) {
    container.classList.add('har-widget');
    container.innerHTML = '';

    var head = el('div', 'har-head');
    var dot = el('span', 'har-dot');
    var title = el('span', 'har-title', 'VCK190 · WiFi-CSI Live Room Sensing');
    var badge = el('span', 'har-live', '● REPLAY');
    head.appendChild(dot); head.appendChild(title); head.appendChild(badge);

    var grid = el('div', 'har-grid');

    // Big activity tile
    var actTile = el('div', 'har-tile har-act');
    var actLabel = el('div', 'har-act-label', '—');
    var actSub = el('div', 'har-sub', 'activity');
    actTile.appendChild(actSub); actTile.appendChild(actLabel);

    // Presence
    var presTile = el('div', 'har-tile');
    var presVal = el('div', 'har-big', '—');
    presTile.appendChild(el('div', 'har-sub', 'presence'));
    presTile.appendChild(presVal);

    // Breathing
    var brTile = el('div', 'har-tile');
    var brVal = el('div', 'har-big', '—');
    brTile.appendChild(el('div', 'har-sub', 'breathing (bpm)'));
    brTile.appendChild(brVal);

    // Motion bar
    var motTile = el('div', 'har-tile');
    motTile.appendChild(el('div', 'har-sub', 'motion-band power'));
    var motBarWrap = el('div', 'har-bar');
    var motBar = el('div', 'har-bar-fill');
    var motTh = el('div', 'har-bar-th');
    motBarWrap.appendChild(motBar); motBarWrap.appendChild(motTh);
    var motVal = el('div', 'har-mot-val', '');
    motTile.appendChild(motBarWrap); motTile.appendChild(motVal);

    grid.appendChild(actTile);
    grid.appendChild(presTile);
    grid.appendChild(brTile);
    grid.appendChild(motTile);

    // Live CSI spectrogram: brt[33] windowed-DFT magnitude stacked over time
    var sgWrap = el('div', 'har-sg-wrap');
    var sgCap = el('div', 'har-sg-cap', 'Live CSI spectrogram <span>brt[33] windowed-DFT magnitude · stacked over time · 0–10 Hz</span>');
    var sgCanvas = el('canvas', 'har-sgram');
    sgWrap.appendChild(sgCap); sgWrap.appendChild(sgCanvas);

    // Canvas: scrolling CSI waveform + motion history
    var canvasWrap = el('div', 'har-canvas-wrap');
    var canvas = el('canvas', 'har-canvas');
    canvasWrap.appendChild(canvas);

    // Controls
    var ctrl = el('div', 'har-ctrl');
    var playBtn = el('button', 'har-btn', '⏸ Pause');
    var note = el('span', 'har-note', 'representative feature-stream replay — the board runs the same metrics on live AI-Engine features');
    ctrl.appendChild(playBtn); ctrl.appendChild(note);

    container.appendChild(head);
    container.appendChild(grid);
    container.appendChild(sgWrap);
    container.appendChild(canvasWrap);
    container.appendChild(ctrl);

    return {
      dot: dot, badge: badge, actTile: actTile, actLabel: actLabel,
      presVal: presVal, brVal: brVal, motBar: motBar, motTh: motTh, motVal: motVal,
      canvas: canvas, sgCanvas: sgCanvas, playBtn: playBtn
    };
  }

  function injectCSS() {
    if (document.getElementById('har-widget-css')) return;
    var css = `
    .har-widget{background:${COL.panel};border:1px solid ${COL.border};border-radius:14px;padding:18px;font-family:'JetBrains Mono',monospace;color:${COL.txt};}
    .har-head{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
    .har-dot{width:10px;height:10px;border-radius:50%;background:${COL.green};box-shadow:0 0 10px ${COL.green};animation:harpulse 1.4s infinite;}
    .har-title{font-weight:600;color:${COL.txt};font-size:.95rem;}
    .har-live{margin-left:auto;color:${COL.green};font-size:.72rem;letter-spacing:1px;border:1px solid ${COL.green};border-radius:20px;padding:2px 10px;}
    .har-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1.4fr;gap:12px;}
    .har-tile{background:#0d131b;border:1px solid ${COL.border};border-radius:10px;padding:14px;min-height:96px;}
    .har-sub{color:${COL.mut};font-size:.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
    .har-act-label{font-size:1.45rem;font-weight:800;line-height:1.15;}
    .har-big{font-size:1.6rem;font-weight:800;}
    .har-act{transition:border-color .2s;}
    .har-bar{position:relative;height:16px;background:#05090d;border-radius:8px;overflow:hidden;border:1px solid ${COL.border};margin-top:4px;}
    .har-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,${COL.blue},${COL.cyan});transition:width .18s,background .18s;}
    .har-bar-th{position:absolute;top:-2px;bottom:-2px;width:2px;background:${COL.amber};}
    .har-mot-val{margin-top:8px;font-size:.8rem;color:${COL.mut};}
    .har-canvas-wrap{margin-top:14px;background:#05090d;border:1px solid ${COL.border};border-radius:10px;overflow:hidden;}
    .har-canvas{display:block;width:100%;height:180px;}
    .har-sg-wrap{margin-top:14px;background:#05090d;border:1px solid ${COL.border};border-radius:10px;overflow:hidden;}
    .har-sg-cap{color:${COL.txt};font-size:.78rem;padding:9px 12px 0;font-weight:600;}
    .har-sg-cap span{display:block;color:${COL.mut};font-size:.68rem;font-weight:400;margin-top:2px;}
    .har-sgram{display:block;width:100%;height:200px;}
    .har-ctrl{display:flex;align-items:center;gap:14px;margin-top:12px;}
    .har-btn{background:#0d131b;color:${COL.txt};border:1px solid ${COL.border};border-radius:8px;padding:7px 16px;font-family:inherit;font-size:.82rem;cursor:pointer;transition:.2s;}
    .har-btn:hover{border-color:${COL.cyan};color:${COL.cyan};}
    .har-note{color:${COL.mut};font-size:.72rem;}
    .har-fall .har-act-label{color:${COL.red};}
    .har-flash{animation:harflash .5s ease-in-out 3;}
    @keyframes harpulse{0%,100%{opacity:1;}50%{opacity:.35;}}
    @keyframes harflash{0%,100%{background:#0d131b;}50%{background:rgba(255,84,112,.22);}}
    @media(max-width:760px){.har-grid{grid-template-columns:1fr 1fr;}}
    `;
    var s = el('style'); s.id = 'har-widget-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  function Renderer(ui, data) {
    var win = data.windows, i = 0, playing = true, last = 0;
    var motHist = [];
    var HISTLEN = 160;
    var ctx = ui.canvas.getContext('2d');
    var sgCtx = ui.sgCanvas.getContext('2d');
    var meta = data.meta || {};
    var binHz = meta.bin_hz || 0.3125;
    var SG_COLS = 150;         // spectrogram time depth (windows)
    var sgBuf = [];            // rolling list of brt[] vectors
    var sgScale = null;        // smoothed max for normalization

    function resize() {
      var dpr = window.devicePixelRatio || 1;
      var r = ui.canvas.getBoundingClientRect();
      ui.canvas.width = Math.max(320, r.width) * dpr;
      ui.canvas.height = 180 * dpr;
      var rs = ui.sgCanvas.getBoundingClientRect();
      ui.sgCanvas.width = Math.max(320, rs.width) * dpr;
      ui.sgCanvas.height = 200 * dpr;
    }
    window.addEventListener('resize', resize);
    resize();

    // jet-like colormap (blue -> cyan -> green -> yellow -> red), matches dashboard
    function cmap(t) {
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      var r = 1.5 - Math.abs(4 * t - 3), g = 1.5 - Math.abs(4 * t - 2), b = 1.5 - Math.abs(4 * t - 1);
      r = r < 0 ? 0 : (r > 1 ? 1 : r); g = g < 0 ? 0 : (g > 1 ? 1 : g); b = b < 0 ? 0 : (b > 1 ? 1 : b);
      return 'rgb(' + (r * 255 | 0) + ',' + (g * 255 | 0) + ',' + (b * 255 | 0) + ')';
    }

    function drawSgram() {
      var dpr = window.devicePixelRatio || 1;
      var W = ui.sgCanvas.width, H = ui.sgCanvas.height;
      var PL = 40 * dpr, PR = 10 * dpr, PT = 8 * dpr, PB = 20 * dpr;
      sgCtx.clearRect(0, 0, W, H);
      var iw = W - PL - PR, ih = H - PT - PB;
      if (iw < 20 || ih < 20 || !sgBuf.length) return;
      var nb = sgBuf[sgBuf.length - 1].length;
      var cw = iw / SG_COLS, ch = ih / nb, k, j;
      // rolling max (skip DC bin 0) for normalization
      var hi = 0;
      for (j = 0; j < sgBuf.length; j++) { var s = sgBuf[j]; for (k = 1; k < s.length; k++) if (s[k] > hi) hi = s[k]; }
      if (!(hi > 0)) hi = 1;
      sgScale = (sgScale == null) ? hi : Math.max(hi, sgScale * 0.9 + hi * 0.1);
      var top = sgScale, start = SG_COLS - sgBuf.length;
      for (j = 0; j < sgBuf.length; j++) {
        var sp = sgBuf[j], cx = PL + (start + j) * cw;
        for (k = 0; k < nb; k++) {
          var v = sp[k] || 0; if (v < 0) v = -v;
          var tt = Math.log(1 + 9 * v / top) / 2.302585;   // log/dB-ish compression
          var cy = PT + ih - (k + 1) * ch;
          sgCtx.fillStyle = cmap(tt);
          sgCtx.fillRect(cx, cy, cw + 1, ch + 1);
        }
      }
      // frequency axis (Hz)
      sgCtx.font = (10 * dpr) + "px 'JetBrains Mono',monospace";
      sgCtx.fillStyle = COL.mut; sgCtx.textAlign = 'right'; sgCtx.textBaseline = 'middle';
      for (k = 0; k <= nb; k += 8) {
        var fy = PT + ih - k * ch;
        sgCtx.fillText((k * binHz).toFixed(1), PL - 6 * dpr, fy);
      }
      sgCtx.textAlign = 'left'; sgCtx.textBaseline = 'top';
      sgCtx.fillText('Hz', 6 * dpr, PT);
      sgCtx.fillText('-' + SG_COLS + ' windows', PL, PT + ih + 5 * dpr);
      sgCtx.textAlign = 'right'; sgCtx.fillText('now', W - PR, PT + ih + 5 * dpr);
    }

    function drawCanvas(w) {
      var W = ui.canvas.width, H = ui.canvas.height, dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, W, H);
      // split: top 60% CSI sparkline, bottom 40% motion history
      var splitY = H * 0.60;

      // --- CSI sparkline (current window) ---
      var csi = w.csi || [];
      ctx.strokeStyle = COL.border; ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(0, splitY); ctx.lineTo(W, splitY); ctx.stroke();
      ctx.fillStyle = COL.mut; ctx.font = (10 * dpr) + "px 'JetBrains Mono',monospace";
      ctx.fillText('CSI amplitude → AI Engine', 8 * dpr, 14 * dpr);
      ctx.fillText('motion history', 8 * dpr, splitY + 14 * dpr);

      if (csi.length) {
        var mn = Math.min.apply(null, csi), mx = Math.max.apply(null, csi);
        var rng = (mx - mn) || 1;
        var pad = 20 * dpr;
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        for (var k = 0; k < csi.length; k++) {
          var x = (k / (csi.length - 1)) * W;
          var y = pad + (1 - (csi[k] - mn) / rng) * (splitY - 2 * pad);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // --- motion history strip ---
      motHist.push(w.motion);
      if (motHist.length > HISTLEN) motHist.shift();
      var th = w.motion_th || 0.0033;
      var scale = Math.max(th * 4, 0.02);
      var baseY = H - 8 * dpr;
      var stripH = (H - splitY) - 18 * dpr;
      // threshold line
      var thY = baseY - (th / scale) * stripH;
      ctx.strokeStyle = COL.amber; ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.moveTo(0, thY); ctx.lineTo(W, thY); ctx.stroke();
      ctx.setLineDash([]);
      var bw = W / HISTLEN;
      for (var m = 0; m < motHist.length; m++) {
        var hval = Math.min(1, motHist[m] / scale);
        var bh = hval * stripH;
        var over = motHist[m] > th;
        ctx.fillStyle = motHist[m] > 0.05 ? COL.red : (over ? COL.cyan : COL.mut);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(m * bw, baseY - bh, bw * 0.8, bh);
      }
      ctx.globalAlpha = 1;
    }

    function apply(w) {
      var ac = activityColor(w.activity);
      ui.actLabel.textContent = w.activity;
      ui.actLabel.style.color = ac;
      ui.actTile.style.borderColor = ac;
      ui.actTile.classList.toggle('har-fall', w.activity.indexOf('FALL') === 0);
      if (w.fall) { ui.actTile.classList.remove('har-flash'); void ui.actTile.offsetWidth; ui.actTile.classList.add('har-flash'); }

      ui.presVal.textContent = w.presence ? 'YES' : 'no';
      ui.presVal.style.color = w.presence ? COL.green : COL.mut;

      ui.brVal.textContent = (w.breathing_ok && w.bpm > 0) ? w.bpm.toFixed(1) : '—';
      ui.brVal.style.color = (w.breathing_ok && w.bpm > 0) ? COL.green : COL.mut;

      var th = w.motion_th || 0.0033;
      var scale = Math.max(th * 4, 0.02);
      var pct = Math.min(100, (w.motion / scale) * 100);
      ui.motBar.style.width = pct + '%';
      ui.motBar.style.background = w.motion > 0.05
        ? COL.red
        : (w.motion > th ? 'linear-gradient(90deg,' + COL.blue + ',' + COL.cyan + ')' : COL.mut);
      ui.motTh.style.left = Math.min(100, (th / scale) * 100) + '%';
      ui.motVal.textContent = w.motion.toFixed(5) + '  (th ' + th.toFixed(4) + ')';

      if (w.brt && w.brt.length) {
        sgBuf.push(w.brt);
        if (sgBuf.length > SG_COLS) sgBuf.shift();
      }
      drawSgram();
      drawCanvas(w);
    }

    function tick(ts) {
      if (playing && ts - last > 190) {
        apply(win[i]);
        i = (i + 1) % win.length;
        last = ts;
      }
      requestAnimationFrame(tick);
    }

    ui.playBtn.addEventListener('click', function () {
      playing = !playing;
      ui.playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
      ui.badge.style.opacity = playing ? '1' : '0.4';
      ui.dot.style.animationPlayState = playing ? 'running' : 'paused';
    });

    requestAnimationFrame(tick);
  }

  var api = {
    init: function (containerId, jsonUrl) {
      injectCSS();
      var container = document.getElementById(containerId);
      if (!container) return;
      var ui = build(container);
      fetch(jsonUrl).then(function (r) { return r.json(); }).then(function (data) {
        new Renderer(ui, data);
      }).catch(function (e) {
        container.innerHTML = '<div style="color:#9ca3af;padding:20px">replay data unavailable: ' + e + '</div>';
      });
    }
  };

  global.WifiHarReplay = api;
})(window);
