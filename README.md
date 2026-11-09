# Retrato em ASCII

Transforma uma foto num retrato desenhado com caracteres, como num terminal: **https://dalmolin.dev/retrato-ascii/**

Tudo roda no navegador. A foto não é enviada a lugar nenhum: o recorte do fundo e o desenho são feitos na própria página,
e o modelo e o MediaPipe são servidos por este repositório (nenhum pedido sai do site).

## Como funciona

1. A foto é reduzida a no máximo 1024 px no lado maior.
2. O [Image Segmenter do MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter), com o modelo
   `selfie_segmenter` (250 KB), separa a pessoa do fundo. A máscara perde uma faixa fina da borda (erosão) e a foto é
   enquadrada na pessoa.
3. A foto vira tons de cinza, as sombras são clareadas (gama ajustável), o contraste local é realçado (duas máscaras de
   nitidez) e cada bloco vira um caractere da escala ` .:-=+*#%@`. O contraste é medido só na pessoa (percentis 2 e 98).
4. Saem duas versões: uma para fundo claro (escuro da foto = caractere cheio) e outra para fundo escuro (o contrário).

É o mesmo processamento do retrato do [Sobre de dalmolin.dev](https://dalmolin.dev/sobre/)
(`ferramentas/retrato.py` no repo do site, que recorta o fundo com outro modelo, o segformer).

## Arquivos

- `index.html`, `estilo.css`, `app.js`: a página.
- `retrato.js`: foto → caracteres (funções puras, sem DOM).
- `recorte.js`: recorte da pessoa com o MediaPipe.
- `vendor/mediapipe/`: `@mediapipe/tasks-vision` 1.2.2 (Apache 2.0), só o pacote e o wasm usados.
- `modelos/selfie_segmenter.tflite`: modelo do MediaPipe.
- `fontes/`: Archivo, Source Sans 3 e IBM Plex Mono (SIL Open Font License).
- `exemplo.json`: o retrato mostrado antes de a pessoa escolher uma foto.

## Conferência

```
python ferramentas/confere.py [foto]
```

Sobe a foto em 1280 e 390 px, tema claro e escuro, e confere erros de console, rolagem lateral, exportações (.txt e PNG)
e se algum pedido saiu do site. Capturas em `ferramentas/_capturas/`. `python ferramentas/og.py` refaz `og.png`.
Para abrir localmente: `python -m http.server` na raiz.

---

Código sob licença MIT. Feito por Matheus Dalmolin · [dalmolin.dev](https://dalmolin.dev/)
