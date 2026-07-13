// Pega as coisas que vamos usar no HTML
const canvas = document.getElementById("jogo");
const ctx = canvas.getContext("2d");
const placarNivel = document.getElementById("nivel");
const placarPassaros = document.getElementById("passarosRestantes");
const placarPontos = document.getElementById("pontos");
const placarRecorde = document.getElementById("recorde");
const telaAviso = document.getElementById("telaAviso");
const tituloAviso = document.getElementById("tituloAviso");
const textoAviso = document.getElementById("textoAviso");
const botaoAviso = document.getElementById("botaoAviso");

// --- O TAMANHO DO MUNDO ---
// O cenário é sempre desse tamanho, não importa a tela: o CSS depois estica
// ou encolhe o canvas inteiro. Assim as contas da física nunca mudam.
const LARGURA = canvas.width; // 960
const ALTURA = canvas.height; // 540
const CHAO = 470; // a altura do chão (o gramado começa aqui)

// --- AS REGRAS DA FÍSICA ---
// A gravidade é uma velocidade que vai sendo somada para baixo o tempo todo.
// 900 quer dizer: "a cada segundo, tudo cai 900 pixels por segundo mais rápido".
const GRAVIDADE = 900;

// O jogo pensa em passinhos de tempo sempre do mesmo tamanho (1/60 de segundo).
// Se o computador for lento ou rápido, a física continua igualzinha.
const PASSO = 1 / 60;

// Quantas vezes por passo o jogo conserta as coisas que se atravessaram.
// Quanto mais vezes, mais firmes ficam as pilhas de caixas.
const ITERACOES = 8;

// O quique das coisas: 0 = cai e para (igual um tijolo), 1 = quica igual bolinha.
const QUIQUE = 0.05;
const QUIQUE_DO_PASSARO = 0.2; // o passarinho quica um pouquinho, mas não muito:
// se ele quicasse demais, sairia ricocheteando na parede em vez de arrebentar ela
const ATRITO = 0.55; // o quanto as coisas se seguram uma na outra ao deslizar

// --- O ESTILINGUE ---
const ESTILINGUE_X = 130;
const ESTILINGUE_Y = CHAO - 110; // onde o passarinho fica encaixado
const PUXAO_MAXIMO = 90; // não dá para puxar mais longe do que isso
const FORCA = 10; // o quanto cada pixel puxado vira velocidade

// --- OS MATERIAIS DAS CAIXAS ---
// Cada material tem: vida (quanto aguenta de pancada), densidade (o quanto é
// pesado) e as cores para desenhar.
const MATERIAIS = {
  gelo: { vida: 20, densidade: 0.5, cor: "#9fe3f5", corEscura: "#5fb8d4" },
  madeira: { vida: 40, densidade: 1.0, cor: "#c98f43", corEscura: "#8a5c22" },
  pedra: { vida: 85, densidade: 2.4, cor: "#a9a9a9", corEscura: "#6e6e6e" },
  // O porquinho aguenta uma caixa caindo em cima (mas não duas!). Se ele fosse
  // muito mole, o castelo inteiro desabava num tiro só e o jogo perdia a graça.
  porco: { vida: 30, densidade: 0.8, cor: "#7ac943", corEscura: "#4e8f22" },
};

// Uma pancada só machuca se for forte. Uma caixa encostando devagar na outra
// não faz nada — senão a torre se destruiria sozinha só de existir.
const PANCADA_MINIMA = 110;

// O passarinho tem BICO: a pancada dele machuca bem mais do que a de uma caixa
// batendo em outra. Sem isso, ele quica na parede de pedra sem nunca quebrá-la,
// e os porquinhos escondidos atrás ficam impossíveis de acertar.
const FORCA_DO_BICO = 1.6;

// --- OS NÍVEIS ---
// Cada caixa é criada com: bloco(material, x, baixo, largura, altura), onde
// "x" é o meio da caixa e "baixo" é onde fica o pé dela.
function bloco(tipo, x, baixo, largura, altura) {
  return { tipo: tipo, x: x, y: baixo - altura / 2, largura: largura, altura: altura };
}

// O porquinho é sempre do mesmo tamanho, então tem um atalho só para ele.
function porco(x, baixo) {
  return bloco("porco", x, baixo, 34, 34);
}

// Peças que se repetem muito, para os níveis ficarem fáceis de ler:
// uma coluna em pé e uma viga deitada.
function coluna(tipo, x, baixo) {
  return bloco(tipo, x, baixo, 22, 90);
}

function viga(tipo, x, baixo, largura = 140) {
  return bloco(tipo, x, baixo, largura, 22);
}

