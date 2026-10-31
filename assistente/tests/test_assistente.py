import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from avaliar import avaliar  # noqa: E402
from busca import buscar  # noqa: E402
from extrair import trechos_do_site, trechos_extras  # noqa: E402
from texto import corrigir, distancia, ngramas_char, projeto_citado, radical, tem_referencia, tokenizar  # noqa: E402

HTML = (RAIZ.parent / "index.html").read_text(encoding="utf-8")
# o índice é treinado por construir_indice.py (no CI, logo antes dos testes); treinar aqui levaria ~30 s
INDICE = json.loads((RAIZ / "indice.json").read_text(encoding="utf-8"))
PERGUNTAS = json.loads((RAIZ / "perguntas_teste.json").read_text(encoding="utf-8"))


def test_tokenizar_tira_acentos_stopwords_e_plural():
    assert tokenizar("Quais são as Decisões técnicas dos projetos?") == ["decisao", "tecnica", "projeto"]


def test_radical_junta_singular_e_plural():
    assert radical("dados") == radical("dado") == "dado"
    assert radical("funcoes") == "funcao"


def test_ngramas_char_tem_pontas_marcadas():
    assert ngramas_char("Oi") == [" oi", "oi ", " oi "]
    assert " pyt" in ngramas_char("pyton") and " pyt" in ngramas_char("Python")


def test_distancia_conta_troca_de_letras_vizinhas_como_um_erro():
    assert distancia("harmony", "harmony", 2) == 0
    assert distancia("hramony", "harmony", 2) == 1
    assert distancia("abc", "xyzw", 1) == 2


def test_corrigir_troca_palavra_desconhecida_pela_mais_parecida():
    conhecidas = {"harmony": 3.0, "cronometro": 2.0, "cidade": 2.0}
    assert corrigir(["harmoni", "cronometo", "idade", "xyz"], conhecidas) == ["harmony", "cronometro", "idade", "xyz"]


def test_contexto_reconhece_projeto_e_referencia():
    assert projeto_citado("Como funciona o gerador de solos?") == "harmony"
    assert projeto_citado("Qual o seu email?") is None
    assert tem_referencia("E quantos testes ele tem?") and tem_referencia("e as telas?")
    assert not tem_referencia("Qual o seu email?")


def test_indice_esta_em_dia_com_o_site():
    esperados = [t["texto"] for t in trechos_do_site(HTML) + trechos_extras()]
    assert [t["texto"] for t in INDICE["trechos"]] == esperados, "rode python assistente/construir_indice.py"


def test_indice_tem_todas_as_areas_e_temas_conhecidos():
    areas = {t["area"] for t in INDICE["trechos"]}
    assert {"Sobre mim", "Trajetória", "Contato", "Fluxo", "Mapa de Vendas", "SuperAgente", "Harmony", "Assistente", "Portfólio"} <= areas
    assert {t["tema"] for t in INDICE["trechos"]} | {"fora"} == set(INDICE["classificador"]["classes"])


def test_vetores_tem_norma_um():
    for t in INDICE["trechos"]:
        assert abs(sum(w * w for _, w in t["vetor"]) - 1) < 1e-3


def test_links_apontam_para_ids_do_site():
    for t in INDICE["trechos"]:
        assert f'id="{t["link"][1:]}"' in HTML, t["link"]


def test_indice_cabe_no_navegador():
    assert (RAIZ / "indice.json").stat().st_size < 500 * 1024


def test_email_responde_com_contato():
    r = buscar("qual o seu e-mail?", INDICE, k=1)
    assert not r["fora"] and r["res"][0][1]["link"] == "#contato"


def test_pergunta_fora_do_portfolio_nao_e_respondida():
    assert buscar("qual a capital da frança?", INDICE)["fora"]
    assert not buscar("quem é você?", INDICE)["fora"]


def test_continuacao_usa_o_projeto_anterior():
    r = buscar("e quantos testes ele tem?", INDICE, projeto_anterior="harmony")
    assert r["contexto"] == "harmony" and r["res"][0][1]["link"] == "#harmony"
    # pergunta que cita outro projeto, ou que não tem a ver com ele, ignora o contexto
    assert buscar("e o fluxo?", INDICE, projeto_anterior="harmony")["contexto"] is None
    assert buscar("qual o seu email?", INDICE, projeto_anterior="harmony")["res"][0][1]["link"] == "#contato"


def test_qualidade_minima_nas_perguntas_de_teste():
    r = avaliar(INDICE, PERGUNTAS)
    assert r["top1"] >= 0.9, r["erros"]
    assert r["top3"] >= 0.95, r["erros"]


@pytest.mark.skipif(not shutil.which("node"), reason="precisa do Node para rodar o motor.js")
def test_motor_js_responde_igual_ao_python():
    treino = json.loads((RAIZ / "treino.json").read_text(encoding="utf-8"))
    casos = [{"pergunta": p, "projeto": None} for lista in treino.values() for p in lista]
    casos += [{"pergunta": p["pergunta"], "projeto": "harmony"} for p in PERGUNTAS]
    casos += [{"pergunta": "harmoni gerdor de solso", "projeto": None}, {"pergunta": "", "projeto": None}]
    saida = subprocess.run(["node", str(RAIZ / "tests" / "rodar_motor.js")], input=json.dumps(casos),
                           capture_output=True, text=True, check=True).stdout
    for caso, js in zip(casos, json.loads(saida)):
        py = buscar(caso["pergunta"], INDICE, k=3, projeto_anterior=caso["projeto"])
        assert js["ids"] == [t["id"] for _, t in py["res"]], caso
        assert (js["fora"], js["tema"], js["toks"]) == (py["fora"], py["tema"], py["toks"]), caso
        assert js["prob"] == pytest.approx(py["prob"], abs=1e-9), caso
