/**
 * 99_Testes_E2E.gs
 * ============================================================
 * Fluxo funcional completo, com assert em cada passo.
 *
 * Cobre as seções 3, 4, 5 e a parte automatizável da 2 do
 * PLANO_DE_TESTES.md, na ordem em que as coisas acontecem de
 * verdade: despesa → compra → abertura de box → venda → retirada.
 *
 * ⚠️ ESTE ARQUIVO ESCREVE NA PLANILHA.
 * Só insere: nunca apaga nem edita linha existente. Todo registro
 * criado leva 'E2E' no nome/descrição para ser fácil de identificar
 * depois. Rodar em HML. Em produção, só se você souber exatamente
 * por quê.
 *
 * Por que E2E em vez de mais testes de unidade: os asserts de
 * retirada máxima e reserva mínima do 99_Testes_Socios.js passam
 * hoje sem exercitar a regra, porque não há lucro atribuído a
 * ninguém. Só um fluxo que gera venda de verdade coloca lucro na
 * mesa e faz esses limites significarem alguma coisa.
 * ============================================================
 */

// ============================================================
// INFRAESTRUTURA
// ============================================================

var E2E_NEGOCIO = 'Pokémon TCG';
var E2E_PRODUTO_BOX = 'E2E Box de Teste';
var E2E_PRODUTO_BOOSTER = 'E2E Booster de Teste';
var E2E_BOOSTERS_POR_BOX = 6;

function _e2eFalhar_(passo, mensagem, contexto) {
  throw new Error('FALHA E2E [' + passo + ']: ' + mensagem +
    (contexto ? ' | ' + JSON.stringify(contexto) : ''));
}

/**
 * Exige número finito. Mesmo motivo do 99_Testes_Compra.js: NaN e
 * undefined passam em qualquer comparação, então um campo renomeado
 * deixaria o teste verde sem conferir nada.
 */
function _e2eNum_(valor, ondeVeio, passo) {
  if (typeof valor !== 'number' || !isFinite(valor)) {
    _e2eFalhar_(passo || 'geral', 'valor não numérico onde se esperava número',
      { origem: ondeVeio, valor: String(valor), tipo: typeof valor });
  }
  return valor;
}

function _e2eIdReq_(sufixo) {
  return 'E2E-' + sufixo + '-' + Utils.timestampCompacto() + '-' + Math.floor(Math.random() * 1000);
}

function _e2eHoje_() {
  return Utils.formatarData(new Date());
}

function _e2eLote_(idLote) {
  var reg = SheetService.buscarPrimeiroPorCampo(CONFIG.ABAS.LOTES_ESTOQUE,
    CONFIG.CAMPOS.LOTES_ESTOQUE.ID_LOTE, idLote);
  return reg ? reg.dados : null;
}

function _e2eProdutoPorNome_(nome) {
  var C = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var produtos = SheetService.getDadosComoObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS);
  for (var i = 0; i < produtos.length; i++) {
    if (produtos[i][C.NOME_PRODUTO] === nome) return produtos[i];
  }
  return null;
}

// ============================================================
// PASSO 0 — MASSA DE PRODUTOS
// ============================================================

/**
 * Garante que existem o box fracionável e o booster que ele gera.
 * Idempotente: se já existirem, reaproveita.
 *
 * O booster precisa ser cadastrado ANTES do box, porque o box o
 * referencia como Produto Gerado Padrão.
 */