const NIVEIS = [
  // Nível 1: uma casinha simples com um porquinho dentro
  {
    passaros: 3,
    pecas: () => [
      coluna("madeira", 620, CHAO),
      coluna("madeira", 720, CHAO),
      viga("madeira", 670, CHAO - 90, 130),
      porco(670, CHAO),
    ],
  },

  // Nível 2: dois andares e dois porquinhos
  {
    passaros: 3,
    pecas: () => [
      coluna("madeira", 600, CHAO),
      coluna("madeira", 740, CHAO),
      viga("madeira", 670, CHAO - 90, 170),
      porco(670, CHAO),

      coluna("gelo", 630, CHAO - 112),
      coluna("gelo", 710, CHAO - 112),
      viga("gelo", 670, CHAO - 202, 110),
      porco(670, CHAO - 112),
    ],
  },

  // Nível 3: uma fortaleza de pedra
  {
    passaros: 5,
    pecas: () => [
      coluna("pedra", 590, CHAO),
      coluna("pedra", 690, CHAO),
      coluna("pedra", 790, CHAO),

      // As colunas estão de 100 em 100, então cada viga tem que ser MENOR do
      // que 100: se duas vigas vizinhas nascerem uma por cima da outra, elas
      // se empurram sozinhas e a torre já começa tremendo.
      viga("pedra", 640, CHAO - 90, 96),
      viga("pedra", 740, CHAO - 90, 96),

      porco(640, CHAO),
      porco(740, CHAO),

      bloco("madeira", 690, CHAO - 112, 40, 40),
      porco(690, CHAO - 152),
    ],
  },

  // Nível 4: duas torres altas
  {
    passaros: 5,
    pecas: () => [
      // Torre da esquerda
      coluna("madeira", 580, CHAO),
      coluna("madeira", 660, CHAO),
      viga("pedra", 620, CHAO - 90, 110),
      porco(620, CHAO),
      coluna("gelo", 600, CHAO - 112),
      coluna("gelo", 640, CHAO - 112),
      viga("madeira", 620, CHAO - 202, 100),
      porco(620, CHAO - 224),

      // Torre da direita
      coluna("madeira", 780, CHAO),
      coluna("madeira", 860, CHAO),
      viga("pedra", 820, CHAO - 90, 110),
      porco(820, CHAO),
      bloco("gelo", 820, CHAO - 112, 40, 40),
      porco(820, CHAO - 152),
    ],
  },

  // Nível 5: o castelão
  {
    passaros: 6,
    pecas: () => [
      // A muralha da frente: duas pedras, uma em cima da outra. Aqui não tem
      // viga no meio, então a de cima começa exatamente onde a de baixo
      // termina (uma coluna tem 90 de altura).
      coluna("pedra", 540, CHAO),
      coluna("pedra", 540, CHAO - 90),

      // Salão de baixo (colunas de 120 em 120, então as vigas têm 116)
      coluna("madeira", 640, CHAO),
      coluna("madeira", 760, CHAO),
      coluna("madeira", 880, CHAO),
      viga("madeira", 700, CHAO - 90, 116),
      viga("madeira", 820, CHAO - 90, 116),
      porco(700, CHAO),
      porco(820, CHAO),

      // Salão de cima (colunas de 100 em 100, então as vigas têm 96)
      coluna("gelo", 660, CHAO - 112),
      coluna("gelo", 760, CHAO - 112),
      coluna("gelo", 860, CHAO - 112),
      viga("pedra", 710, CHAO - 202, 96),
      viga("pedra", 810, CHAO - 202, 96),
      porco(710, CHAO - 112),
      porco(810, CHAO - 112),

      // O rei lá em cima de tudo
      porco(760, CHAO - 224),
    ],
  },
];

// --- PONTOS ---
const PONTOS_POR_PORCO = 1000;
const PONTOS_POR_CAIXA = 100;
const PONTOS_POR_PASSARO_QUE_SOBROU = 500;

// --- O ESTADO DO JOGO ---
// "corpos" é a lista de tudo que existe no cenário: caixas e porquinhos.
let corpos = [];
let particulas = [];

let passaro = null; // o passarinho que está no estilingue ou voando
let nivelAtual = 0;
let passarosRestantes = 0;
let pontos = 0;

// Quantos pontos o jogador já tinha quando ESTE nível começou. Serve para
// quando ele reinicia o nível: os pontos que ele fez na tentativa que deu
// errado não valem mais, senão daria para ficar repetindo o nível só para
// somar pontos sem nunca terminar.
let pontosNoComecoDoNivel = 0;

// Em que momento o jogo está agora:
// "mirando"  = o passarinho está no estilingue esperando o tiro
// "voando"   = o passarinho está no ar
// "parando"  = o tiro acabou, esperando a poeira baixar
// "parado"   = tem uma tela de aviso aberta (nível vencido ou perdido)
let estado = "mirando";

let puxando = false; // o dedo/mouse está puxando o estilingue?
let pontaDoPuxao = { x: ESTILINGUE_X, y: ESTILINGUE_Y };
let esperaParaProximo = 0; // um contador de tempo depois que tudo para

// O recorde fica guardado no navegador, então não some quando fecha a página
let recorde = Number(localStorage.getItem("recordeAngryBirds")) || 0;
placarRecorde.textContent = recorde;

// --- SOM ---
// O AudioContext é o "alto-falante" do JavaScript. Com ele dá pra criar
// sons na hora, sem precisar de nenhum arquivo de música.
const audioCtx = new AudioContext();

// Toca uma única nota. "frequencia" define se o som é grave ou agudo.
function tocarNota(frequencia, duracao, tipoOnda = "sine", volume = 0.2) {
  const oscilador = audioCtx.createOscillator();
  const ganho = audioCtx.createGain();

  oscilador.type = tipoOnda;
  oscilador.frequency.value = frequencia;

  // O volume começa em "volume" e cai suavemente até quase zero,
  // isso evita um "clique" feio no final do som.
  ganho.gain.setValueAtTime(volume, audioCtx.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duracao);

  oscilador.connect(ganho);
  ganho.connect(audioCtx.destination);

  oscilador.start();
  oscilador.stop(audioCtx.currentTime + duracao);
}

// O barulho do elástico soltando: uma nota que escorrega de aguda para grave.
function tocarSomDeTiro() {
  const oscilador = audioCtx.createOscillator();
  const ganho = audioCtx.createGain();

  oscilador.type = "triangle";
  oscilador.frequency.setValueAtTime(700, audioCtx.currentTime);
  oscilador.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.25);

  ganho.gain.setValueAtTime(0.2, audioCtx.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

  oscilador.connect(ganho);
  ganho.connect(audioCtx.destination);

  oscilador.start();
  oscilador.stop(audioCtx.currentTime + 0.25);
}

// A pancada de uma caixa. Quanto mais forte a batida, mais alto o "toc".
function tocarSomDePancada(forca) {
  const volume = Math.min(0.25, 0.05 + forca / 3000);
  tocarNota(120 + Math.random() * 60, 0.09, "square", volume);
}

// O porquinho estourando: duas notas rápidas subindo.
function tocarSomDePorco() {
  tocarNota(520, 0.08, "sawtooth", 0.2);
  setTimeout(() => tocarNota(760, 0.12, "sawtooth", 0.18), 70);
}

