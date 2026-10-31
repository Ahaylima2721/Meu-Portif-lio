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

O orbe de cristal no canto da página é um assistente que responde perguntas sobre o Ayalan e os projetos, sem servidor e sem chave de API.

1. **Extração** (`assistente/extrair.py`): lê o `index.html` e divide o conteúdo em 122 trechos, cada um com título e link para a parte do site.
2. **Vetorização** (`assistente/construir_indice.py`): TF-IDF com scikit-learn (unigramas e bigramas, tf sublinear, norma L2) e tokenização própria para português (sem acentos, sem stopwords, singular e plural juntos).
3. **Avaliação** (`assistente/avaliar.py`): 28 perguntas de teste. Acerto no 1º resultado: 93%. Entre os 3 primeiros: 100%.
4. **Busca no navegador** (`index.html`): a pergunta vira um vetor com as mesmas regras e o assistente responde com os trechos de maior similaridade de cosseno, com link para a fonte.

A cada push, o GitHub Actions treina o índice, roda a avaliação e os testes (`pytest`) e só então publica o site.

```bash
pip install -r assistente/requirements.txt
python assistente/construir_indice.py
python assistente/avaliar.py
python -m pytest -q assistente/tests
```

## Sobre as imagens

As capturas do Fluxo tiveram nomes de pessoas, e-mail, tarefas, arquivos e o logo da empresa trocados por dados fictícios. As do Mapa de Vendas usam uma base de vendas fictícia com a mesma estrutura de colunas da real.

## Tecnologia

Uma única página HTML com CSS e JavaScript puros, sem build. Fontes do Google Fonts e ícones Lucide embutidos como SVG. Publicada com GitHub Pages.

## Contato

ayalanlima35@gmail.com · [github.com/Ahaylima2721](https://github.com/Ahaylima2721)
