// Pega as coisas que vamos usar no HTML
const casas = document.querySelectorAll(".casa");
const mensagem = document.getElementById("mensagem");
const telaEscolha = document.getElementById("telaEscolha");
const botaoReiniciar = document.getElementById("botaoReiniciar");
const placarVitorias = document.getElementById("vitorias");
const placarEmpates = document.getElementById("empates");
const placarDerrotas = document.getElementById("derrotas");

// Quem é quem no tabuleiro
const JOGADOR = "❌";
const ROBO = "⭕";

// O tabuleiro é uma lista de 9 casinhas, contadas assim:
//   0 | 1 | 2
//   3 | 4 | 5
//   6 | 7 | 8
// Cada posição guarda "❌", "⭕" ou "" (vazia).
let tabuleiro = ["", "", "", "", "", "", "", "", ""];

// Todas as maneiras de fazer 3 em linha (3 linhas, 3 colunas e 2 diagonais)
const linhasQueVencem = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// Estado do jogo
let nivel = 1; // 1 = fácil, 2 = médio, 3 = difícil
let jogoAtivo = false; // só vira true depois de escolher o nível
let vezDoRobo = false; // enquanto o robô "pensa", o jogador não pode clicar

// Cada partida ganha um número novo. Serve para o robô saber se a partida
// ainda é a mesma quando ele termina de "pensar": se você apertou Espaço no
// meio, a jogada dele é de uma partida velha e deve ser jogada fora.
let idDaPartida = 0;

// O placar fica guardado no navegador, então não some quando fecha a página
let vitorias = Number(localStorage.getItem("vitoriasVelha")) || 0;
let empates = Number(localStorage.getItem("empatesVelha")) || 0;
let derrotas = Number(localStorage.getItem("derrotasVelha")) || 0;
mostrarPlacar();

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

function somDeJogada() {
  tocarNota(440, 0.1, "triangle");
}

function somDoRobo() {
  tocarNota(300, 0.1, "square", 0.12);
}

function somDeVitoria() {
  // Três notas subindo, como uma musiquinha de "ganhou!"
  tocarNota(523, 0.15);
  setTimeout(() => tocarNota(659, 0.15), 130);
  setTimeout(() => tocarNota(784, 0.3), 260);
}

function somDeDerrota() {
  tocarNota(200, 0.4, "sawtooth", 0.15);
}

function somDeEmpate() {
  tocarNota(350, 0.25, "triangle", 0.15);
}

// --- REGRAS DO JOGO ---

// Devolve a lista das casinhas que ainda estão vazias.
function casasLivres(tab) {
  const livres = [];

  for (let i = 0; i < 9; i++) {
    if (tab[i] === "") {
      livres.push(i);
    }
  }

  return livres;
}

// Se alguém já fez 3 em linha, devolve as 3 casinhas dessa linha.
// Se ninguém venceu ainda, devolve null (ou seja, "nada").
function linhaVencedora(tab, quem) {
  for (const linha of linhasQueVencem) {
    const [a, b, c] = linha;

    if (tab[a] === quem && tab[b] === quem && tab[c] === quem) {
      return linha;
    }
  }

  return null;
}

// --- O ROBÔ ---

// Sorteia uma casinha vazia qualquer.
function jogadaAleatoria(tab) {
  const livres = casasLivres(tab);
  const sorteada = Math.floor(Math.random() * livres.length);

  return livres[sorteada];
}

// Sorteia se o robô vai prestar atenção nessa jogada.
// Ex.: chance(0.5) dá "true" mais ou menos na metade das vezes.
function chance(quantoPorCento) {
  return Math.random() < quantoPorCento;
}

// Sorteia uma casinha "boba": uma que NÃO atrapalha o jogador.
// É assim que o robô distraído joga — ele te vê fazendo 2 em linha e,
// em vez de bloquear, vai brincar em outro canto do tabuleiro.
function jogadaDistraida(tab) {
  const bloqueio = jogadaQueFechaLinha(tab, JOGADOR);

  // As casinhas bobas são todas, menos a que bloquearia você
  const bobas = casasLivres(tab).filter((casa) => casa !== bloqueio);

  // Se a única casinha que sobrou for justo o bloqueio, paciência: joga nela
  if (bobas.length === 0) {
    return jogadaAleatoria(tab);
  }

  return bobas[Math.floor(Math.random() * bobas.length)];
}

// Procura uma casinha onde "quem" fecha 3 em linha AGORA.
// Serve tanto para o robô vencer quanto para ele bloquear o jogador:
// é a mesma conta, só muda de quem estamos falando.
function jogadaQueFechaLinha(tab, quem) {
  for (const casa of casasLivres(tab)) {
    // Faz a jogada "de mentirinha" só para conferir o resultado...
    tab[casa] = quem;
    const venceu = linhaVencedora(tab, quem) !== null;
    tab[casa] = ""; // ...e desfaz na hora, deixando o tabuleiro como estava

    if (venceu) {
      return casa;
    }
  }

  return null;
}

