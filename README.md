# Retrato em ASCII

Transforma uma foto num retrato desenhado com caracteres, como num terminal, ou escrito com um texto (seu, um poema em
domínio público ou um que a IA do Chrome escreve): **https://dalmolin.dev/retrato-ascii/**

Tudo roda no navegador. A foto não é enviada a lugar nenhum: o recorte do fundo e o desenho são feitos na própria página,
e o modelo e o MediaPipe são servidos por este repositório. O único pedido para fora do site é o contador de visitas da
Cloudflare (Web Analytics), que vale para todo o dalmolin.dev e não recebe a foto. A escrita com IA também roda no
aparelho: é o Gemini Nano que vem dentro do Chrome (quem baixa o modelo, na primeira vez, é o próprio Chrome).

## Como funciona

1. A foto é reduzida a no máximo 1024 px no lado maior.
2. O [Image Segmenter do MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter), com o modelo
   `selfie_segmenter` (250 KB), separa a pessoa do fundo. A máscara perde uma faixa fina da borda (erosão) e a foto é
   enquadrada na pessoa.
3. A foto vira tons de cinza, as sombras são clareadas (gama ajustável), o contraste local é realçado (duas máscaras de
   nitidez) e cada bloco vira um caractere da escala ` .:-=+*#%@`. O contraste é medido só na pessoa (percentis 2 e 98).
4. Saem duas versões: uma para fundo claro (escuro da foto = caractere cheio) e outra para fundo escuro (o contrário).
5. Em **Letras**, o retrato é escrito com um texto, que corre em ordem de leitura e se repete até preencher a foto.
   **Soltas** e **Maiúsculas** continuam sendo texto puro: o tom de cada bloco é arredondado para letra ou
   espaço (ou espaço, minúscula e MAIÚSCULA), e o que sobra do arredondamento passa para os vizinhos (difusão de erro de
   Floyd–Steinberg). **Traço** e **Tamanho** desenham todas as letras e tiram o tom da grossura (IBM Plex Mono de 100 a
   700) ou do tamanho de cada uma; saem só como imagem.
6. O texto vem da caixa (colado), dos prontos (poemas, cantigas e o Salmo 23 na Almeida de 1819, todos em domínio
   público, com a fonte de cada um em `prontos.js`) ou do Gemini Nano, pela
   [Prompt API do Chrome](https://developer.chrome.com/docs/ai/prompt-api), só no Chrome para computador. O Chrome ainda
   não lista o português entre os idiomas do modelo e recusa quando o pedido declara `pt`; sem declarar, o modelo escreve
   em português. O prompt (`escrita.js`) tem regras e quatro exemplos de pedido e resposta: com os exemplos, o modelo
   acerta o tipo de pedido (tema, obra, dedicatória, pedido de forma). Em outros navegadores, a aba explica por que não
   está disponível.

É o mesmo processamento do retrato do [Sobre de dalmolin.dev](https://dalmolin.dev/sobre/)
(`ferramentas/retrato.py` no repo do site, que recorta o fundo com outro modelo, o segformer).

## Arquivos

- `index.html`, `estilo.css`, `app.js`: a página.
- `escrita.js`: a escrita com o Gemini Nano (prompt, exemplos, disponibilidade, texto em fluxo).
- `prontos.js`: os textos prontos, com a fonte de cada um.
- `retrato.js`: foto → grade → símbolos ou texto (funções puras, sem DOM).
- `recorte.js`: recorte da pessoa com o MediaPipe.
- `vendor/mediapipe/`: `@mediapipe/tasks-vision` 1.2.2 (Apache 2.0), só o pacote e o wasm usados.
- `modelos/selfie_segmenter.tflite`: modelo do MediaPipe.
- `fontes/`: Archivo, Source Sans 3 e IBM Plex Mono (SIL Open Font License).
- `exemplo.json`: o retrato mostrado antes de a pessoa escolher uma foto.

## Conferência

```
python ferramentas/confere.py [foto]
```

Sobe a foto em 1280 e 390 px (claro e escuro) e em 1440 × 709 a 2x (escuro) e confere erros de console, rolagem lateral,
exportações (.txt e PNG) e se algum pedido saiu do site. Em Letras, confere cada estilo, os prontos, a caixa de texto, a
aba da IA (o Chromium do Playwright não tem a Prompt API, então ela mostra o aviso) e se a prévia continua inteira na tela
ao rolar os ajustes. A escrita com o Gemini Nano em si só se testa num Chrome de verdade. Capturas em `ferramentas/_capturas/`. `python ferramentas/og.py` refaz `og.png`.
Para abrir localmente: `python -m http.server` na raiz.

---

Código sob licença MIT. Feito por Matheus Dalmolin · [dalmolin.dev](https://dalmolin.dev/)
