"""Lê o index.html do portfólio e divide o conteúdo em trechos com título e link.

O próprio site é a fonte de verdade: quando um texto muda na página, o índice muda junto.
"""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

RAIZ = Path(__file__).resolve().parent
NOMES = {"fluxo": "Fluxo", "mapa": "Mapa de Vendas", "superagente": "SuperAgente", "harmony": "Harmony"}


def limpo(el) -> str:
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip() if el else ""


def trechos_do_site(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict] = []

    def add(area, secao, titulo, texto, link, prefixo=""):
        # `prefixo` ajuda a busca (diz de qual projeto/seção é o trecho), mas não aparece na resposta
        texto = texto.strip()
        if len(texto) < 20:
            return
        out.append({"id": f"t{len(out):03d}", "area": area, "secao": secao, "titulo": titulo,
                    "busca": prefixo + texto, "texto": texto, "link": link})

    inicio = soup.find(id="inicio")
    hero = inicio.select_one(".hero")
    add("Sobre mim", "Apresentação", "Quem é Ayalan Lima",
        f"{limpo(hero.h1)}, {limpo(hero.select_one('.role'))}. {limpo(hero.select_one('.pitch'))} {limpo(hero.select_one('.pill'))}.", "#inicio")
    add("Sobre mim", "Números", "Números do portfólio",
        ". ".join(limpo(d) for d in inicio.select(".facts div")) + ".", "#inicio")

    sobre = soup.find(id="sobre")
    add("Sobre mim", "Quem sou", "Quem sou e onde trabalho", " ".join(limpo(p) for p in sobre.select(".about-text p")), "#sobre")
    card = sobre.select_one(".role-card")
    add("Sobre mim", "Função atual", limpo(card.h3),
        f"Função atual: {limpo(card.h3)}. " + ". ".join(f"{limpo(d.dt)}: {limpo(d.dd)}" for d in card.select("dl div")) + ".", "#sobre")

    for c in soup.find(id="dia-a-dia").select(".card"):
        add("Sobre mim", "Dia a dia", limpo(c.h3), limpo(c.p), "#dia-a-dia", f"No dia a dia: {limpo(c.h3)}. ")
    for li in soup.find(id="principios").select("li"):
        add("Sobre mim", "Como trabalho", limpo(li.b).rstrip("."), limpo(li.select_one("span")), "#principios", limpo(li.b) + " ")
    for c in soup.find(id="habilidades").select(".card"):
        add("Sobre mim", "Habilidades", f"Habilidades em {limpo(c.h3)}",
            f"Habilidades em {limpo(c.h3)}: {limpo(c.p)} Tecnologias: {', '.join(limpo(x) for x in c.select('.chip'))}.", "#habilidades")
    traj = soup.find(id="trajetoria")
    for li in traj.select(".timeline li"):
        nome = limpo(li.h3).split(" ")[0] if li.h3 else ""
        add("Trajetória", "Trajetória", limpo(li.h3), f"{limpo(li.time)}: {limpo(li.h3)}. {limpo(li.p)}", "#trajetoria")
    add("Trajetória", "Trajetória", "Linha do tempo",
        "Trajetória e experiência: " + " ".join(f"{limpo(li.time)} {limpo(li.h3)}." for li in traj.select(".timeline li")), "#trajetoria")
    add("Sobre mim", "Ferramentas", "Ferramentas e tecnologias",
        "Ferramentas, linguagens e stack: " + " ".join(f"{limpo(d.h3)}: {limpo(d.p)}." for d in soup.find(id="ferramentas").select(".tools div")), "#ferramentas")
    contato = soup.find(id="contato")
    add("Contato", "Contato", "Como entrar em contato",
        f"E-mail: {limpo(contato.find(id='email'))}. GitHub: github.com/Ahaylima2721. {limpo(contato.select('p')[-1])}", "#contato", "Contato, e-mail, conversar: ")

    for a in soup.find(id="projetos").select(".pcard"):
        nome = limpo(a.select_one(".pinfo > b"))
        add(nome, "Resumo", f"Projeto {nome}",
            f"Projeto {nome}: {limpo(a.select_one('.pdesc'))} Etiquetas: {', '.join(limpo(b) for b in a.select('.badge'))}.", a["href"])
    nomes = [limpo(a.select_one(".pinfo > b")) for a in soup.find(id="projetos").select(".pcard")]
    add("Projetos", "Lista", "Lista de projetos do portfólio",
        f"O portfólio tem {len(nomes)} projetos em destaque: {', '.join(nomes[:-1])} e {nomes[-1]}. Todos estão na página Projetos, cada um com problema, arquitetura, decisões técnicas e telas.", "#projetos")

    for pid, nome in NOMES.items():
        v = soup.find(id=pid)
        link = f"#{pid}"
        metricas = "; ".join(limpo(d) for d in v.select(".metrics div"))
        add(nome, "Visão geral", f"{nome}: visão geral",
            f"{nome}. {limpo(v.select_one('.plead'))} Números: {metricas}. Etiquetas: {', '.join(limpo(b) for b in v.select('.badges .badge'))}.", link)
        legendas = [b.get("data-cap", "") for b in v.select(".demo-tabs button")] + [limpo(f) for f in v.select(".phone figcaption")]
        if legendas:
            add(nome, "Telas", f"{nome}: telas", f"Telas do {nome}: " + " ".join(legendas), link + "-demo" if v.select_one(f"#{pid}-demo") else link)
        for bloco in v.select(".block"):
            secao = limpo(bloco.select_one(".blabel")).capitalize()
            corpo = [limpo(p) for p in bloco.find_all("p", recursive=False) if "blabel" not in (p.get("class") or [])]
            if corpo:
                add(nome, secao, f"{nome}: {secao.lower()}", " ".join(corpo), link, f"{nome}, {secao.lower()}: ")
            itens = bloco.select(".feat li, .flow li, .decisions > div, .challenges > div, .next li")
            for it in itens:
                cab = it.select_one("b, .ch-q")
                titulo = limpo(cab).rstrip(".:") if cab else secao
                corpo_item = limpo(it)
                if cab and corpo_item.startswith(limpo(cab)):
                    corpo_item = corpo_item[len(limpo(cab)):].strip(" .:")
                add(nome, secao, f"{nome}: {titulo}", corpo_item, link, f"{nome}, {secao.lower()}. {titulo}. ")
            linhas = bloco.select(".cmp tbody tr")
            if linhas:
                add(nome, secao, f"{nome}: medição antes e depois",
                    f"{nome}, medição em 500 solos, antes e depois: " + "; ".join(" ".join(limpo(td) for td in tr.select("td")) for tr in linhas) + ".", link)
        stack = v.select_one(".stackline")
        if stack:
            add(nome, "Tecnologias", f"{nome}: tecnologias", f"Tecnologias usadas no {nome}: {', '.join(limpo(c) for c in stack.select('.chip'))}.", link)
    return out


def trechos_extras() -> list[dict]:
    """Trechos escritos à mão, sobre o próprio assistente."""
    return [dict(t, busca=t["texto"]) for t in json.loads((RAIZ / "extras.json").read_text(encoding="utf-8"))]