// A musiquinha de vitória: três notas subindo, como um degrau.
function tocarSomDeVitoria() {
  tocarNota(523, 0.12, "square", 0.18);
  setTimeout(() => tocarNota(659, 0.12, "square", 0.18), 130);
  setTimeout(() => tocarNota(784, 0.25, "square", 0.18), 260);
}

// O som de derrota: duas notas graves descendo.
function tocarSomDeDerrota() {
  tocarNota(280, 0.2, "sawtooth", 0.2);
  setTimeout(() => tocarNota(160, 0.35, "sawtooth", 0.2), 180);
}

// Os navegadores só deixam tocar som depois que o jogador interage com a
// página (clica, aperta uma tecla ou encosta o dedo).
function acordarOSom() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

document.addEventListener("keydown", acordarOSom, { once: true });
document.addEventListener("pointerdown", acordarOSom, { once: true });

// --- CRIAR AS COISAS ---
// Transforma a receita de uma peça (do nível) num corpo de verdade, com
// velocidade, peso e vida.
function criarCorpo(peca) {
  const material = MATERIAIS[peca.tipo];

  // O peso vem do tamanho vezes a densidade: uma viga de pedra é bem mais
  // pesada do que uma vareta de gelo do mesmo tamanho.
  const massa = (peca.largura * peca.altura * material.densidade) / 1000;

  return {
    tipo: peca.tipo,
    x: peca.x,
    y: peca.y,
    largura: peca.largura,
    altura: peca.altura,
    vx: 0, // velocidade para os lados
    vy: 0, // velocidade para cima/baixo
    massa: massa,
    invMassa: 1 / massa, // o "inverso" do peso: usado nas contas de empurrão
    vida: material.vida,
    vidaCheia: material.vida,
  };
}

// O passarinho é uma bolinha, não uma caixa: ele rola e quica.
function criarPassaro() {
  passaro = {
    x: ESTILINGUE_X,
    y: ESTILINGUE_Y,
    vx: 0,
    vy: 0,
    raio: 14,
    massa: 8, // pesadão de propósito: assim ele empurra bem as caixas
    invMassa: 1 / 8,
    angulo: 0, // para que lado ele está apontando (só para desenhar)
    voando: false,
    tempoParado: 0, // há quanto tempo ele está quase sem se mexer
  };
}

// --- EFEITOS VISUAIS: partículas ---
// Cria vários pontinhos que se espalham a partir de um lugar.
function criarParticulas(x, y, cor, quantidade = 14) {
  for (let i = 0; i < quantidade; i++) {
    particulas.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.5) * 260 - 80,
      vida: 1, // vai de 1 até 0
      tamanho: 2 + Math.random() * 3,
      cor: cor,
    });
  }
}

// Move as partículas e apaga as que já "morreram".
function atualizarParticulas(dt) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += GRAVIDADE * 0.6 * dt;
    p.vida -= dt * 1.6;
    if (p.vida <= 0) particulas.splice(i, 1);
  }
}

// --- MACHUCAR UMA COISA ---
// Toda pancada tira vida. Quando a vida acaba, a coisa se quebra e some.
function machucar(corpo, forca) {
  if (forca < PANCADA_MINIMA) return; // pancada fraca demais, não faz nada

  corpo.vida -= (forca - PANCADA_MINIMA) / 12;

  const material = MATERIAIS[corpo.tipo];

  if (corpo.vida > 0) {
    // Ainda aguenta: só faz barulho e solta umas lasquinhas
    tocarSomDePancada(forca);
    criarParticulas(corpo.x, corpo.y, material.corEscura, 4);
    return;
  }

  // Quebrou! Sai da lista de corpos e vira um montinho de pontinhos.
  const posicao = corpos.indexOf(corpo);
  if (posicao !== -1) corpos.splice(posicao, 1);

  if (corpo.tipo === "porco") {
    pontos += PONTOS_POR_PORCO;
    tocarSomDePorco();
    criarParticulas(corpo.x, corpo.y, material.cor, 24);
  } else {
    pontos += PONTOS_POR_CAIXA;
    tocarSomDePancada(forca);
    criarParticulas(corpo.x, corpo.y, material.cor, 16);
  }

  placarPontos.textContent = pontos;
}

// --- A FÍSICA ---
// Aqui está o segredo do jogo. Em cada passinho de tempo:
//   1) tudo cai um pouquinho (a gravidade puxa) e anda;
//   2) o jogo procura coisas que se atravessaram e as desencosta;
//   3) quem bateu forte se machuca.
//
// Obs: as caixas aqui não giram, elas só escorregam e caem retinhas. Fazer
// caixa girar de verdade é MUITO mais difícil, e a torre desabando já fica
// divertida do mesmo jeito.
function passoDaFisica(dt) {
  // 1) A gravidade puxa tudo para baixo, e tudo anda para onde está indo
  for (const corpo of corpos) {
    corpo.vy += GRAVIDADE * dt;
    corpo.x += corpo.vx * dt;
    corpo.y += corpo.vy * dt;
  }

  if (passaro !== null && passaro.voando) {
    passaro.vy += GRAVIDADE * dt;
    passaro.x += passaro.vx * dt;
    passaro.y += passaro.vy * dt;

    // O bico do passarinho aponta para onde ele está indo
    passaro.angulo = Math.atan2(passaro.vy, passaro.vx);
  }

  // 2) e 3) Desencosta o que se atravessou. Fazemos isso várias vezes porque
  // desencostar uma caixa pode acabar enfiando ela em outra.
  for (let i = 0; i < ITERACOES; i++) {
    // Só a primeira volta machuca: as outras são só para arrumar as posições,
    // e a coisa não pode se machucar 8 vezes pela mesma batida.
    const podeMachucar = i === 0;

    for (const corpo of corpos) {
      bateuNoChao(corpo, podeMachucar);
    }

    for (let a = 0; a < corpos.length; a++) {
      for (let b = a + 1; b < corpos.length; b++) {
        bateramUmNoOutro(corpos[a], corpos[b], podeMachucar);
      }
    }

    if (passaro !== null && passaro.voando) {
      passaroBateuNoChao(podeMachucar);

      // Vai de trás para frente porque uma caixa pode ser destruída no meio
      // do caminho, e aí ela sai da lista.
      for (let c = corpos.length - 1; c >= 0; c--) {
        passaroBateuNaCaixa(corpos[c], podeMachucar);
      }
    }
  }

  // Um freio de leve em tudo, para as pilhas pararem quietas em vez de ficarem
  // tremendo para sempre.
  for (const corpo of corpos) {
    corpo.vx *= 0.995;
    corpo.vy *= 0.995;
    if (Math.abs(corpo.vx) < 2) corpo.vx = 0;
  }
}

