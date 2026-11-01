/* Motor do assistente do portfólio: responde com o indice.json exatamente como assistente/busca.py.
   As regras de texto espelham assistente/texto.py; stopwords, sinônimos e listas de projetos vêm do próprio índice.
   Roda no navegador (window.MotorAssistente) e no Node (require), para o teste que compara com o Python. */
(function (raiz) {
  'use strict';

  function normalizar(t) { return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function palavras(t) { return normalizar(t).match(/[a-z0-9]+/g) || []; }
  function radical(p) {
    var n = p.length;
    if (n > 4 && /oes$/.test(p)) return p.slice(0, -3) + 'ao';
    if (n > 4 && /aes$/.test(p)) return p.slice(0, -3) + 'ao';
    if (n > 5 && /ais$/.test(p)) return p.slice(0, -3) + 'al';
    if (n > 4 && /es$/.test(p) && 'rsz'.indexOf(p[n - 3]) >= 0) return p.slice(0, -2);
    if (n > 3 && /s$/.test(p) && !/ss$/.test(p)) return p.slice(0, -1);
    return p;
  }
  function ngramasChar(t) {
    var out = [];
    palavras(t).forEach(function (w) {
      w = ' ' + w + ' ';
      [3, 4].forEach(function (n) { for (var i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n)); });
    });
    return out;
  }
  function bigramas(toks) { var out = []; for (var i = 0; i + 1 < toks.length; i++) out.push(toks[i] + ' ' + toks[i + 1]); return out; }

  // distância de edição com troca de letras vizinhas, parando em limite + 1
  function distancia(a, b, limite) {
    if (Math.abs(a.length - b.length) > limite) return limite + 1;
    var ant2 = null, ant = [], i, j;
    for (j = 0; j <= b.length; j++) ant.push(j);
    for (i = 1; i <= a.length; i++) {
      var atual = [i], menor = i;
      for (j = 1; j <= b.length; j++) {
        var v = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (ant2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ant2[j - 2] + 1);
        atual.push(v); if (v < menor) menor = v;
      }
      if (menor > limite) return limite + 1;
      ant2 = ant; ant = atual;
    }
    return ant[b.length];
  }

  function tfidf(termos, pos, idf) {
    var cont = {}, vet = {}, norma = 0;
    termos.forEach(function (t) { if (Object.prototype.hasOwnProperty.call(pos, t)) cont[pos[t]] = (cont[pos[t]] || 0) + 1; });
    Object.keys(cont).forEach(function (j) { var v = (1 + Math.log(cont[j])) * idf[j]; vet[j] = v; norma += v * v; });
    norma = Math.sqrt(norma) || 1;
    Object.keys(vet).forEach(function (j) { vet[j] /= norma; });
    return vet;
  }
  function posicoes(lista) { var m = Object.create(null); lista.forEach(function (t, i) { m[t] = i; }); return m; }

  function Motor(indice) {
    var clf = indice.classificador, stop = Object.create(null);
    indice.stopwords.forEach(function (s) { stop[s] = 1; });
    var pos = posicoes(indice.vocabulario), pal = posicoes(clf.palavras.termos), let_ = posicoes(clf.letras.termos);
    var conhecidas = [], vistas = Object.create(null);
    function conhecer(t, idf) { if (t.indexOf(' ') < 0 && !vistas[t]) { vistas[t] = 1; conhecidas.push([t, idf]); } }
    indice.vocabulario.forEach(function (t, i) { conhecer(t, indice.idf[i]); });
    clf.palavras.termos.forEach(function (t, i) { conhecer(t, clf.palavras.idf[i]); });
    var refs = Object.create(null); indice.referencias.forEach(function (r) { refs[r] = 1; });
    var pessoa = Object.create(null); indice.pessoa.forEach(function (r) { pessoa[r] = 1; });
    var termosProjeto = {};
    indice.trechos.forEach(function (t) {
      var m = termosProjeto[t.tema] || (termosProjeto[t.tema] = Object.create(null));
      t.vetor.forEach(function (p) { var w = indice.vocabulario[p[0]]; if (w.indexOf(' ') < 0) m[w] = 1; });
    });

    function tokenizar(t) { return palavras(t).filter(function (w) { return w.length > 1 && !stop[w]; }).map(radical); }

    // troca palavras que o índice não conhece pela mais parecida com a mesma primeira letra ("harmoni" -> "harmony")
    function corrigir(toks) {
      return toks.map(function (t) {
        if (vistas[t] || t.length < 4 || /^[0-9]+$/.test(t)) return t;
        var limite = t.length < 8 ? 1 : 2, melhor = null;
        conhecidas.forEach(function (c) {
          if (c[0][0] !== t[0]) return;
          var d = distancia(t, c[0], limite);
          if (d <= limite && (!melhor || d < melhor[0] || d === melhor[0] && (c[1] < melhor[1] || c[1] === melhor[1] && c[0] < melhor[2]))) melhor = [d, c[1], c[0]];
        });
        return melhor ? melhor[2] : t;
      });
    }

    function classificar(pergunta, toks) {
      if (!toks) toks = corrigir(tokenizar(pergunta));
      var logits = clf.vies.slice();
      [['palavras', pal, toks.concat(bigramas(toks))], ['letras', let_, ngramasChar(pergunta)]].forEach(function (p) {
        var v = tfidf(p[2], p[1], clf[p[0]].idf);
        Object.keys(v).forEach(function (j) { clf[p[0]].pesos[j].forEach(function (kw) { logits[kw[0]] += v[j] * kw[1]; }); });
      });
      var m = Math.max.apply(null, logits), ex = logits.map(function (z) { return Math.exp(z - m); });
      var s = ex.reduce(function (a, b) { return a + b; }, 0), probs = {};
      clf.classes.forEach(function (c, i) { probs[c] = ex[i] / s; });
      return probs;
    }

    function expandir(toks) {
      var extra = [];
      toks.forEach(function (t) { (indice.sinonimos[t] || []).forEach(function (s) { if (toks.indexOf(s) < 0) extra.push(s); }); });
      return toks.concat(extra);
    }

    function projetoCitado(pergunta) {
      var ws = palavras(pergunta), nomes = Object.keys(indice.projetos);
      for (var i = 0; i < nomes.length; i++) {
        if (indice.projetos[nomes[i]].some(function (t) { return ws.indexOf(t) >= 0; })) return nomes[i];
      }
      return null;
    }
    function temReferencia(pergunta) {
      var ws = palavras(pergunta);
      return ws.some(function (w) { return refs[w]; }) || (ws.length > 1 && ws[0] === 'e');
    }
    function falaDaPessoa(pergunta) { return palavras(pergunta).some(function (w) { return pessoa[w]; }); }

    // 1. corrige digitação; 2. o projeto da conversa vale metade da decisão se a pergunta continua a anterior;
    // 3. classificador dá a probabilidade de cada tema; 4. nota = (1 - λ) · cosseno + λ · probabilidade do tema;
    // 5. tema "fora" ou nota baixa: a pergunta não é sobre o portfólio; 6. "o que é o Fluxo?" pede a visão geral
    function buscar(pergunta, projetoAnterior, k) {
      var f = indice.fusao, usada = pergunta, contexto = null;
      if (projetoAnterior && !projetoCitado(pergunta)) {
        var doProjeto = termosProjeto[projetoAnterior] || {};
        var usaTermo = corrigir(tokenizar(pergunta)).some(function (t) { return doProjeto[t]; });
        if (temReferencia(pergunta) || (!falaDaPessoa(pergunta) && usaTermo)) { usada = pergunta + ' ' + projetoAnterior; contexto = projetoAnterior; }
      }
      var toks = corrigir(tokenizar(usada)), probs = classificar(usada, toks);
      if (contexto) Object.keys(probs).forEach(function (c) { probs[c] = probs[c] * 0.5 + (c === contexto ? 0.5 : 0); });
      var q = tfidf(expandir(toks).concat(bigramas(toks)), pos, indice.idf), lam = f.lambda;
      var res = indice.trechos.map(function (t) {
        var cos = 0; t.vetor.forEach(function (p) { if (q[p[0]]) cos += q[p[0]] * p[1]; });
        return { nota: (1 - lam) * cos + lam * (probs[t.tema] || 0), cos: cos, t: t };
      }).sort(function (a, b) { return b.nota - a.nota; });
      var topo = res[0].t.tema, nomes = indice.nomes_projeto[topo];
      if (nomes && toks.length && toks.every(function (t) { return nomes.indexOf(t) >= 0 || indice.genericos.indexOf(t) >= 0; })) {
        for (var g = 0; g < res.length; g++) if (res[g].t.tema === topo && res[g].t.secao === 'Visão geral') { res.unshift(res.splice(g, 1)[0]); break; }
      }
      var tema = clf.classes[0];
      clf.classes.forEach(function (c) { if (probs[c] > probs[tema]) tema = c; });
      var fora = (tema === 'fora' && probs.fora >= f.limiar_fora) || res[0].nota < f.limiar_nota;
      return { res: res.slice(0, k || 5), fora: fora, tema: tema, prob: probs[tema], probs: probs, toks: toks, usada: usada, contexto: contexto };
    }

    // para a rede neural interativa da página da Zoe: cada termo ativo da pergunta (neurônio de entrada),
    // com o valor TF-IDF e os pesos aprendidos para cada tema (neurônios de saída). Não muda nenhuma resposta.
    function explicar(pergunta) {
      var toks = corrigir(tokenizar(pergunta)), feats = [];
      [['palavras', pal, toks.concat(bigramas(toks))], ['letras', let_, ngramasChar(pergunta)]].forEach(function (p) {
        var v = tfidf(p[2], p[1], clf[p[0]].idf), termos = clf[p[0]].termos;
        Object.keys(v).forEach(function (j) { feats.push({ termo: termos[j], parte: p[0], v: v[j], pesos: clf[p[0]].pesos[j] }); });
      });
      return { feats: feats, probs: classificar(pergunta, toks), classes: clf.classes, vies: clf.vies, toks: toks };
    }

    return { buscar: buscar, classificar: classificar, explicar: explicar, tokenizar: tokenizar, corrigir: corrigir, normalizar: normalizar, ngramasChar: ngramasChar };
  }

  Motor.normalizar = normalizar;
  if (typeof module === 'object' && module.exports) module.exports = Motor;
  else raiz.MotorAssistente = Motor;
})(this);
