"""Mede o assistente nas perguntas de teste (que não entram no treino) e compara com a busca só por TF-IDF.

Cada pergunta tem a seção esperada (ou "fora", quando o portfólio não deve responder).
Perguntas com "anterior" testam a conversa: a anterior é feita antes, e o projeto dela vira contexto.
"""
import json
import sys
from pathlib import Path

from busca import buscar

RAIZ = Path(__file__).resolve().parent
# A versão anterior do assistente: só similaridade TF-IDF, sem correção, sem classificador e sem contexto.
SO_TFIDF = {"lambda": 0.0, "corrigir": False, "limiar_fora": 2.0, "limiar_nota": 0.1}


def responder(p: dict, indice: dict, params: dict | None, contexto: bool):
    projeto = None
    if contexto and p.get("anterior"):
        ant = buscar(p["anterior"], indice, params=params)
        if not ant["fora"] and ant["res"][0][1]["tema"] in indice["temas_projeto"]:
            projeto = ant["res"][0][1]["tema"]
    return buscar(p["pergunta"], indice, k=3, projeto_anterior=projeto, params=params)


def avaliar(indice: dict, perguntas: list[dict], params: dict | None = None, contexto: bool = True) -> dict:
    top1 = top3 = 0
    erros = []
    for p in perguntas:
        r = responder(p, indice, params, contexto)
        certos = p["esperado"] if isinstance(p["esperado"], list) else [p["esperado"]]
        links = ["fora"] if r["fora"] else [t["link"].split("-demo")[0] for _, t in r["res"]]
        if links[0] in certos:
            top1 += 1
        else:
            erros.append((p["pergunta"], p["esperado"], links, r["tema"], round(r["prob"], 2)))
        if any(c in links for c in certos):
            top3 += 1
    n = len(perguntas)
    return {"n": n, "top1": top1 / n, "top3": top3 / n, "erros": erros}


def main():
    indice = json.loads((RAIZ / "indice.json").read_text(encoding="utf-8"))
    perguntas = json.loads((RAIZ / "perguntas_teste.json").read_text(encoding="utf-8"))
    grupos = {
        "todas": perguntas,
        "no escopo": [p for p in perguntas if p["esperado"] != "fora" and not p.get("anterior")],
        "fora do escopo": [p for p in perguntas if p["esperado"] == "fora"],
        "continuação": [p for p in perguntas if p.get("anterior")],
    }
    print(f"{'grupo':<16}{'n':>4}   {'só TF-IDF (1º / top 3)':>24}   {'modelo novo (1º / top 3)':>26}")
    for nome, ps in grupos.items():
        a = avaliar(indice, ps, SO_TFIDF, contexto=False)
        b = avaliar(indice, ps)
        print(f"{nome:<16}{len(ps):>4}   {a['top1']:>12.0%} / {a['top3']:<9.0%}   {b['top1']:>14.0%} / {b['top3']:<9.0%}")
    r = avaliar(indice, perguntas)
    for pergunta, esperado, links, tema, prob in r["erros"]:
        print(f"  ✗ {pergunta!r}: esperado {esperado}, veio {links} (tema {tema} {prob})")
    sys.exit(0 if r["top1"] >= 0.85 else 1)


if __name__ == "__main__":
    main()
