// ==================== CONFIGURAÇÃO ====================
const JSONBIN_API_KEY = '$2a$10$8yB70Rb7oLrLXy0Ge3JuzOA1xxB56R1tJZS4NDJ0m.CRg4mADoB0m';
const JSONBIN_BIN_ID = '691d1701ae596e708f61d4c6';
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`;

let associados = [];
let currentUser = null;
let isAdmin = false;
let currentPage = 1;
const itemsPerPage = 10;
let selectedAssociado = null;
let associadoEditando = null;
let scheduledMessages = [];
let associadosPendentes = [];
let envioEmAndamento = false;
let indiceEnvioAtual = 0;
let intervaloEnvio = null;
let intervaloVerificacao = null;
let filtroAssociadoPag = '', filtroAnoPag = '', filtroMesPag = '', filtroFormaPag = '';

// Variáveis de áudio
let whatsappAutorizado = false;
let dispositivoAutorizado = null;
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioUrl = null;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const mainSystem = document.getElementById('main-system');
const userWelcome = document.getElementById('user-welcome');
const userType = document.getElementById('user-type');
const logoutBtn = document.getElementById('logout-btn');
const toastMessage = document.getElementById('toast-message');
const mensagemTemplate = document.getElementById('mensagem-template');
const associadoSelect = document.getElementById('associado-select');
const associadoInfo = document.getElementById('associado-info');
const contribuicaoForm = document.getElementById('contribuicao-form');
const paymentHistory = document.getElementById('payment-history');
const monthsContainer = document.getElementById('months-container');
const dataProgramada = document.getElementById('data-programada');
const modalEditar = document.getElementById('modal-editar');
const formEditar = document.getElementById('form-editar');
const contribuicoesLista = document.getElementById('contribuicoes-lista');
const modalContribuicao = document.getElementById('modal-contribuicao');
const formNovaContribuicao = document.getElementById('form-nova-contribuicao');

// Elementos de áudio
const btnAutorizarWhatsapp = document.getElementById('btn-autorizar-whatsapp');
const authStatusBadge = document.getElementById('auth-status-badge');
const btnRecordAudio = document.getElementById('btn-record-audio');
const btnStopRecording = document.getElementById('btn-stop-recording');
const btnPlayRecorded = document.getElementById('btn-play-recorded');
const btnSendAudioRecorded = document.getElementById('btn-send-audio-recorded');
const audioStatus = document.getElementById('audio-status');
const audioPlayerContainer = document.getElementById('audio-player-container');
const recordedAudio = document.getElementById('recorded-audio');
const uploadStatusDiv = document.getElementById('upload-status');
const enviarAutomaticoBtn = document.getElementById('enviar-automatico-btn');
const pararEnvioBtn = document.getElementById('parar-envio-btn');
const contadorEnvioDiv = document.getElementById('contador-envio');
const progressContainerDiv = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const contadorTexto = document.getElementById('contador-texto');

// ==================== FUNÇÕES AUXILIARES ====================
function formatarData(data) { 
    return data ? new Date(data).toLocaleDateString('pt-BR') : '-'; 
}

function formatarMesAno(mesAno) { 
    if (!mesAno) return '-'; 
    const [ano, mes] = mesAno.split('-').map(Number);
    return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); 
}

function formatarValor(valor) { 
    return `R$ ${(valor || 0).toFixed(2)}`; 
}

function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toastMessage.className = `toast-message alert-${type}`;
    toastMessage.style.display = 'block';
    setTimeout(() => { toastMessage.style.display = 'none'; }, 3000);
}

async function carregarDados() {
    try {
        const response = await fetch(JSONBIN_URL, { headers: { 'X-Master-Key': JSONBIN_API_KEY } });
        if (!response.ok) throw new Error('Erro ao carregar dados');
        const data = await response.json();
        associados = data.record.associados || [];
        scheduledMessages = data.record.scheduledMessages || [];
        return true;
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao carregar dados. Tente novamente.', 'error');
        return false;
    }
}

async function salvarDados() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
            body: JSON.stringify({ associados: associados, scheduledMessages: scheduledMessages })
        });
        if (!response.ok) throw new Error('Erro ao salvar dados');
        return true;
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao salvar dados. Tente novamente.', 'error');
        return false;
    }
}

function getDispositivoSelecionado() {
    const dispositivoRadios = document.querySelectorAll('input[name="dispositivo"]');
    for (let radio of dispositivoRadios) if (radio.checked) return radio.value;
    return isMobile ? 'mobile' : 'web';
}

function gerarLinkWhatsApp(telefone, mensagem, nome = '') {
    const mensagemPersonalizada = mensagem.replace('[NOME]', nome);
    const telefoneLimpo = telefone.replace(/\D/g, '');
    return `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagemPersonalizada)}`;
}

function enviarWhatsAppUniversal(telefone, mensagem, nome = '') {
    const link = gerarLinkWhatsApp(telefone, mensagem, nome);
    if (isMobile) window.location.href = link;
    else window.open(link, '_blank');
}

function enviarMensagemIndividual(numeroAssociado) {
    const associado = associados.find(a => a.numero === numeroAssociado);
    if (!associado) return;
    enviarWhatsAppUniversal(associado.telefone, mensagemTemplate.value, associado.nome);
}

function enviarAudio(telefone, texto, nome = '') {
    const textoPersonalizado = texto.replace('[NOME]', nome);
    const mensagemAudio = `🔊 *Mensagem de áudio para você:*\n\n"${textoPersonalizado}"\n\n(Esta é uma mensagem de texto. Se você não sabe ler, peça a alguém para ler em voz alta para você.)`;
    const link = gerarLinkWhatsApp(telefone, mensagemAudio, '');
    if (isMobile) window.location.href = link;
    else window.open(link, '_blank');
}

function enviarLinkAudioGravado(telefone, linkAudio, nome) {
    const msg = `🎤 *MENSAGEM DE VOZ PARA ${nome.toUpperCase()}* 🎤\nClique para ouvir: ${linkAudio}\n(Se não conseguir ouvir, peça ajuda)`;
    const link = gerarLinkWhatsApp(telefone, msg, '');
    if (isMobile) window.location.href = link;
    else window.open(link, '_blank');
}

// ==================== UPLOAD DE ÁUDIO ====================
async function uploadAudioToTmpFiles(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'mensagem_voz.webm');
    
    try {
        uploadStatusDiv.innerHTML = '<span class="loading"></span> Enviando áudio...';
        const response = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.status === 'success' && data.data.url) {
            const directUrl = data.data.url.replace('/dl/', '/download/') + '?download=1';
            uploadStatusDiv.innerHTML = `✅ Áudio enviado! <a href="${directUrl}" target="_blank">Link permanente (30 dias)</a>`;
            return directUrl;
        } else {
            throw new Error('Falha no upload');
        }
    } catch (err) {
        console.error(err);
        uploadStatusDiv.innerHTML = '❌ Erro no upload. Tente novamente.';
        return null;
    }
}

async function enviarAudioGravadoParaPendentes() {
    if (!audioBlob) { 
        showToast('Grave um áudio primeiro', 'error'); 
        return; 
    }
    if (associadosPendentes.length === 0) { 
        showToast('Sem pendentes', 'error'); 
        return; 
    }
    
    showToast('Enviando áudio para servidor... Aguarde');
    const audioPublicUrl = await uploadAudioToTmpFiles(audioBlob);
    if (!audioPublicUrl) {
        showToast('Falha no upload do áudio. Tente novamente.', 'error');
        return;
    }
    
    if (confirm(`Enviar link do áudio para ${associadosPendentes.length} associados pendentes?`)) {
        for (let i = 0; i < associadosPendentes.length; i++) {
            setTimeout(() => {
                enviarLinkAudioGravado(associadosPendentes[i].telefone, audioPublicUrl, associadosPendentes[i].nome);
            }, i * 2000);
        }
        showToast(`Enviando links do áudio para ${associadosPendentes.length} associados...`);
    }
}

// ==================== AUTORIZAÇÃO ====================
function carregarAutorizacao() {
    const auth = localStorage.getItem('whatsappAutorizado');
    const disp = localStorage.getItem('dispositivoAutorizado');
    if (auth === 'true' && disp) {
        whatsappAutorizado = true;
        dispositivoAutorizado = disp;
        authStatusBadge.textContent = `Autorizado (${disp === 'web' ? 'WhatsApp Web' : 'WhatsApp Mobile'})`;
        authStatusBadge.className = 'status-badge authorized';
    } else {
        whatsappAutorizado = false;
        dispositivoAutorizado = null;
        authStatusBadge.textContent = 'Não autorizado';
        authStatusBadge.className = 'status-badge unauthorized';
    }
}

function autorizarWhatsapp() {
    const radios = document.querySelectorAll('input[name="auth-device"]');
    let selected = null;
    for (let r of radios) if (r.checked) { selected = r.value; break; }
    if (!selected) { 
        showToast('Selecione um dispositivo', 'error'); 
        return; 
    }
    localStorage.setItem('whatsappAutorizado', 'true');
    localStorage.setItem('dispositivoAutorizado', selected);
    whatsappAutorizado = true;
    dispositivoAutorizado = selected;
    authStatusBadge.textContent = `Autorizado (${selected === 'web' ? 'WhatsApp Web' : 'WhatsApp Mobile'})`;
    authStatusBadge.className = 'status-badge authorized';
    showToast(`Autorizado para ${selected === 'web' ? 'WhatsApp Web' : 'WhatsApp Mobile'}`);
}

// ==================== GRAVAÇÃO DE ÁUDIO ====================
async function iniciarGravacao() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            audioUrl = URL.createObjectURL(audioBlob);
            recordedAudio.src = audioUrl;
            audioPlayerContainer.style.display = 'block';
            audioStatus.textContent = 'Áudio gravado! Você pode ouvir e enviar.';
            btnSendAudioRecorded.disabled = false;
            btnPlayRecorded.disabled = false;
            stream.getTracks().forEach(t => t.stop());
            uploadStatusDiv.innerHTML = '';
        };
        mediaRecorder.start();
        audioStatus.textContent = 'Gravando... 🎙️ Clique em Parar';
        btnRecordAudio.disabled = true;
        btnStopRecording.disabled = false;
        btnRecordAudio.classList.add('pulse-animation');
    } catch (e) { 
        showToast('Erro ao acessar microfone', 'error'); 
    }
}

function pararGravacao() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        btnRecordAudio.disabled = false;
        btnStopRecording.disabled = true;
        btnRecordAudio.classList.remove('pulse-animation');
        audioStatus.textContent = 'Gravação finalizada.';
    }
}

function reproduzirAudio() { 
    if (recordedAudio.src) recordedAudio.play(); 
    else showToast('Nenhum áudio', 'error'); 
}

// ==================== ENVIO AUTOMÁTICO ====================
function iniciarEnvioAutomatico() {
    if (!whatsappAutorizado) { 
        showToast('Autorize o WhatsApp primeiro', 'error'); 
        return; 
    }
    if (envioEmAndamento) { 
        if (confirm('Envio em andamento. Parar e reiniciar?')) { 
            pararEnvio(); 
            setTimeout(iniciarEnvioAutomatico, 500); 
        } 
        return; 
    }
    if (associadosPendentes.length === 0) { 
        showToast('Sem pendentes', 'error'); 
        return; 
    }
    if (!confirm(`Enviar para ${associadosPendentes.length} associados?`)) return;
    envioEmAndamento = true;
    indiceEnvioAtual = 0;
    contadorEnvioDiv.style.display = 'block';
    progressContainerDiv.style.display = 'block';
    enviarAutomaticoBtn.disabled = true;
    pararEnvioBtn.disabled = false;
    enviarProximaAuto();
}

function enviarProximaAuto() {
    if (!envioEmAndamento) return;
    if (indiceEnvioAtual >= associadosPendentes.length) { 
        finalizarEnvioAuto(); 
        return; 
    }
    const a = associadosPendentes[indiceEnvioAtual];
    contadorTexto.textContent = `Enviando ${indiceEnvioAtual + 1}/${associadosPendentes.length}: ${a.nome}`;
    const perc = Math.round((indiceEnvioAtual / associadosPendentes.length) * 100);
    progressBar.style.width = `${perc}%`;
    progressText.textContent = `${perc}%`;
    const link = gerarLinkWhatsApp(a.telefone, mensagemTemplate.value, a.nome);
    if (dispositivoAutorizado === 'mobile') window.location.href = link;
    else window.open(link, '_blank');
    indiceEnvioAtual++;
    if (indiceEnvioAtual < associadosPendentes.length) {
        intervaloEnvio = setTimeout(enviarProximaAuto, 5000);
    } else {
        setTimeout(finalizarEnvioAuto, 5000);
    }
}

function finalizarEnvioAuto() {
    envioEmAndamento = false;
    clearTimeout(intervaloEnvio);
    contadorTexto.textContent = `Concluído! ${associadosPendentes.length} mensagens.`;
    progressBar.style.width = '100%';
    progressText.textContent = '100%';
    setTimeout(() => {
        enviarAutomaticoBtn.disabled = false;
        pararEnvioBtn.disabled = true;
        setTimeout(() => {
            contadorEnvioDiv.style.display = 'none';
            progressContainerDiv.style.display = 'none';
        }, 3000);
    }, 2000);
    showToast('Envio automático finalizado');
}

function pararEnvio() {
    if (envioEmAndamento) {
        envioEmAndamento = false;
        clearTimeout(intervaloEnvio);
        enviarAutomaticoBtn.disabled = false;
        pararEnvioBtn.disabled = true;
        contadorTexto.textContent = 'Envio interrompido.';
        showToast('Envio cancelado');
    }
}

// ==================== FUNÇÕES DE STATUS ====================
function calcularStatusPagamento(associado) {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const dataCadastro = new Date(associado.dataCadastro);
    const anoCadastro = dataCadastro.getFullYear();
    const mesCadastro = dataCadastro.getMonth() + 1;
    let totalMeses = 0, mesesPagos = 0;
    for (let ano = anoCadastro; ano <= anoAtual; ano++) {
        for (let mes = 1; mes <= 12; mes++) {
            if (ano === anoCadastro && mes < mesCadastro) continue;
            if (ano === anoAtual && mes > mesAtual) continue;
            totalMeses++;
            const mesAno = `${ano}-${mes.toString().padStart(2, '0')}`;
            if (associado.contribuicoes?.find(c => c.mesReferencia === mesAno)) mesesPagos++;
        }
    }
    const pendentes = totalMeses - mesesPagos;
    const percentual = totalMeses > 0 ? Math.round((mesesPagos / totalMeses) * 100) : 0;
    return pendentes === 0 ? 
        { texto: `Em dia (${mesesPagos}/${totalMeses} - ${percentual}%)`, classe: 'status-pago', mesesPendentes: 0 } :
        { texto: `${pendentes} atrasados (${mesesPagos}/${totalMeses} - ${percentual}%)`, classe: 'status-pendente', mesesPendentes: pendentes };
}

// ==================== FUNÇÕES ADMIN ====================
async function cadastrarAssociado(e) {
    e.preventDefault();
    const novoAssociado = {
        numero: associados.length > 0 ? Math.max(...associados.map(a => a.numero)) + 1 : 1,
        nome: document.getElementById('nome').value,
        dataCadastro: document.getElementById('data-cadastro').value,
        formaPagamento: document.getElementById('forma-pagamento').value,
        telefone: document.getElementById('telefone').value,
        contribuicoes: []
    };
    associados.push(novoAssociado);
    if (await salvarDados()) {
        document.getElementById('cadastro-result').innerHTML = `<div class="alert alert-success">Cadastrado! Nº: ${novoAssociado.numero}</div>`;
        document.getElementById('cadastro-result').style.display = 'block';
        document.getElementById('cadastro-form').reset();
        document.getElementById('data-cadastro').valueAsDate = new Date();
        atualizarSeletorAssociados();
        atualizarListaAssociados();
        atualizarListaPendentes();
        popularSelectMeses();
        atualizarRelatorios();
        popularFiltrosPagamentos();
        showToast('Associado cadastrado com sucesso!');
    }
}

async function excluirAssociado(numero) {
    if (!confirm(`Tem certeza que deseja excluir o associado de número ${numero}?`)) return;
    const index = associados.findIndex(a => a.numero === numero);
    if (index === -1) return;
    associados.splice(index, 1);
    associados.sort((a, b) => a.numero - b.numero);
    for (let i = 0; i < associados.length; i++) associados[i].numero = i + 1;
    if (await salvarDados()) {
        showToast('Associado excluído e números reorganizados!');
        atualizarSeletorAssociados();
        atualizarListaAssociados();
        atualizarListaPendentes();
        popularSelectMeses();
        atualizarRelatorios();
        popularFiltrosPagamentos();
        atualizarTabelaPagamentos();
    }
}

function atualizarListaAssociados() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    let filtrados = searchTerm ? 
        associados.filter(a => a.nome.toLowerCase().includes(searchTerm) || a.numero.toString().includes(searchTerm)) : 
        associados;
    const totalPages = Math.ceil(filtrados.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * itemsPerPage;
    const pagina = filtrados.slice(start, start + itemsPerPage);
    const tbody = document.getElementById('associados-list');
    tbody.innerHTML = pagina.length ? 
        pagina.map(a => {
            const status = calcularStatusPagamento(a);
            return `<tr>
                <td>${a.numero}</td>
                <td>${a.nome}</td>
                <td>${a.telefone}</td>
                <td>${formatarData(a.dataCadastro)}</td>
                <td>${a.formaPagamento}</td>
                <td class="${status.classe}">${status.texto}</td>
                <td>
                    <button class="whatsapp-btn" onclick="enviarMensagemIndividual(${a.numero})">📱</button>
                    <button class="btn-success" onclick="irParaContribuicoes(${a.numero})">💰</button>
                    <button class="btn-warning" onclick="editarAssociado(${a.numero})">✏️</button>
                    <button class="btn-danger" onclick="excluirAssociado(${a.numero})">🗑️</button>
                </td>
            </tr>`;
        }).join('') : 
        '<tr><td colspan="7" style="text-align:center;">Nenhum associado encontrado</td></tr>';
    atualizarPaginacao(totalPages);
}

function atualizarPaginacao(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination || totalPages <= 1) { pagination.innerHTML = ''; return; }
    pagination.innerHTML = '';
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '«';
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; atualizarListaAssociados(); } });
    pagination.appendChild(prev);
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => { currentPage = i; atualizarListaAssociados(); });
        pagination.appendChild(btn);
    }
    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '»';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; atualizarListaAssociados(); } });
    pagination.appendChild(next);
}

function atualizarSeletorAssociados() {
    if (associadoSelect) {
        associadoSelect.innerHTML = '<option value="">Selecione...</option>' + 
            associados.map(a => `<option value="${a.numero}">${a.numero} - ${a.nome}</option>`).join('');
    }
    popularFiltrosPagamentos();
}

function selecionarAssociado() {
    const numero = parseInt(associadoSelect.value);
    if (!numero) { 
        associadoInfo.style.display = 'none'; 
        selectedAssociado = null; 
        return; 
    }
    selectedAssociado = associados.find(a => a.numero === numero);
    if (!selectedAssociado) return;
    document.getElementById('info-nome').textContent = selectedAssociado.nome;
    document.getElementById('info-numero').textContent = selectedAssociado.numero;
    document.getElementById('info-telefone').textContent = selectedAssociado.telefone;
    document.getElementById('info-data-cadastro').textContent = formatarData(selectedAssociado.dataCadastro);
    paymentHistory.innerHTML = selectedAssociado.contribuicoes?.length ? 
        selectedAssociado.contribuicoes.sort((a, b) => new Date(b.dataPagamento) - new Date(a.dataPagamento)).map(c => 
            `<div class="payment-item">
                <div>
                    <strong>${formatarMesAno(c.mesReferencia)}</strong>
                    <br><small>${formatarData(c.dataPagamento)}</small>
                    <br><small>Obs: ${c.observacoes || '-'}</small>
                </div>
                <div>
                    <strong>R$ ${c.valor.toFixed(2)}</strong>
                    <br><small>${c.formaPagamento}</small>
                </div>
            </div>`
        ).join('') : 
        '<p>Nenhuma contribuição</p>';
    document.getElementById('forma-pagamento-contrib').value = selectedAssociado.formaPagamento;
    associadoInfo.style.display = 'block';
}

async function registrarContribuicao(e) {
    e.preventDefault();
    if (!selectedAssociado) return alert('Selecione um associado');
    const contrib = {
        mesReferencia: document.getElementById('mes-referencia').value,
        dataPagamento: document.getElementById('data-pagamento').value,
        formaPagamento: document.getElementById('forma-pagamento-contrib').value,
        valor: parseFloat(document.getElementById('valor').value),
        observacoes: document.getElementById('observacoes').value,
        dataRegistro: new Date().toISOString().split('T')[0]
    };
    selectedAssociado.contribuicoes = selectedAssociado.contribuicoes.filter(c => c.mesReferencia !== contrib.mesReferencia);
    selectedAssociado.contribuicoes.push(contrib);
    if (await salvarDados()) {
        selecionarAssociado();
        atualizarListaAssociados();
        atualizarListaPendentes();
        popularSelectMeses();
        atualizarRelatorios();
        popularFiltrosPagamentos();
        atualizarTabelaPagamentos();
        contribuicaoForm.reset();
        showToast('Contribuição registrada!');
    }
}

function atualizarListaPendentes() {
    associadosPendentes = associados.filter(a => calcularStatusPagamento(a).mesesPendentes > 0);
    const div = document.getElementById('pendentes-list');
    if (div) {
        div.innerHTML = associadosPendentes.length ? 
            associadosPendentes.map(a => {
                const status = calcularStatusPagamento(a);
                return `<div class="card" style="margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3>${a.nome}</h3>
                            <p>Nº: ${a.numero} | Tel: ${a.telefone}</p>
                            <p class="${status.classe}">${status.texto}</p>
                        </div>
                        <button class="whatsapp-btn" onclick="enviarMensagemIndividual(${a.numero})">📱 Enviar</button>
                    </div>
                </div>`;
            }).join('') : 
            '<p>Nenhum pendente</p>';
    }
}

function popularSelectMeses() {
    const sel = document.getElementById('mes-relatorio');
    if (!sel) return;
    const mesesSet = new Set();
    associados.forEach(associado => {
        associado.contribuicoes?.forEach(contrib => mesesSet.add(contrib.mesReferencia));
    });
    const mesesOrdenados = Array.from(mesesSet).sort().reverse();
    let options = '<option value="">Todos os meses</option>';
    mesesOrdenados.forEach(mes => {
        options += `<option value="${mes}">${formatarMesAno(mes)}</option>`;
    });
    sel.innerHTML = options;
}

function atualizarRelatorios() {
    const mesFiltro = document.getElementById('mes-relatorio').value;
    let totalPeriodo = 0, qtdPeriodo = 0;
    const formas = {};
    const arrecadacaoPorMes = new Map();
    let totalGeral = 0;
    associados.forEach(associado => {
        associado.contribuicoes?.forEach(contrib => {
            totalGeral += contrib.valor || 0;
            if (!mesFiltro || contrib.mesReferencia === mesFiltro) {
                totalPeriodo += contrib.valor || 0;
                qtdPeriodo++;
                const forma = contrib.formaPagamento;
                if (!formas[forma]) formas[forma] = { qtd: 0, valor: 0 };
                formas[forma].qtd++;
                formas[forma].valor += contrib.valor || 0;
                if (!arrecadacaoPorMes.has(contrib.mesReferencia)) {
                    arrecadacaoPorMes.set(contrib.mesReferencia, { total: 0, qtd: 0 });
                }
                const mesData = arrecadacaoPorMes.get(contrib.mesReferencia);
                mesData.total += contrib.valor || 0;
                mesData.qtd++;
            }
        });
    });
    const mesesOrdenados = Array.from(arrecadacaoPorMes.keys()).sort().reverse();
    const arrecadacaoMeses = mesesOrdenados.map(mes => ({
        mes: mes,
        total: arrecadacaoPorMes.get(mes).total,
        qtd: arrecadacaoPorMes.get(mes).qtd,
        media: arrecadacaoPorMes.get(mes).qtd > 0 ? arrecadacaoPorMes.get(mes).total / arrecadacaoPorMes.get(mes).qtd : 0
    }));
    document.getElementById('arrecadacao-mes').textContent = `R$ ${totalPeriodo.toFixed(2)}`;
    document.getElementById('arrecadacao-total').textContent = `R$ ${totalGeral.toFixed(2)}`;
    document.getElementById('associados-ativos').textContent = associados.length;
    document.getElementById('pagamentos-mes').textContent = qtdPeriodo;
    const bodyFormas = document.getElementById('relatorio-formas-pagamento-body');
    bodyFormas.innerHTML = Object.keys(formas).length ? 
        Object.entries(formas).map(([f, d]) => 
            `<tr><td>${f}</td><td>${d.qtd}</td><td>R$ ${d.valor.toFixed(2)}</td></tr>`
        ).join('') : 
        '<tr><td colspan="3" style="text-align:center;">Sem dados</td></tr>';
    const bodyMeses = document.getElementById('relatorio-arrecadacao-meses-body');
    bodyMeses.innerHTML = arrecadacaoMeses.length ? 
        arrecadacaoMeses.map(m => 
            `<tr><td>${formatarMesAno(m.mes)}</td><td>R$ ${m.total.toFixed(2)}</td><td>${m.qtd}</td><td>R$ ${m.media.toFixed(2)}</td></tr>`
        ).join('') : 
        '<tr><td colspan="4" style="text-align:center;">Nenhuma contribuição no período</td></tr>';
}

function irParaContribuicoes(num) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab[data-tab="contribuicoes"]').classList.add('active');
    document.getElementById('contribuicoes-tab').classList.add('active');
    atualizarSeletorAssociados();
    associadoSelect.value = num;
    selecionarAssociado();
    const hoje = new Date();
    document.getElementById('mes-referencia').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('data-pagamento').valueAsDate = hoje;
}

function editarAssociado(num) {
    associadoEditando = associados.find(a => a.numero === num);
    if (!associadoEditando) return;
    document.getElementById('editar-nome').value = associadoEditando.nome;
    document.getElementById('editar-data-cadastro').value = associadoEditando.dataCadastro;
    document.getElementById('editar-forma-pagamento').value = associadoEditando.formaPagamento;
    document.getElementById('editar-telefone').value = associadoEditando.telefone;
    contribuicoesLista.innerHTML = associadoEditando.contribuicoes?.length ? 
        associadoEditando.contribuicoes.sort((a, b) => new Date(b.mesReferencia) - new Date(a.mesReferencia)).map((c, i) => 
            `<div class="payment-item">
                <input type="checkbox" class="contrib-checkbox" data-index="${i}">
                ${formatarMesAno(c.mesReferencia)} - R$ ${c.valor.toFixed(2)}
            </div>`
        ).join('') : 
        '<p>Nenhuma contribuição</p>';
    modalEditar.style.display = 'flex';
}

async function salvarEdicaoAssociado(e) {
    e.preventDefault();
    if (!associadoEditando) return;
    associadoEditando.nome = document.getElementById('editar-nome').value;
    associadoEditando.dataCadastro = document.getElementById('editar-data-cadastro').value;
    associadoEditando.formaPagamento = document.getElementById('editar-forma-pagamento').value;
    associadoEditando.telefone = document.getElementById('editar-telefone').value;
    if (await salvarDados()) {
        modalEditar.style.display = 'none';
        atualizarListaAssociados();
        atualizarSeletorAssociados();
        popularSelectMeses();
        atualizarRelatorios();
        popularFiltrosPagamentos();
        atualizarTabelaPagamentos();
        showToast('Associado atualizado!');
    }
}

function abrirModalContribuicao() {
    if (!associadoEditando) return;
    formNovaContribuicao.reset();
    const hoje = new Date();
    document.getElementById('nova-data-pagamento').valueAsDate = hoje;
    document.getElementById('nova-mes-referencia').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    modalContribuicao.style.display = 'flex';
}

async function adicionarNovaContribuicao(e) {
    e.preventDefault();
    if (!associadoEditando) return;
    const contrib = {
        mesReferencia: document.getElementById('nova-mes-referencia').value,
        dataPagamento: document.getElementById('nova-data-pagamento').value,
        formaPagamento: document.getElementById('nova-forma-pagamento').value,
        valor: parseFloat(document.getElementById('nova-valor').value),
        observacoes: document.getElementById('nova-observacoes').value
    };
    associadoEditando.contribuicoes = associadoEditando.contribuicoes.filter(c => c.mesReferencia !== contrib.mesReferencia);
    associadoEditando.contribuicoes.push(contrib);
    if (await salvarDados()) {
        atualizarListaContribuicoesEdicao();
        modalContribuicao.style.display = 'none';
        showToast('Contribuição adicionada!');
    }
}

function atualizarListaContribuicoesEdicao() {
    contribuicoesLista.innerHTML = associadoEditando.contribuicoes?.length ? 
        associadoEditando.contribuicoes.sort((a, b) => new Date(b.mesReferencia) - new Date(a.mesReferencia)).map((c, i) => 
            `<div class="payment-item">
                <input type="checkbox" class="contrib-checkbox" data-index="${i}">
                ${formatarMesAno(c.mesReferencia)} - R$ ${c.valor.toFixed(2)}
            </div>`
        ).join('') : 
        '<p>Nenhuma contribuição</p>';
}

async function removerContribuicoesSelecionadas() {
    if (!associadoEditando) return;
    const checkboxes = document.querySelectorAll('.contrib-checkbox:checked');
    if (!checkboxes.length) return alert('Selecione contribuições');
    if (!confirm(`Remover ${checkboxes.length} contribuições?`)) return;
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
    indices.forEach(i => associadoEditando.contribuicoes.splice(i, 1));
    if (await salvarDados()) {
        atualizarListaContribuicoesEdicao();
        showToast('Contribuições removidas!');
    }
}

// ==================== RELATÓRIO DE PAGAMENTOS ====================
function obterTodosPagamentos() {
    const pagamentos = [];
    associados.forEach(associado => {
        if (associado.contribuicoes && associado.contribuicoes.length) {
            associado.contribuicoes.forEach(contrib => {
                const [ano, mes] = contrib.mesReferencia.split('-').map(Number);
                pagamentos.push({
                    numero: associado.numero,
                    nome: associado.nome,
                    telefone: associado.telefone,
                    mesReferencia: contrib.mesReferencia,
                    dataPagamento: contrib.dataPagamento,
                    dia: new Date(contrib.dataPagamento).getDate(),
                    mes: mes,
                    ano: ano,
                    valor: contrib.valor || 0,
                    formaPagamento: contrib.formaPagamento,
                    observacoes: contrib.observacoes || ''
                });
            });
        }
    });
    return pagamentos.sort((a, b) => new Date(b.dataPagamento) - new Date(a.dataPagamento));
}

function filtrarPagamentos(pagamentos) {
    return pagamentos.filter(p => {
        if (filtroAssociadoPag && p.numero != filtroAssociadoPag) return false;
        if (filtroAnoPag && p.ano != filtroAnoPag) return false;
        if (filtroMesPag && p.mes != parseInt(filtroMesPag)) return false;
        if (filtroFormaPag && p.formaPagamento !== filtroFormaPag) return false;
        return true;
    });
}

function popularFiltrosPagamentos() {
    const selAssoc = document.getElementById('filtro-associado-pag');
    if (selAssoc) {
        selAssoc.innerHTML = '<option value="">Todos os associados</option>' + 
            associados.map(a => `<option value="${a.numero}">${a.numero} - ${a.nome}</option>`).join('');
    }
    const anos = new Set();
    associados.forEach(a => {
        a.contribuicoes?.forEach(c => {
            const ano = c.mesReferencia.split('-')[0];
            anos.add(ano);
        });
    });
    const selAno = document.getElementById('filtro-ano-pag');
    if (selAno) {
        selAno.innerHTML = '<option value="">Todos os anos</option>' + 
            Array.from(anos).sort().reverse().map(ano => `<option value="${ano}">${ano}</option>`).join('');
    }
}

function atualizarTabelaPagamentos() {
    const todosPagamentos = obterTodosPagamentos();
    const pagamentosFiltrados = filtrarPagamentos(todosPagamentos);
    const totalValor = pagamentosFiltrados.reduce((sum, p) => sum + p.valor, 0);
    const totalCount = pagamentosFiltrados.length;
    const media = totalCount > 0 ? totalValor / totalCount : 0;
    const associadosUnicos = new Set(pagamentosFiltrados.map(p => p.numero)).size;
    document.getElementById('total-pagamentos-count').textContent = totalCount;
    document.getElementById('total-pagamentos-valor').textContent = formatarValor(totalValor);
    document.getElementById('media-pagamento').textContent = formatarValor(media);
    document.getElementById('associados-com-pagamentos').textContent = associadosUnicos;
    const tbody = document.getElementById('tabela-pagamentos-body');
    if (pagamentosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Nenhum pagamento encontrado com os filtros selecionados.</td></tr>';
        return;
    }
    tbody.innerHTML = pagamentosFiltrados.map(p => `
        <tr>
            <td>${p.numero}</td>
            <td>${p.nome}</td>
            <td>${p.telefone}</td>
            <td>${formatarMesAno(p.mesReferencia)}</td>
            <td>${formatarData(p.dataPagamento)}</td>
            <td>${p.dia}</td>
            <td>${p.mes}</td>
            <td>${p.ano}</td>
            <td>${formatarValor(p.valor)}</td>
            <td>${p.formaPagamento}</td>
            <td>${p.observacoes || '-'}</td>
        </tr>
    `).join('');
}

function aplicarFiltros() {
    filtroAssociadoPag = document.getElementById('filtro-associado-pag').value;
    filtroAnoPag = document.getElementById('filtro-ano-pag').value;
    filtroMesPag = document.getElementById('filtro-mes-pag').value;
    filtroFormaPag = document.getElementById('filtro-forma-pag').value;
    atualizarTabelaPagamentos();
}

function limparFiltros() {
    document.getElementById('filtro-associado-pag').value = '';
    document.getElementById('filtro-ano-pag').value = '';
    document.getElementById('filtro-mes-pag').value = '';
    document.getElementById('filtro-forma-pag').value = '';
    filtroAssociadoPag = '';
    filtroAnoPag = '';
    filtroMesPag = '';
    filtroFormaPag = '';
    atualizarTabelaPagamentos();
}

function exportarPagamentosPDF() {
    const htmlContent = gerarHtmlRelatorioPagamentos();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    iframe.onload = () => {
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    };
}

function exportarPagamentosWord() {
    const htmlContent = gerarHtmlRelatorioPagamentos();
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_pagamentos_${new Date().toISOString().slice(0, 19)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Relatório de pagamentos exportado para Word!');
}

function exportarPagamentosExcel() {
    const todosPagamentos = obterTodosPagamentos();
    const pagamentosFiltrados = filtrarPagamentos(todosPagamentos);
    let csv = "Nº;Associado;Telefone;Mês Referência;Data Pagamento;Dia;Mês;Ano;Valor (R$);Forma Pagamento;Observações\n";
    pagamentosFiltrados.forEach(p => {
        csv += `"${p.numero}";"${p.nome}";"${p.telefone}";"${formatarMesAno(p.mesReferencia)}";"${formatarData(p.dataPagamento)}";${p.dia};${p.mes};${p.ano};${p.valor.toFixed(2)};"${p.formaPagamento}";"${p.observacoes || ''}"\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_pagamentos_${new Date().toISOString().slice(0, 19)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Relatório de pagamentos exportado para Excel!');
}

