# Ayalan Lima · Portfólio

Portfólio de **Ayalan Lima**, desenvolvedor e analista de dados. O site imita um editor de código: cada arquivo da barra lateral abre uma área.

**Acesse:** https://ahaylima2721.github.io/Meu-Portif-lio/

## O que tem no site

- **Sobre mim:** quem sou, minha função, meu dia a dia, habilidades, linha do tempo e stack.
- **Projetos**, cada um com problema, arquitetura, decisões técnicas, desafios, números e telas:
  - **Fluxo**: gestão de tarefas da equipe com cronômetro, envio em lote, aprovações e calendário de compras (React, TanStack Start, Supabase).
  - **Mapa de Vendas**: planilha de vendas transformada em mapa de calor por cidade (JavaScript, Leaflet, PapaParse, SheetJS).
  - **SuperAgente**: assistente que responde perguntas sobre planilhas com RAG (Python, scikit-learn, Gemini, Groq).
  - **Harmony**: app de estudo de violão com gerador de solos e 354 testes (React, TypeScript, Web Audio, Capacitor).

## Assistente do portfólio (Python + machine learning)

O orbe de cristal no canto da página é um assistente que responde perguntas sobre o Ayalan e os projetos. O treino é em Python; a resposta roda no navegador, sem servidor e sem chave de API.

**Base de conhecimento.** `assistente/extrair.py` lê o `index.html` e divide o conteúdo em trechos com título e link. Somam-se os fatos dos READMEs dos repositórios que não cabem na página (`repositorios.json`) e os trechos sobre o próprio assistente (`extras.json`): 136 trechos no total.

**Modelo** (`assistente/construir_indice.py`), dois componentes que se somam:

1. **Busca por similaridade:** TF-IDF dos trechos (unigramas e bigramas, tf sublinear, norma L2) com tokenização própria para português (sem acentos, sem stopwords, singular e plural juntos).
2. **Classificador de tema:** regressão logística sobre n-gramas de palavras e de letras (3 e 4), treinada com 522 perguntas escritas à mão em 15 temas (`treino.json`), duas versões de cada uma com erro de digitação e os próprios trechos do site. Um dos temas é "fora do portfólio".

A nota de cada trecho é `(1 − λ) · similaridade + λ · probabilidade do tema do trecho`. A regularização do classificador, o λ e os limiares de "fora do escopo" são escolhidos por busca em grade numa validação com 25% das perguntas. Na validação, dizer "não sei" a uma pergunta que o portfólio responde custa mais que errar a seção. Os pesos menores que 8% do maior são podados: o índice cai de 669 KB para cerca de 380 KB (~100 KB com gzip) sem perder acerto.

**No navegador** (`assistente/motor.js`), a pergunta passa por:

- **correção de digitação** contra o vocabulário do índice ("harmoni" vira "harmony");
- **contexto da conversa:** "e quantos testes ele tem?" depois de uma pergunta sobre o Harmony continua no Harmony;
- **classificador + similaridade**, com link para a parte do site de onde veio a resposta;
- **recusa educada** quando a pergunta foge do portfólio, em vez de devolver o trecho menos pior.

**Avaliação** (`assistente/avaliar.py`): 62 perguntas de teste que não entram no treino, com erros de digitação, perguntas de continuação e perguntas fora do escopo.

| Grupo | Perguntas | Só TF-IDF (versão anterior) | Modelo atual |
| --- | ---: | ---: | ---: |
| Todas | 62 | 69% | 98% |
| No escopo | 47 | 77% | 98% |
| Fora do escopo | 8 | 50% | 100% |
| Continuação | 8 | 50% | 100% |

Acerto no 1º resultado. O classificador sozinho acerta 65% dos temas em validação cruzada de 5 partes; boa parte dos erros é entre temas vizinhos (habilidades e ferramentas, por exemplo), que a busca por similaridade desempata.

**Testes** (`pytest`): regras de texto, índice em dia com o site, fora do escopo, contexto, qualidade mínima e **paridade**: as 586 perguntas passam pelo `busca.py` e pelo `motor.js` no Node, e as respostas têm que ser idênticas.

A cada push, o GitHub Actions treina o modelo, roda a avaliação e os testes e só então publica o site.

```bash
pip install -r assistente/requirements.txt
python assistente/construir_indice.py   # treina e salva assistente/indice.json
python assistente/avaliar.py            # compara com a versão só TF-IDF
python -m pytest -q assistente/tests
```

## Sobre as imagens

As capturas do Fluxo tiveram nomes de pessoas, e-mail, tarefas, arquivos e o logo da empresa trocados por dados fictícios. As do Mapa de Vendas usam uma base de vendas fictícia com a mesma estrutura de colunas da real.

## Tecnologia

Uma única página HTML com CSS e JavaScript puros, sem build. Fontes do Google Fonts e ícones Lucide embutidos como SVG. Publicada com GitHub Pages.

## Contato

ayalanlima35@gmail.com · [github.com/Ahaylima2721](https://github.com/Ahaylima2721)
