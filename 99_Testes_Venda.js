/**
 * PENDENCIA (v1.6.0): este roteiro de teste manual ainda referencia
 * "CS Skins" / "Trade Lock", removidos do escopo do projeto.
 * Nao roda automaticamente; ajustar massas de teste para Pokemon TCG
 * antes de reutilizar este roteiro.
 */

/**
 * tests/99_Testes_Venda.gs
 * Testes manuais temporários para 09_VendaService.gs em HML.
 * Copiar para o Apps Script apenas durante homologação.
 */

function _testeVendaHoje_() {
  return Utils.formatarData(new Date());
}

function _testeVendaEncontrarLotes_(filtro) {
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var lotes = SheetService.getDadosComoObjetos(CONFIG.ABAS.LOTES_ESTOQUE);
  var res = [];
  for (var i = 0; i < lotes.length; i++) {
    var l = lotes[i];
    var status = Utils.normalizar(l[C.STATUS] || '').toLowerCase();
    var qtdDisp = parseFloat(l[C.QTD_DISPONIVEL] || 0);
    var qtdTL = parseFloat(l[C.QTD_TRADE_LOCK] || 0);
    var qtdHold = parseFloat(l[C.QTD_HOLD] || 0);
    var ok = true;
    if (filtro.idProduto && l[C.ID_PRODUTO] !== filtro.idProduto) ok = false;
    if (filtro.negocio && l[C.NEGOCIO] !== filtro.negocio) ok = false;
    if (filtro.status && status !== filtro.status) ok = false;
    if (filtro.disponivel && qtdDisp <= 0) ok = false;
    if (filtro.tradeLock && !(status === 'trade lock' || qtdTL > 0)) ok = false;
    if (filtro.hold && !(status === 'hold' || qtdHold > 0)) ok = false;
    if (ok) res.push(l);
  }
  return res;
}

function _testeVendaPayload_(lote, qtd, valorUnitario, idReq) {
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  return {
    idRequisicao: idReq || ('TST-VENDA-' + Utils.timestampCompacto() + '-' + Math.floor(Math.random() * 1000)),
    cabecalho: {
      dataVenda: _testeVendaHoje_(),
      negocio: lote[C.NEGOCIO],
      cliente: 'Teste Venda HML',
      taxaVenda: 0,
      freteVenda: 0,
      descontoVenda: 0,
      observacao: 'Teste manual VendaService'
    },
    itens: [{
      idProduto: lote[C.ID_PRODUTO],
      quantidade: qtd,
      valorUnitarioVenda: valorUnitario,
      observacao: 'Item teste venda'
    }]
  };
}

function testarVendaDisponivel() {
  var lotes = _testeVendaEncontrarLotes_({ disponivel: true });
  if (lotes.length === 0) {
    return { sucesso: false, erro: 'Pré-condição ausente: crie/libere um lote com Quantidade Disponível > 0.' };
  }
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var lote = lotes[0];
  var preco = Math.max(parseFloat(lote[C.CUSTO_UNIT] || 0) + 10, 1);
  var res = VendaService.salvarVenda(_testeVendaPayload_(lote, 1, preco));
  Logger.log(JSON.stringify(res));
  return res;
}

function testarVendaBloqueiaTradeLock() {
  var lotes = _testeVendaEncontrarLotes_({ tradeLock: true });
  if (lotes.length === 0) {
    return { sucesso: false, erro: 'Pré-condição ausente: não há lote em Trade Lock para testar bloqueio.' };
  }
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var lote = lotes[0];
  var preco = Math.max(parseFloat(lote[C.CUSTO_UNIT] || 0) + 10, 1);
  var res = VendaService.salvarVenda(_testeVendaPayload_(lote, 1, preco));
  Logger.log(JSON.stringify(res));
  return res;
}

function testarVendaBloqueiaSaldoInsuficiente() {
  var lotes = _testeVendaEncontrarLotes_({ disponivel: true });
  if (lotes.length === 0) {
    return { sucesso: false, erro: 'Pré-condição ausente: crie/libere um lote disponível.' };
  }
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var lote = lotes[0];
  var preco = Math.max(parseFloat(lote[C.CUSTO_UNIT] || 0) + 10, 1);
  var res = VendaService.salvarVenda(_testeVendaPayload_(lote, 999999, preco));
  Logger.log(JSON.stringify(res));
  // Assert real: com pré-condição presente (lote disponível encontrado
  // acima), a venda de 999999 unidades TEM que ser bloqueada. Sem este
  // assert, um bug que removesse a validação de estoque negativo passaria
  // despercebido — o resultado ficava só num log que ninguém é obrigado a ler.
  if (res.sucesso === true) {
    throw new Error('FALHA DE REGRA CRÍTICA: venda de 999999 unidades foi aceita (deveria bloquear estoque insuficiente). ' + JSON.stringify(res));
  }
  return res;
}

