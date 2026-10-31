"""Regras de texto compartilhadas entre o Python (que treina o índice) e o JavaScript do site.

O navegador recebe as stopwords, os sinônimos e as regras de radical dentro do indice.json,
para que a pergunta do visitante seja processada exatamente como os trechos foram.
"""
import re
import unicodedata

# Palavras muito comuns que não ajudam a achar o assunto da pergunta.
STOPWORDS = sorted({
    "a", "o", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "um", "uma", "uns", "umas",
    "para", "pra", "por", "pelo", "pela", "com", "sem", "que", "se", "os", "as", "ao", "aos", "e", "ser", "foi",
    "sao", "esta", "estao", "como", "mais", "mas", "ou", "sua", "seu", "suas", "seus", "meu", "minha", "meus",
    "minhas", "eu", "voce", "voces", "ele", "ela", "eles", "elas", "isso", "esse", "essa", "este", "isto",
    "aquele", "qual", "quais", "quem", "onde", "quando", "porque", "quanto", "quantos", "me", "te", "lhe",
    "sobre", "fale", "falar", "conte", "contar", "diga", "dizer", "explique", "explica", "mostre", "quero",
    "saber", "gostaria", "pode", "poderia", "tem", "ter", "faz", "fazer", "ja", "tambem", "muito", "bem",
    "entre", "ate", "cada", "todo", "toda", "todos", "todas", "nao", "sim", "so", "ainda", "la", "aqui",
    "ai", "the", "and", "of", "to", "is",
})

# Pergunta do visitante -> termos que aparecem no portfólio. Aplicado depois do radical.
SINONIMOS = {
    "email": ["contato"], "mail": ["contato"], "contatar": ["contato"], "conversar": ["contato"],
    "whatsapp": ["contato"], "linkedin": ["contato"], "telefone": ["contato"],
    "linguagem": ["ferramenta", "stack", "tecnologia"], "tecnologia": ["ferramenta", "stack"],
    "ferramenta": ["stack"], "sabe": ["habilidade"], "domina": ["habilidade"], "conhecimento": ["habilidade"],
    "skill": ["habilidade"], "competencia": ["habilidade"],
    "trabalho": ["funcao", "setor"], "emprego": ["funcao", "setor"], "empresa": ["setor", "concessionaria"],
    "cargo": ["funcao", "atual"], "profissao": ["funcao"], "atua": ["funcao", "setor"], "trabalha": ["funcao", "setor"],
    "experiencia": ["trajetoria"], "carreira": ["trajetoria"], "historia": ["trajetoria"], "evolucao": ["trajetoria"],
    "inteligencia": ["ia"], "artificial": ["ia"], "llm": ["ia"], "gpt": ["ia"], "chatbot": ["ia", "assistente"],
    "robo": ["assistente"], "bot": ["assistente"],
    "seguro": ["seguranca"], "senha": ["seguranca"], "permissao": ["seguranca", "rls"],
    "teste": ["vitest"], "qualidade": ["teste"],
    "violao": ["harmony"], "musica": ["harmony", "violao"], "guitarra": ["harmony", "violao"], "solo": ["harmony"],
    "tarefa": ["fluxo"], "equipe": ["fluxo"], "supervisor": ["fluxo"], "cronometro": ["fluxo"],
    "venda": ["mapa"], "calor": ["mapa"], "heatmap": ["mapa", "calor"], "cidade": ["mapa"],
    "planilha": ["excel", "csv"], "excel": ["planilha"],
    "disponivel": ["oportunidade", "contato"], "vaga": ["oportunidade", "contato"], "contratar": ["oportunidade", "contato"],
    "dia": ["rotina"], "rotina": ["dia"], "faz": ["dia"],
    "projeto": ["projeto"], "github": ["github", "codigo"],
}


def normalizar(texto: str) -> str:
    """Minúsculas, sem acentos."""
    texto = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")


def radical(palavra: str) -> str:
    """Radical simples para português: junta singular e plural (dados -> dado, decisoes -> decisao)."""
    if len(palavra) > 4 and palavra.endswith("oes"):
        return palavra[:-3] + "ao"
    if len(palavra) > 4 and palavra.endswith("aes"):
        return palavra[:-3] + "ao"
    if len(palavra) > 5 and palavra.endswith("ais"):
        return palavra[:-3] + "al"
    if len(palavra) > 4 and palavra.endswith("es") and palavra[-3] in "rsz":
        return palavra[:-2]
    if len(palavra) > 3 and palavra.endswith("s") and not palavra.endswith("ss"):
        return palavra[:-1]
    return palavra


def tokenizar(texto: str) -> list[str]:
    """Texto -> lista de radicais, sem stopwords. Mesma lógica de `tokenizar` no assistente.js."""
    tokens = re.findall(r"[a-z0-9]+", normalizar(texto))
    return [radical(t) for t in tokens if len(t) > 1 and t not in STOPWORDS]


