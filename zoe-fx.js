/* ============================================================================
   zoe-fx.js — animações extras da Zoe (orbe de cristal do portfólio)

   Funciona com o mesmo HTML do portfólio:
     <button class="orb"><span class="orb-face"><i></i><i></i></span> ... </button>
   (as camadas .orb-liquid / .orb-rings / .orb-mouth são criadas se faltarem)

   Uso:
     incluir o arquivo zoe-fx.js na página (tag script com src="zoe-fx.js")
     ZoeFx.absorver(orb)            // arquivos voando para dentro dela + pensando + "achei!"
     ZoeFx.vida(orb, { soltarArquivos: true })   // liga os comportamentos automáticos

   Boca: fica OCULTA até a versão com fala ficar pronta. Para mostrar:
     ZoeFx.boca(true)   (ou <html data-zoe-boca="on">)

   Todas as funções devolvem uma Promise que resolve quando a animação termina.
   Com "reduzir movimento" ligado, as partículas são puladas e só a expressão muda.
   ============================================================================ */
(function () {
  'use strict';

  var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EYE = '#F7F3FF';

  /* ---------------- estilos (injetados uma vez) ---------------- */
  var CSS = [
    '.zfx-layer{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden}',
    '.zfx{position:absolute;left:0;top:0;transform:translate(-50%,-50%);will-change:transform,opacity}',

    /* arquivo voando */
    '.zfx-arquivo{width:38px;height:46px;border-radius:5px 12px 5px 5px;background:#fff;box-shadow:0 8px 18px -8px rgba(40,10,90,.55),0 0 0 1px rgba(91,33,182,.18);display:grid;align-content:end;justify-items:center;padding-bottom:5px}',
    '.zfx-arquivo::before{content:"";position:absolute;top:0;right:0;width:11px;height:11px;border-radius:0 10px 0 4px;background:linear-gradient(225deg,transparent 50%,#E4DCF7 50%)}',
    '.zfx-arquivo::after{content:"";position:absolute;left:7px;right:9px;top:11px;height:12px;background:repeating-linear-gradient(#E4DCF7 0 2px,transparent 2px 5px)}',
    '.zfx-arquivo b{font:700 8.5px/1 ui-monospace,Menlo,monospace;color:#fff;padding:2px 4px;border-radius:3px;background:var(--c,#8B5CF6);letter-spacing:.02em}',
    '.zfx-arquivo span{position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);font:500 10px/1 ui-monospace,Menlo,monospace;color:#6D28D9;background:rgba(255,255,255,.9);padding:2px 5px;border-radius:4px;white-space:nowrap}',

    /* chips de palavras orbitando enquanto pensa */
    '.zfx-chip{font:600 11px/1 ui-monospace,Menlo,monospace;color:#5B21B6;background:rgba(255,255,255,.92);border:1px solid #D9C9FF;padding:4px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 12px -6px rgba(91,33,182,.6)}',
    '.zfx-bit{width:6px;height:6px;border-radius:50%;background:#C9A7FF;box-shadow:0 0 8px #A78BFA}',

    /* brilhos, anéis, confete, corações, notas, estrelas */
    '.zfx-estrela{width:13px;height:13px;background:radial-gradient(circle,#fff 25%,#A78BFA 70%);clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);filter:drop-shadow(0 0 6px #8B5CF6)}',
    '.zfx-anel{border-radius:50%;border:2px solid rgba(167,139,250,.75)}',
    '.zfx-flash{border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(201,167,255,.5) 40%,transparent 70%)}',
    '.zfx-confete{width:7px;height:11px;border-radius:2px}',
    '.zfx-coracao{width:18px;height:16px}',
    '.zfx-nota{font:700 20px/1 Georgia,serif;color:#8B5CF6;text-shadow:0 0 8px rgba(201,167,255,.9)}',
    '.zfx-balao{font:700 14px/1 system-ui,sans-serif;color:#5B21B6;background:#fff;padding:6px 10px;border-radius:12px 12px 12px 3px;box-shadow:0 8px 20px -10px rgba(91,33,182,.6);white-space:nowrap}',
    '.zfx-doc{width:64px;height:78px;border-radius:6px;background:#fff;box-shadow:0 12px 24px -12px rgba(40,10,90,.6);padding:12px 10px;display:grid;gap:6px;align-content:start}',
    '.zfx-doc i{display:block;height:4px;border-radius:2px;background:#E4DCF7}',
    '.zfx-doc i.on{background:#A78BFA;transition:background .2s}',
    '.zfx-lupa{width:28px;height:28px}',
    '.zfx-carga{width:var(--d);height:var(--d)}',

    /* camadas extras dentro do orbe */
    '.orb .zfx-bochecha{position:absolute;z-index:2;top:60%;width:15%;height:8%;border-radius:50%;background:#FF8FB1;filter:blur(1.5px);opacity:0;transition:opacity .35s}',
    '.orb .zfx-bochecha.e{left:17%}.orb .zfx-bochecha.d{right:17%}',
    '.orb.zfx-corada .zfx-bochecha{opacity:.75}',
    '.orb-liquid i{transition:top .45s cubic-bezier(.3,1.4,.5,1)}',
    '.orb-liquid i:nth-child(1){top:calc(56% - var(--zfx-nivel,0%))}',
    '.orb-liquid i:nth-child(2){top:calc(62% - var(--zfx-nivel,0%))}',

    /* expressões novas (mesmas peças do portfólio: .orb-face i e .orb-mouth) */
    '.orb.zfx-faminta .orb-face i{animation:none;transform:scale(1.25)}',
    '.orb.zfx-faminta .orb-mouth{border:0;background:' + EYE + ';border-radius:50%;width:12%;height:12%;animation:zfxMastiga .5s ease-in-out infinite alternate}',
    '.orb.zfx-surpresa .orb-face i{animation:none;transform:scale(1.35)}',
    '.orb.zfx-surpresa .orb-mouth{border:0;background:' + EYE + ';border-radius:50%;width:9%;height:9%}',
    '.orb.zfx-bocejo .orb-face i{animation:none;transform:scaleY(.25)}',
    '.orb.zfx-bocejo .orb-mouth{border:0;background:' + EYE + ';border-radius:50%;animation:zfxBoceja 1.8s ease-in-out}',
    '.orb.zfx-tonta .orb-face i{animation:zfxGira .7s linear infinite;height:auto;aspect-ratio:1;border-radius:50%;background:transparent;border:2px solid ' + EYE + ';border-right-color:transparent;transform:none}',
    '.orb.zfx-tonta .orb-mouth{transform:translateX(-50%) rotate(-14deg);width:12%}',
    '.orb.zfx-danca{animation:orbFloat 4.5s ease-in-out infinite,zfxDanca .9s ease-in-out infinite}',
    '.orb.zfx-danca .orb-face i{animation:none;transform:scaleY(.45) translateY(-20%);border-radius:999px 999px 4px 4px}',
    '.orb.zfx-danca .orb-mouth{width:24%;height:10%}',
    '.orb.zfx-glitch{animation:orbFloat 4.5s ease-in-out infinite,zfxGlitch .45s steps(2) 2}',
    '.orb.zfx-glitch .orb-face i{animation:none;aspect-ratio:7/3}',

    /* boca oculta até a versão com fala; a expressão fica nos olhos e no corpo */
    'html:not([data-zoe-boca="on"]) .orb .orb-mouth{display:none}',
    'html:not([data-zoe-boca="on"]) .orb.falando .orb-face i{animation:zfxFalaOlho .26s ease-in-out infinite alternate}',
    'html:not([data-zoe-boca="on"]) .orb.zfx-faminta .orb-face{animation:zfxInspira .5s ease-in-out infinite alternate}',
    '@keyframes zfxFalaOlho{from{transform:none}to{transform:scaleY(.82) translateY(-10%)}}',
    '@keyframes zfxInspira{to{scale:1.1}}',

    '@keyframes zfxMastiga{to{height:5%;width:14%}}',
    '@keyframes zfxBoceja{0%{width:10%;height:4%}45%,65%{width:18%;height:19%}100%{width:10%;height:4%}}',
    '@keyframes zfxGira{to{rotate:360deg}}',
    '@keyframes zfxDanca{0%,100%{rotate:-9deg;translate:-4px 0}50%{rotate:9deg;translate:4px -4px}}',
    '@keyframes zfxGlitch{0%{filter:hue-rotate(0);translate:0}25%{filter:hue-rotate(90deg);translate:-3px 1px}50%{filter:hue-rotate(-60deg) saturate(1.6);translate:3px -1px}75%{filter:hue-rotate(40deg);translate:-2px 0}100%{filter:none;translate:0}}'
  ].join('\n');

  var layer = null;
  function preparar() {
    if (layer) return;
    var st = document.createElement('style'); st.id = 'zfx-css'; st.textContent = CSS; document.head.appendChild(st);
    layer = document.createElement('div'); layer.className = 'zfx-layer'; layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  function pecas(orb) {
    preparar();
    var face = orb.querySelector('.orb-face');
    if (!orb.querySelector('.orb-rings')) orb.insertAdjacentHTML('afterbegin', '<span class="orb-rings" aria-hidden="true"><i></i><i></i><i></i></span>');
    if (!orb.querySelector('.orb-liquid')) orb.querySelector('.orb-rings').insertAdjacentHTML('afterend', '<span class="orb-liquid" aria-hidden="true"><i></i><i></i></span>');
    if (!orb.querySelector('.orb-mouth') && face) face.insertAdjacentHTML('afterend', '<span class="orb-mouth" aria-hidden="true"></span>');
    if (!orb.querySelector('.zfx-bochecha')) orb.insertAdjacentHTML('beforeend', '<span class="zfx-bochecha e" aria-hidden="true"></span><span class="zfx-bochecha d" aria-hidden="true"></span>');
  }

  /* ---------------- utilidades ---------------- */
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(l) { return l[Math.floor(Math.random() * l.length)]; }
  /* direção para o meio da tela: se ela estiver num canto, os efeitos vêm do lado aberto */
  function abertura(c) {
    var vx = innerWidth / 2 - c.x, vy = innerHeight / 2 - c.y, d = Math.hypot(vx, vy);
    var perto = Math.min(c.x, c.y, innerWidth - c.x, innerHeight - c.y) < c.r * 4;
    return { ang: Math.atan2(vy, vx), leque: perto ? Math.PI * 0.55 : Math.PI, canto: perto, ux: d ? vx / d : 0, uy: d ? vy / d : 0 };
  }
  function centro(orb) { var b = orb.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 }; }
  function limitarX(x) { return Math.min(Math.max(x, 24), innerWidth - 24); }
  function limitarY(y) { return Math.min(Math.max(y, 24), innerHeight - 24); }
  function particula(cls, html, x, y) {
    var el = document.createElement('div'); el.className = 'zfx ' + cls; if (html) el.innerHTML = html;
    el.style.left = x + 'px'; el.style.top = y + 'px'; layer.appendChild(el); return el;
  }
  function T(dx, dy, extra) { return 'translate(-50%,-50%) translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) ' + (extra || ''); }
  function animar(el, quadros, opts) { var a = el.animate(quadros, opts); return a.finished.then(function () { el.remove(); }, function () { el.remove(); }); }
  function com(orb, cls, ms) {
    cls.split(' ').forEach(function (c) { orb.classList.add(c); });
    return esperar(ms).then(function () { cls.split(' ').forEach(function (c) { orb.classList.remove(c); }); });
  }
  function ocupar(orb, on) { if (on) orb.dataset.zfx = '1'; else delete orb.dataset.zfx; }
  function faceAnim(orb, pontos, ms) {
    var face = orb.querySelector('.orb-face'); if (!face) return Promise.resolve();
    var q = pontos.map(function (p) { return { transform: 'translate(calc(-50% + ' + p[0] + 'px), calc(-50% + ' + p[1] + 'px))' }; });
    return face.animate(q, { duration: ms, easing: 'ease-in-out' }).finished.catch(function () {});
  }

  /* ---------------- micro-reações ---------------- */
  function gole(orb) {
    return orb.animate([{ scale: '1' }, { scale: '1.12 0.9' }, { scale: '0.96 1.05' }, { scale: '1' }], { duration: 300, easing: 'ease-out' }).finished.catch(function () {});
  }
  function gelatina(orb) {
    return orb.animate([{ scale: '1' }, { scale: '1.15 0.85' }, { scale: '0.88 1.12' }, { scale: '1.06 0.95' }, { scale: '0.98 1.02' }, { scale: '1' }], { duration: 650, easing: 'ease-out' }).finished.catch(function () {});
  }
  function onda(orb, cor) {
    if (calmo) return Promise.resolve();
    var c = centro(orb), el = particula('zfx-anel', '', c.x, c.y);
    el.style.width = el.style.height = (c.r * 2) + 'px'; if (cor) el.style.borderColor = cor;
    return animar(el, [{ transform: T(0, 0, 'scale(1)'), opacity: 0.8 }, { transform: T(0, 0, 'scale(1.7)'), opacity: 0 }], { duration: 650, easing: 'ease-out' });
  }

  /* ---------------- ARQUIVOS ENTRANDO + PENSANDO ---------------- */
  var CORES = { md: '#3B82F6', json: '#D97706', py: '#16A34A', js: '#CA8A04', html: '#EA580C', css: '#2563EB', csv: '#0D9488',
    pdf: '#DC2626', png: '#DB2777', jpg: '#DB2777', webp: '#DB2777', txt: '#64748B', xlsx: '#15803D', docx: '#1D4ED8' };
  var ARQUIVOS = ['README.md', 'index.html', 'indice.json', 'treino.json', 'modelo.py', 'motor.js', 'perfil.json', 'vendas.csv', 'harmony.webp'];
  var PALAVRAS = ['Fluxo', 'Harmony', 'TF-IDF', 'contexto', 'Mapa de Vendas'];

  function cartao(nome) {
    var ext = (nome.split('.').pop() || 'txt').toLowerCase().slice(0, 4);
    var curto = nome.length > 16 ? nome.slice(0, 13) + '…' : nome;
    return { html: '<b>' + ext.toUpperCase() + '</b><span>' + curto.replace(/[<&]/g, '') + '</span>', cor: CORES[ext] || '#8B5CF6' };
  }

  function voarParaDentro(orb, nome, i, total) {
    var c = centro(orb), dist = Math.max(130, c.r * 2.8) * rand(1, 1.35);
    var ab = abertura(c), ang = ab.leque === Math.PI ? (i / total) * Math.PI * 2 + rand(-0.4, 0.4)
      : ab.ang + ((total > 1 ? i / (total - 1) : 0.5) * 2 - 1) * ab.leque + rand(-0.15, 0.15);
    var sx = limitarX(c.x + Math.cos(ang) * dist), sy = limitarY(c.y + Math.sin(ang) * dist * 0.8);
    var k = cartao(nome), el = particula('zfx-arquivo', k.html, sx, sy); el.style.setProperty('--c', k.cor);
    var dx = c.x - sx, dy = c.y - sy, mx = dx * 0.55 - dy * 0.28, my = dy * 0.55 + dx * 0.28, rot = rand(-35, 35);
    var a = el.animate([
      { transform: T(0, 0, 'scale(.3) rotate(' + rot + 'deg)'), opacity: 0 },
      { transform: T(0, -8, 'scale(1) rotate(' + (rot / 2) + 'deg)'), opacity: 1, offset: 0.2, easing: 'ease-in' },
      { transform: T(mx, my, 'scale(.8) rotate(' + (-rot / 2) + 'deg)'), opacity: 1, offset: 0.68, easing: 'cubic-bezier(.6,0,.9,.5)' },
      { transform: T(dx, dy, 'scale(.05) rotate(' + (rot * 3) + 'deg)'), opacity: 0.3 }
    ], { duration: 1150, fill: 'forwards' });
    return a.finished.then(function () { el.remove(); }, function () { el.remove(); });
  }

  function orbitar(orb, palavras, ms) {
    if (calmo) return Promise.resolve();
    var c = centro(orb), ab = abertura(c), R = Math.max(ab.canto ? 92 : 70, c.r * 1.75), passos = 16, voltas = ms / 2400;
    var ox = ab.canto ? ab.ux * R * 0.55 : 0, oy = ab.canto ? ab.uy * R * 0.35 : 0;
    var itens = palavras.map(function (p) { return { cls: 'zfx-chip', html: p }; })
      .concat([0, 1, 2, 3, 4, 5].map(function () { return { cls: 'zfx-bit', html: '' }; }));
    return Promise.all(itens.map(function (it, j) {
      var el = particula(it.cls, it.html, c.x, c.y), a0 = (j / itens.length) * Math.PI * 2, q = [];
      var raio = it.cls === 'zfx-bit' ? R * 0.78 : R;
      for (var s = 0; s <= passos; s++) {
        var a = a0 + (s / passos) * Math.PI * 2 * voltas, frente = Math.sin(a) > 0;
        var fade = s === 0 || s === passos ? 0 : 1;
        q.push({ transform: T(ox + Math.cos(a) * raio, oy + Math.sin(a) * raio * 0.38 - c.r * 0.1, 'scale(' + (frente ? 1 : 0.75) + ')'), opacity: fade * (frente ? 1 : 0.35) });
      }
      return animar(el, q, { duration: ms, easing: 'linear' });
    }));
  }

  function eureka(orb) {
    pecas(orb); ocupar(orb, true);
    var c = centro(orb), jobs = [com(orb, 'feliz pulo', 1600)];
    if (!calmo) {
      var fl = particula('zfx-flash', '', c.x, c.y); fl.style.width = fl.style.height = (c.r * 2.6) + 'px';
      jobs.push(animar(fl, [{ transform: T(0, 0, 'scale(.5)'), opacity: 0.9 }, { transform: T(0, 0, 'scale(1.3)'), opacity: 0 }], { duration: 600, easing: 'ease-out' }));
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2, d = c.r * rand(1.5, 2.2), el = particula('zfx-estrela', '', c.x, c.y);
        jobs.push(animar(el, [{ transform: T(0, 0, 'scale(.2)'), opacity: 1 }, { transform: T(Math.cos(a) * d, Math.sin(a) * d, 'scale(1) rotate(90deg)'), opacity: 1, offset: 0.6 }, { transform: T(Math.cos(a) * d * 1.15, Math.sin(a) * d * 1.15, 'scale(.3) rotate(180deg)'), opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', delay: i * 12 }));
      }
      jobs.push(onda(orb));
    }
    return Promise.all(jobs).then(function () { ocupar(orb, false); });
  }

  /**
   * absorver(orb, { arquivos, palavras, intervalo, pensar })
   * Arquivos voam de todos os lados para dentro dela; a cada um ela "engole",
   * o líquido sobe; depois pensa com as palavras orbitando e termina com um "achei!".
   */
  function absorver(orb, o) {
    o = o || {}; pecas(orb); ocupar(orb, true);
    var arquivos = o.arquivos && o.arquivos.length ? o.arquivos.slice(0, 14) : ARQUIVOS;
    var intervalo = o.intervalo || 230, nivel = 0, pensar = o.pensar || 2400;
    orb.classList.add('zfx-faminta');
    var voos = arquivos.map(function (nome, i) {
      return esperar(i * intervalo).then(function () {
        if (calmo) return;
        return voarParaDentro(orb, nome, i, arquivos.length);
      }).then(function () {
        gole(orb); onda(orb);
        nivel = Math.min(nivel + 22 / arquivos.length, 22); orb.style.setProperty('--zfx-nivel', nivel.toFixed(1) + '%');
      });
    });
    return Promise.all(voos).then(function () {
      orb.classList.remove('zfx-faminta'); orb.classList.add('pensando');
      return orbitar(orb, o.palavras || PALAVRAS, pensar);
    }).then(function () {
      orb.classList.remove('pensando');
      orb.style.setProperty('--zfx-nivel', '0%');
      return eureka(orb);
    }).then(function () { ocupar(orb, false); });
  }

  /* ---------------- outras animações ---------------- */
  function confete(orb) {
    pecas(orb); var c = centro(orb), cores = ['#C9A7FF', '#8B5CF6', '#FF5A4F', '#FFC857', '#6FCF97', '#8FA2F0', '#FF8FB1'], jobs = [com(orb, 'feliz', 1800), gelatina(orb)];
    if (!calmo) for (var i = 0; i < 40; i++) {
      var el = particula('zfx-confete', '', c.x, c.y - c.r * 0.3); el.style.background = pick(cores);
      var vx = rand(-1, 1) * c.r * 3.2, up = rand(1.6, 3.2) * c.r, rot = rand(-720, 720);
      jobs.push(animar(el, [
        { transform: T(0, 0, 'rotate(0)'), opacity: 1 },
        { transform: T(vx * 0.55, -up, 'rotate(' + rot / 2 + 'deg)'), opacity: 1, offset: 0.35, easing: 'ease-in' },
        { transform: T(vx, c.r * 2.2 + rand(0, 60), 'rotate(' + rot + 'deg)'), opacity: 0 }
      ], { duration: rand(1500, 2300), easing: 'cubic-bezier(.2,.7,.4,1)', delay: rand(0, 120) }));
    }
    return Promise.all(jobs);
  }

  function coracoes(orb) {
    pecas(orb); var c = centro(orb), jobs = [com(orb, 'feliz zfx-corada', 2200)];
    var svg = '<svg viewBox="0 0 24 22" width="100%" height="100%"><path fill="#FF8FB1" d="M12 21s-9-5.6-9-12A5 5 0 0 1 12 6a5 5 0 0 1 9 3c0 6.4-9 12-9 12z"/></svg>';
    if (!calmo) for (var i = 0; i < 6; i++) {
      var el = particula('zfx-coracao', svg, c.x + rand(-c.r * 0.6, c.r * 0.6), c.y - c.r * 0.6), sway = rand(16, 34) * (i % 2 ? 1 : -1), s = rand(0.7, 1.3);
      jobs.push(animar(el, [
        { transform: T(0, 0, 'scale(0)'), opacity: 0 },
        { transform: T(sway * 0.5, -c.r * 0.6, 'scale(' + s + ')'), opacity: 1, offset: 0.3 },
        { transform: T(-sway * 0.3, -c.r * 1.3, 'scale(' + s + ')'), opacity: 0.9, offset: 0.65 },
        { transform: T(sway, -c.r * 2, 'scale(' + s * 0.8 + ')'), opacity: 0 }
      ], { duration: 1900, easing: 'ease-out', delay: i * 180 }));
    }
    return Promise.all(jobs);
  }

  function dancar(orb, ms) {
    pecas(orb); ms = ms || 3600; var c = centro(orb), jobs = [com(orb, 'zfx-danca', ms)];
    if (!calmo) for (var i = 0; i < Math.round(ms / 400); i++) {
      var lado = i % 2 ? 1 : -1, el = particula('zfx-nota', pick(['♪', '♫', '♩', '♬']), c.x + lado * c.r * 0.9, c.y - c.r * 0.2);
      jobs.push(animar(el, [
        { transform: T(0, 0, 'scale(.4) rotate(0)'), opacity: 0 },
        { transform: T(lado * 14, -c.r * 0.7, 'scale(1) rotate(' + lado * 12 + 'deg)'), opacity: 1, offset: 0.3 },
        { transform: T(lado * 40, -c.r * 1.8, 'scale(.8) rotate(' + -lado * 10 + 'deg)'), opacity: 0 }
      ], { duration: 1500, easing: 'ease-out', delay: i * 400 }));
    }
    return Promise.all(jobs);
  }

  function tonta(orb, ms) {
    pecas(orb); ms = ms || 2600; var c = centro(orb), jobs = [com(orb, 'zfx-tonta', ms)];
    if (!calmo) for (var i = 0; i < 3; i++) {
      var el = particula('zfx-estrela', '', c.x, c.y), q = [];
      for (var s = 0; s <= 20; s++) { var a = (i / 3) * Math.PI * 2 + (s / 20) * Math.PI * 4; q.push({ transform: T(Math.cos(a) * c.r * 0.9, -c.r * 1.05 + Math.sin(a) * c.r * 0.22, 'scale(' + (Math.sin(a) > 0 ? 1 : 0.6) + ')'), opacity: s === 20 ? 0 : 1 }); }
      jobs.push(animar(el, q, { duration: ms, easing: 'linear' }));
    }
    return Promise.all(jobs);
  }

  function surpresa(orb) {
    pecas(orb); var c = centro(orb), jobs = [com(orb, 'zfx-surpresa', 1100)];
    jobs.push(orb.animate([{ translate: '0 0' }, { translate: '0 -' + Math.round(c.r * 0.35) + 'px' }, { translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' }).finished.catch(function () {}));
    if (!calmo) {
      var el = particula('zfx-balao', '!', c.x + c.r * 0.9, c.y - c.r * 1.1);
      jobs.push(animar(el, [{ transform: T(0, 10, 'scale(0)'), opacity: 0 }, { transform: T(0, 0, 'scale(1.2)'), opacity: 1, offset: 0.2 }, { transform: T(0, 0, 'scale(1)'), opacity: 1, offset: 0.8 }, { transform: T(0, -10, 'scale(.9)'), opacity: 0 }], { duration: 1100, easing: 'ease-out' }));
    }
    return Promise.all(jobs);
  }

  function bocejo(orb) {
    pecas(orb);
    var j = orb.animate([{ scale: '1' }, { scale: '0.96 1.07', offset: 0.5 }, { scale: '1' }], { duration: 1800, easing: 'ease-in-out' }).finished.catch(function () {});
    return Promise.all([com(orb, 'zfx-bocejo', 1800), j]);
  }

  function corada(orb, ms) {
    pecas(orb); ms = ms || 2200;
    var j = orb.animate([{ rotate: '0deg' }, { rotate: '-7deg', offset: 0.25 }, { rotate: '-7deg', offset: 0.75 }, { rotate: '0deg' }], { duration: ms, easing: 'ease-in-out' }).finished.catch(function () {});
    return Promise.all([com(orb, 'feliz zfx-corada', ms), j]);
  }

  function ola(orb, texto) {
    pecas(orb); var c = centro(orb), jobs = [com(orb, 'feliz', 1500)];
    jobs.push(orb.animate([{ rotate: '0deg' }, { rotate: '-14deg' }, { rotate: '11deg' }, { rotate: '-8deg' }, { rotate: '5deg' }, { rotate: '0deg' }], { duration: 1200, easing: 'ease-in-out' }).finished.catch(function () {}));
    if (!calmo) {
      var el = particula('zfx-balao', texto || 'oi!', limitarX(c.x - c.r * 0.9), c.y - c.r * 1.15);
      jobs.push(animar(el, [{ transform: T(0, 8, 'scale(0)'), opacity: 0 }, { transform: T(0, 0, 'scale(1.1)'), opacity: 1, offset: 0.15 }, { transform: T(0, 0, 'scale(1)'), opacity: 1, offset: 0.85 }, { transform: T(0, -8, 'scale(.9)'), opacity: 0 }], { duration: 1600, easing: 'ease-out' }));
    }
    return Promise.all(jobs);
  }

  function lendo(orb, ms) {
    pecas(orb); ms = ms || 3000; var c = centro(orb), m = c.r * 0.13, linhas = 4, jobs = [];
    var doc = calmo ? null : particula('zfx-doc', '<i></i><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i>', c.x + c.r * 0.15, c.y + c.r * 1.25);
    if (doc) jobs.push(animar(doc, [{ transform: T(0, 30, 'rotate(-6deg)'), opacity: 0 }, { transform: T(0, 0, 'rotate(-6deg)'), opacity: 1, offset: 0.1 }, { transform: T(0, 0, 'rotate(-6deg)'), opacity: 1, offset: 0.9 }, { transform: T(0, 30, 'rotate(-6deg)'), opacity: 0 }], { duration: ms }));
    var pts = [[0, 0]];
    for (var l = 0; l < linhas; l++) { var y = m * (0.2 + l * 0.35); pts.push([-m, y], [m, y]); }
    pts.push([0, 0]);
    if (doc) Array.prototype.forEach.call(doc.children, function (li, k) { setTimeout(function () { li.classList.add('on'); }, (k + 1) * ms / 6.5); });
    jobs.push(faceAnim(orb, pts, ms));
    return Promise.all(jobs);
  }

  function procurando(orb, ms) {
    pecas(orb); ms = ms || 2800; var c = centro(orb), R = c.r * 1.45, m = c.r * 0.12, passos = 24, q = [], pts = [];
    var svg = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#7C3AED" stroke-width="2.4" stroke-linecap="round"><circle cx="10" cy="10" r="6.5" fill="rgba(255,255,255,.85)"/><path d="M15 15l6 6"/></svg>';
    for (var s = 0; s <= passos; s++) {
      var a = -Math.PI / 2 + (s / passos) * Math.PI * 2;
      q.push({ transform: T(Math.cos(a) * R, Math.sin(a) * R * 0.7, 'rotate(' + (a * 57.3 + 90) + 'deg)'), opacity: s === 0 || s === passos ? 0 : 1 });
      pts.push([Math.cos(a) * m, Math.sin(a) * m]);
    }
    var jobs = [faceAnim(orb, pts, ms)];
    if (!calmo) jobs.push(animar(particula('zfx-lupa', svg, c.x, c.y), q, { duration: ms, easing: 'ease-in-out' }));
    return Promise.all(jobs);
  }

  function carregando(orb, ms) {
    pecas(orb); ms = ms || 2200; var c = centro(orb), d = c.r * 2 + 18, jobs = [com(orb, 'pensando', ms)];
    if (!calmo) {
      var r = d / 2 - 3, L = (2 * Math.PI * r).toFixed(1);
      var el = particula('zfx-carga', '<svg width="100%" height="100%" viewBox="0 0 ' + d + ' ' + d + '"><circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + r + '" fill="none" stroke="rgba(167,139,250,.25)" stroke-width="4"/><circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + r + '" fill="none" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + L + '" stroke-dashoffset="' + L + '" transform="rotate(-90 ' + d / 2 + ' ' + d / 2 + ')"/></svg>', c.x, c.y);
      el.style.setProperty('--d', d + 'px');
      el.querySelector('circle:last-child').animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      jobs.push(animar(el, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.92 }, { opacity: 0 }], { duration: ms }));
    }
    return Promise.all(jobs).then(function () { return eureka(orb); });
  }

  function glitch(orb) { pecas(orb); return com(orb, 'zfx-glitch', 900); }

  /* ---------------- comportamentos automáticos ---------------- */
  /**
   * vida(orb, opts) liga reações automáticas:
   *  - clique: gelatina; 5 cliques em 2s: fica tonta
   *  - rolar a página: inclina na direção da rolagem
   *  - arrastar arquivo pela página: fica "faminta"; soltar: absorve os arquivos (opts.soltarArquivos)
   *  - 25s sem mexer: boceja
   *  - voltar para a aba: surpresa + "oi!"
   *  - copiar texto da página: fica corada (alguém gostou de algo)
   */
  function vida(orb, opts) {
    opts = opts || {}; pecas(orb);
    var cliques = [], ultimo = Date.now();
    orb.addEventListener('click', function () {
      var agora = Date.now(); cliques = cliques.filter(function (t) { return agora - t < 2000; }); cliques.push(agora);
      if (cliques.length >= 5) { cliques = []; tonta(orb); } else gelatina(orb);
    });
    if (!calmo) {
      var timer = null;
      var ultimoY = scrollY;
      addEventListener('scroll', function () {
        var v = scrollY - ultimoY; ultimoY = scrollY;
        orb.style.transition = 'rotate .25s ease-out'; orb.style.rotate = Math.max(-12, Math.min(12, v * 0.6)) + 'deg';
        clearTimeout(timer); timer = setTimeout(function () { orb.style.rotate = '0deg'; }, 160);
      }, { passive: true });
    }
    ['pointermove', 'keydown', 'scroll'].forEach(function (ev) { addEventListener(ev, function () { ultimo = Date.now(); }, { passive: true }); });
    setInterval(function () { if (!document.hidden && !orb.dataset.zfx && Date.now() - ultimo > (opts.bocejoMs || 25000)) { ultimo = Date.now(); bocejo(orb); } }, 2000);
    var saiu = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saiu = Date.now(); else if (saiu && Date.now() - saiu > 4000) { surpresa(orb).then(function () { ola(orb, 'voltou!'); }); }
    });
    document.addEventListener('copy', function () { if (!orb.dataset.zfx) corada(orb, 1600); });
    if (opts.soltarArquivos) {
      var arrastando = 0;
      addEventListener('dragenter', function (e) { if (!e.dataTransfer || [].indexOf.call(e.dataTransfer.types, 'Files') < 0) return; arrastando++; orb.classList.add('zfx-faminta'); });
      addEventListener('dragleave', function () { arrastando = Math.max(0, arrastando - 1); if (!arrastando) orb.classList.remove('zfx-faminta'); });
      addEventListener('dragover', function (e) { if (orb.classList.contains('zfx-faminta')) e.preventDefault(); });
      addEventListener('drop', function (e) {
        if (!e.dataTransfer || !e.dataTransfer.files.length) return;
        e.preventDefault(); arrastando = 0;
        var nomes = [].map.call(e.dataTransfer.files, function (f) { return f.name; });
        absorver(orb, { arquivos: nomes });
        if (opts.aoReceber) opts.aoReceber(e.dataTransfer.files);
      });
    }
  }

  /* liga/desliga a boca (fica oculta até a versão com fala) */
  function boca(on) {
    preparar();
    if (on) document.documentElement.setAttribute('data-zoe-boca', 'on');
    else document.documentElement.removeAttribute('data-zoe-boca');
  }

  if (document.body) preparar(); else document.addEventListener('DOMContentLoaded', preparar);

  window.ZoeFx = {
    boca: boca,
    absorver: absorver, eureka: eureka, confete: confete, coracoes: coracoes, dancar: dancar, tonta: tonta,
    surpresa: surpresa, bocejo: bocejo, corada: corada, ola: ola, lendo: lendo, procurando: procurando,
    carregando: carregando, glitch: glitch, gelatina: gelatina, gole: gole, onda: onda, vida: vida, preparar: pecas
  };
})();