function e2ePrepararProdutos() {
  var C = CONFIG.CAMPOS.PRODUTOS_ATIVOS;

  var booster = _e2eProdutoPorNome_(E2E_PRODUTO_BOOSTER);
  if (!booster) {
    var rb = ProdutoService.cadastrar({
      negocio: E2E_NEGOCIO,
      nomeProduto: E2E_PRODUTO_BOOSTER,
      tipoModelo: 'Booster',
      colecaoJogo: 'Coleção E2E',
      estadoCondicao: 'Novo/Lacrado',
      unidadeControle: 'Unidade',
      fracionavel: 'Não'
    });
    if (!rb.sucesso) _e2eFalhar_('produtos', 'não consegui cadastrar o booster de teste', rb);
    booster = _e2eProdutoPorNome_(E2E_PRODUTO_BOOSTER);
  }

  // Reaproveita um box de teste anterior SÓ se ele realmente servir para
  // abertura. Uma rodada antiga pode ter deixado um box gravado como não
  // fracionável (foi o que o bug de comparação de 'Sim'/'sim' causava), e
  // reaproveitá-lo faria o teste falhar num passo adiante, longe da causa.
  // Como a planilha é protegida, não dá para corrigir o registro velho
  // daqui — então cadastra um novo, com nome próprio.
  var box = null;
  var candidatos = SheetService.getDadosComoObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS)
    .filter(function(p) {
      return String(p[C.NOME_PRODUTO] || '').indexOf(E2E_PRODUTO_BOX) === 0;
    });

  for (var i = 0; i < candidatos.length; i++) {
    var val = ProdutoService.validarParaAbertura(candidatos[i][C.ID_PRODUTO]);
    if (val.valido) { box = candidatos[i]; break; }
  }

  var boxReaproveitado = !!box;
  if (!box) {
    var nomeBoxNovo = candidatos.length === 0
      ? E2E_PRODUTO_BOX
      : E2E_PRODUTO_BOX + ' ' + Utils.timestampCompacto();

    var rx = ProdutoService.cadastrar({
      negocio: E2E_NEGOCIO,
      nomeProduto: nomeBoxNovo,
      tipoModelo: 'Box',
      colecaoJogo: 'Coleção E2E',
      estadoCondicao: 'Novo/Lacrado',
      unidadeControle: 'Caixa',
      fracionavel: 'Sim',
      qtdGeradaPadrao: E2E_BOOSTERS_POR_BOX,
      produtoGeradoPadrao: booster[C.ID_PRODUTO]
    });
    if (!rx.sucesso) _e2eFalhar_('produtos', 'não consegui cadastrar o box de teste', rx);
    box = _e2eProdutoPorNome_(nomeBoxNovo);
  }

  // Falha aqui, e não três passos adiante, se o box não servir para abrir.
  var checagem = ProdutoService.validarParaAbertura(box[C.ID_PRODUTO]);
  if (!checagem.valido) {
    _e2eFalhar_('produtos', 'o box de teste não passa na validação de abertura',
      { produto: box[C.NOME_PRODUTO], erro: checagem.erro });
  }

  return {
    idBox: box[C.ID_PRODUTO],
    idBooster: booster[C.ID_PRODUTO],
    nomeBox: box[C.NOME_PRODUTO],
    nomeBooster: booster[C.NOME_PRODUTO],
    boxReaproveitado: boxReaproveitado
  };
}

// ============================================================
// SEÇÃO 3 — DESPESAS
// ============================================================

/**
 * Despesa Fixa, Variável e a rejeição de natureza ausente.
 *
 * O terceiro caso é o que tem valor: se alguém remover a validação
 * de natureza, as duas primeiras continuariam passando.
 */
function e2eDespesas() {
  var fixa = FinanceiroService.registrarDespesa({
    idRequisicao: _e2eIdReq_('DESP-FIX'),
    data: _e2eHoje_(),
    negocio: E2E_NEGOCIO,
    categoria: 'Operacional',
    natureza: 'Fixa',
    valor: 40,
    descricao: 'E2E despesa fixa',
    observacao: 'Massa de teste E2E'
  });
  if (!fixa.sucesso) _e2eFalhar_('despesas', 'despesa Fixa deveria ter sido aceita', fixa);

  var variavel = FinanceiroService.registrarDespesa({
    idRequisicao: _e2eIdReq_('DESP-VAR'),
    data: _e2eHoje_(),
    negocio: E2E_NEGOCIO,
    categoria: 'Operacional',
    natureza: 'Variável',
    valor: 25,
    descricao: 'E2E despesa variável',
    observacao: 'Massa de teste E2E'
  });
  if (!variavel.sucesso) _e2eFalhar_('despesas', 'despesa Variável deveria ter sido aceita', variavel);

  var semNatureza = FinanceiroService.registrarDespesa({
    idRequisicao: _e2eIdReq_('DESP-SEM'),
    data: _e2eHoje_(),
    negocio: E2E_NEGOCIO,
    categoria: 'Operacional',
    valor: 10,
    descricao: 'E2E despesa sem natureza — deve bloquear'
  });
  if (semNatureza.sucesso) {
    _e2eFalhar_('despesas', 'despesa SEM natureza foi aceita (deveria bloquear)', semNatureza);
  }

  return { fixa: fixa.id, variavel: variavel.id, semNaturezaBloqueada: true };
}