def sinonimos_normalizados() -> dict[str, list[str]]:
    """Sinônimos já com radical, prontos para o navegador."""
    return {radical(normalizar(k)): [radical(normalizar(v)) for v in vs] for k, vs in SINONIMOS.items()}


def expandir(tokens: list[str]) -> list[str]:
    """Acrescenta os sinônimos dos termos da pergunta."""
    sin = sinonimos_normalizados()
    extra = [s for t in tokens for s in sin.get(t, []) if s not in tokens]
    return tokens + extra


def ngramas_char(texto: str) -> list[str]:
    """Pedaços de 3 e 4 letras de cada palavra (com espaço nas pontas). Aguentam erro de digitação:
    "pyton" e "python" ainda dividem " py", "pyt" e "on ". Mesma lógica de `ngramasChar` no motor.js."""
    out = []
    for w in re.findall(r"[a-z0-9]+", normalizar(texto)):
        w = f" {w} "
        for n in (3, 4):
            out.extend(w[i:i + n] for i in range(len(w) - n + 1))
    return out


def distancia(a: str, b: str, limite: int) -> int:
    """Distância de edição (inserir, apagar, trocar ou inverter duas letras vizinhas), parando em `limite` + 1."""
    if abs(len(a) - len(b)) > limite:
        return limite + 1
    ant2, ant = None, list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        atual = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            custo = 0 if a[i - 1] == b[j - 1] else 1
            atual[j] = min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + custo)
            if ant2 and i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                atual[j] = min(atual[j], ant2[j - 2] + 1)
        if min(atual) > limite:
            return limite + 1
        ant2, ant = ant, atual
    return ant[-1]


def corrigir(tokens: list[str], conhecidas: dict[str, float]) -> list[str]:
    """Troca palavras que o índice não conhece pela mais parecida que ele conhece ("harmoni" -> "harmony").
    `conhecidas` é palavra -> idf; no empate de distância fica a palavra mais comum (menor idf).
    A primeira letra precisa bater: sem isso, "idade" vira "cidade"."""
    out = []
    for t in tokens:
        if t in conhecidas or len(t) < 4 or t.isdigit():
            out.append(t)
            continue
        limite = 1 if len(t) < 8 else 2
        melhor = None
        for c, idf in conhecidas.items():
            if c[0] != t[0] or " " in c:
                continue
            d = distancia(t, c, limite)
            if d <= limite and (melhor is None or (d, idf, c) < melhor):
                melhor = (d, idf, c)
        out.append(melhor[2] if melhor else t)
    return out


# Palavras que nomeiam um projeto. Sem nenhuma delas, a pergunta pode estar falando do projeto anterior.
PROJETOS = {
    "fluxo": ["fluxo", "taskflow", "tarefa", "tarefas", "supervisor", "cronometro"],
    "mapa": ["mapa", "mapas", "calor", "leaflet"],
    "superagente": ["superagente", "agente", "rag", "gemini", "groq"],
    "harmony": ["harmony", "violao", "guitarra", "solo", "solos", "caged", "acorde", "acordes", "escala", "escalas"],
}
# Só o nome do projeto (já com radical), mais palavras genéricas: "o que é o Fluxo?" pede a visão geral.
NOMES_PROJETO = {"fluxo": ["fluxo", "taskflow"], "mapa": ["mapa", "venda"], "superagente": ["superagente"], "harmony": ["harmony"]}
GENERICOS = ["funciona", "projeto", "app", "aplicativo", "sistema", "ferramenta"]
# Palavras que apontam para algo já dito na conversa: "e as telas dele?", "esse projeto usa testes?".
REFERENCIAS = sorted({
    "ele", "ela", "dele", "dela", "nele", "nela", "esse", "essa", "desse", "dessa", "nesse", "nessa", "este", "esta",
    "deste", "desta", "neste", "nesta", "isso", "disso", "nisso",
})
# Palavras que mostram que a pergunta é sobre a pessoa, não sobre o projeto: "qual a sua idade?".
PESSOA = sorted({"voce", "vc", "tu", "teu", "tua", "seu", "sua", "seus", "suas", "contigo", "ayalan"})


def projeto_citado(pergunta: str) -> str | None:
    palavras = set(re.findall(r"[a-z0-9]+", normalizar(pergunta)))
    for p, termos in PROJETOS.items():
        if palavras & set(termos):
            return p
    return None


def tem_referencia(pergunta: str) -> bool:
    palavras = re.findall(r"[a-z0-9]+", normalizar(pergunta))
    return bool(set(palavras) & set(REFERENCIAS)) or (len(palavras) > 1 and palavras[0] == "e")


def fala_da_pessoa(pergunta: str) -> bool:
    return bool(set(re.findall(r"[a-z0-9]+", normalizar(pergunta))) & set(PESSOA))
