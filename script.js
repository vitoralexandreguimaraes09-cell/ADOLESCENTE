const somDado = new Audio("dado.mp3");
const TOTAL_CASAS = 40;
const TOTAL_CARTAS = 13;
const facesDado = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const SVG_NS = 'http://www.w3.org/2000/svg';
const tabuleiro = document.getElementById('tabuleiro');
const casasTabuleiro = document.getElementById('casasTabuleiro');
const estrada = document.getElementById('estrada');
const estradaSombra = document.getElementById('estradaSombra');
const linhaEstrada = document.getElementById('linhaEstrada');
const personagem = document.getElementById('personagem');
const introducao = document.getElementById('introducao');
const painelJogo = document.getElementById('painelJogo');
const telaFinal = document.getElementById('telaFinal');
const jogarBtn = document.getElementById('jogarBtn');
const dadoVisual = document.getElementById('dadoVisual');
const casaAtual = document.getElementById('casaAtual');
const ultimoDado = document.getElementById('ultimoDado');
const porcentagem = document.getElementById('porcentagem');
const barraProgresso = document.getElementById('barraProgresso');
const mensagemIcone = document.getElementById('mensagemIcone');
const mensagemTitulo = document.getElementById('mensagemTitulo');
const mensagemTexto = document.getElementById('mensagemTexto');
const overlayDado = document.getElementById('overlayDado');
const dadoCentro = document.getElementById('dadoCentro');
const textoDado = document.getElementById('textoDado');
const overlayCarta = document.getElementById('overlayCarta');
const textoCarta = document.getElementById('textoCarta');
const fecharCartaBtn = document.getElementById('fecharCartaBtn');
const audioBtn = document.getElementById('audioBtn');

// Música e efeitos sonoros são sintetizados no navegador, sem precisar baixar arquivos de áudio.
let contextoAudio = null;
let musicaAtiva = true;
let audioIniciadoPeloUsuario = false;
let temporizadorMusica = null;
let notaMusica = 0;
const melodia = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5];

function prepararAudio() {
  if (!contextoAudio) {
    const AudioContextDisponivel = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextDisponivel) return false;
    contextoAudio = new AudioContextDisponivel();
  }
  if (contextoAudio.state === 'suspended') contextoAudio.resume();
  return true;
}

function tocarTom(frequencia, duracao = 0.12, tipo = 'sine', volume = 0.045, atraso = 0) {
  if (!musicaAtiva || !prepararAudio()) return;
  const inicio = contextoAudio.currentTime + atraso;
  const oscilador = contextoAudio.createOscillator();
  const ganho = contextoAudio.createGain();
  oscilador.type = tipo;
  oscilador.frequency.setValueAtTime(frequencia, inicio);
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.025);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  oscilador.connect(ganho);
  ganho.connect(contextoAudio.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracao + 0.03);
}

function tocarEfeito(tipo) {
  if (!musicaAtiva || !prepararAudio()) return;

  if (tipo === 'clique') {
    tocarTom(720, 0.045, 'sine', 0.025);
    tocarTom(960, 0.035, 'sine', 0.014, 0.025);
  } else if (tipo === 'dado') {
    // Pequenos toques secos no início da jogada.
    tocarTom(190, 0.07, 'triangle', 0.035);
    tocarTom(260, 0.06, 'triangle', 0.025, 0.08);
  } else if (tipo === 'rolagem') {
    somDado.currentTime = 0;

    somDado.play().catch(erro => {
      console.warn('Não foi possível reproduzir o som do dado:', erro);
    });

  } else if (tipo === 'passo') {
    // Um som macio e curto a cada vez que o peão pousa numa casa.
    tocarTom(300, 0.07, 'triangle', 0.026);
    tocarTom(185, 0.08, 'sine', 0.018, 0.025);
  } else if (tipo === 'carta') {
    tocarTom(659.25, 0.16, 'sine', 0.04);
    tocarTom(783.99, 0.2, 'sine', 0.035, 0.12);
  } else if (tipo === 'fim') {
    [523.25, 659.25, 783.99].forEach((nota, i) => tocarTom(nota, 0.35, 'sine', 0.04, i * 0.13));
  }
}
function iniciarMusica() {
  if (temporizadorMusica) clearInterval(temporizadorMusica);
  tocarTom(melodia[0], 0.32, 'sine', 0.018);
  notaMusica = 1;
  temporizadorMusica = setInterval(() => {
    if (!musicaAtiva) return;
    tocarTom(melodia[notaMusica % melodia.length], 0.34, 'sine', 0.018);
    if (notaMusica % 4 === 0) tocarTom(melodia[(notaMusica + 3) % melodia.length] / 2, 0.45, 'triangle', 0.009);
    notaMusica++;
  }, 420);
}

