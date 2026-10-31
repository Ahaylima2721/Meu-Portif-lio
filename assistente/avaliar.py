"""Mede a qualidade do índice com perguntas de teste: acerto no 1º resultado e entre os 3 primeiros."""
import json
import sys
from pathlib import Path

from busca import buscar

RAIZ = Path(__file__).resolve().parent


def avaliar(indice: dict, perguntas: list[dict]) -> dict:
    top1 = top3 = 0
    erros = []
    for p in perguntas:
        res = buscar(p["pergunta"], indice, k=3)
        links = [t["link"].split("-demo")[0] for _, t in res]
        certos = p["esperado"] if isinstance(p["esperado"], list) else [p["esperado"]]
        if links[0] in certos:
            top1 += 1
        if any(c in links for c in certos):
            top3 += 1
        else:
            erros.append((p["pergunta"], p["esperado"], links, round(res[0][0], 3)))
    n = len(perguntas)
    return {"n": n, "top1": top1 / n, "top3": top3 / n, "erros": erros}


def main():
    indice = json.loads((RAIZ / "indice.json").read_text(encoding="utf-8"))
    perguntas = json.loads((RAIZ / "perguntas_teste.json").read_text(encoding="utf-8"))
    r = avaliar(indice, perguntas)
    print(f"{r['n']} perguntas · acerto no 1º: {r['top1']:.0%} · entre os 3 primeiros: {r['top3']:.0%}")
    for pergunta, esperado, links, nota in r["erros"]:
        print(f"  ✗ {pergunta!r}: esperado {esperado}, veio {links} (nota {nota})")
    sys.exit(0 if r["top3"] >= 0.85 else 1)


if __name__ == "__main__":
    main()
