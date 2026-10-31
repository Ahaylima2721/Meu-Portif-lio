import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from avaliar import avaliar  # noqa: E402
from busca import buscar  # noqa: E402
from construir_indice import construir  # noqa: E402
from texto import radical, tokenizar  # noqa: E402

HTML = (RAIZ.parent / "index.html").read_text(encoding="utf-8")
INDICE = construir(HTML)


def test_tokenizar_tira_acentos_stopwords_e_plural():
    assert tokenizar("Quais são as Decisões técnicas dos projetos?") == ["decisao", "tecnica", "projeto"]


def test_radical_junta_singular_e_plural():
    assert radical("dados") == radical("dado") == "dado"
    assert radical("funcoes") == "funcao"


def test_indice_tem_todas_as_areas():
    areas = {t["area"] for t in INDICE["trechos"]}
    assert {"Sobre mim", "Trajetória", "Contato", "Fluxo", "Mapa de Vendas", "SuperAgente", "Harmony", "Assistente"} <= areas


def test_vetores_tem_norma_um():
    for t in INDICE["trechos"]:
        assert abs(sum(w * w for _, w in t["vetor"]) - 1) < 1e-3


def test_links_apontam_para_ids_do_site():
    for t in INDICE["trechos"]:
        assert f'id="{t["link"][1:]}"' in HTML, t["link"]


def test_email_responde_com_contato():
    _, melhor = buscar("qual o seu e-mail?", INDICE, k=1)[0]
    assert melhor["link"] == "#contato"


def test_qualidade_minima_nas_perguntas_de_teste():
    perguntas = json.loads((RAIZ / "perguntas_teste.json").read_text(encoding="utf-8"))
    r = avaliar(INDICE, perguntas)
    assert r["top3"] >= 0.9, r["erros"]
    assert r["top1"] >= 0.8, r["erros"]
