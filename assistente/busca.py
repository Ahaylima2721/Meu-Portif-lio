"""Responde uma pergunta com o indice.json exatamente como o navegador faz (motor.js).

1. corrige erros de digitação contra o vocabulário do índice;
2. se a pergunta parece continuar a anterior ("e os testes dele?"), o projeto da conversa vale metade da decisão;
3. o classificador dá a probabilidade de cada tema;
4. cada trecho recebe (1 - λ) · similaridade TF-IDF + λ · probabilidade do seu tema;
5. se o tema mais provável for "fora", ou a nota ficar baixa, a pergunta é tratada como fora do escopo;
6. "o que é o Fluxo?" (só o nome do projeto) responde com a visão geral dele.
"""
import math

from texto import (GENERICOS, NOMES_PROJETO, corrigir, expandir, fala_da_pessoa, ngramas_char, projeto_citado,
                   tem_referencia, tokenizar)

_cache: dict[int, dict] = {}


def _preparar(indice: dict) -> dict:
    if id(indice) not in _cache:
        clf = indice["classificador"]
        conhecidas = {t: idf for t, idf in zip(indice["vocabulario"], indice["idf"]) if " " not in t}
        for t, idf in zip(clf["palavras"]["termos"], clf["palavras"]["idf"]):
            if " " not in t:
                conhecidas.setdefault(t, idf)
        termos_projeto: dict[str, set[str]] = {}
        for t in indice["trechos"]:
            termos_projeto.setdefault(t["tema"], set()).update(
                indice["vocabulario"][j] for j, _ in t["vetor"] if " " not in indice["vocabulario"][j])
        _cache[id(indice)] = {
            "termos_projeto": termos_projeto,
            "pos": {t: i for i, t in enumerate(indice["vocabulario"])},
            "pal": {t: i for i, t in enumerate(clf["palavras"]["termos"])},
            "let": {t: i for i, t in enumerate(clf["letras"]["termos"])},
            "conhecidas": conhecidas,
        }
    return _cache[id(indice)]


def _tfidf(termos: list[str], pos: dict, idf: list[float]) -> dict[int, float]:
    contagem: dict[int, int] = {}
    for t in termos:
        if t in pos:
            contagem[pos[t]] = contagem.get(pos[t], 0) + 1
    vet = {j: (1 + math.log(c)) * idf[j] for j, c in contagem.items()}
    norma = math.sqrt(sum(v * v for v in vet.values())) or 1.0
    return {j: v / norma for j, v in vet.items()}


def classificar(pergunta: str, indice: dict, toks: list[str] | None = None) -> dict[str, float]:
    clf, c = indice["classificador"], _preparar(indice)
    if toks is None:
        toks = corrigir(tokenizar(pergunta), c["conhecidas"])
    logits = list(clf["vies"])
    for parte, pos, termos in (("palavras", c["pal"], toks + [f"{a} {b}" for a, b in zip(toks, toks[1:])]),
                               ("letras", c["let"], ngramas_char(pergunta))):
        for j, v in _tfidf(termos, pos, clf[parte]["idf"]).items():
            for k, w in clf[parte]["pesos"][j]:
                logits[k] += v * w
    m = max(logits)
    ex = [math.exp(z - m) for z in logits]
    s = sum(ex)
    return {cl: e / s for cl, e in zip(clf["classes"], ex)}


def componentes(pergunta: str, indice: dict, corrigir_erros: bool = True):
    """Tokens, probabilidade de cada tema e similaridade de cosseno com cada trecho (na ordem do índice)."""
    toks = tokenizar(pergunta)
    if corrigir_erros:
        toks = corrigir(toks, _preparar(indice)["conhecidas"])
    probs = classificar(pergunta, indice, toks)
    termos = expandir(toks) + [f"{a} {b}" for a, b in zip(toks, toks[1:])]
    q = _tfidf(termos, _preparar(indice)["pos"], indice["idf"])
    cos = [sum(q.get(j, 0.0) * w for j, w in t["vetor"]) for t in indice["trechos"]]
    return toks, probs, cos


def decidir(toks, probs, cos, indice: dict, p: dict, k: int = 3) -> dict:
    lam = p["lambda"]
    notas = [((1 - lam) * c + lam * probs.get(t["tema"], 0.0), t) for c, t in zip(cos, indice["trechos"])]
    notas.sort(key=lambda x: -x[0])
    topo = notas[0][1]["tema"]
    if topo in NOMES_PROJETO and toks and all(t in NOMES_PROJETO[topo] or t in GENERICOS for t in toks):
        geral = next(i for i, (_, t) in enumerate(notas) if t["tema"] == topo and t["secao"] == "Visão geral")
        notas.insert(0, notas.pop(geral))
    tema = max(probs, key=probs.get)
    # sem palavras de conteúdo ("quem é você?") a decisão fica só com o classificador, que também lê as letras
    fora = (tema == "fora" and probs["fora"] >= p["limiar_fora"]) or notas[0][0] < p["limiar_nota"]
    return {"res": notas[:k], "fora": fora, "tema": tema, "prob": probs[tema], "toks": toks}


def buscar(pergunta: str, indice: dict, k: int = 3, projeto_anterior: str | None = None, params: dict | None = None) -> dict:
    p = dict(indice["fusao"], **(params or {}))
    usada, contexto = pergunta, None
    if projeto_anterior and not projeto_citado(pergunta):
        # continua o projeto anterior se a pergunta aponta para ele ("e os testes dele?") ou se não é sobre a
        # pessoa e usa uma palavra que aparece nos trechos do projeto ("tem testes?" depois do Harmony)
        toks0 = corrigir(tokenizar(pergunta), _preparar(indice)["conhecidas"])
        do_projeto = _preparar(indice)["termos_projeto"].get(projeto_anterior, set())
        if tem_referencia(pergunta) or (not fala_da_pessoa(pergunta) and any(t in do_projeto for t in toks0)):
            usada, contexto = f"{pergunta} {projeto_anterior}", projeto_anterior
    toks, probs, cos = componentes(usada, indice, p.get("corrigir", True))
    if contexto:
        # a conversa vale metade da decisão: "quais tecnologias ele usa?" depois do Fluxo é sobre o Fluxo
        probs = {t: v * 0.5 + (0.5 if t == contexto else 0.0) for t, v in probs.items()}
    r = decidir(toks, probs, cos, indice, p, k)
    r["usada"], r["contexto"] = usada, contexto
    return r