// --- Uma caixa bateu no chão ---
function bateuNoChao(corpo, podeMachucar) {
  const pe = corpo.y + corpo.altura / 2; // onde está o pé da caixa
  if (pe <= CHAO) return; // ainda está no ar, tudo bem

  corpo.y = CHAO - corpo.altura / 2; // coloca de volta em cima do chão

  if (corpo.vy > 0) {
    if (podeMachucar) machucar(corpo, corpo.vy);
    corpo.vy = -corpo.vy * QUIQUE;
  }

  corpo.vx *= 1 - ATRITO * 0.3; // o chão segura a caixa para ela não escorregar
}

// --- Duas caixas se atravessaram ---
function bateramUmNoOutro(a, b, podeMachucar) {
  // O quanto elas estão enfiadas uma na outra, em cada sentido
  const distanciaX = b.x - a.x;
  const enfiadoX = (a.largura + b.largura) / 2 - Math.abs(distanciaX);
  if (enfiadoX <= 0) return; // nem se tocam

  const distanciaY = b.y - a.y;
  const enfiadoY = (a.altura + b.altura) / 2 - Math.abs(distanciaY);
  if (enfiadoY <= 0) return; // nem se tocam

  // Elas se separam pelo lado em que estão MENOS enfiadas: é o caminho mais
  // curto para sair de dentro uma da outra.
  let nx = 0; // a direção do empurrão, de "a" para "b"
  let ny = 0;
  let quantoEnfiou = 0;

  if (enfiadoX < enfiadoY) {
    nx = distanciaX < 0 ? -1 : 1;
    quantoEnfiou = enfiadoX;
  } else {
    ny = distanciaY < 0 ? -1 : 1;
    quantoEnfiou = enfiadoY;
  }

  // Desencosta as duas. A mais leve se afasta mais — igual quando um adulto
  // esbarra numa criança: quem voa longe é a criança.
  const somaDosInversos = a.invMassa + b.invMassa;
  a.x -= nx * quantoEnfiou * (a.invMassa / somaDosInversos);
  a.y -= ny * quantoEnfiou * (a.invMassa / somaDosInversos);
  b.x += nx * quantoEnfiou * (b.invMassa / somaDosInversos);
  b.y += ny * quantoEnfiou * (b.invMassa / somaDosInversos);

  // Agora a velocidade: o quanto uma está indo "para dentro" da outra
  const velocidadeDeChoque = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (velocidadeDeChoque > 0) return; // já estão se afastando, deixa quietas

  const forcaDaBatida = -velocidadeDeChoque;

  if (podeMachucar) {
    machucar(a, forcaDaBatida);
    machucar(b, forcaDaBatida);
  }

  // O empurrão que faz uma parar/voltar depois de bater na outra
  const empurrao = ((1 + QUIQUE) * forcaDaBatida) / somaDosInversos;
  a.vx -= empurrao * nx * a.invMassa;
  a.vy -= empurrao * ny * a.invMassa;
  b.vx += empurrao * nx * b.invMassa;
  b.vy += empurrao * ny * b.invMassa;

  // O atrito: as caixas se seguram e não escorregam feito sabão.
  // O "lado" é a direção do empurrão girada 90 graus.
  const ladoX = -ny;
  const ladoY = nx;
  const velocidadeDeslizando = (b.vx - a.vx) * ladoX + (b.vy - a.vy) * ladoY;
  const freada = (-velocidadeDeslizando * ATRITO) / somaDosInversos;

  a.vx -= freada * ladoX * a.invMassa;
  a.vy -= freada * ladoY * a.invMassa;
  b.vx += freada * ladoX * b.invMassa;
  b.vy += freada * ladoY * b.invMassa;
}

// --- O passarinho bateu no chão ---
function passaroBateuNoChao(podeMachucar) {
  if (passaro.y + passaro.raio <= CHAO) return;

  passaro.y = CHAO - passaro.raio;

  if (passaro.vy > 0) {
    passaro.vy = -passaro.vy * QUIQUE_DO_PASSARO;
    if (podeMachucar && Math.abs(passaro.vy) > 60) {
      criarParticulas(passaro.x, CHAO, "#c2a06b", 5);
    }
  }

  passaro.vx *= 0.86; // ele vai rolando e perdendo a força
}

