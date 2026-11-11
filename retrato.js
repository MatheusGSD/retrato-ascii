// Foto → retrato em caracteres. Mesmo processamento do retrato do Sobre de dalmolin.dev (ferramentas/retrato.py):
// recorta a pessoa, clareia as sombras, realça o contraste local e reduz a uma grade de caracteres.
// Funções puras sobre Float32Array (0 a 1, linha a linha), sem DOM. Além da escala de símbolos, desenha com um texto
// qualquer: letras soltas, maiúsculas e minúsculas (texto puro) ou a lista de células para os estilos desenhados.

export const ESCALA = " .:-=+*#%@"; // do vazio ao cheio
export const CELULA = 0.6 / 1.2; // largura do caractere em IBM Plex Mono / altura da linha (line-height 1.2)
const PISO = 0.12; // densidade mínima na pessoa, para a silhueta aparecer mesmo nas partes claras

/** Tamanhos de 3 caixas cuja convolução aproxima uma gaussiana de desvio-padrão sigma. */
function caixasGauss(sigma) {
  const ideal = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  return [0, 1, 2].map((i) => (i < m ? wl : wl + 2));
}

/** Média móvel numa direção, com a borda repetida. */
function caixa1d(src, dst, w, h, r, horizontal) {
  const [n, linhas, passo, salto] = horizontal ? [w, h, 1, w] : [h, w, w, 1];
  const div = 2 * r + 1;
  for (let l = 0; l < linhas; l++) {
    const base = l * salto;
    const at = (i) => src[base + Math.min(n - 1, Math.max(0, i)) * passo];
    let soma = 0;
    for (let i = -r; i <= r; i++) soma += at(i);
    for (let i = 0; i < n; i++) {
      dst[base + i * passo] = soma / div;
      soma += at(i + r + 1) - at(i - r);
    }
  }
}

export function borrar(src, w, h, sigma) {
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  for (const tam of caixasGauss(sigma)) {
    const r = (tam - 1) / 2;
    caixa1d(a, b, w, h, r, true);
    caixa1d(b, a, w, h, r, false);
  }
  return a;
}

/** Máscara de nitidez, como a UnsharpMask do Pillow: soma a diferença para a versão borrada onde ela passa do limiar. */
export function realcar(lum, w, h, raio, porcento, limiar = 0) {
  const borrada = borrar(lum, w, h, raio);
  const out = new Float32Array(lum.length);
  for (let i = 0; i < lum.length; i++) {
    const d = lum[i] - borrada[i];
    out[i] = Math.abs(d) >= limiar ? Math.min(1, Math.max(0, lum[i] + (d * porcento) / 100)) : lum[i];
  }
  return out;
}

/** Erosão (mínimo numa janela quadrada de lado 2r+1): tira a franja do fundo da borda da máscara. */
export function erodir(m, w, h, r) {
  if (r < 1) return m;
  const tmp = new Float32Array(m.length);
  const out = new Float32Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = Math.min(v, m[y * w + k]);
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = Math.min(v, tmp[k * w + x]);
      out[y * w + x] = v;
    }
  return out;
}

/** Retângulo [x0, y0, x1, y1) que contém a máscara acima do limiar, ou null se ela estiver vazia. */
export function enquadrar(m, w, h, limiar = 0.5) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x] > limiar) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

/** Média de cada célula da grade (cols × linhas). */
function reduzir(src, w, h, cols, linhas) {
  const soma = new Float32Array(cols * linhas);
  const n = new Float32Array(cols * linhas);
  for (let y = 0; y < h; y++) {
    const ly = Math.min(linhas - 1, Math.floor((y * linhas) / h));
    for (let x = 0; x < w; x++) {
      const c = ly * cols + Math.min(cols - 1, Math.floor((x * cols) / w));
      soma[c] += src[y * w + x];
      n[c]++;
    }
  }
  return soma.map((s, i) => (n[i] ? s / n[i] : 0));
}

function percentil(ordenados, p) {
  const i = (ordenados.length - 1) * p;
  const a = Math.floor(i);
  const b = Math.min(ordenados.length - 1, a + 1);
  return ordenados[a] + (ordenados[b] - ordenados[a]) * (i - a);
}

/**
 * Grade do retrato. lum: luminância já enquadrada (w × h); masc: máscara da pessoa no mesmo enquadramento, ou null
 * (sem recorte). As medidas dos filtros valem para uma imagem com cerca de 560 px de largura (a do retrato do Sobre).
 * Devolve, por célula, o claro da foto normalizado (norm, 0 a 1) e se a célula é da pessoa (dentro, 0 ou 1).
 */