// ============================================================
// SEÇÃO 4 — COMPRA COM RATEIO
// ============================================================

/**
 * Compra de 2 box + 2 booster com frete, conferindo o rateio já
 * gravado nos lotes — não na prévia. É o passo que prova que o
 * custo que chega ao estoque é o mesmo que o cálculo prometeu.
 *
 * Bruto: box 2×100 = 200, booster 2×50 = 100. Total 300.
 * Frete 30 → box 20, booster 10.
 * Lote box: custo total 220, unitário 110.
 * Lote booster: custo total 110, unitário 55.
 */
function e2eCompra(ids) {
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;

  var res = CompraService.salvarCompra({
    idRequisicao: _e2eIdReq_('COMPRA'),
    cabecalho: {
      dataCompra: _e2eHoje_(),
      negocio: E2E_NEGOCIO,
      fornecedor: 'Fornecedor E2E',
      frete: 30, taxas: 0, desconto: 0,
      observacao: 'Compra E2E'
    },
    itens: [
      { idProduto: ids.idBox,     quantidade: 2, valorUnitarioBruto: 100 },
      { idProduto: ids.idBooster, quantidade: 2, valorUnitarioBruto: 50 }
    ]
  });

  if (!res.sucesso) _e2eFalhar_('compra', 'compra deveria ter sido aceita', res);
  if (!res.idsLotes || res.idsLotes.length !== 2) {
    _e2eFalhar_('compra', 'esperava 2 lotes criados', res);
  }

  var loteBox = _e2eLote_(res.idsLotes[0]);
  var loteBooster = _e2eLote_(res.idsLotes[1]);
  if (!loteBox || !loteBooster) _e2eFalhar_('compra', 'lote gravado não encontrado', res.idsLotes);

  var custoTotalBox = _e2eNum_(parseFloat(loteBox[C.CUSTO_TOTAL]), 'loteBox.custoTotal', 'compra');
  var custoTotalBoo = _e2eNum_(parseFloat(loteBooster[C.CUSTO_TOTAL]), 'loteBooster.custoTotal', 'compra');
  var custoUnitBox = _e2eNum_(parseFloat(loteBox[C.CUSTO_UNIT]), 'loteBox.custoUnit', 'compra');

  // O frete tem que ter chegado ao estoque, rateado por valor.
  if (Math.abs(custoTotalBox - 220) > 0.01) {
    _e2eFalhar_('compra', 'custo total do lote de box deveria ser 220 (200 + 20 de frete)',
      { encontrado: custoTotalBox });
  }
  if (Math.abs(custoTotalBoo - 110) > 0.01) {
    _e2eFalhar_('compra', 'custo total do lote de booster deveria ser 110 (100 + 10 de frete)',
      { encontrado: custoTotalBoo });
  }
  if (Math.abs(custoUnitBox - 110) > 0.01) {
    _e2eFalhar_('compra', 'custo unitário do box deveria ser 110', { encontrado: custoUnitBox });
  }
  // Nada evapora entre o cálculo e o estoque.
  if (Math.abs((custoTotalBox + custoTotalBoo) - 330) > 0.01) {
    _e2eFalhar_('compra', 'soma dos custos dos lotes não fecha com o custo total da compra',
      { esperado: 330, encontrado: custoTotalBox + custoTotalBoo });
  }

  return {
    idCompra: res.idCompra,
    idLoteBox: res.idsLotes[0],
    idLoteBooster: res.idsLotes[1],
    custoUnitBox: custoUnitBox
  };
}

/**
 * Compra com produto inativo deve bloquear.
 * Sem produto inativo cadastrado, o passo é pulado — não inventa
 * massa de dado só para ter o que testar.
 */