// --- O passarinho bateu numa caixa ---
// O passarinho é redondo e a caixa é quadrada, então a conta é diferente:
// achamos o ponto da caixa mais perto do centro do passarinho.
function passaroBateuNaCaixa(caixa, podeMachucar) {
  const maisPertoX = Math.max(
    caixa.x - caixa.largura / 2,
    Math.min(passaro.x, caixa.x + caixa.largura / 2)
  );
  const maisPertoY = Math.max(
    caixa.y - caixa.altura / 2,
    Math.min(passaro.y, caixa.y + caixa.altura / 2)
  );

  let distanciaX = passaro.x - maisPertoX;
  let distanciaY = passaro.y - maisPertoY;
  let distancia = Math.hypot(distanciaX, distanciaY);

  if (distancia > passaro.raio) return; // não se tocaram

  // Se o passarinho entrou tanto que o centro dele está DENTRO da caixa,
  // a distância dá zero e não dá para saber para que lado empurrar.
  // Nesse caso a gente joga ele para cima e pronto.
  if (distancia === 0) {
    distanciaX = 0;
    distanciaY = -1;
    distancia = 0.01;
  }

  const nx = distanciaX / distancia; // a direção do empurrão, da caixa para o passarinho
  const ny = distanciaY / distancia;
  const quantoEnfiou = passaro.raio - distancia;

  const somaDosInversos = passaro.invMassa + caixa.invMassa;
  passaro.x += nx * quantoEnfiou * (passaro.invMassa / somaDosInversos);
  passaro.y += ny * quantoEnfiou * (passaro.invMassa / somaDosInversos);
  caixa.x -= nx * quantoEnfiou * (caixa.invMassa / somaDosInversos);
  caixa.y -= ny * quantoEnfiou * (caixa.invMassa / somaDosInversos);

  const velocidadeDeChoque = (passaro.vx - caixa.vx) * nx + (passaro.vy - caixa.vy) * ny;
  if (velocidadeDeChoque > 0) return; // já estão se afastando

  const forcaDaBatida = -velocidadeDeChoque;

  // O passarinho não se machuca, só a caixa — e a bicada dói mais
  if (podeMachucar) machucar(caixa, forcaDaBatida * FORCA_DO_BICO);

  const empurrao = ((1 + QUIQUE_DO_PASSARO) * forcaDaBatida) / somaDosInversos;
  passaro.vx += empurrao * nx * passaro.invMassa;
  passaro.vy += empurrao * ny * passaro.invMassa;
  caixa.vx -= empurrao * nx * caixa.invMassa;
  caixa.vy -= empurrao * ny * caixa.invMassa;
}

// --- OS CONTROLES: puxar o estilingue ---
// O canvas na tela pode estar maior ou menor do que os 960x540 de verdade.
// Esta função transforma "onde o dedo está na tela" em "onde é isso no jogo".
function posicaoNoJogo(evento) {
  const area = canvas.getBoundingClientRect();

  // O CSS usa "object-fit: contain": o desenho cabe inteiro e sobra uma borda
  // vazia em cima/embaixo ou nos lados. Precisamos descontar essa borda.
  const escala = Math.min(area.width / LARGURA, area.height / ALTURA);
  const larguraDesenhada = LARGURA * escala;
  const alturaDesenhada = ALTURA * escala;
  const sobraEsquerda = (area.width - larguraDesenhada) / 2;
  const sobraDeCima = (area.height - alturaDesenhada) / 2;

  return {
    x: (evento.clientX - area.left - sobraEsquerda) / escala,
    y: (evento.clientY - area.top - sobraDeCima) / escala,
  };
}

canvas.addEventListener("pointerdown", (evento) => {
  if (estado !== "mirando" || passaro === null) return;

  const ponto = posicaoNoJogo(evento);

  // Só começa a puxar se o dedo encostou PERTO do passarinho. Uma folga
  // generosa (60 pixels) porque no celular o dedo é gordinho.
  const distancia = Math.hypot(ponto.x - passaro.x, ponto.y - passaro.y);
  if (distancia > 60) return;

  puxando = true;
  canvas.setPointerCapture(evento.pointerId); // o dedo continua sendo "do jogo" mesmo se sair do canvas
  atualizarPuxao(ponto);
});

canvas.addEventListener("pointermove", (evento) => {
  if (!puxando) return;
  atualizarPuxao(posicaoNoJogo(evento));
});

canvas.addEventListener("pointerup", () => {
  if (!puxando) return;
  puxando = false;
  atirar();
});

canvas.addEventListener("pointercancel", () => {
  // O navegador cancelou o toque (uma ligação chegou, sei lá): devolve o
  // passarinho para o estilingue sem atirar.
  puxando = false;
  if (passaro !== null && !passaro.voando) {
    passaro.x = ESTILINGUE_X;
    passaro.y = ESTILINGUE_Y;
  }
});

// Coloca o passarinho onde o dedo está, mas sem deixar puxar longe demais.
function atualizarPuxao(ponto) {
  let puxadoX = ponto.x - ESTILINGUE_X;
  let puxadoY = ponto.y - ESTILINGUE_Y;

  const distancia = Math.hypot(puxadoX, puxadoY);

  if (distancia > PUXAO_MAXIMO) {
    // Encurta o puxão até o máximo, mantendo a mesma direção
    puxadoX = (puxadoX / distancia) * PUXAO_MAXIMO;
    puxadoY = (puxadoY / distancia) * PUXAO_MAXIMO;
  }

  passaro.x = ESTILINGUE_X + puxadoX;
  passaro.y = ESTILINGUE_Y + puxadoY;
  pontaDoPuxao = { x: passaro.x, y: passaro.y };
}

// --- ATIRAR! ---
function atirar() {
  // A velocidade é o CONTRÁRIO do puxão: puxou para trás, o bicho vai para
  // a frente. E quanto mais longe puxou, mais rápido ele sai.
  const puxadoX = ESTILINGUE_X - passaro.x;
  const puxadoY = ESTILINGUE_Y - passaro.y;

  // Um puxãozinho de nada não vale como tiro: o passarinho só volta pro lugar.
  if (Math.hypot(puxadoX, puxadoY) < 12) {
    passaro.x = ESTILINGUE_X;
    passaro.y = ESTILINGUE_Y;
    return;
  }

  passaro.vx = puxadoX * FORCA;
  passaro.vy = puxadoY * FORCA;
  passaro.voando = true;
  passaro.tempoParado = 0;

  estado = "voando";
  tocarSomDeTiro();
}