export function grade(lum, masc, w, h, { colunas = 60, gama = 0.7 } = {}) {
  const k = w / 560;
  let l = lum.map((v) => Math.pow(v, gama)); // gama < 1 clareia as sombras
  l = realcar(l, w, h, 24 * k, 90); // contraste local
  l = realcar(l, w, h, 3 * k, 140, 2 / 255); // nitidez dos traços
  const linhas = Math.max(1, Math.round(((colunas * h) / w) * CELULA));
  const g = reduzir(l, w, h, colunas, linhas);
  const dentro = masc ? reduzir(masc, w, h, colunas, linhas).map((v) => (v > 0.5 ? 1 : 0)) : g.map(() => 1);
  const ord = g.filter((_, i) => dentro[i]).sort();
  const lo = ord.length ? percentil(ord, 0.02) : 0; // contraste medido só na pessoa
  const hi = ord.length ? percentil(ord, 0.98) : 1;
  const norm = g.map((v) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1))));
  return { norm, dentro, colunas, linhas, piso: masc ? PISO : 0 };
}

/**
 * Tinta de cada célula (0 a 1). No fundo claro, o escuro da foto é cheio; no fundo escuro, o contrário (com uma versão
 * só, uma das duas sai em negativo). O piso garante a silhueta nas partes mais claras da pessoa.
 */
export function tinta(G, fundo, comPiso = true) {
  const piso = comPiso ? G.piso : 0;
  return G.norm.map((v, i) => (G.dentro[i] ? piso + (1 - piso) * (fundo === "claro" ? 1 - v : v) : 0));
}

function linhasDeTexto(G, celula) {
  const out = [];
  for (let y = 0; y < G.linhas; y++) {
    let s = "";
    for (let x = 0; x < G.colunas; x++) s += celula(y * G.colunas + x);
    out.push(s.trimEnd());
  }
  return out.join("\n");
}

/** Escala de símbolos: cada célula vira um caractere de ESCALA, do vazio ao cheio. */
export function simbolos(G, fundo) {
  const d = tinta(G, fundo);
  return linhasDeTexto(G, (i) => ESCALA[Math.min(ESCALA.length - 1, Math.floor(d[i] * ESCALA.length))]);
}

/** Compatibilidade: as duas versões em símbolos de uma vez. */
export function retrato(lum, masc, w, h, opcoes) {
  const G = grade(lum, masc, w, h, opcoes);
  return { claro: simbolos(G, "claro"), escuro: simbolos(G, "escuro"), colunas: G.colunas, linhas: G.linhas };
}

// ---------- desenho com texto ----------

/** O texto em fila, repetido sem fim; espaços e quebras de linha em sequência viram um espaço só. */
export function fila(texto) {
  const t = [...((texto.replace(/\s+/g, " ").trim() || "texto") + " ")];
  let i = 0;
  return () => t[i++ % t.length];
}

/**
 * Reduz a tinta a n níveis (0 a n-1) com difusão de erro (Floyd–Steinberg): o que sobra do arredondamento de uma
 * célula passa para as vizinhas, e um cinza médio vira uma mistura de cheio e vazio, como a retícula de um jornal.
 */
export function niveis(d, G, n) {
  const { colunas: C, linhas: L, dentro } = G;
  const e = Float32Array.from(d);
  const q = new Uint8Array(d.length);
  for (let y = 0; y < L; y++)
    for (let x = 0; x < C; x++) {
      const i = y * C + x;
      if (!dentro[i]) continue;
      q[i] = Math.round(Math.min(1, Math.max(0, e[i])) * (n - 1));
      const erro = e[i] - q[i] / (n - 1);
      const passa = (dx, dy, f) => {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < C && yy < L && dentro[yy * C + xx]) e[yy * C + xx] += erro * f;
      };
      passa(1, 0, 7 / 16); passa(-1, 1, 3 / 16); passa(0, 1, 5 / 16); passa(1, 1, 1 / 16);
    }
  return q;
}

/** Letras soltas: onde há tinta entra a próxima letra do texto; onde não há, espaço. */
export function letras(G, fundo, texto) {
  const q = niveis(tinta(G, fundo), G, 2);
  const prox = fila(texto);
  return linhasDeTexto(G, (i) => (q[i] ? prox() : " "));
}

/** Maiúsculas e minúsculas: espaço, minúscula ou MAIÚSCULA, conforme a tinta. */
export function maiusculas(G, fundo, texto) {
  const q = niveis(tinta(G, fundo), G, 3);
  const prox = fila(texto);
  return linhasDeTexto(G, (i) => (q[i] === 0 ? " " : q[i] === 1 ? prox().toLowerCase() : prox().toUpperCase()));
}

/** Para os estilos desenhados (peso e tamanho): a letra e a tinta (sem piso) de cada célula da pessoa, em ordem. */
export function celulas(G, fundo, texto) {
  const d = tinta(G, fundo, false);
  const prox = fila(texto);
  const out = [];
  for (let i = 0; i < d.length; i++)
    if (G.dentro[i]) out.push({ x: i % G.colunas, y: Math.floor(i / G.colunas), letra: prox(), tinta: d[i] });
  return out;
}