function e2eCompraProdutoInativo() {
  var C = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var produtos = SheetService.getDadosComoObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS);
  var inativo = null;
  for (var i = 0; i < produtos.length; i++) {
    if (Utils.normalizar(produtos[i][C.ATIVO] || '') !== 'Sim') { inativo = produtos[i]; break; }
  }
  if (!inativo) return { pulado: true, motivo: 'Nenhum produto inativo cadastrado para testar o bloqueio.' };

  var res = CompraService.salvarCompra({
    idRequisicao: _e2eIdReq_('COMPRA-INATIVO'),
    cabecalho: {
      dataCompra: _e2eHoje_(), negocio: E2E_NEGOCIO, fornecedor: 'Fornecedor E2E',
      frete: 0, taxas: 0, desconto: 0, observacao: 'Deve bloquear'
    },
    itens: [{ idProduto: inativo[C.ID_PRODUTO], quantidade: 1, valorUnitarioBruto: 10 }]
  });

  if (res.sucesso) {
    _e2eFalhar_('compra-inativo', 'compra com produto inativo foi aceita (deveria bloquear)', res);
  }
  return { pulado: false, bloqueou: true, produto: inativo[C.NOME_PRODUTO] };
}

// ============================================================
// SEÇÃO 4 — ABERTURA DE BOX
// ============================================================

/**
 * Abre 1 box e confere a regra que mais importa aqui: **abertura
 * transforma custo, não cria valor**. O custo consumido do lote de
 * origem tem que reaparecer inteiro no lote de destino, e nada
 * disso pode virar receita ou lucro.
 */
function e2eAbertura(ids) {
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var A = CONFIG.CAMPOS.POKEMON_ABERTURA_BOX;

  // Fotografa os lotes disponíveis do box ANTES de abrir.
  //
  // registrarAberturaPorProduto escolhe o lote mais antigo por FIFO, que
  // não é necessariamente o que a compra desta rodada criou — rodadas
  // anteriores deixam lotes de box para trás. Conferir o lote da compra
  // daria falso negativo. Então o assert é sobre o lote que o serviço
  // realmente consumiu, e de quebra confere que ele escolheu o mais antigo.
  var disponiveisAntes = EstoqueService.listarLotesDisponiveisPorProduto(ids.idBox);
  if (disponiveisAntes.length === 0) {
    _e2eFalhar_('abertura', 'nenhum lote de box disponível para abrir', { idBox: ids.idBox });
  }
  var saldoAntesPorLote = {};
  disponiveisAntes.forEach(function(l) { saldoAntesPorLote[l.idLote] = l.qtdDisponivel; });
  var maisAntigoEsperado = disponiveisAntes[0].idLote;

  var vendasAntes = SheetService.contarLinhas(CONFIG.ABAS.VENDAS);

  var res = EstoqueService.registrarAberturaPorProduto({
    idProduto: ids.idBox,
    qtdAbrir: 1,
    qtdGeradaPorUnidade: E2E_BOOSTERS_POR_BOX,
    dataAbertura: _e2eHoje_(),
    observacao: 'Abertura E2E'
  });
  if (!res.sucesso) _e2eFalhar_('abertura', 'abertura deveria ter sido aceita', res);

  // Qual lote foi realmente consumido
  var regAberturaOrigem = SheetService.buscarPrimeiroPorCampo(CONFIG.ABAS.POKEMON_ABERTURA_BOX,
    A.ID_ABERTURA, res.idAbertura);
  if (!regAberturaOrigem) _e2eFalhar_('abertura', 'linha de abertura não encontrada', res);
  var idOrigemUsado = regAberturaOrigem.dados[A.ID_LOTE_ORIGEM];

  // FIFO: tem que ter escolhido o lote mais antigo disponível
  if (idOrigemUsado !== maisAntigoEsperado) {
    _e2eFalhar_('abertura', 'abertura não consumiu o lote mais antigo (FIFO)',
      { esperado: maisAntigoEsperado, consumido: idOrigemUsado });
  }

  // Origem baixou exatamente 1
  var dispAntes = _e2eNum_(saldoAntesPorLote[idOrigemUsado], 'saldoAntes do lote consumido', 'abertura');
  var loteDepois = _e2eLote_(idOrigemUsado);
  var dispDepois = _e2eNum_(parseFloat(loteDepois[C.QTD_DISPONIVEL]), 'loteOrigem.qtdDisponivel', 'abertura');
  if (Math.abs(dispDepois - (dispAntes - 1)) > 0.0001) {
    _e2eFalhar_('abertura', 'lote de origem não baixou exatamente 1 unidade',
      { lote: idOrigemUsado, antes: dispAntes, depois: dispDepois });
  }

  // Destino criado com a quantidade gerada
  var destino = _e2eLote_(res.idLoteDestino);
  if (!destino) _e2eFalhar_('abertura', 'lote de destino não foi criado', res);
  var qtdDestino = _e2eNum_(parseFloat(destino[C.QTD_DISPONIVEL]), 'loteDestino.qtdDisponivel', 'abertura');
  if (qtdDestino !== E2E_BOOSTERS_POR_BOX) {
    _e2eFalhar_('abertura', 'lote de destino deveria ter ' + E2E_BOOSTERS_POR_BOX + ' unidades',
      { encontrado: qtdDestino });
  }

  // Custo preservado: o que saiu do box tem que estar inteiro nos boosters
  var consumido = _e2eNum_(parseFloat(regAberturaOrigem.dados[A.CUSTO_TOTAL_CONSUMIDO]), 'abertura.custoConsumido', 'abertura');
  var custoUnitDestino = _e2eNum_(parseFloat(regAberturaOrigem.dados[A.CUSTO_UNIT_DESTINO]), 'abertura.custoUnitDestino', 'abertura');
  var recomposto = Utils.arredondar(custoUnitDestino * E2E_BOOSTERS_POR_BOX, 2);

  // Referência é o custo do lote realmente consumido, não o da compra desta
  // rodada — por FIFO podem ser lotes diferentes.
  var custoUnitOrigem = _e2eNum_(parseFloat(loteDepois[C.CUSTO_UNIT]), 'loteOrigem.custoUnit', 'abertura');
  if (Math.abs(consumido - custoUnitOrigem) > 0.01) {
    _e2eFalhar_('abertura', 'custo consumido deveria ser o custo unitário do lote de origem × 1',
      { esperado: custoUnitOrigem, encontrado: consumido });
  }
  if (Math.abs(recomposto - consumido) > 0.02) {
    _e2eFalhar_('abertura', 'custo não foi preservado na abertura: o que saiu do box não bate com o que entrou nos boosters',
      { consumido: consumido, recompostoNoDestino: recomposto });
  }

  // Abertura não é venda
  var vendasDepois = SheetService.contarLinhas(CONFIG.ABAS.VENDAS);
  if (vendasDepois !== vendasAntes) {
    _e2eFalhar_('abertura', 'abertura de box criou linha em Vendas — não pode virar receita',
      { antes: vendasAntes, depois: vendasDepois });
  }

  return {
    idAbertura: res.idAbertura,
    idLoteDestino: res.idLoteDestino,
    custoConsumido: consumido,
    custoUnitDestino: custoUnitDestino
  };
}