// --- Depois do tiro: quando é que a jogada acabou? ---
// A jogada termina quando o passarinho some do cenário OU quando ele fica
// paradinho por um tempinho. Aí conferimos se ganhou, perdeu ou vai o próximo.
function verificarFimDaJogada(dt) {
  if (estado !== "voando") return;

  const saiuDoCenario =
    passaro.x < -50 || passaro.x > LARGURA + 200 || passaro.y > ALTURA + 200;

  const velocidade = Math.hypot(passaro.vx, passaro.vy);
  if (velocidade < 25) {
    passaro.tempoParado += dt;
  } else {
    passaro.tempoParado = 0;
  }

  if (saiuDoCenario || passaro.tempoParado > 1.2) {
    estado = "parando";
    esperaParaProximo = 0.8; // um tempinho para a poeira baixar
  }
}

// Conta quantos porquinhos ainda estão de pé
function contarPorcos() {
  return corpos.filter((corpo) => corpo.tipo === "porco").length;
}

// Chamado quando o jogo já esperou a poeira baixar
function decidirOQueFazer() {
  // O passarinho que acabou de voar já era: some da conta.
  passarosRestantes -= 1;
  placarPassaros.textContent = passarosRestantes;

  if (contarPorcos() === 0) {
    vencerNivel();
    return;
  }

  if (passarosRestantes <= 0) {
    perderNivel();
    return;
  }

  // Ainda tem passarinho: prepara o próximo no estilingue
  criarPassaro();
  estado = "mirando";
}

function vencerNivel() {
  estado = "parado";
  tocarSomDeVitoria();

  // Cada passarinho que sobrou (contando o que está no estilingue) vale pontos
  const bonus = passarosRestantes * PONTOS_POR_PASSARO_QUE_SOBROU;
  pontos += bonus;
  placarPontos.textContent = pontos;

  salvarRecorde();

  const ehOUltimoNivel = nivelAtual === NIVEIS.length - 1;

  if (ehOUltimoNivel) {
    tituloAviso.textContent = "Você zerou o jogo! 🏆";
    textoAviso.textContent = `Todos os castelos caíram! ${pontos} pontos. Recorde: ${recorde}`;
    botaoAviso.textContent = "Jogar de novo";
  } else {
    tituloAviso.textContent = "Nível concluído! 🎉";
    textoAviso.textContent = `Bônus de ${bonus} pontos pelos passarinhos que sobraram. Total: ${pontos}`;
    botaoAviso.textContent = "Próximo nível";
  }

  telaAviso.classList.remove("escondido");
}

function perderNivel() {
  estado = "parado";
  tocarSomDeDerrota();
  salvarRecorde();

  tituloAviso.textContent = "Acabaram os passarinhos! 🐷";
  textoAviso.textContent = `Ainda sobraram ${contarPorcos()} porquinhos rindo de você. Tente de novo!`;
  botaoAviso.textContent = "Tentar de novo";

  telaAviso.classList.remove("escondido");
}

function salvarRecorde() {
  if (pontos > recorde) {
    recorde = pontos;
    localStorage.setItem("recordeAngryBirds", recorde);
    placarRecorde.textContent = recorde;
  }
}

// O botão da tela de aviso faz coisas diferentes conforme o que aconteceu
botaoAviso.addEventListener("click", () => {
  telaAviso.classList.add("escondido");

  if (contarPorcos() === 0) {
    // Venceu: vai para o próximo nível (ou recomeça, se zerou o jogo)
    const ehOUltimoNivel = nivelAtual === NIVEIS.length - 1;
    if (ehOUltimoNivel) {
      comecarJogo();
    } else {
      pontosNoComecoDoNivel = pontos; // os pontos deste nível estão garantidos
      nivelAtual += 1;
      montarNivel();
    }
  } else {
    // Perdeu: joga o mesmo nível de novo
    montarNivel();
  }
});

// --- DESENHAR ---
function desenharCenario() {
  // O céu: um degradê que vai do azul claro lá em cima até quase branco no
  // horizonte, igual num dia bonito.
  const ceu = ctx.createLinearGradient(0, 0, 0, CHAO);
  ceu.addColorStop(0, "#5fb8e8");
  ceu.addColorStop(1, "#cfeeff");
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // Umas nuvens fofas (cada uma são três bolas grudadas)
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  desenharNuvem(150, 90, 1);
  desenharNuvem(480, 60, 0.8);
  desenharNuvem(780, 110, 1.1);

  // Os morrinhos verdes lá no fundo
  ctx.fillStyle = "#8fce6b";
  desenharMorro(240, 90);
  desenharMorro(620, 120);
  desenharMorro(880, 70);

  // O gramado
  ctx.fillStyle = "#6ab24a";
  ctx.fillRect(0, CHAO, LARGURA, ALTURA - CHAO);

  // A terra debaixo do gramado
  ctx.fillStyle = "#8a6242";
  ctx.fillRect(0, CHAO + 16, LARGURA, ALTURA - CHAO - 16);

  // Um risquinho mais escuro separando o gramado da terra
  ctx.fillStyle = "#4e8f3a";
  ctx.fillRect(0, CHAO + 13, LARGURA, 3);
}

function desenharNuvem(x, y, tamanho) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * tamanho, 0, Math.PI * 2);
  ctx.arc(x + 26 * tamanho, y - 8 * tamanho, 28 * tamanho, 0, Math.PI * 2);
  ctx.arc(x + 56 * tamanho, y, 20 * tamanho, 0, Math.PI * 2);
  ctx.fill();
}

function desenharMorro(x, altura) {
  ctx.beginPath();
  ctx.moveTo(x - altura * 1.8, CHAO);
  ctx.quadraticCurveTo(x, CHAO - altura * 2, x + altura * 1.8, CHAO);
  ctx.fill();
}

// As duas pontas da forquilha do estilingue. Elas ficam na MESMA altura do
// passarinho, uma de cada lado dele: assim o bichinho fica encaixado bem no
// meio do elástico, igual no estilingue de verdade.
const PONTA_ESQUERDA = { x: ESTILINGUE_X - 20, y: ESTILINGUE_Y - 4 };
const PONTA_DIREITA = { x: ESTILINGUE_X + 20, y: ESTILINGUE_Y - 4 };

