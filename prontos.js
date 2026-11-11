// Textos prontos para desenhar o retrato. Só obras em domínio público no Brasil (Lei 9.610/98: 70 anos contados de 1º de
// janeiro do ano seguinte à morte do autor) e cantigas populares. Redação conferida com a fonte de cada um em 11/11/2026,
// com a ortografia atualizada (sem trocar palavras) e os versos corridos num parágrafo. O Salmo vem da Almeida de 1819: as
// edições modernas da Almeida (Revista e Corrigida, Revista e Atualizada, Corrigida Fiel) têm direitos de editoras.
export const PRONTOS = [
  { id: "camoes", grupo: "Poemas", titulo: "Amor é fogo que arde sem se ver", autor: "Luís de Camões",
    fonte: "https://pt.wikisource.org/wiki/Rimas_de_Luís_de_Camões/Sonetos/81",
    texto: "Amor é fogo que arde sem se ver, é ferida que dói, e não se sente, é um contentamento descontente, é dor que desatina sem doer. É um não querer mais que bem querer, é um andar solitário entre a gente, é nunca contentar-se de contente, é um cuidar que ganha em se perder. É querer estar preso por vontade, é servir a quem vence o vencedor, é ter com quem nos mata lealdade. Mas como causar pode seu favor nos corações humanos amizade, se tão contrário a si é o mesmo Amor?" },
  { id: "exilio", grupo: "Poemas", titulo: "Canção do Exílio", autor: "Gonçalves Dias",
    fonte: "https://pt.wikisource.org/wiki/Canção_do_Exílio_(Gonçalves_Dias)",
    texto: "Minha terra tem palmeiras, onde canta o Sabiá; as aves, que aqui gorjeiam, não gorjeiam como lá. Nosso céu tem mais estrelas, nossas várzeas têm mais flores, nossos bosques têm mais vida, nossa vida mais amores. Em cismar — sozinho — à noite — mais prazer encontro eu lá; minha terra tem palmeiras, onde canta o Sabiá. Minha terra tem primores, que tais não encontro eu cá; em cismar — sozinho — à noite — mais prazer encontro eu lá; minha terra tem palmeiras, onde canta o Sabiá. Não permita Deus que eu morra, sem que eu volte para lá; sem que eu desfrute os primores que não encontro por cá; sem qu’inda aviste as palmeiras, onde canta o Sabiá." },
  { id: "mar", grupo: "Poemas", titulo: "Mar Português", autor: "Fernando Pessoa",
    fonte: "https://pt.wikisource.org/wiki/Mar_Portuguez",
    texto: "Ó mar salgado, quanto do teu sal são lágrimas de Portugal! Por te cruzarmos, quantas mães choraram, quantos filhos em vão rezaram! Quantas noivas ficaram por casar para que fosses nosso, ó mar! Valeu a pena? Tudo vale a pena se a alma não é pequena. Quem quer passar além do Bojador tem que passar além da dor. Deus ao mar o perigo e o abismo deu, mas nele é que espelhou o céu." },
  { id: "estrelas", grupo: "Poemas", titulo: "Ora (direis) ouvir estrelas!", autor: "Olavo Bilac",
    fonte: "https://pt.wikisource.org/wiki/Via_Láctea",
    texto: "Ora (direis) ouvir estrelas! Certo perdeste o senso! E eu vos direi, no entanto, que, para ouvi-las, muita vez desperto e abro as janelas, pálido de espanto... E conversamos toda a noite, enquanto a Via Láctea, como um pálio aberto, cintila. E, ao vir do sol, saudoso e em pranto, inda as procuro pelo céu deserto. Direis agora: Tresloucado amigo! Que conversas com elas? Que sentido tem o que dizem, quando estão contigo? E eu vos direi: Amai para entendê-las! Pois só quem ama pode ter ouvido capaz de ouvir e de entender estrelas." },
  { id: "abrealas", grupo: "Músicas", titulo: "Ó abre alas", autor: "Chiquinha Gonzaga, 1899",
    fonte: "https://pt.wikisource.org/wiki/Abre_alas",
    texto: "Ó abre alas que eu quero passar, ó abre alas que eu quero passar. Eu sou da Lira e não posso negar, eu sou da Lira e não posso negar. Ó abre alas que eu quero passar, ó abre alas que eu quero passar. Rosa de Ouro é que vai ganhar, Rosa de Ouro é que vai ganhar." },
  { id: "ciranda", grupo: "Músicas", titulo: "Ciranda, cirandinha", autor: "cantiga popular",
    fonte: "https://pt.wikisource.org/wiki/Ciranda_cirandinha",
    texto: "Ciranda, cirandinha, vamos todos cirandar, vamos dar a meia volta, volta e meia vamos dar. O anel que tu me deste era vidro e se quebrou; o amor que tu me tinhas era pouco e se acabou. Por isso, dona Rosa, entre dentro desta roda, diga um verso bem bonito, diga adeus e vá se embora." },
  { id: "peixe", grupo: "Músicas", titulo: "Peixe vivo", autor: "cantiga popular",
    fonte: "https://pt.wikisource.org/wiki/Peixe_vivo",
    texto: "Como pode o peixe vivo viver fora da água fria? Como poderei viver sem a tua, sem a tua, sem a tua companhia? Os pastores desta aldeia já me fazem zombaria, por me verem assim chorando sem a tua, sem a tua, sem a tua companhia." },
  { id: "salmo", grupo: "Bíblia", titulo: "Salmo 23", autor: "tradução de João Ferreira de Almeida (edição de 1819)",
    fonte: "https://archive.org/details/biblia_almeida_1819",
    texto: "Jehovah é meu Pastor, nada me faltará. Em pastos ervosos me faz deitar: mansamente me leva a águas mui quietas. Refrigera minha alma: guia-me por veredas de justiça, por seu nome. Ainda que também andasse pelo vale da sombra de morte, não temeria algum mal: porque estás comigo: tua vara e teu cajado me consolam." },
];
export const GRUPOS = ["Poemas", "Músicas", "Bíblia"];
