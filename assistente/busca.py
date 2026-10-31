"""Busca no índice exatamente como o navegador faz (assistente.js). Usada pela avaliação e pelos testes."""
import math

from texto import expandir, tokenizar


def vetor_consulta(pergunta: str, indice: dict) -> dict[int, float]:
    pos = {t: i for i, t in enumerate(indice["vocabulario"])}
    toks = tokenizar(pergunta)
    termos = expandir(toks) + [f"{a} {b}" for a, b in zip(toks, toks[1:])]
    contagem: dict[int, int] = {}
    for t in termos:
        if t in pos:
            contagem[pos[t]] = contagem.get(pos[t], 0) + 1
    vet = {j: (1 + math.log(c)) * indice["idf"][j] for j, c in contagem.items()}
    norma = math.sqrt(sum(v * v for v in vet.values())) or 1.0
    return {j: v / norma for j, v in vet.items()}


def buscar(pergunta: str, indice: dict, k: int = 3) -> list[tuple[float, dict]]:
    q = vetor_consulta(pergunta, indice)
    notas = [(sum(q.get(j, 0.0) * w for j, w in t["vetor"]), t) for t in indice["trechos"]]
    notas.sort(key=lambda x: -x[0])
    return notas[:k]