// O robô esperto: ele imagina TODAS as jogadas possíveis dali até o fim do
// jogo e escolhe a melhor. Chamamos essa técnica de "minimax".
//
// A nota funciona assim: o robô ganhar vale +10, perder vale -10 e empatar
// vale 0. Quando é a vez do robô, ele fica com a MAIOR nota que conseguir.
// Quando é a vez do jogador, o robô supõe que o jogador vai escolher a jogada
// PIOR para ele (a menor nota) — por isso "mini" + "max".
//
// O "quantasJogadas" desconta um pouquinho das notas mais distantes, assim
// o robô prefere vencer rápido e demorar o máximo possível para perder.
function notaDaJogada(tab, ehVezDoRobo, quantasJogadas) {
  if (linhaVencedora(tab, ROBO)) {
    return 10 - quantasJogadas;
  }

  if (linhaVencedora(tab, JOGADOR)) {
    return quantasJogadas - 10;
  }

  const livres = casasLivres(tab);

  if (livres.length === 0) {
    return 0; // deu velha
  }

  const notas = [];

  for (const casa of livres) {
    tab[casa] = ehVezDoRobo ? ROBO : JOGADOR;
    notas.push(notaDaJogada(tab, !ehVezDoRobo, quantasJogadas + 1));
    tab[casa] = ""; // desfaz a jogada imaginada
  }

  return ehVezDoRobo ? Math.max(...notas) : Math.min(...notas);
}

// Escolhe a melhor casinha possível usando as notas do minimax.
function melhorJogada(tab) {
  let melhorCasa = null;
  let melhorNota = -Infinity;

  for (const casa of casasLivres(tab)) {
    tab[casa] = ROBO;
    const nota = notaDaJogada(tab, false, 1);
    tab[casa] = "";

    if (nota > melhorNota) {
      melhorNota = nota;
      melhorCasa = casa;
    }
  }

  return melhorCasa;
}

// O robô "atento": fecha a linha se puder vencer, bloqueia se você estiver
// quase vencendo, e no resto do tempo chuta. Ele presta atenção no que está
// acontecendo agora, mas não arma jogadas com antecedência.
function jogadaAtenta(tab) {
  const paraVencer = jogadaQueFechaLinha(tab, ROBO);
  if (paraVencer !== null) {
    return paraVencer;
  }

  const paraBloquear = jogadaQueFechaLinha(tab, JOGADOR);
  if (paraBloquear !== null) {
    return paraBloquear;
  }

  return jogadaAleatoria(tab);
}

// Aqui o nível escolhido vira o "jeito de pensar" do robô.
// A diferença entre os níveis é o TANTO que ele presta atenção: quanto mais
// fácil, mais vezes ele se distrai e deixa você ganhar.
function escolherJogadaDoRobo() {
  if (nivel === 1) {
    // Fácil: se distrai em 1 de cada 3 jogadas. No resto do tempo ele joga
    // "atento" — então ainda dá pra ganhar dele, mas você tem que armar a
    // jogada em vez de só sair marcando qualquer casinha.
    if (chance(0.35)) {
      return jogadaDistraida(tabuleiro);
    }

    return jogadaAtenta(tabuleiro);
  }

  if (nivel === 2) {
    // Médio: quase sempre atento (ele bloqueia e vence quando dá), e de vez
    // em quando arrisca uma jogada perfeita, pensando alguns passos à frente.
    if (chance(0.35)) {
      return melhorJogada(tabuleiro);
    }

    return jogadaAtenta(tabuleiro);
  }

  // Difícil: joga a jogada perfeita (pensando até o fim do jogo) quase sempre.
  // A brecha é pequena: em 1 de cada 10 jogadas ele escorrega e joga só no
  // "atento". Você precisa estar de olho pra aproveitar.
  if (chance(0.9)) {
    return melhorJogada(tabuleiro);
  }

  return jogadaAtenta(tabuleiro);
}

// --- DESENHAR NA TELA ---

function mostrarPlacar() {
  placarVitorias.textContent = vitorias;
  placarEmpates.textContent = empates;
  placarDerrotas.textContent = derrotas;
}

function salvarPlacar() {
  localStorage.setItem("vitoriasVelha", vitorias);
  localStorage.setItem("empatesVelha", empates);
  localStorage.setItem("derrotasVelha", derrotas);
}