function alternarAudio() {
  if (!prepararAudio()) {
    audioBtn.textContent = 'Áudio indisponível';
    return;
  }
  musicaAtiva = !musicaAtiva;
  audioBtn.setAttribute('aria-pressed', String(musicaAtiva));
  audioBtn.classList.toggle('ativo', musicaAtiva);
  audioBtn.textContent = musicaAtiva ? '♫ Música ligada' : '♫ Ativar música';
  if (musicaAtiva) iniciarMusica();
  else if (temporizadorMusica) { clearInterval(temporizadorMusica); temporizadorMusica = null; }
}

let posicao = 1;
let animacaoAtiva = false;
let esperandoFecharCarta = false;
let pontos = [];
let caminhoComprimento = 0;
let casasCriadas = {};

function criarElementoSvg(nome, atributos = {}) {
  const elemento = document.createElementNS(SVG_NS, nome);
  Object.entries(atributos).forEach(([chave, valor]) => elemento.setAttribute(chave, valor));
  return elemento;
}

// Pontos-guia em zigue-zague, ligados por curvas suaves para formar uma estrada contínua.
function criarPontosGuia() {
  const resultado = [];
  const celular = window.matchMedia('(max-width: 600px)').matches;

  if (celular) {
    // No celular, o tabuleiro fica mais alto e estreito, sem exigir rolagem horizontal.
    tabuleiro.setAttribute('viewBox', '0 0 600 1100');
    const xs = [68, 184, 300, 416, 532];
    for (let linha = 0; linha < 8; linha++) {
      const listaX = linha % 2 === 0 ? xs : [...xs].reverse();
      listaX.forEach((x, coluna) => {
        resultado.push({ x, y: 70 + linha * 137 + (coluna % 2 === 0 ? -3 : 3) });
      });
    }
  } else {
    // Em telas grandes, o percurso fica mais largo, como um tabuleiro de mesa.
    tabuleiro.setAttribute('viewBox', '0 0 1000 610');
    const xs = [90, 207, 324, 441, 558, 675, 792, 909];
    const ys = [520, 410, 300, 190, 80];
    for (let linha = 0; linha < 5; linha++) {
      const listaX = linha % 2 === 0 ? xs : [...xs].reverse();
      listaX.forEach((x, coluna) => {
        resultado.push({ x, y: ys[linha] + (coluna % 2 === 0 ? -5 : 5) });
      });
    }
  }
  return resultado;
}