// O estilingue é um "Y" de madeira.
function desenharTroncoDoEstilingue() {
  ctx.strokeStyle = "#7a4b23";
  ctx.lineCap = "round";

  // O cabo, que vai do chão até a forquilha
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(ESTILINGUE_X, CHAO);
  ctx.lineTo(ESTILINGUE_X, ESTILINGUE_Y + 26);
  ctx.stroke();

  // Os dois braços do Y
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(ESTILINGUE_X, ESTILINGUE_Y + 28);
  ctx.lineTo(PONTA_ESQUERDA.x, PONTA_ESQUERDA.y);
  ctx.moveTo(ESTILINGUE_X, ESTILINGUE_Y + 28);
  ctx.lineTo(PONTA_DIREITA.x, PONTA_DIREITA.y);
  ctx.stroke();
}

// O elástico: dois riscos grossos saindo das pontas do Y até o passarinho.
//
// A tira de trás é sempre desenhada ANTES do passarinho (fica atrás dele).
// A da frente só passa POR CIMA quando o jogador está puxando — aí o elástico
// está esticado e dá aquela sensação de que o bicho está preso nele. Com o
// passarinho paradinho no lugar, essa tira também fica atrás, senão ela
// atravessaria bem em cima da carinha dele.
function desenharElastico(atras) {
  if (passaro === null || passaro.voando) return;

  const ponta = atras ? PONTA_ESQUERDA : PONTA_DIREITA;

  ctx.strokeStyle = "#3b2010";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ponta.x, ponta.y);
  ctx.lineTo(passaro.x, passaro.y);
  ctx.stroke();
}