// Copia o que está no tabuleiro (a lista) para os botões (a tela).
function desenharTabuleiro() {
  casas.forEach((casa, i) => {
    casa.textContent = tabuleiro[i];

    // Casinha ocupada não pode ser clicada de novo
    casa.disabled = tabuleiro[i] !== "" || !jogoAtivo || vezDoRobo;
  });
}

function pintarLinhaVencedora(linha) {
  for (const i of linha) {
    casas[i].classList.add("vencedora");
  }
}

// --- O JOGO EM SI ---

// Coloca a marca na casinha e confere se o jogo acabou.
// Devolve true se o jogo continua e false se acabou.
function jogar(casa, quem) {
  tabuleiro[casa] = quem;

  const linha = linhaVencedora(tabuleiro, quem);

  if (linha) {
    jogoAtivo = false;
    vezDoRobo = false;
    desenharTabuleiro();
    pintarLinhaVencedora(linha);

    if (quem === JOGADOR) {
      vitorias++;
      mensagem.textContent = "Você ganhou! 🎉";
      somDeVitoria();
    } else {
      derrotas++;
      mensagem.textContent = "O robô ganhou! 🤖";
      somDeDerrota();
    }

    salvarPlacar();
    mostrarPlacar();
    return false;
  }

  if (casasLivres(tabuleiro).length === 0) {
    jogoAtivo = false;
    vezDoRobo = false;
    desenharTabuleiro();

    empates++;
    mensagem.textContent = "Deu velha! 🤝";
    somDeEmpate();

    salvarPlacar();
    mostrarPlacar();
    return false;
  }

  return true;
}

// A vez do robô. O setTimeout é só para ele "pensar" meio segundo:
// se ele respondesse na hora, pareceria um bug.
function vezDoRoboJogar() {
  vezDoRobo = true;
  mensagem.textContent = "O robô está pensando... 🤔";
  desenharTabuleiro();

  const partidaDoRobo = idDaPartida;

  setTimeout(() => {
    // Se a partida já é outra (você reiniciou enquanto ele pensava),
    // essa jogada não vale mais.
    if (partidaDoRobo !== idDaPartida) {
      return;
    }

    const casa = escolherJogadaDoRobo();
    somDoRobo();

    const continua = jogar(casa, ROBO);

    if (continua) {
      vezDoRobo = false;
      mensagem.textContent = "Sua vez! Você é o " + JOGADOR;
      desenharTabuleiro();
    }
  }, 500);
}

// Quando o jogador clica numa casinha
function cliqueNaCasa(evento) {
  const casa = Number(evento.currentTarget.dataset.casa);

  // Não pode jogar fora da vez, nem por cima de uma casinha ocupada
  if (!jogoAtivo || vezDoRobo || tabuleiro[casa] !== "") {
    return;
  }

  somDeJogada();

  if (jogar(casa, JOGADOR)) {
    vezDoRoboJogar();
  }
}

// Limpa tudo e começa uma partida nova (mantendo o nível escolhido).
function reiniciar() {
  idDaPartida++; // partida nova: o robô esquece o que estava pensando
  tabuleiro = ["", "", "", "", "", "", "", "", ""];
  jogoAtivo = true;
  vezDoRobo = false;

  casas.forEach((casa) => casa.classList.remove("vencedora"));

  mensagem.textContent = "Sua vez! Você é o " + JOGADOR;
  desenharTabuleiro();
}

// Volta para a tela de escolher o nível.
function escolherNivel() {
  idDaPartida++; // a partida atual acabou aqui
  jogoAtivo = false;
  vezDoRobo = false;
  telaEscolha.classList.remove("escondido");
}

// Começa o jogo no nível escolhido.
function comecarJogo(nivelEscolhido) {
  nivel = nivelEscolhido;
  telaEscolha.classList.add("escondido");
  reiniciar();
}

// --- CONTROLES ---

casas.forEach((casa) => casa.addEventListener("click", cliqueNaCasa));

document.querySelectorAll(".nivel").forEach((botao) => {
  botao.addEventListener("click", () => comecarJogo(Number(botao.dataset.nivel)));
});

botaoReiniciar.addEventListener("click", reiniciar);

document.addEventListener("keydown", (evento) => {
  // Na tela de escolha, as teclas 1, 2 e 3 escolhem o nível
  if (!telaEscolha.classList.contains("escondido")) {
    if (evento.key === "1" || evento.key === "2" || evento.key === "3") {
      comecarJogo(Number(evento.key));
    }
    return;
  }

  // Espaço reinicia o jogo: volta para a tela de escolher o nível,
  // para você poder trocar de dificuldade antes da próxima partida.
  if (evento.code === "Space") {
    evento.preventDefault(); // senão o navegador rola a página
    escolherNivel();
  }
});

// Ao abrir a página, o jogador escolhe o nível antes de qualquer coisa
escolherNivel();
desenharTabuleiro();
