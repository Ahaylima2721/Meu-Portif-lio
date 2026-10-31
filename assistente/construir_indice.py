"""Treina o índice do assistente: extrai os trechos do site, vetoriza com TF-IDF e salva indice.json.

Uso:  python assistente/construir_indice.py [caminho/do/index.html]
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer

from extrair import trechos_do_site, trechos_extras
from texto import STOPWORDS, sinonimos_normalizados, tokenizar

RAIZ = Path(__file__).resolve().parent


def texto_para_vetorizar(t: dict) -> str:
    # o título entra duas vezes para pesar mais que o corpo
    return f"{t['area']} {t['secao']} {t['titulo']} {t['titulo']} {t['busca']}"


def construir(html: str) -> dict:
    trechos = trechos_do_site(html) + trechos_extras()
    for i, t in enumerate(trechos):
        t["id"] = f"t{i:03d}"
    vet = TfidfVectorizer(tokenizer=tokenizar, lowercase=False, token_pattern=None,
                          ngram_range=(1, 2), sublinear_tf=True, smooth_idf=True, norm="l2")
    matriz = vet.fit_transform([texto_para_vetorizar(t) for t in trechos])
    vocab = vet.get_feature_names_out().tolist()
    for i, t in enumerate(trechos):
        linha = matriz.getrow(i)
        t["vetor"] = [[int(j), round(float(w), 5)] for j, w in zip(linha.indices, linha.data)]
        del t["busca"]  # o navegador só precisa do texto exibido e do vetor
    return {
        "versao": 1,
        "gerado_em": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "modelo": "TF-IDF (unigramas e bigramas, tf sublinear, idf suavizado, norma L2)",
        "vocabulario": vocab,
        "idf": [round(float(x), 5) for x in vet.idf_],
        "stopwords": STOPWORDS,
        "sinonimos": sinonimos_normalizados(),
        "trechos": trechos,
    }


def main():
    html_path = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ.parent / "index.html"
    indice = construir(html_path.read_text(encoding="utf-8"))
    destino = RAIZ / "indice.json"
    destino.write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(indice['trechos'])} trechos · {len(indice['vocabulario'])} termos · {destino.stat().st_size // 1024} KB -> {destino.name}")


if __name__ == "__main__":
    main()