function gerarHtmlRelatorioPagamentos() {
    const todosPagamentos = obterTodosPagamentos();
    const pagamentosFiltrados = filtrarPagamentos(todosPagamentos);
    const totalValor = pagamentosFiltrados.reduce((sum, p) => sum + p.valor, 0);
    const totalCount = pagamentosFiltrados.length;
    const media = totalCount > 0 ? totalValor / totalCount : 0;
    const associadosUnicos = new Set(pagamentosFiltrados.map(p => p.numero)).size;
    const dataGeracao = new Date().toLocaleString('pt-BR');
    let tituloFiltros = '';
    if (filtroAssociadoPag) {
        const associado = associados.find(a => a.numero == filtroAssociadoPag);
        tituloFiltros += `Associado: ${associado?.nome || filtroAssociadoPag} | `;
    }
    if (filtroAnoPag) tituloFiltros += `Ano: ${filtroAnoPag} | `;
    if (filtroMesPag) tituloFiltros += `Mês: ${filtroMesPag} | `;
    if (filtroFormaPag) tituloFiltros += `Forma: ${filtroFormaPag} | `;
    if (!tituloFiltros) tituloFiltros = 'Todos os pagamentos';
    else tituloFiltros = tituloFiltros.slice(0, -3);
    let html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Relatório de Pagamentos - ${tituloFiltros}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #2c3e50; text-align: center; }
            .header { text-align: center; margin-bottom: 30px; }
            .stats { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
            .stat-box { background: #ecf0f1; padding: 15px; border-radius: 8px; flex: 1; text-align: center; }
            .stat-value { font-size: 1.8rem; font-weight: bold; color: #2c3e50; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #3498db; color: white; }
            .total { font-weight: bold; font-size: 1.2em; margin-top: 20px; }
        </style>
        </head>
        <body>
        <div class="header"><h1>Relatório de Pagamentos - Mensalidades</h1><p>Gerado em: ${dataGeracao}</p><p><strong>Filtros:</strong> ${tituloFiltros}</p></div>
        <div class="stats">
            <div class="stat-box"><div class="stat-value">${totalCount}</div><div>Total de Pagamentos</div></div>
            <div class="stat-box"><div class="stat-value">${formatarValor(totalValor)}</div><div>Valor Total Arrecadado</div></div>
            <div class="stat-box"><div class="stat-value">${formatarValor(media)}</div><div>Valor Médio por Pagamento</div></div>
            <div class="stat-box"><div class="stat-value">${associadosUnicos}</div><div>Associados que Pagaram</div></div>
        </div>
        <table>
            <thead><tr><th>Nº</th><th>Associado</th><th>Telefone</th><th>Mês Referência</th><th>Data Pagamento</th><th>Dia</th><th>Mês</th><th>Ano</th><th>Valor</th><th>Forma Pagamento</th><th>Observações</th></tr></thead>
            <tbody>
                ${pagamentosFiltrados.length ? pagamentosFiltrados.map(p => `
                    <tr>
                        <td>${p.numero}</td>
                        <td>${p.nome}</td>
                        <td>${p.telefone}</td>
                        <td>${formatarMesAno(p.mesReferencia)}</td>
                        <td>${formatarData(p.dataPagamento)}</td>
                        <td>${p.dia}</td>
                        <td>${p.mes}</td>
                        <td>${p.ano}</td>
                        <td>${formatarValor(p.valor)}</td>
                        <td>${p.formaPagamento}</td>
                        <td>${p.observacoes || '-'}</td>
                    </tr>
                `).join('') : '<tr><td colspan="11" style="text-align:center;">Nenhum pagamento encontrado</td></tr>'}
            </tbody>
        </table>
        <div class="total">Total de Registros: ${totalCount}</div>
        </body></html>
    `;
    return html;
}

function exportarRelatorioPDF() {
    const html = gerarHtmlRelatorioPagamentos();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    };
}

function exportarRelatorioWord() {
    const html = gerarHtmlRelatorioPagamentos();
    const blob = new Blob([html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'relatorio_pagamentos.doc';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Relatório exportado para Word!');
}

function exportarRelatorioExcel() {
    const pagamentos = obterTodosPagamentos();
    const filtrados = filtrarPagamentos(pagamentos);
    let csv = "Nº;Associado;Telefone;Mês Referência;Data Pagamento;Dia;Mês;Ano;Valor (R$);Forma Pagamento;Observações\n";
    filtrados.forEach(p => {
        csv += `"${p.numero}";"${p.nome}";"${p.telefone}";"${formatarMesAno(p.mesReferencia)}";"${formatarData(p.dataPagamento)}";${p.dia};${p.mes};${p.ano};${p.valor.toFixed(2)};"${p.formaPagamento}";"${p.observacoes || ''}"\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_pagamentos.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Relatório exportado para Excel!');
}

// ==================== FUNÇÕES DE MENSAGENS AGENDADAS ====================
function atualizarListaMensagensAgendadas() {
    const container = document.getElementById('mensagens-agendadas-container');
    const lista = document.getElementById('lista-mensagens-agendadas');
    if (!lista) return;
    if (!scheduledMessages.length) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    lista.innerHTML = scheduledMessages.map((m, i) => `
        <div class="mensagem-agendada" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #ddd;">
            <div>
                <strong>${formatarDataHora(m.data)}</strong>
                <br><small>${m.associados.length} associados</small>
            </div>
            <button class="btn-danger" onclick="cancelarMensagemAgendada(${i})">❌</button>
        </div>
    `).join('');
}

function formatarDataHora(d) {
    return d ? new Date(d).toLocaleString('pt-BR') : '-';
}

async function cancelarMensagemAgendada(index) {
    if (!confirm('Cancelar esta mensagem?')) return;
    scheduledMessages.splice(index, 1);
    if (await salvarDados()) {
        atualizarListaMensagensAgendadas();
        showToast('Mensagem cancelada');
    }
}

async function verificarMensagensAgendadas() {
    const agora = new Date();
    let enviadas = false;
    for (let i = scheduledMessages.length - 1; i >= 0; i--) {
        const m = scheduledMessages[i];
        if (new Date(m.data) <= agora) {
            const associadosEnviar = associados.filter(a => m.associados.includes(a.numero));
            if (associadosEnviar.length && m.tipo === 'automatico') {
                let idx = 0;
                const enviar = () => {
                    if (idx >= associadosEnviar.length) return;
                    const a = associadosEnviar[idx];
                    window.open(gerarLinkWhatsApp(a.telefone, m.mensagem, a.nome), '_blank');
                    idx++;
                    if (idx < associadosEnviar.length) setTimeout(enviar, 5000);
                };
                enviar();
            }
            scheduledMessages.splice(i, 1);
            enviadas = true;
        }
    }
    if (enviadas) {
        await salvarDados();
        atualizarListaMensagensAgendadas();
    }
}

function iniciarVerificacaoMensagensAgendadas() {
    if (intervaloVerificacao) clearInterval(intervaloVerificacao);
    intervaloVerificacao = setInterval(verificarMensagensAgendadas, 30000);
}

function gerarListaNumeros() {
    if (!associadosPendentes.length) return alert('Sem pendentes');
    document.getElementById('numeros-list').innerHTML = associadosPendentes.map(a => 
        `<div class="numero-item">${a.nome} - ${a.telefone}</div>`
    ).join('');
    document.getElementById('numeros-container').style.display = 'block';
    document.getElementById('links-container').style.display = 'none';
    document.getElementById('numeros-container').scrollIntoView({ behavior: 'smooth' });
}

function copiarNumeros() {
    const texto = associadosPendentes.map(a => a.telefone.replace(/\D/g, '')).join('\n');
    navigator.clipboard.writeText(texto).then(() => showToast('Números copiados!')).catch(() => alert('Copie manualmente: ' + texto));
}

function gerarLinks() {
    if (!associadosPendentes.length) return alert('Sem pendentes');
    document.getElementById('links-list').innerHTML = associadosPendentes.map(a => {
        const link = gerarLinkWhatsApp(a.telefone, mensagemTemplate.value, a.nome);
        return `<div class="numero-item"><a href="${link}" target="_blank" style="word-break:break-all;">${a.nome}: ${link}</a></div>`;
    }).join('');
    document.getElementById('links-container').style.display = 'block';
}

// ==================== LOGIN ====================
async function loginAssociadoSubmit(e) {
    e.preventDefault();
    await carregarDados();
    const numero = parseInt(document.getElementById('numero-associado').value);
    const telefone = document.getElementById('telefone-login').value.replace(/\D/g, '');
    const associado = associados.find(a => a.numero === numero && a.telefone.replace(/\D/g, '') === telefone);
    if (associado) {
        currentUser = associado;
        isAdmin = false;
        showMainSystem();
        showToast('Login realizado com sucesso!');
    } else {
        showToast('Associado não encontrado.', 'error');
    }
}

async function loginAdminSubmit(e) {
    e.preventDefault();
    await carregarDados();
    if (document.getElementById('senha-admin').value === 'associacao2024') {
        currentUser = { nome: 'Administrador' };
        isAdmin = true;
        showMainSystem();
        showToast('Login administrativo realizado!');
    } else {
        showToast('Senha incorreta.', 'error');
    }
}

function showMainSystem() {
    loginScreen.style.display = 'none';
    mainSystem.style.display = 'block';
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('isAdmin', isAdmin.toString());
    if (isAdmin) {
        userType.textContent = 'Modo Administrador';
        userWelcome.textContent = 'Bem-vindo, Administrador';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.associado-only').forEach(el => el.style.display = 'none');
        document.getElementById('quick-nav-admin').style.display = isMobile ? 'none' : 'flex';
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('.tab.admin-only').classList.add('active');
        document.getElementById('cadastro-tab').classList.add('active');
        atualizarSeletorAssociados();
        atualizarListaAssociados();
        atualizarListaPendentes();
        atualizarListaMensagensAgendadas();
        popularSelectMeses();
        atualizarRelatorios();
        popularFiltrosPagamentos();
        atualizarTabelaPagamentos();
    } else {
        userType.textContent = 'Área do Associado';
        userWelcome.textContent = `Bem-vindo, ${currentUser.nome}`;
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.associado-only').forEach(el => el.style.display = 'block');
        document.getElementById('associado-info-detail').innerHTML = `
            <p><strong>Número:</strong> ${currentUser.numero}</p>
            <p><strong>Nome:</strong> ${currentUser.nome}</p>
            <p><strong>Telefone:</strong> ${currentUser.telefone}</p>
            <p><strong>Data de Cadastro:</strong> ${formatarData(currentUser.dataCadastro)}</p>
            <p><strong>Forma de Pagamento:</strong> ${currentUser.formaPagamento}</p>
        `;
        const status = calcularStatusPagamento(currentUser);
        document.getElementById('associado-info-detail').innerHTML += `<p><strong>Status:</strong> <span class="${status.classe}">${status.texto}</span></p>`;
        statusDetalhes.innerHTML = '<div class="status-item"><div class="status-valor">0</div><div class="status-label">Carregando...</div></div>';
        const contribuicoesHTML = currentUser.contribuicoes?.length ? 
            currentUser.contribuicoes.sort((a, b) => new Date(b.dataPagamento) - new Date(a.dataPagamento)).map(contrib => 
                `<div class="payment-item">
                    <div><strong>${formatarMesAno(contrib.mesReferencia)}</strong><br><small>Pago: ${formatarData(contrib.dataPagamento)}</small></div>
                    <div><strong>R$ ${contrib.valor?.toFixed(2) || '0,00'}</strong><br><small>${contrib.formaPagamento}</small></div>
                </div>`
            ).join('') : 
            '<p>Nenhuma contribuição registrada.</p>';
        document.getElementById('minhas-contribuicoes-list').innerHTML = contribuicoesHTML;
        atualizarGradeMesesCompleta(currentUser);
    }
}

function atualizarGradeMesesCompleta(associado) {
    if (!monthsContainer) return;
    monthsContainer.innerHTML = '';
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const dataCadastro = new Date(associado.dataCadastro + 'T12:00:00');
    const anoCadastro = dataCadastro.getFullYear();
    const mesCadastro = dataCadastro.getMonth() + 1;
    const anoInicio = anoCadastro;
    const anoFim = anoAtual + 1;
    const anos = [];
    for (let ano = anoFim; ano >= anoInicio; ano--) anos.push(ano);
    const mesesAbreviados = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    anos.forEach(ano => {
        const yearSection = document.createElement('div');
        yearSection.className = 'year-section';
        yearSection.innerHTML = `<div class="year-title">${ano} ${ano === anoAtual ? '(Atual)' : ano > anoAtual ? '(Futuro)' : ''}</div>`;
        const monthsGrid = document.createElement('div');
        monthsGrid.className = 'months-grid';
        for (let mes = 1; mes <= 12; mes++) {
            if (ano === anoCadastro && mes < mesCadastro) continue;
            const mesAno = `${ano}-${mes.toString().padStart(2, '0')}`;
            const contrib = associado.contribuicoes?.find(c => c.mesReferencia === mesAno);
            const monthDiv = document.createElement('div');
            monthDiv.className = 'month-item';
            if (ano === anoAtual && mes === mesAtual) monthDiv.classList.add('atual');
            let status = 'futuro', statusText = 'Futuro';
            if (contrib) { status = 'pago'; statusText = 'Pago'; }
            else if (ano < anoAtual || (ano === anoAtual && mes < mesAtual)) { status = 'pendente'; statusText = 'Pendente'; }
            monthDiv.classList.add(status);
            monthDiv.innerHTML = `<div class="mes-nome">${mesesAbreviados[mes - 1]}</div><div class="status-info">${statusText}</div>`;
            monthsGrid.appendChild(monthDiv);
        }
        yearSection.appendChild(monthsGrid);
        monthsContainer.appendChild(yearSection);
    });
}

function logout() {
    currentUser = null;
    isAdmin = false;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAdmin');
    mainSystem.style.display = 'none';
    loginScreen.style.display = 'block';
    if (intervaloVerificacao) clearInterval(intervaloVerificacao);
}

// ==================== EVENTOS ====================
document.addEventListener('DOMContentLoaded', async function() {
    await carregarDados();
    carregarAutorizacao();
    
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isAdmin = localStorage.getItem('isAdmin') === 'true';
        showMainSystem();
    }
    
    if (document.getElementById('data-cadastro')) {
        document.getElementById('data-cadastro').valueAsDate = new Date();
    }
    if (dataProgramada) {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(9, 0, 0, 0);
        dataProgramada.value = amanha.toISOString().slice(0, 16);
    }
    
    // Eventos de login
    document.getElementById('btn-acesso-associado').addEventListener('click', () => {
        document.getElementById('login-associado').style.display = 'block';
        document.getElementById('login-admin').style.display = 'none';
    });
    document.getElementById('btn-acesso-admin').addEventListener('click', () => {
        document.getElementById('login-admin').style.display = 'block';
        document.getElementById('login-associado').style.display = 'none';
    });
    document.getElementById('login-form-associado').addEventListener('submit', loginAssociadoSubmit);
    document.getElementById('login-form-admin').addEventListener('submit', loginAdminSubmit);
    logoutBtn.addEventListener('click', logout);
    
    // Formatação de telefone
    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.substring(0, 11);
            if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            else if (value.length > 2) value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
            else if (value.length > 0) value = value.replace(/^(\d{0,2})/, '($1');
            e.target.value = value;
        });
    });
    
    // Tabs
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', function() {
            if (this.classList.contains('active')) return;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('active');
            if (this.getAttribute('data-tab') === 'contribuicoes') atualizarSeletorAssociados();
            else if (this.getAttribute('data-tab') === 'consulta') atualizarListaAssociados();
            else if (this.getAttribute('data-tab') === 'mensagens') atualizarListaPendentes();
            else if (this.getAttribute('data-tab') === 'pagamentos') {
                popularFiltrosPagamentos();
                atualizarTabelaPagamentos();
            } else if (this.getAttribute('data-tab') === 'minhas-contribuicoes' && currentUser && !isAdmin) {
                // recarregar dados
                atualizarGradeMesesCompleta(currentUser);
            } else if (this.getAttribute('data-tab') === 'relatorios') {
                popularSelectMeses();
                atualizarRelatorios();
            }
        });
    });
    
    // Eventos do formulário de cadastro
    document.getElementById('cadastro-form').addEventListener('submit', cadastrarAssociado);
    document.getElementById('search-input').addEventListener('input', () => {
        currentPage = 1;
        atualizarListaAssociados();
    });
    
    // Eventos de mensagens
    document.getElementById('gerar-lista-btn').addEventListener('click', gerarListaNumeros);
    document.getElementById('copiar-numeros-btn').addEventListener('click', copiarNumeros);
    document.getElementById('gerar-links-btn').addEventListener('click', gerarLinks);
    document.getElementById('abrir-whatsapp-btn').addEventListener('click', () => {
        if (isMobile) window.location.href = 'https://wa.me';
        else window.open('https://web.whatsapp.com', '_blank');
    });
    
    document.getElementById('enviar-todos-btn').addEventListener('click', () => {
        if (associadosPendentes.length) {
            associadosPendentes.forEach((a, i) => {
                setTimeout(() => enviarWhatsAppUniversal(a.telefone, mensagemTemplate.value, a.nome), i * 2000);
            });
            showToast('Iniciando envio manual...');
        }
    });
    
    document.getElementById('enviar-audio-btn').addEventListener('click', () => {
        if (associadosPendentes.length) {
            associadosPendentes.forEach((a, i) => {
                setTimeout(() => enviarAudio(a.telefone, mensagemTemplate.value, a.nome), i * 2000);
            });
            showToast('Enviando áudio texto...');
        }
    });
    
    // Eventos de contribuições
    associadoSelect.addEventListener('change', selecionarAssociado);
    contribuicaoForm.addEventListener('submit', registrarContribuicao);
    formEditar.addEventListener('submit', salvarEdicaoAssociado);
    document.getElementById('btn-cancelar-edicao').addEventListener('click', () => modalEditar.style.display = 'none');
    document.getElementById('btn-adicionar-contribuicao').addEventListener('click', abrirModalContribuicao);
    document.getElementById('btn-remover-contribuicao').addEventListener('click', removerContribuicoesSelecionadas);
    formNovaContribuicao.addEventListener('submit', adicionarNovaContribuicao);
    document.getElementById('btn-cancelar-contribuicao').addEventListener('click', () => modalContribuicao.style.display = 'none');
    
    // Eventos de relatórios
    document.getElementById('mes-relatorio').addEventListener('change', atualizarRelatorios);
    document.getElementById('btn-exportar-pdf').addEventListener('click', exportarRelatorioPDF);
    document.getElementById('btn-exportar-word').addEventListener('click', exportarRelatorioWord);
    document.getElementById('btn-exportar-excel').addEventListener('click', () => {
        const pagamentos = obterTodosPagamentos();
        const filtrados = filtrarPagamentos(pagamentos);
        let csv = "Mês/Ano;Total;Quantidade;Média\n";
        const meses = document.querySelectorAll('#relatorio-arrecadacao-meses-body tr');
        meses.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length) csv += `${tds[0].innerText};${tds[1].innerText};${tds[2].innerText};${tds[3].innerText}\n`;
        });
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'arrecadacao.csv';
        link.click();
    });
    
    // Eventos de tipo de envio
    document.querySelectorAll('input[name="tipo-envio"]').forEach(option => {
        option.addEventListener('change', function() {
            document.getElementById('info-manual').style.display = this.value === 'manual' ? 'block' : 'none';
            document.getElementById('info-automatico').style.display = this.value === 'automatico' ? 'block' : 'none';
        });
    });
    
    // Eventos de áudio
    btnAutorizarWhatsapp.addEventListener('click', autorizarWhatsapp);
    btnRecordAudio.addEventListener('click', iniciarGravacao);
    btnStopRecording.addEventListener('click', pararGravacao);
    btnPlayRecorded.addEventListener('click', reproduzirAudio);
    btnSendAudioRecorded.addEventListener('click', enviarAudioGravadoParaPendentes);
    enviarAutomaticoBtn.addEventListener('click', iniciarEnvioAutomatico);
    pararEnvioBtn.addEventListener('click', pararEnvio);
    
    // Eventos de pagamentos
    document.getElementById('aplicar-filtros-pag').addEventListener('click', aplicarFiltros);
    document.getElementById('limpar-filtros-pag').addEventListener('click', limparFiltros);
    document.getElementById('btn-exportar-pagamentos-pdf').addEventListener('click', exportarPagamentosPDF);
    document.getElementById('btn-exportar-pagamentos-word').addEventListener('click', exportarPagamentosWord);
    document.getElementById('btn-exportar-pagamentos-excel').addEventListener('click', exportarPagamentosExcel);
    
    // FAB WhatsApp
    if (document.getElementById('fab-whatsapp') && isMobile) {
        document.getElementById('fab-whatsapp').style.display = 'flex';
    }
    document.getElementById('fab-whatsapp')?.addEventListener('click', () => {
        document.querySelector('.tab[data-tab="mensagens"]')?.click();
    });
    
    iniciarVerificacaoMensagensAgendadas();
    verificarMensagensAgendadas();
});