// A "linha do tiro": bolinhas mostrando por onde o passarinho vai passar.
// Isso é feito imaginando o voo dele, passinho por passinho, com as MESMAS
// contas da física de verdade — só que sem desenhar nada nem bater em nada.
function desenharMira() {
  if (!puxando || passaro === null) return;

  let x = passaro.x;
  let y = passaro.y;
  let vx = (ESTILINGUE_X - passaro.x) * FORCA;
  let vy = (ESTILINGUE_Y - passaro.y) * FORCA;

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";

  for (let i = 0; i < 90; i++) {
    vy += GRAVIDADE * PASSO;
    x += vx * PASSO;
    y += vy * PASSO;

    if (y > CHAO) break; // a linha para quando bateria no chão

    // Só desenha uma bolinha a cada 6 passinhos, senão vira um risco só
    if (i % 6 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- Desenha uma caixa (madeira, gelo ou pedra) ---
function desenharCaixa(caixa) {
  const material = MATERIAIS[caixa.tipo];
  const esquerda = caixa.x - caixa.largura / 2;
  const cima = caixa.y - caixa.altura / 2;

  ctx.fillStyle = material.cor;
  ctx.fillRect(esquerda, cima, caixa.largura, caixa.altura);

  // A borda escura dá aquele contorno de desenho animado
  ctx.strokeStyle = material.corEscura;
  ctx.lineWidth = 3;
  ctx.strokeRect(esquerda + 1.5, cima + 1.5, caixa.largura - 3, caixa.altura - 3);

  // Quando a caixa está machucada, aparecem rachaduras: quanto menos vida,
  // mais rachadura.
  const machucado = 1 - caixa.vida / caixa.vidaCheia;
  if (machucado > 0.25) {
    ctx.strokeStyle = material.corEscura;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(esquerda + caixa.largura * 0.3, cima);
    ctx.lineTo(esquerda + caixa.largura * 0.5, cima + caixa.altura * 0.55);
    ctx.lineTo(esquerda + caixa.largura * 0.35, cima + caixa.altura);
    ctx.stroke();
  }
  if (machucado > 0.6) {
    ctx.beginPath();
    ctx.moveTo(esquerda + caixa.largura, cima + caixa.altura * 0.25);
    ctx.lineTo(esquerda + caixa.largura * 0.6, cima + caixa.altura * 0.5);
    ctx.lineTo(esquerda + caixa.largura * 0.75, cima + caixa.altura);
    ctx.stroke();
  }
}

// --- Desenha um porquinho ---
function desenharPorco(p) {
  const raio = p.largura / 2;

  // A cabeça redonda
  ctx.fillStyle = MATERIAIS.porco.cor;
  ctx.beginPath();
  ctx.arc(p.x, p.y, raio, 0, Math.PI * 2);
  ctx.fill();

  // As orelhinhas
  ctx.beginPath();
  ctx.arc(p.x - raio * 0.65, p.y - raio * 0.75, raio * 0.28, 0, Math.PI * 2);
  ctx.arc(p.x + raio * 0.65, p.y - raio * 0.75, raio * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // O focinho
  ctx.fillStyle = MATERIAIS.porco.corEscura;
  ctx.beginPath();
  ctx.arc(p.x, p.y + raio * 0.25, raio * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // As duas ventinhas do focinho
  ctx.fillStyle = "#2f5c12";
  ctx.beginPath();
  ctx.arc(p.x - raio * 0.15, p.y + raio * 0.25, raio * 0.09, 0, Math.PI * 2);
  ctx.arc(p.x + raio * 0.15, p.y + raio * 0.25, raio * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // Os olhos brancos com a pupila preta
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(p.x - raio * 0.32, p.y - raio * 0.28, raio * 0.24, 0, Math.PI * 2);
  ctx.arc(p.x + raio * 0.32, p.y - raio * 0.28, raio * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(p.x - raio * 0.28, p.y - raio * 0.28, raio * 0.11, 0, Math.PI * 2);
  ctx.arc(p.x + raio * 0.36, p.y - raio * 0.28, raio * 0.11, 0, Math.PI * 2);
  ctx.fill();

  // Se o porquinho já levou pancada, ele fica com uma carinha machucada
  if (p.vida < p.vidaCheia * 0.5) {
    ctx.strokeStyle = "#2f5c12";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - raio * 0.55, p.y - raio * 0.62);
    ctx.lineTo(p.x - raio * 0.1, p.y - raio * 0.48);
    ctx.moveTo(p.x + raio * 0.55, p.y - raio * 0.62);
    ctx.lineTo(p.x + raio * 0.1, p.y - raio * 0.48);
    ctx.stroke();
  }
}

// --- Desenha o passarinho ---
function desenharPassaro() {
  if (passaro === null) return;

  ctx.save();
  ctx.translate(passaro.x, passaro.y);

  // Voando, ele aponta o bico para onde está indo. Parado no estilingue, ele
  // fica olhando para a frente mesmo.
  if (passaro.voando) ctx.rotate(passaro.angulo);

  const raio = passaro.raio;

  // O rabo de penas, atrás
  ctx.fillStyle = "#8f1c1c";
  ctx.beginPath();
  ctx.moveTo(-raio * 0.7, -raio * 0.5);
  ctx.lineTo(-raio * 1.7, -raio * 0.9);
  ctx.lineTo(-raio * 1.5, raio * 0.2);
  ctx.closePath();
  ctx.fill();

  // O corpo vermelho
  ctx.fillStyle = "#e0322f";
  ctx.beginPath();
  ctx.arc(0, 0, raio, 0, Math.PI * 2);
  ctx.fill();

  // A barriguinha mais clara
  ctx.fillStyle = "#f6c99a";
  ctx.beginPath();
  ctx.arc(raio * 0.15, raio * 0.45, raio * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // O bico amarelo
  ctx.fillStyle = "#f5a623";
  ctx.beginPath();
  ctx.moveTo(raio * 0.75, -raio * 0.15);
  ctx.lineTo(raio * 1.6, raio * 0.05);
  ctx.lineTo(raio * 0.75, raio * 0.3);
  ctx.closePath();
  ctx.fill();

  // Os olhos
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(raio * 0.25, -raio * 0.35, raio * 0.32, 0, Math.PI * 2);
  ctx.arc(raio * 0.7, -raio * 0.3, raio * 0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(raio * 0.35, -raio * 0.35, raio * 0.13, 0, Math.PI * 2);
  ctx.arc(raio * 0.72, -raio * 0.3, raio * 0.11, 0, Math.PI * 2);
  ctx.fill();

  // A sobrancelha brava (é ela que deixa o passarinho com cara de bravo!)
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-raio * 0.1, -raio * 0.85);
  ctx.lineTo(raio * 0.85, -raio * 0.5);
  ctx.stroke();

  ctx.restore();
}

function desenharParticulas() {
  for (const p of particulas) {
    ctx.globalAlpha = Math.max(0, p.vida);
    ctx.fillStyle = p.cor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.tamanho, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; // volta ao normal (senão o resto fica transparente)
}

// Os passarinhos da fila, esperando a vez deles, ao lado do estilingue
function desenharFilaDePassaros() {
  // Um deles já está no estilingue, então a fila mostra os OUTROS
  const naFila = passarosRestantes - 1;

  for (let i = 0; i < naFila; i++) {
    const x = 60 - i * 26;
    const y = CHAO - 12;

    ctx.fillStyle = "#e0322f";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5a623";
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 1);
    ctx.lineTo(x + 14, y + 1);
    ctx.lineTo(x + 6, y + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(x + 3, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(x + 4, y - 3, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Desenha TUDO, na ordem certa (de trás para frente) ---
function desenhar() {
  desenharCenario();

  desenharElastico(true); // a tira de trás do elástico
  desenharTroncoDoEstilingue();

  for (const corpo of corpos) {
    if (corpo.tipo === "porco") {
      desenharPorco(corpo);
    } else {
      desenharCaixa(corpo);
    }
  }

  desenharMira();

  if (!puxando) desenharElastico(false);
  desenharPassaro();
  if (puxando) desenharElastico(false);

  desenharFilaDePassaros();
  desenharParticulas();
}

// --- O LOOP PRINCIPAL ---
// O requestAnimationFrame pede ao navegador: "me chame de novo na próxima vez
// que você for desenhar a tela" (umas 60 vezes por segundo).
let ultimoInstante = 0;

function loopDoJogo(agora) {
  // Quanto tempo passou desde o último quadro, em segundos.
  // O Math.min impede um "salto" gigante se a aba ficar escondida um tempão.
  const tempoQuePassou = Math.min((agora - ultimoInstante) / 1000, 0.05);
  ultimoInstante = agora;

  if (estado !== "parado") {
    passoDaFisica(PASSO);
    verificarFimDaJogada(tempoQuePassou);

    if (estado === "parando") {
      esperaParaProximo -= tempoQuePassou;
      if (esperaParaProximo <= 0) {
        decidirOQueFazer();
      }
    }
  }

  atualizarParticulas(tempoQuePassou);
  desenhar();

  requestAnimationFrame(loopDoJogo);
}

// --- COMEÇAR / REINICIAR ---
function montarNivel() {
  const nivel = NIVEIS[nivelAtual];

  corpos = nivel.pecas().map(criarCorpo);
  particulas = [];

  pontos = pontosNoComecoDoNivel; // o nível recomeça do zero, os pontos dele também
  passarosRestantes = nivel.passaros;
  puxando = false;
  esperaParaProximo = 0;
  estado = "mirando";

  criarPassaro();

  placarNivel.textContent = nivelAtual + 1;
  placarPassaros.textContent = passarosRestantes;
  placarPontos.textContent = pontos;
  telaAviso.classList.add("escondido");
}

function comecarJogo() {
  nivelAtual = 0;
  pontos = 0;
  pontosNoComecoDoNivel = 0;
  montarNivel();
}

// A tecla espaço reinicia o nível a qualquer momento
document.addEventListener("keydown", (evento) => {
  if (evento.key === " ") {
    evento.preventDefault();
    montarNivel();
  }
});

// Começa o jogo!
comecarJogo();
requestAnimationFrame(loopDoJogo);
