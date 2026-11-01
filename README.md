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
  - **Zoe** (em andamento): a assistente do portfólio, com página própria e um laboratório que mostra cada etapa de uma resposta (Python, scikit-learn, JavaScript).

## Zoe, a assistente do portfólio (Python + machine learning)

O orbe de cristal no canto da página é a **Zoe**, uma assistente que responde perguntas sobre o Ayalan e os projetos. Ela tem página própria (`#zoe`), tratada como projeto em andamento, com um laboratório que roda o mesmo motor e mostra as palavras corrigidas, a probabilidade de cada tema, os trechos mais parecidos e a decisão final. A página também traz o algoritmo passo a passo com as fórmulas (os valores de λ, C e limiares são lidos do índice publicado) e uma **rede neural interativa**: o classificador desenhado como rede de uma camada, com os pesos reais, e um experimento que treina no navegador uma rede com camada oculta (ReLU + softmax, Adam) sobre as mesmas perguntas de treino. No topo do site, a Zoe mora no quadrado azul e voa até o canto quando a página rola. O treino é em Python; a resposta roda no navegador, sem servidor e sem chave de API.

**Base de conhecimento.** `assistente/extrair.py` lê o `index.html` e divide o conteúdo em trechos com título e link. Somam-se os fatos dos READMEs dos repositórios que não cabem na página (`repositorios.json`), os trechos sobre a própria Zoe (`extras.json`) e um perfil além do site, com formação, objetivos, como trabalho e hobbies (`perfil.json`): 183 trechos no total. Blocos com `data-indice="nao"` (fórmulas e widgets) ficam fora do índice. A página da Zoe e os trechos sobre ela formam o tema `assistente`.

**Modelo** (`assistente/construir_indice.py`), dois componentes que se somam:

1. **Busca por similaridade:** TF-IDF dos trechos (unigramas e bigramas, tf sublinear, norma L2) com tokenização própria para português (sem acentos, sem stopwords, singular e plural juntos).
2. **Classificador de tema:** regressão logística sobre n-gramas de palavras e de letras (3 e 4), treinada com 601 perguntas escritas à mão em 15 temas (`treino.json`), duas versões de cada uma com erro de digitação e os próprios trechos do site. Um dos temas é "fora do portfólio".

A nota de cada trecho é `(1 − λ) · similaridade + λ · probabilidade do tema do trecho`. A regularização do classificador, o λ e os limiares de "fora do escopo" são escolhidos por busca em grade, pela nota média de três sorteios de validação com 25% das perguntas cada (um sorteio só deixava a escolha sujeita à sorte). Na validação, dizer "não sei" a uma pergunta que o portfólio responde custa mais que errar a seção. Os pesos menores que 8% do maior são podados: o índice fica em cerca de 435 KB (~120 KB com gzip) sem perder acerto.

**No navegador** (`assistente/motor.js`), a pergunta passa por:

- **correção de digitação** contra o vocabulário do índice ("harmoni" vira "harmony");
- **contexto da conversa:** "e quantos testes ele tem?" depois de uma pergunta sobre o Harmony continua no Harmony (vale também para a Zoe: "e quanto ela acerta?");
- **classificador + similaridade**, com link para a parte do site de onde veio a resposta;
- **recusa educada** quando a pergunta foge do portfólio, em vez de devolver o trecho menos pior.

**Avaliação** (`assistente/avaliar.py`): 72 perguntas de teste que não entram no treino, com erros de digitação, perguntas de continuação e perguntas fora do escopo.

| Grupo | Perguntas | Só TF-IDF (versão anterior) | Modelo atual |
| --- | ---: | ---: | ---: |
| Todas | 72 | 65% | 96% |
| No escopo | 56 | 71% | 96% |
| Fora do escopo | 8 | 50% | 100% |
| Continuação | 9 | 44% | 89% |

Acerto no 1º resultado. Com o perfil (`perfil.json`), entraram perguntas pessoais que precisam continuar fora do escopo, como idade e salário; o treino ganhou exemplos delas e a recusa passou a acertar os 8 casos de teste. O ponto fraco hoje são palavras que puxam para outro tema: perguntar onde fica o trabalho usando a palavra "cidade" leva ao Mapa de Vendas. Com o texto novo da página da Zoe (status, integração e por que aprender machine learning), a busca em grade passou a escolher C = 10 e uma pergunta de continuação ("Quais tecnologias ele usa?" depois do Fluxo) voltou a cair em Ferramentas: 97% → 96%. O classificador sozinho acerta 64% dos temas em validação cruzada de 5 partes; boa parte dos erros é entre temas vizinhos (habilidades e ferramentas, por exemplo), que a busca por similaridade desempata.

**Testes** (`pytest`): regras de texto, índice em dia com o site, fora do escopo, contexto, qualidade mínima e **paridade**: as mais de 600 perguntas passam pelo `busca.py` e pelo `motor.js` no Node, e as respostas têm que ser idênticas.

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
