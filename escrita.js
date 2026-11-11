// Escrita com IA: o Gemini Nano, o modelo que vem dentro do Chrome para computador (Prompt API, `LanguageModel`).
// Roda no aparelho da pessoa: nada é enviado. O Chrome ainda não lista o português entre os idiomas do modelo e responde
// "unavailable" quando o pedido declara "pt"; sem declarar idioma, o modelo escreve em português. Por isso não declaramos.
// Os exemplos (pedido → resposta) ensinam ao modelo, que é pequeno, o que cada tipo de pedido quer: só com a regra escrita
// ele escorrega (escrevia "sou grato" nas dedicatórias); com o exemplo, acerta.

export const SISTEMA = `Você escreve textos curtos em português do Brasil para preencher um retrato desenhado com letras. Responda sempre só com o texto pedido, sem título, sem aspas, sem listas, sem emojis e sem comentários.

Regras:
1. Tema ou palavra (por exemplo: mar, saudade, futebol): um parágrafo original de 50 a 80 palavras sobre o tema, em frases completas e com imagens concretas.
2. Obra, autor, gênero ou livro sagrado (por exemplo: senhor dos anéis, machado de assis, bíblia): um parágrafo original de 50 a 80 palavras no estilo e no clima da obra, como se fosse um trecho novo dela. Nunca copie trechos nem cite versículos, falas ou capítulos.
3. Pessoa ou ocasião (por exemplo: para minha mãe, aniversário da Ana): uma dedicatória de 40 a 70 palavras escrita diretamente para a pessoa, em frases completas e calorosas. Não invente fatos sobre a pessoa. Não use palavras que mostrem o gênero de quem escreve, como grato, grata, obrigado, obrigada, cansado ou cansada; prefira formas como agradeço.
4. Pedido de forma (por exemplo: só o nome Rafa, o alfabeto, em inglês): faça exatamente o que foi pedido e nada mais.
5. Pedido ofensivo, sexual ou com dados pessoais de terceiros: um parágrafo neutro sobre luz e sombra.`;

export const EXEMPLOS = [
  ["mar", "O mar chega cedo, antes de todo mundo, e deixa espuma nos pés de quem passa. Tem cheiro de sal e de começo. As ondas repetem a mesma frase há séculos, e ninguém se cansa de ouvir. No fim da tarde, o azul vira cobre, os barcos voltam devagar e a areia guarda, por um instante, as pegadas do dia."],
  ["dom quixote", "Montado num cavalo magro e numa coragem enorme, o cavaleiro sai pela estrada convencido de que cada moinho esconde um gigante. O escudeiro, mais prático, conta os pães e as léguas. Riem dele nas estalagens, mas ele segue adiante, porque acredita que o mundo ainda precisa de quem defenda os fracos, nem que seja contra o vento."],
  ["para meu avô", "Vô, agradeço por ter me ensinado a ter paciência com as coisas que crescem devagar. Suas histórias ainda moram na mesa da cozinha, entre o café e o pão. Cada conselho seu virou caminho. Hoje, quando alguém pergunta de onde vem esse jeito calmo de olhar o mundo, a resposta é simples: vem de você."],
  ["só a palavra luz", "luz"],
];

export const SUGESTOES = ["bíblia", "senhor dos anéis", "amor", "para minha mãe"];

/** "available" | "downloadable" | "downloading" | "unavailable" | "sem-api" (navegador sem a Prompt API). */
export async function disponibilidade() {
  if (!("LanguageModel" in globalThis)) return "sem-api";
  try {
    return await LanguageModel.availability();
  } catch {
    return "unavailable";
  }
}

let base = null;
/** Sessão com o prompt e os exemplos, criada uma vez; cada pedido usa um clone dela (sem histórico entre pedidos). */
function sessaoBase(aoBaixar) {
  base ??= LanguageModel.create({
    initialPrompts: [
      { role: "system", content: SISTEMA },
      ...EXEMPLOS.flatMap(([pedido, resposta]) => [{ role: "user", content: pedido }, { role: "assistant", content: resposta }]),
    ],
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => aoBaixar?.(e.loaded));
    },
  }).catch((e) => {
    base = null;
    throw e;
  });
  return base;
}

/** Deixa o modelo pronto (na primeira vez, o Chrome baixa); chamar dentro do clique em que a pessoa aceitou. */
export async function preparar(aoBaixar) {
  await sessaoBase(aoBaixar);
}

/** Tira aspas e marcação que o modelo às vezes põe; no retrato, quebras de linha viram espaço de qualquer jeito. */
export const limpar = (t) => t.replace(/["“”«»*#_]/g, "").replace(/\s+/g, " ").trim();

/**
 * Escreve um texto a partir do pedido; aoTrecho(texto) recebe o texto até ali a cada pedaço que chega. Deve ser chamada
 * ainda dentro do clique: na primeira vez, o Chrome baixa o modelo, e o download exige um gesto da pessoa.
 */
export async function escrever(pedido, { signal, aoTrecho, aoBaixar } = {}) {
  const promessa = sessaoBase(aoBaixar);
  const sessao = await (await promessa).clone({ signal });
  try {
    let bruto = "";
    for await (const pedaco of sessao.promptStreaming(pedido, { signal })) {
      bruto += pedaco; // o Chrome manda só o trecho novo
      aoTrecho?.(limpar(bruto));
    }
    return limpar(bruto);
  } finally {
    sessao.destroy();
  }
}
