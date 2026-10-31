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