// ============================================================
// SEÇÃO 5 — VENDAS
// ============================================================

/**
 * Vende 2 boosters do lote recém-aberto e confere que o lucro foi
 * reconhecido e distribuído na participação vigente.
 */
function e2eVenda(ids, abertura) {
  var C_LIS = CONFIG.CAMPOS.LUCRO_POR_ITEM_SOCIO;

  var precoUnit = Utils.arredondar(abertura.custoUnitDestino + 20, 2);
  var qtd = 2;

  var res = VendaService.salvarVenda({
    idRequisicao: _e2eIdReq_('VENDA'),
    cabecalho: {
      dataVenda: _e2eHoje_(), negocio: E2E_NEGOCIO, cliente: 'Cliente E2E',
      taxaVenda: 0, freteVenda: 0, descontoVenda: 0, observacao: 'Venda E2E'
    },
    itens: [{ idProduto: ids.idBooster, quantidade: qtd, valorUnitarioVenda: precoUnit }]
  });
  if (!res.sucesso) _e2eFalhar_('venda', 'venda deveria ter sido aceita', res);

  // Lucro reconhecido por sócio
  var linhas = SheetService.buscarPorCampo(CONFIG.ABAS.LUCRO_POR_ITEM_SOCIO, C_LIS.ID_VENDA, res.idVenda);
  if (linhas.length === 0) {
    _e2eFalhar_('venda', 'venda não gerou nenhuma linha em Lucro_Por_Item_Socio — o lucro ficou sem dono', res);
  }

  var ativos = SociosService.listarSocios(true);
  var somaAtribuido = 0;
  var lucroBrutoItem = null;

  for (var i = 0; i < linhas.length; i++) {
    var d = linhas[i].dados;
    somaAtribuido += _e2eNum_(parseFloat(d[C_LIS.LUCRO_ATRIBUIDO_SOCIO]), 'lucroAtribuidoSocio', 'venda');
    lucroBrutoItem = _e2eNum_(parseFloat(d[C_LIS.LUCRO_BRUTO_ITEM]), 'lucroBrutoItem', 'venda');
  }
  somaAtribuido = Utils.arredondar(somaAtribuido, 2);

  // Uma linha por sócio ativo por item
  if (linhas.length !== ativos.length) {
    _e2eFalhar_('venda', 'esperava uma linha de lucro por sócio ativo',
      { sociosAtivos: ativos.length, linhas: linhas.length });
  }

  // O lucro do item foi distribuído inteiro, sem sobra nem excesso
  if (Math.abs(somaAtribuido - lucroBrutoItem) > 0.02) {
    _e2eFalhar_('venda', 'a soma do lucro atribuído aos sócios não fecha com o lucro bruto do item',
      { lucroBrutoItem: lucroBrutoItem, somaAtribuida: somaAtribuido });
  }

  return {
    idVenda: res.idVenda,
    precoUnit: precoUnit,
    quantidade: qtd,
    lucroBrutoItem: lucroBrutoItem,
    lucroDistribuido: somaAtribuido
  };
}

