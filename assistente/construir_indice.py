"""Treina o assistente e salva indice.json: trechos com vetores TF-IDF, classificador de tema e pesos da fusão.

Etapas:
1. extrai os trechos do site (extrair.py) e junta os fatos dos repositórios (repositorios.json);
2. vetoriza os trechos com TF-IDF para a busca por similaridade;
3. separa as perguntas de treino.json em treino e validação, e escolhe por busca em grade a
   regularização do classificador, o peso λ da fusão e os limiares de "fora do escopo";
4. treina o classificador final com todas as perguntas e mede a validação cruzada em 5 partes.

Uso:  python assistente/construir_indice.py [caminho/do/index.html]
"""
import itertools
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import StratifiedKFold, train_test_split

from busca import componentes, decidir
from extrair import trechos_do_site, trechos_extras
from modelo import TEMAS_PROJETO, Classificador, exemplos, tema_do_trecho
from texto import GENERICOS, NOMES_PROJETO, PESSOA, PROJETOS, REFERENCIAS, STOPWORDS, sinonimos_normalizados, tokenizar

RAIZ = Path(__file__).resolve().parent
GRADE = {
    "C": [3.0, 10.0, 30.0],
    "lambda": [0.0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    "limiar_fora": [0.3, 0.4, 0.5, 0.6],
    "limiar_nota": [0.0, 0.05, 0.1, 0.15],
}


def texto_para_vetorizar(t: dict) -> str:
    # o título entra duas vezes para pesar mais que o corpo
    return f"{t['area']} {t['secao']} {t['titulo']} {t['titulo']} {t['busca']}"


def perguntas_treino() -> dict[str, list[str]]:
    return json.loads((RAIZ / "treino.json").read_text(encoding="utf-8"))


def indice_de_busca(trechos: list[dict]) -> dict:
    vet = TfidfVectorizer(tokenizer=tokenizar, lowercase=False, token_pattern=None,
                          ngram_range=(1, 2), sublinear_tf=True, smooth_idf=True, norm="l2")
    matriz = vet.fit_transform([texto_para_vetorizar(t) for t in trechos])
    saida = []
    for i, t in enumerate(trechos):
        linha = matriz.getrow(i)
        t = {k: v for k, v in t.items() if k != "busca"}  # o navegador só precisa do texto exibido e do vetor
        t["vetor"] = [[int(j), round(float(w), 5)] for j, w in zip(linha.indices, linha.data)]
        saida.append(t)
    return {
        "vocabulario": vet.get_feature_names_out().tolist(),
        "idf": [round(float(x), 5) for x in vet.idf_],
        "trechos": saida,
    }


def nota_da_resposta(r: dict, tema_certo: str) -> float:
    """1 se acertou. Dizer "não sei" a uma pergunta que o portfólio responde custa mais que errar a seção,
    porque o visitante fica sem resposta nenhuma."""
    if tema_certo == "fora":
        return 1.0 if r["fora"] else 0.0
    if r["fora"]:
        return -0.5
    return 1.0 if r["res"][0][1]["tema"] == tema_certo else 0.0


def escolher_parametros(base: dict, perguntas: dict[str, list[str]], trechos: list[dict]) -> tuple[dict, float]:
    """Busca em grade na validação (25% das perguntas, fora do treino). Devolve os parâmetros e a nota média."""
    pares = [(p, t) for t, lista in perguntas.items() for p in lista]
    treino, valid = train_test_split(pares, test_size=0.25, random_state=0, stratify=[t for _, t in pares])
    por_tema: dict[str, list[str]] = {}
    for p, t in treino:
        por_tema.setdefault(t, []).append(p)

    melhor = (-1.0, None)
    for C in GRADE["C"]:
        clf = Classificador(C).treinar(*exemplos(por_tema, trechos))
        indice = dict(base, classificador=clf.exportar())
        comps = [(componentes(p, indice), t) for p, t in valid]
        for lam, lf, ln in itertools.product(GRADE["lambda"], GRADE["limiar_fora"], GRADE["limiar_nota"]):
            params = {"lambda": lam, "limiar_fora": lf, "limiar_nota": ln}
            acc = np.mean([nota_da_resposta(decidir(*c, indice, params), t) for c, t in comps])
            # no empate, prefere λ e limiares menores (modelo mais simples)
            if acc > melhor[0] + 1e-9:
                melhor = (acc, dict(params, C=C))
    return melhor[1], float(melhor[0])


def validacao_cruzada(perguntas: dict[str, list[str]], trechos: list[dict], C: float) -> float:
    """Acerto do classificador sozinho (tema da pergunta), em 5 partes."""
    pares = [(p, t) for t, lista in perguntas.items() for p in lista]
    rotulos = [t for _, t in pares]
    accs = []
    for tr, te in StratifiedKFold(5, shuffle=True, random_state=0).split(pares, rotulos):
        por_tema: dict[str, list[str]] = {}
        for i in tr:
            por_tema.setdefault(pares[i][1], []).append(pares[i][0])
        clf = Classificador(C).treinar(*exemplos(por_tema, trechos))
        prob = clf.probabilidades([pares[i][0] for i in te])
        pred = [clf.classes[k] for k in prob.argmax(axis=1)]
        accs.append(np.mean([p == pares[i][1] for p, i in zip(pred, te)]))
    return float(np.mean(accs))


def construir(html: str) -> dict:
    trechos = trechos_do_site(html) + trechos_extras()
    for i, t in enumerate(trechos):
        t["id"] = f"t{i:03d}"
        t["tema"] = tema_do_trecho(t)
    base = indice_de_busca(trechos)
    perguntas = perguntas_treino()

    params, acc_valid = escolher_parametros(base, perguntas, trechos)
    C = params.pop("C")
    clf = Classificador(C).treinar(*exemplos(perguntas, trechos))
    return {
        "versao": 2,
        "gerado_em": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "modelo": "TF-IDF (palavras) + regressão logística (palavras e letras) com fusão aprendida",
        **base,
        "classificador": clf.exportar(),
        "fusao": params,
        "temas_projeto": sorted(TEMAS_PROJETO),
        "projetos": PROJETOS,
        "nomes_projeto": NOMES_PROJETO,
        "genericos": GENERICOS,
        "referencias": REFERENCIAS,
        "pessoa": PESSOA,
        "stopwords": STOPWORDS,
        "sinonimos": sinonimos_normalizados(),
        "metricas": {
            "perguntas_treino": sum(len(v) for v in perguntas.values()),
            "por_tema": dict(Counter({t: len(v) for t, v in perguntas.items()})),
            "C": C,
            "nota_validacao": round(acc_valid, 4),
            "acerto_classificador_cv5": round(validacao_cruzada(perguntas, trechos, C), 4),
        },
    }


def main():
    html_path = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ.parent / "index.html"
    indice = construir(html_path.read_text(encoding="utf-8"))
    destino = RAIZ / "indice.json"
    destino.write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    m, clf = indice["metricas"], indice["classificador"]
    print(f"{len(indice['trechos'])} trechos · {len(indice['vocabulario'])} termos de busca · "
          f"{len(clf['palavras']['termos'])} + {len(clf['letras']['termos'])} termos no classificador · "
          f"{destino.stat().st_size // 1024} KB -> {destino.name}")
    print(f"{m['perguntas_treino']} perguntas de treino em {len(m['por_tema'])} temas · C={m['C']} · "
          f"fusão {indice['fusao']}")
    print(f"nota na validação: {m['nota_validacao']:.3f} · classificador (validação cruzada 5x): {m['acerto_classificador_cv5']:.1%}")


if __name__ == "__main__":
    main()
