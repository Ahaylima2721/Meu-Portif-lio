/* ============================================================================
   zoe-ascii.js — a Zoe começa fragmentada em caracteres e se monta até virar
   o orbe de cristal roxo de verdade (o mesmo elemento .orb do portfólio).

   Uso: ZoeAscii.formar(elementoOrb[, { duracao, atraso }]) → Promise
   Enquanto forma, o orbe recebe a classe "zoe-fragmentada" (fica invisível);
   no fim, o orbe real aparece e os caracteres se dissolvem por cima dele.
   ============================================================================ */
(function () {
  'use strict';
  var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RAMPA = ' .:-=+*#%@';
  var RUIDO = '01<>/\\{}[]#%&@$*+=?!ZOEzoe';
  var ease = function (t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); };

  // desenha o orbe (mesmas cores do CSS da Zoe) num canvas pequeno para servir de alvo
  function alvo(n) {
    var c = document.createElement('canvas'); c.width = c.height = n;
    var g = c.getContext('2d'), r = n / 2;
    var base = g.createRadialGradient(r, r, 0, r, r, r);
    base.addColorStop(0, '#C9A7FF'); base.addColorStop(.38, '#8B5CF6'); base.addColorStop(.72, '#5B21B6'); base.addColorStop(1, '#2A0E5E');
    g.fillStyle = base; g.beginPath(); g.arc(r, r, r * .98, 0, 6.283); g.fill();
    var luz = g.createRadialGradient(n * .32, n * .26, 0, n * .32, n * .26, n * .26);
    luz.addColorStop(0, 'rgba(255,255,255,.95)'); luz.addColorStop(.4, 'rgba(255,255,255,.45)'); luz.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = luz; g.fillRect(0, 0, n, n);
    var onda = g.createLinearGradient(0, n * .55, 0, n);
    onda.addColorStop(0, 'rgba(196,181,253,.35)'); onda.addColorStop(1, 'rgba(196,181,253,0)');
    g.save(); g.beginPath(); g.arc(r, r, r * .98, 0, 6.283); g.clip(); g.fillStyle = onda; g.fillRect(0, n * .58, n, n); g.restore();
    // olhos
    g.fillStyle = '#F7F3FF';
    var ew = n * .085, eh = n * .14, gap = n * .12;
    [r - gap / 2 - ew, r + gap / 2].forEach(function (x) { g.beginPath(); g.roundRect ? g.roundRect(x, r * 1.04 - eh / 2, ew, eh, ew / 2) : g.rect(x, r * 1.04 - eh / 2, ew, eh); g.fill(); });
    return g.getImageData(0, 0, n, n).data;
  }

  function formar(orb, opts) {
    opts = opts || {};
    if (!orb || orb.dataset.formando) return Promise.resolve();
    var rect = orb.getBoundingClientRect();
    if (!rect.width) return Promise.resolve();
    if (calmo) { orb.classList.remove('zoe-fragmentada'); return Promise.resolve(); }
    orb.dataset.formando = '1';
    orb.classList.add('zoe-fragmentada');

    var D = rect.width, pai = orb.offsetParent || document.body;
    var pr = pai.getBoundingClientRect();
    var caixa = D * 3.4, cx = rect.left - pr.left + D / 2, cy = rect.top - pr.top + D / 2;
    var cvs = document.createElement('canvas');
    cvs.className = 'zoe-ascii';
    cvs.setAttribute('aria-hidden', 'true');
    cvs.style.cssText = 'position:absolute;pointer-events:none;z-index:3;left:' + (cx - caixa / 2) + 'px;top:' + (cy - caixa / 2) + 'px;width:' + caixa + 'px;height:' + caixa + 'px;transition:opacity .7s ease';
    pai.appendChild(cvs);
    var DPR = Math.min(devicePixelRatio || 1, 2);
    cvs.width = caixa * DPR; cvs.height = caixa * DPR;
    var g = cvs.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);

    var cel = Math.max(4, Math.round(D / 24)), cw = cel * .62, n = Math.floor(D / cw), nh = Math.floor(D / cel);
    var dados = alvo(n), off = (caixa - D) / 2, parts = [];
    for (var y = 0; y < nh; y++) for (var x = 0; x < n; x++) {
      var sx = x, sy = Math.floor(y * n / nh), k = (sy * n + sx) * 4;
      if (dados[k + 3] < 40) continue;
      var R = dados[k], G = dados[k + 1], B = dados[k + 2], lum = (R * .3 + G * .59 + B * .11) / 255;
      var ch = RAMPA[Math.min(RAMPA.length - 1, 2 + Math.floor(lum * (RAMPA.length - 2)))];
      var a = Math.random() * 6.283, dist = D * (.9 + Math.random() * 1.4);
      parts.push({ tx: off + x * cw, ty: off + y * cel, sx: caixa / 2 + Math.cos(a) * dist, sy: caixa / 2 + Math.sin(a) * dist,
        ch: ch, cor: 'rgb(' + Math.min(255, R + 30) + ',' + Math.min(255, G + 30) + ',' + Math.min(255, B + 40) + ')', atraso: Math.random() * 700 });
    }
    // fragmentos soltos que orbitam e somem
    for (var i = 0; i < 40; i++) {
      var a2 = Math.random() * 6.283, d2 = D * (.7 + Math.random() * .9);
      parts.push({ solto: true, a: a2, d: d2, ch: RUIDO[(Math.random() * RUIDO.length) | 0], cor: '#A78BFA', atraso: Math.random() * 400 });
    }

    var dur = opts.duracao || 2300, t0 = performance.now() + (opts.atraso || 0);
    return new Promise(function (fim) {
      function quadro(agora) {
        var t = agora - t0;
        g.clearRect(0, 0, caixa, caixa);
        g.font = '600 ' + cel + 'px "JetBrains Mono", ui-monospace, monospace';
        g.textBaseline = 'top';
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i], x, y, c = p.ch;
          if (p.solto) {
            var ks = t / dur, ang = p.a + ks * 2.4, dd = p.d * (1 - ease(ks) * .55);
            x = caixa / 2 + Math.cos(ang) * dd; y = caixa / 2 + Math.sin(ang) * dd * .9;
            g.globalAlpha = Math.max(0, .7 - ks * .7);
            if (Math.random() < .2) p.ch = RUIDO[(Math.random() * RUIDO.length) | 0];
          } else {
            var k = ease((t - p.atraso) / (dur - 700));
            x = p.sx + (p.tx - p.sx) * k; y = p.sy + (p.ty - p.sy) * k;
            if (k < .96 || Math.random() < .015) c = RUIDO[(Math.random() * RUIDO.length) | 0];
            g.globalAlpha = .25 + .75 * k;
          }
          g.fillStyle = p.cor; g.fillText(c, x, y);
        }
        g.globalAlpha = 1;
        if (t < dur) return requestAnimationFrame(quadro);
        // revela o orbe de verdade e dissolve os caracteres por cima
        orb.classList.remove('zoe-fragmentada');
        orb.classList.add('zoe-revelada');
        cvs.style.opacity = '0';
        setTimeout(function () { cvs.remove(); orb.classList.remove('zoe-revelada'); delete orb.dataset.formando; fim(); }, 750);
      }
      requestAnimationFrame(quadro);
    });
  }

  window.ZoeAscii = { formar: formar };
})();