function caminhoSuave(pontos) {
  if (pontos.length < 2) return '';
  let d = `M ${pontos[0].x} ${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const atual = pontos[i];
    const proximo = pontos[i + 1];
    const meioX = (atual.x + proximo.x) / 2;
    const meioY = (atual.y + proximo.y) / 2;
    if (i === 0) d += ` Q ${atual.x} ${atual.y} ${meioX} ${meioY}`;
    else d += ` T ${meioX} ${meioY}`;
    if (i === pontos.length - 2) d += ` T ${proximo.x} ${proximo.y}`;
  }
  return d;
}

function montarEstrada() {
  const guias = criarPontosGuia();
  const d = caminhoSuave(guias);
  [estradaSombra, estrada, linhaEstrada].forEach(el => el.setAttribute('d', d));
  caminhoComprimento = estrada.getTotalLength();
  pontos = [];
  for (let i = 0; i < TOTAL_CASAS; i++) {
    const distancia = (i / (TOTAL_CASAS - 1)) * caminhoComprimento;
    pontos.push(estrada.getPointAtLength(distancia));
  }
}

function criarCasas() {
  casasTabuleiro.innerHTML = '';
  casasCriadas = {};
  pontos.forEach((ponto, indice) => {
    const numero = indice + 1;
    const grupo = criarElementoSvg('g', {class: `casa-svg cor-${(numero - 1) % 6}`, transform: `translate(${ponto.x} ${ponto.y})`});
    // Todas as casas do percurso podem indicar uma carta física.
    grupo.classList.add('casa-carta');
    if (numero === 1) grupo.classList.add('casa-inicio');
    if (numero === TOTAL_CASAS) grupo.classList.add('casa-final');

    const circulo = criarElementoSvg('circle', {class:'base-casa', r: 22, cx:0, cy:0});
    const numeroEl = criarElementoSvg('text', {class:'numero-casa', x:0, y:0});
    numeroEl.textContent = numero;
    grupo.append(circulo, numeroEl);

    const icone = criarElementoSvg('text', {class:'carta-simbolo', x:0, y:15});
    icone.textContent = '✦';
    grupo.appendChild(icone);
    if (numero === 1 || numero === TOTAL_CASAS) {
      const marca = criarElementoSvg('text', {class:'carta-simbolo', x:0, y:34});
      marca.textContent = numero === 1 ? 'INÍCIO' : 'FIM';
      marca.setAttribute('font-size','10');
      marca.setAttribute('font-weight','900');
      grupo.appendChild(marca);
    }
    casasTabuleiro.appendChild(grupo);
    casasCriadas[numero] = grupo;
  });
  posicionarPersonagem(pontos[0]);
}

function posicionarPersonagem(ponto, alturaPulo = 0) {
  if (!ponto) return;
  personagem.setAttribute('transform', `translate(${ponto.x} ${ponto.y - 31 - alturaPulo})`);
}

function atualizarInterface() {
  casaAtual.textContent = `${posicao} de ${TOTAL_CASAS}`;
  const progresso = Math.round(((posicao - 1) / (TOTAL_CASAS - 1)) * 100);
  porcentagem.textContent = `${progresso}%`;
  barraProgresso.style.width = `${progresso}%`;
}

function mostrarMensagem(icone, titulo, texto) {
  mensagemIcone.textContent = icone;
  mensagemTitulo.textContent = titulo;
  mensagemTexto.textContent = texto;
}

function abrirCarta(numeroCarta) {
  textoCarta.textContent = `Pegue a carta de número ${numeroCarta}.`;
  overlayCarta.classList.remove('escondido');
  esperandoFecharCarta = true;
  fecharCartaBtn.focus();
}

function sortearNumeroCarta() {
  // Sorteia uma das 13 cartas sempre que o peão termina uma jogada.
  return Math.floor(Math.random() * TOTAL_CARTAS) + 1;
}

function verificarCasa() {
  atualizarInterface();
  const numeroCarta = sortearNumeroCarta();
  mostrarMensagem('✦', `Pegue a carta de número ${numeroCarta}.`, 'Pegue a carta física indicada.');
  tocarEfeito('carta');
  abrirCarta(numeroCarta);
}

function animarPersonagem(destino, duracao = 460) {
  return new Promise(resolve => {
    const inicioPosicao = posicao;
    const inicioTempo = performance.now();
    const inicioDistancia = ((inicioPosicao - 1) / (TOTAL_CASAS - 1)) * caminhoComprimento;
    const fimDistancia = ((destino - 1) / (TOTAL_CASAS - 1)) * caminhoComprimento;

    function quadro(agora) {
      const bruto = Math.min((agora - inicioTempo) / duracao, 1);
      // Avança entre duas casas por vez, elevando o peão no meio do salto.
      const progresso = bruto * bruto * (3 - 2 * bruto);
      const distancia = inicioDistancia + (fimDistancia - inicioDistancia) * progresso;
      const ponto = estrada.getPointAtLength(distancia);
      const alturaPulo = Math.sin(bruto * Math.PI) * 17;
      posicionarPersonagem(ponto, alturaPulo);

      if (bruto < 1) requestAnimationFrame(quadro);
      else {
        posicionarPersonagem(pontos[destino - 1], 0);
        resolve();
      }
    }
    requestAnimationFrame(quadro);
  });
}
async function moverPassoAPasso(destino) {
  const origem = posicao;
  const distancia = destino - origem;
  for (let i = 1; i <= distancia; i++) {
    const proximaCasa = origem + i;
    const duracao = 460;
    await animarPersonagem(proximaCasa, duracao);
    posicao = proximaCasa;
    tocarEfeito('passo');
    atualizarInterface();
    Object.values(casasCriadas).forEach(casa => casa.classList.remove('casa-atual'));
    casasCriadas[posicao]?.classList.add('casa-atual');
  }
  animacaoAtiva = false;
  jogarBtn.disabled = false;
  verificarCasa();
}

async function jogarDado() {
  if (animacaoAtiva || esperandoFecharCarta || !overlayDado.classList.contains('escondido')) return;
  animacaoAtiva = true;
  jogarBtn.disabled = true;
  overlayDado.classList.remove('escondido');
  tocarEfeito('dado');
  tocarEfeito('rolagem');
  dadoCentro.classList.add('rolando');
  textoDado.textContent = 'O dado está rolando...';
  const resultado = Math.floor(Math.random() * 6) + 1;
  let giros = 0;
  await new Promise(resolve => {
    const timer = setInterval(() => {
      dadoCentro.textContent = facesDado[Math.floor(Math.random() * 6)];
      giros++;
      if (giros >= 12) {
        clearInterval(timer);
        dadoCentro.textContent = facesDado[resultado - 1];
        dadoCentro.classList.remove('rolando');
        textoDado.textContent = `Você tirou ${resultado}!`;
        dadoVisual.textContent = facesDado[resultado - 1];
        ultimoDado.textContent = resultado;
        setTimeout(resolve, 650);
      }
    }, 100);
  });
  overlayDado.classList.add('escondido');
  const destino = Math.min(posicao + resultado, TOTAL_CASAS);
  mostrarMensagem('🎲', `Você tirou ${resultado}!`, 'Sua peça está caminhando pelo tabuleiro...');
  await moverPassoAPasso(destino);
}

function finalizarPartida() {
  tocarEfeito('fim');
  painelJogo.classList.add('escondido');
  telaFinal.classList.remove('escondido');
  barraProgresso.style.width = '100%';
}

function iniciarPartida() {
  iniciarAudioNaPrimeiraInteracao();
  if (musicaAtiva && !temporizadorMusica && contextoAudio) iniciarMusica();
  posicao = 1;
  animacaoAtiva = false;
  esperandoFecharCarta = false;
  ultimoDado.textContent = '—';
  dadoVisual.textContent = '⚄';
  dadoCentro.textContent = '⚄';
  dadoCentro.classList.remove('rolando');
  overlayDado.classList.add('escondido');
  overlayCarta.classList.add('escondido');
  introducao.classList.add('escondido');
  telaFinal.classList.add('escondido');
  painelJogo.classList.remove('escondido');
  jogarBtn.disabled = false;
  jogarBtn.innerHTML = 'Jogar o dado <span>🎲</span>';
  montarEstrada();
  criarCasas();
  atualizarInterface();
  mostrarMensagem('🌟', 'Sua jornada começa aqui!', 'Clique em “Jogar o dado” para avançar pelo tabuleiro.');
}

function continuarDepoisDaCarta() {
  overlayCarta.classList.add('escondido');
  esperandoFecharCarta = false;
  if (posicao === TOTAL_CASAS) {
    finalizarPartida();
    return;
  }
  mostrarMensagem('🎲', 'Sua vez de continuar!', 'Clique em “Jogar o dado” para seguir pelo caminho.');
  jogarBtn.focus();
}

document.getElementById('iniciarBtn').addEventListener('click', iniciarPartida);
document.getElementById('reiniciarBtn').addEventListener('click', iniciarPartida);
document.getElementById('jogarNovamenteBtn').addEventListener('click', iniciarPartida);
jogarBtn.addEventListener('click', jogarDado);
fecharCartaBtn.addEventListener('click', continuarDepoisDaCarta);
audioBtn.setAttribute('aria-pressed', 'true');
audioBtn.classList.add('ativo');
audioBtn.textContent = '♫ Música ligada';

// Navegadores bloqueiam áudio automático até a primeira interação. Assim, a música
// começa sozinha no primeiro toque/clique do usuário, sem precisar apertar o botão de música.
function iniciarAudioNaPrimeiraInteracao() {
  if (audioIniciadoPeloUsuario) return;
  audioIniciadoPeloUsuario = true;
  if (prepararAudio() && musicaAtiva && !temporizadorMusica) iniciarMusica();
}
document.addEventListener('pointerdown', iniciarAudioNaPrimeiraInteracao, { once: true, capture: true });
document.addEventListener('keydown', iniciarAudioNaPrimeiraInteracao, { once: true, capture: true });

audioBtn.addEventListener('click', alternarAudio);
// Som discreto de clique em todos os botões do jogo.
document.addEventListener('click', event => {
  if (event.target.closest('button')) tocarEfeito('clique');
});
let temporizadorRedimensionamento;
window.addEventListener('resize', () => {
  clearTimeout(temporizadorRedimensionamento);
  temporizadorRedimensionamento = setTimeout(() => {
    if (animacaoAtiva) return;
    montarEstrada();
    criarCasas();
    posicionarPersonagem(pontos[posicao - 1]);
    Object.values(casasCriadas).forEach(casa => casa.classList.remove('casa-atual'));
    casasCriadas[posicao]?.classList.add('casa-atual');
  }, 180);
});

montarEstrada();
criarCasas();
atualizarInterface();