/**
 * Venda acima do saldo disponível deve bloquear.
 */
function e2eVendaSaldoInsuficiente(ids) {
  var res = VendaService.salvarVenda({
    idRequisicao: _e2eIdReq_('VENDA-EXCESSO'),
    cabecalho: {
      dataVenda: _e2eHoje_(), negocio: E2E_NEGOCIO, cliente: 'Cliente E2E',
      taxaVenda: 0, freteVenda: 0, descontoVenda: 0, observacao: 'Deve bloquear'
    },
    itens: [{ idProduto: ids.idBooster, quantidade: 999999, valorUnitarioVenda: 10 }]
  });
  if (res.sucesso) {
    _e2eFalhar_('venda-excesso', 'venda de 999999 unidades foi aceita (deveria bloquear)', res);
  }
  return { bloqueou: true };
}

// ============================================================
// SEÇÃO 2 — RETIRADAS (agora com lucro de verdade na mesa)
// ============================================================

/**
 * Retirada acima do limite e retirada válida.
 *
 * Cuidado importante: solicitarRetirada devolve `sucesso: true`
 * mesmo quando bloqueia — o que decide é `status` e `valorAprovado`.
 * Um assert em cima de `sucesso` daria falso verde.
 */
function e2eRetiradas() {
  var ativos = SociosService.listarSocios(true);
  if (ativos.length === 0) {
    return { pulado: true, motivo: 'Nenhum sócio ativo cadastrado.' };
  }

  // Escolhe quem tem mais lucro disponível
  var alvo = ativos[0];
  ativos.forEach(function(s) { if (s.lucroDisponivel > alvo.lucroDisponivel) alvo = s; });

  var limite = _e2eNum_(SociosService.calcularRetiradaMaxima(alvo.idSocio),
    'calcularRetiradaMaxima', 'retiradas');

  if (limite <= 0) {
    return {
      pulado: true,
      motivo: 'Nenhum sócio tem lucro disponível — a venda do passo anterior não gerou lucro suficiente.',
      socio: alvo.nome
    };
  }

  // 1) Acima do limite → não pode aprovar mais que o limite
  var excesso = Utils.arredondar(limite * 2 + 100, 2);
  var acima = SociosService.solicitarRetirada({
    idSocio: alvo.idSocio,
    valorSolicitado: excesso,
    idRequisicao: _e2eIdReq_('RET-ACIMA'),
    data: _e2eHoje_(),
    observacao: 'E2E retirada acima do limite'
  });
  var aprovadoAcima = _e2eNum_(acima.valorAprovado, 'retiradaAcima.valorAprovado', 'retiradas');
  if (aprovadoAcima > limite + 0.01) {
    _e2eFalhar_('retiradas', 'retirada aprovou acima do limite calculado',
      { solicitado: excesso, limite: limite, aprovado: aprovadoAcima });
  }
  if (acima.status === 'Aprovada') {
    _e2eFalhar_('retiradas', 'retirada acima do limite não podia sair como "Aprovada" integral',
      { status: acima.status, solicitado: excesso, aprovado: aprovadoAcima });
  }

  // 2) Dentro do limite → aprova integral e baixa o lucro disponível
  var restante = _e2eNum_(SociosService.calcularRetiradaMaxima(alvo.idSocio),
    'calcularRetiradaMaxima pós-parcial', 'retiradas');
  var resultadoValida = null;

  if (restante > 0.02) {
    var pedido = Utils.arredondar(restante / 2, 2);
    var valida = SociosService.solicitarRetirada({
      idSocio: alvo.idSocio,
      valorSolicitado: pedido,
      idRequisicao: _e2eIdReq_('RET-OK'),
      data: _e2eHoje_(),
      observacao: 'E2E retirada válida'
    });
    if (valida.status !== 'Aprovada') {
      _e2eFalhar_('retiradas', 'retirada dentro do limite deveria ser aprovada integralmente',
        { pedido: pedido, limite: restante, status: valida.status, aprovado: valida.valorAprovado });
    }
    if (Math.abs(_e2eNum_(valida.valorAprovado, 'retiradaValida.valorAprovado', 'retiradas') - pedido) > 0.01) {
      _e2eFalhar_('retiradas', 'valor aprovado diferente do solicitado numa retirada dentro do limite',
        { pedido: pedido, aprovado: valida.valorAprovado });
    }

    // O lucro disponível tem que ter caído exatamente o valor aprovado
    var depois = SociosService.listarSocios(true).filter(function(s) { return s.idSocio === alvo.idSocio; })[0];
    var esperadoDisponivel = Utils.arredondar(alvo.lucroDisponivel - aprovadoAcima - pedido, 2);
    if (Math.abs(depois.lucroDisponivel - esperadoDisponivel) > 0.02) {
      _e2eFalhar_('retiradas', 'lucro disponível não baixou o valor retirado',
        { antes: alvo.lucroDisponivel, retirado: aprovadoAcima + pedido,
          esperado: esperadoDisponivel, encontrado: depois.lucroDisponivel });
    }
    resultadoValida = { pedido: pedido, aprovado: valida.valorAprovado, status: valida.status };
  }

  return {
    socio: alvo.nome,
    limiteInicial: limite,
    retiradaAcimaDoLimite: { solicitado: excesso, aprovado: aprovadoAcima, status: acima.status },
    retiradaValida: resultadoValida
  };
}

