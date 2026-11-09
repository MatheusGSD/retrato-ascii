// Recorte da pessoa com o MediaPipe Image Segmenter, rodando no navegador (wasm + modelo servidos por este site).
import { FilesetResolver, ImageSegmenter } from "./vendor/mediapipe/vision_bundle.mjs";

// selfie_segmenter (250 KB): no teste com o retrato do Sobre, deu a mesma arte que o selfie_multiclass_256x256 (16 MB).
export const MODELO = "selfie_segmenter";
const segmentadores = new Map();

export function carregar(modelo = MODELO) {
  if (!segmentadores.has(modelo))
    segmentadores.set(modelo, (async () => {
      const wasm = await FilesetResolver.forVisionTasks(new URL("./vendor/mediapipe/wasm", import.meta.url).href);
      return ImageSegmenter.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: new URL(`./modelos/${modelo}.tflite`, import.meta.url).href, delegate: "CPU" },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })());
  return segmentadores.get(modelo);
}

/** Probabilidade de cada pixel ser da pessoa (Float32Array no tamanho da máscara, que vem em {w, h}). */
export async function pessoa(imagem, modelo = MODELO) {
  const seg = await carregar(modelo);
  const res = seg.segment(imagem);
  try {
    const mascaras = res.confidenceMasks;
    const { width: w, height: h } = mascaras[0];
    const rotulos = seg.getLabels().map((r) => r.toLowerCase());
    let p;
    if (mascaras.length > 1) {
      // vários rótulos (fundo, cabelo, pele, roupa, acessórios...): pessoa = tudo menos o fundo
      const i = Math.max(0, rotulos.indexOf("background"));
      p = mascaras[i].getAsFloat32Array().map((v) => 1 - v);
    } else {
      p = Float32Array.from(mascaras[0].getAsFloat32Array());
    }
    return { p, w, h, rotulos, n: mascaras.length };
  } finally {
    res.close();
  }
}