function testarVendaFIFOComMultiplosLotes() {
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var disponiveis = _testeVendaEncontrarLotes_({ disponivel: true });
  var porProduto = {};
  for (var i = 0; i < disponiveis.length; i++) {
    var idProduto = disponiveis[i][C.ID_PRODUTO];
    porProduto[idProduto] = porProduto[idProduto] || [];
    porProduto[idProduto].push(disponiveis[i]);
  }

  var escolhido = null;
  Object.keys(porProduto).forEach(function(idProduto) {
    if (!escolhido && porProduto[idProduto].length >= 2) escolhido = porProduto[idProduto];
  });

  if (!escolhido) {
    return { sucesso: false, erro: 'Pré-condição ausente: precisam existir 2 lotes disponíveis do mesmo produto.' };
  }

  escolhido.sort(function(a, b) {
    var da = Utils.parsarData(String(a[C.DATA_CRIACAO] || '').split(' ')[0]);
    var db = Utils.parsarData(String(b[C.DATA_CRIACAO] || '').split(' ')[0]);
    if (!da || !db) return 0;
    return da - db;
  });

  var idLoteMaisAntigo = escolhido[0][C.ID_LOTE];
  var idLoteSeguinte = escolhido[1][C.ID_LOTE];
  var qtd1 = parseFloat(escolhido[0][C.QTD_DISPONIVEL] || 0);
  var qtdVenda = qtd1 + 1;
  var preco = Math.max(parseFloat(escolhido[0][C.CUSTO_UNIT] || 0) + 10, 1);
  var res = VendaService.salvarVenda(_testeVendaPayload_(escolhido[0], qtdVenda, preco));
  Logger.log(JSON.stringify(res));
  if (res.sucesso !== true) {
    throw new Error('Venda deveria ter sido aceita (saldo suficiente somando os 2 lotes): ' + JSON.stringify(res));
  }

  // Assert real de FIFO: confere em Lotes_Estoque que o lote mais antigo
  // ficou zerado/Encerrado (consumido primeiro) e que o lote seguinte
  // absorveu só a unidade excedente — sem isso, o teste "passava" mesmo
  // que a venda tivesse consumido o lote errado.
  var loteMaisAntigoDepois = SheetService.buscarPrimeiroPorCampo(CONFIG.ABAS.LOTES_ESTOQUE, C.ID_LOTE, idLoteMaisAntigo);
  var loteSeguinteDepois = SheetService.buscarPrimeiroPorCampo(CONFIG.ABAS.LOTES_ESTOQUE, C.ID_LOTE, idLoteSeguinte);
  var qtdDispMaisAntigoDepois = parseFloat(loteMaisAntigoDepois.dados[C.QTD_DISPONIVEL] || 0);
  var qtdDispSeguinteDepois = parseFloat(loteSeguinteDepois.dados[C.QTD_DISPONIVEL] || 0);
  var qtdDispSeguinteAntes = parseFloat(escolhido[1][C.QTD_DISPONIVEL] || 0);

  if (qtdDispMaisAntigoDepois !== 0) {
    throw new Error('FALHA DE FIFO: lote mais antigo (' + idLoteMaisAntigo + ') deveria ter ficado com saldo 0, mas ficou com ' + qtdDispMaisAntigoDepois + '.');
  }
  if (qtdDispSeguinteDepois !== Utils.arredondar(qtdDispSeguinteAntes - 1, 4)) {
    throw new Error('FALHA DE FIFO: lote seguinte (' + idLoteSeguinte + ') deveria ter absorvido só 1 unidade excedente. Esperado ' +
      Utils.arredondar(qtdDispSeguinteAntes - 1, 4) + ', encontrado ' + qtdDispSeguinteDepois + '.');
  }

  return res;
}

function testarVendaDuplicidadeIdRequisicao() {
  var lotes = _testeVendaEncontrarLotes_({ disponivel: true });
  if (lotes.length === 0) {
    return { sucesso: false, erro: 'Pré-condição ausente: crie/libere um lote disponível.' };
  }
  var C = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var lote = lotes[0];
  var preco = Math.max(parseFloat(lote[C.CUSTO_UNIT] || 0) + 10, 1);
  var idReq = 'TST-DUP-VENDA-' + Utils.timestampCompacto();
  var payload = _testeVendaPayload_(lote, 1, preco, idReq);
  var primeira = VendaService.salvarVenda(payload);
  var segunda = VendaService.salvarVenda(payload);
  var res = { primeira: primeira, segunda: segunda };
  Logger.log(JSON.stringify(res));
  return res;
}