// ============================================================
// ORQUESTRAÇÃO
// ============================================================

/**
 * Roda o fluxo inteiro na ordem. Para no primeiro assert que
 * quebrar — os passos seguintes dependem do estado deixado pelos
 * anteriores, então continuar depois de uma falha só produziria
 * ruído.
 *
 * ⚠️ ESCREVE NA PLANILHA. Ver o cabeçalho deste arquivo.
 */
function testarFluxoCompletoE2E() {
  var resultados = {};
  try {
    resultados.produtos = e2ePrepararProdutos();
    resultados.despesas = e2eDespesas();
    resultados.compra = e2eCompra(resultados.produtos);
    resultados.compraProdutoInativo = e2eCompraProdutoInativo();
    resultados.abertura = e2eAbertura(resultados.produtos);
    resultados.venda = e2eVenda(resultados.produtos, resultados.abertura);
    resultados.vendaSaldoInsuficiente = e2eVendaSaldoInsuficiente(resultados.produtos);
    resultados.retiradas = e2eRetiradas();
    resultados.sucesso = true;
  } catch (e) {
    resultados.sucesso = false;
    resultados.erro = e.message;
    Logger.log(JSON.stringify(resultados, null, 2));
    throw e;
  }

  Logger.log(JSON.stringify(resultados, null, 2));
  try {
    SpreadsheetApp.getUi().alert('Fluxo E2E — OK\n\n' + JSON.stringify(resultados, null, 2));
  } catch (e2) {
    Logger.log('UI indisponivel: ' + e2.message);
  }
  return resultados;
}
