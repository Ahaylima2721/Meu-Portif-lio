"""Classificador de tema da pergunta: regressão logística sobre n-gramas de palavras e de letras.

Treina com as perguntas escritas à mão (treino.json), com versões delas com erro de digitação
e com os próprios trechos do site. O resultado vai para o indice.json e roda no navegador (motor.js).
"""
import random

import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

from texto import ngramas_char, normalizar, tokenizar

# Seção do site (link) -> tema que o classificador aprende. A classe "fora" é pergunta que o portfólio não responde.
LINK_TEMA = {
    "#inicio": "apresentacao", "#sobre": "sobre", "#dia-a-dia": "dia_a_dia", "#principios": "principios",
    "#habilidades": "habilidades", "#trajetoria": "trajetoria", "#ferramentas": "ferramentas", "#contato": "contato",
    "#projetos": "projetos", "#fluxo": "fluxo", "#mapa": "mapa", "#superagente": "superagente", "#harmony": "harmony",
    "#zoe": "assistente",  # a página da Zoe e os trechos sobre o assistente formam um tema só
}
TEMAS_PROJETO = {"fluxo", "mapa", "superagente", "harmony", "assistente"}


def tema_do_trecho(t: dict) -> str:
    if t.get("tema"):
        return t["tema"]
    if t["area"] in ("Assistente", "Portfólio"):
        return "assistente"
    return LINK_TEMA[t["link"].split("-demo")[0]]


def com_erro(texto: str, rng: random.Random) -> str:
    """Uma versão da pergunta com um erro de digitação comum numa palavra de 4+ letras."""
    palavras = texto.split()
    longas = [i for i, w in enumerate(palavras) if len(w) >= 4]
    if not longas:
        return texto
    i = rng.choice(longas)
    w = palavras[i]
    j = rng.randrange(1, len(w) - 1)
    tipo = rng.randrange(3)
    if tipo == 0:
        w = w[:j] + w[j + 1:]                      # letra comida
    elif tipo == 1:
        w = w[:j] + w[j + 1] + w[j] + w[j + 2:]    # letras trocadas de lugar
    else:
        w = w[:j] + w[j] + w[j:]                   # letra repetida
    palavras[i] = w
    return " ".join(palavras)


def exemplos(perguntas: dict[str, list[str]], trechos: list[dict], erros_por_pergunta: int = 2, semente: int = 0):
    """Textos e rótulos de treino: perguntas, perguntas com erro de digitação e trechos do site."""
    rng = random.Random(semente)
    textos, rotulos = [], []
    for tema, lista in perguntas.items():
        for p in lista:
            textos.append(p)
            rotulos.append(tema)
            for _ in range(erros_por_pergunta):
                textos.append(com_erro(normalizar(p), rng))
                rotulos.append(tema)
    for t in trechos:
        textos.append(f"{t['titulo']}. {t['texto']}")
        rotulos.append(tema_do_trecho(t))
    return textos, rotulos


class Classificador:
    def __init__(self, C: float = 10.0):
        self.palavras = TfidfVectorizer(tokenizer=tokenizar, lowercase=False, token_pattern=None,
                                        ngram_range=(1, 2), sublinear_tf=True, min_df=1, norm="l2")
        self.chars = TfidfVectorizer(analyzer=ngramas_char, lowercase=False, sublinear_tf=True, min_df=2, norm="l2")
        self.lr = LogisticRegression(C=C, max_iter=5000)

    def _x(self, textos, treinar=False):
        if treinar:
            return hstack([self.palavras.fit_transform(textos), self.chars.fit_transform(textos)]).tocsr()
        return hstack([self.palavras.transform(textos), self.chars.transform(textos)]).tocsr()

    def treinar(self, textos, rotulos):
        self.lr.fit(self._x(textos, treinar=True), rotulos)
        return self

    def probabilidades(self, textos) -> np.ndarray:
        return self.lr.predict_proba(self._x(textos))

    @property
    def classes(self) -> list[str]:
        return self.lr.classes_.tolist()

    def exportar(self, poda: float = 0.08) -> dict:
        """Pesos esparsos por termo, só os maiores que `poda` × o maior peso (corta o arquivo em ~3x sem perder
        acerto nas perguntas de teste). Formato lido por `classificar` no motor.js."""
        nw = len(self.palavras.vocabulary_)
        coef = self.lr.coef_
        escala = float(np.abs(coef).max())

        def parte(vet, inicio):
            vocab = vet.get_feature_names_out().tolist()
            termos, idf, pesos = [], [], []
            for k, termo in enumerate(vocab):
                col = coef[:, inicio + k]
                nz = [[int(c), round(float(w), 3)] for c, w in enumerate(col) if abs(w) >= poda * escala]
                if nz:
                    termos.append(termo)
                    idf.append(round(float(vet.idf_[k]), 4))
                    pesos.append(nz)
            return {"termos": termos, "idf": idf, "pesos": pesos}

        return {
            "classes": self.classes,
            "vies": [round(float(b), 4) for b in self.lr.intercept_],
            "palavras": parte(self.palavras, 0),
            "letras": parte(self.chars, nw),
        }
