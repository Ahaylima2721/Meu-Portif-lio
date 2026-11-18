/* ============================================================================
   conectando.js — anima a arte do topo (mão robótica + mão humana) sem mudar
   a imagem: ela entra montada por pontos de meio-tom tirados dela mesma, e
   depois cada mão "respira" e se aproxima da outra, com uma faísca no encontro.
   As duas mãos são a mesma imagem, recortada ao meio (clip-path) no vão dos dedos.
   ============================================================================ */
(function () {
  'use strict';
  var arte = document.querySelector('.cx-arte');
  if (!arte) return;
  var robo = arte.querySelector('.cx-mao-robo'), hum = arte.querySelector('.cx-mao-humana');
  var cvs = arte.querySelector('.cx-pontos'), ctx = cvs.getContext('2d');
  var calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VAO_X = 0.489, VAO_Y = 0.462;          // vão entre as pontas dos dedos, em fração da imagem
  var ease = function (t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); };
  var W = 0, H = 0, DPR = 1, pontos = [], faiscas = [], t0 = 0, intro = true;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function medir() {
    var r = arte.getBoundingClientRect();
    W = r.width; H = r.height; DPR = Math.min(devicePixelRatio || 1, 2);
    cvs.width = W * DPR; cvs.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // pontos de meio-tom amostrados da própria imagem (só para a entrada)
  function amostrar() {
    var cel = W < 700 ? 5 : 6, cols = Math.ceil(W / cel), rows = Math.ceil(H / cel);
    var c = document.createElement('canvas'); c.width = cols; c.height = rows;
    var g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(robo, 0, 0, cols, rows);
    var d;
    try { d = g.getImageData(0, 0, cols, rows).data; } catch (e) { return false; }
    pontos = [];
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var v = 1 - d[(y * cols + x) * 4] / 255;
      if (v < 0.12) continue;
      var a = Math.random() * 6.283, dist = 120 + Math.random() * 520;
      pontos.push({ x: x * cel + cel / 2, y: y * cel + cel / 2, r: Math.sqrt(v) * cel * 0.62,
        dx: Math.cos(a) * dist, dy: Math.sin(a) * dist * 0.6, atraso: Math.random() * 700 + (Math.abs(x / cols - VAO_X)) * 500 });
    }
    return true;
  }

  function desenharIntro(t) {
    var dur = 1900, fim = true;
    ctx.fillStyle = '#0d0d0d';
    ctx.beginPath();
    for (var i = 0; i < pontos.length; i++) {
      var p = pontos[i], k = ease((t - p.atraso) / dur);
      if (k <= 0) { fim = false; continue; }
      if (k < 1) fim = false;
      var x = p.x + p.dx * (1 - k), y = p.y + p.dy * (1 - k);
      ctx.moveTo(x + p.r, y); ctx.arc(x, y, p.r, 0, 6.283);
    }
    ctx.fill();
    return fim;
  }

  function quadro(agora) {
    var t = agora - t0;
    ctx.clearRect(0, 0, W, H);
    if (intro) {
      var pronto = desenharIntro(t);
      if (pronto || t > 3200) {
        intro = false; arte.classList.add('montada');
        setTimeout(function () { pontos = []; }, 900);
      }
    } else if (pontos.length) {
      // os pontos se dissolvem enquanto a imagem real aparece por baixo
      ctx.globalAlpha = Math.max(0, 1 - (t - 2000) / 800); desenharIntro(1e9); ctx.globalAlpha = 1;
    }

    // as mãos se aproximam e se afastam devagar; o mouse inclina de leve
    var fase = (Math.sin((agora - t0) * 0.00085 - 1.2) + 1) / 2;   // 0 = longe, 1 = quase tocando
    var amp = W * 0.0062;
    mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;
    robo.style.transform = 'translate3d(' + (fase * amp + mouse.x * 6) + 'px,' + (mouse.y * 4 - fase * 2) + 'px,0) rotate(' + (-fase * 0.5) + 'deg)';
    hum.style.transform = 'translate3d(' + (-fase * amp + mouse.x * 6) + 'px,' + (-mouse.y * 4 + fase * 2) + 'px,0) rotate(' + (fase * 0.45) + 'deg)';

    // faísca de pontos quando as pontas chegam perto
    if (!intro && fase > 0.82 && faiscas.length < 46 && Math.random() < 0.55) {
      var ang = Math.random() * 6.283, vel = 0.25 + Math.random() * 0.9;
      faiscas.push({ x: W * VAO_X, y: H * VAO_Y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel * 0.7, v: 1 });
    }
    ctx.fillStyle = '#0d0d0d';
    for (var i = faiscas.length - 1; i >= 0; i--) {
      var f = faiscas[i]; f.x += f.vx; f.y += f.vy; f.v -= 0.02;
      if (f.v <= 0) { faiscas.splice(i, 1); continue; }
      ctx.globalAlpha = f.v; ctx.beginPath(); ctx.arc(f.x, f.y, 0.6 + f.v * 1.3, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = rodando ? requestAnimationFrame(quadro) : 0;
  }

  var rodando = false, visivel = true, raf = 0;
  function ligar() { if (visivel && !document.hidden) { rodando = true; if (!raf) raf = requestAnimationFrame(quadro); } }
  function desligar() { rodando = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  function comecar() {
    medir();
    if (calmo || !amostrar()) { intro = false; arte.classList.add('montada'); if (calmo) return; }
    t0 = performance.now();
    new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; if (visivel) ligar(); else desligar(); }).observe(arte);
    document.addEventListener('visibilitychange', function () { if (document.hidden) desligar(); else ligar(); });
    var rz; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(medir, 120); });
    var hero = arte.closest('.cx-hero') || arte;
    hero.addEventListener('pointermove', function (e) { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
    hero.addEventListener('pointerleave', function () { mouse.tx = mouse.ty = 0; });
    ligar();
  }
  if (robo.complete && robo.naturalWidth) comecar(); else robo.addEventListener('load', comecar, { once: true });
})();
