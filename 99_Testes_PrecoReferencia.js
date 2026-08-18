/**
 * tests/99_Testes_PrecoReferencia.gs
 * ============================================================
 * Testes manuais temporarios do PrecoReferenciaService.
 * Copiar para o Apps Script HML, executar uma funcao por vez e
 * conferir Logger/alerta.
 * ============================================================
 */

function _mostrarResultadoPrecoReferencia(nomeTeste, resultado) {
  Logger.log(nomeTeste + ': ' + JSON.stringify(resultado, null, 2));
  try {
    SpreadsheetApp.getUi().alert(nomeTeste + '\n' + JSON.stringify(resultado, null, 2));
  } catch (e) {
    Logger.log('UI indisponivel: ' + e.message);
  }
}

function _idReqPrecoReferencia(sufixo) {
  return 'TST-PRECO-' + sufixo + '-' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMddHHmmss');
}

function _normalizarTestePreco(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function _produtoAtivoTestePreco(produto) {
  var campoAtivo = CONFIG.CAMPOS.PRODUTOS_ATIVOS.ATIVO;
  return _normalizarTestePreco(produto[campoAtivo]) === 'sim';
}

function _buscarProdutoAtivoParaTestePreco() {
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var produtos = SheetService.getDadosComoObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS);
  for (var i = 0; i < produtos.length; i++) {
    if (_produtoAtivoTestePreco(produtos[i])) {
      return produtos[i];
    }
  }
  throw new Error('Nenhum produto ativo encontrado para teste de preço.');
}

function _buscarProdutoAtivoComLoteParaTestePreco() {
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var C_LOTE = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var lotes = SheetService.getDadosComoObjetos(CONFIG.ABAS.LOTES_ESTOQUE);

  for (var i = 0; i < lotes.length; i++) {
    var idProduto = lotes[i][C_LOTE.ID_PRODUTO];
    if (!idProduto) continue;
    var produto = SheetService.buscarPrimeiroPorCampo(CONFIG.ABAS.PRODUTOS_ATIVOS, C_PROD.ID_PRODUTO, idProduto);
    if (produto && _produtoAtivoTestePreco(produto.dados)) return produto.dados;
  }

  return _buscarProdutoAtivoParaTestePreco();
}

function _payloadPrecoReferenciaTeste(sufixo, preco) {
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var produto = _buscarProdutoAtivoComLoteParaTestePreco();
  return {
    idRequisicao: _idReqPrecoReferencia(sufixo),
    dataReferencia: Utils.formatarData(new Date()),
    idProduto: produto[C_PROD.ID_PRODUTO],
    negocio: produto[C_PROD.NEGOCIO],
    precoUnitario: preco,
    fonte: 'Manual',
    linkReferencia: '',
    estadoCondicao: produto[C_PROD.ESTADO_CONDICAO] || '',
    observacao: 'Preço teste HML'
  };
}

function testarRegistrarPrecoReferencia() {
  var payload = _payloadPrecoReferenciaTeste('REGISTRAR', 150);
  var res = PrecoReferenciaService.registrarPrecoReferencia(payload);
  _mostrarResultadoPrecoReferencia('testarRegistrarPrecoReferencia', res);
}

function testarBloquearPrecoInvalido() {
  var payload = _payloadPrecoReferenciaTeste('INVALIDO', 0);
  var res = PrecoReferenciaService.registrarPrecoReferencia(payload);
  _mostrarResultadoPrecoReferencia('testarBloquearPrecoInvalido', res);
}

function testarObterPrecoVigente() {
  var payload = _payloadPrecoReferenciaTeste('VIGENTE', 155);
  var registro = PrecoReferenciaService.registrarPrecoReferencia(payload);
  var vigente = PrecoReferenciaService.obterPrecoVigente(payload.idProduto);
  var res = {
    registro: registro,
    vigente: vigente
  };
  _mostrarResultadoPrecoReferencia('testarObterPrecoVigente', res);
}

function testarClassificarStatusPreco() {
  var hoje = new Date();
  var d35 = new Date(hoje.getTime());
  d35.setDate(d35.getDate() - 35);
  var d70 = new Date(hoje.getTime());
  d70.setDate(d70.getDate() - 70);

  var res = {
    semPreco: PrecoReferenciaService.classificarStatusPreco(''),
    atualizado: PrecoReferenciaService.classificarStatusPreco(Utils.formatarData(hoje)),
    atencao: PrecoReferenciaService.classificarStatusPreco(Utils.formatarData(d35)),
    vencido: PrecoReferenciaService.classificarStatusPreco(Utils.formatarData(d70))
  };
  _mostrarResultadoPrecoReferencia('testarClassificarStatusPreco', res);
}

function testarAtualizarValorMercadoProduto() {
  var payload = _payloadPrecoReferenciaTeste('MERCADO', 160);
  var registro = PrecoReferenciaService.registrarPrecoReferencia(payload);
  var atualizacao = PrecoReferenciaService.atualizarValorMercadoProduto(payload.idProduto);
  var res = {
    registro: registro,
    atualizacao: atualizacao
  };
  _mostrarResultadoPrecoReferencia('testarAtualizarValorMercadoProduto', res);
}

function testarListarProdutosSemPreco() {
  var res = PrecoReferenciaService.listarProdutosSemPreco();
  _mostrarResultadoPrecoReferencia('testarListarProdutosSemPreco', {
    quantidade: res.length,
    produtos: res.slice(0, 20)
  });
}

function testarListarProdutosComPrecoVencido() {
  var res = PrecoReferenciaService.listarProdutosComPrecoVencido();
  _mostrarResultadoPrecoReferencia('testarListarProdutosComPrecoVencido', {
    quantidade: res.length,
    produtos: res.slice(0, 20)
  });
}

function testarDuplicidadePrecoReferencia() {
  var payload = _payloadPrecoReferenciaTeste('DUPLICIDADE', 165);
  var primeira = PrecoReferenciaService.registrarPrecoReferencia(payload);
  var segunda = PrecoReferenciaService.registrarPrecoReferencia(payload);
  var res = {
    primeira: primeira,
    segunda: segunda
  };
  _mostrarResultadoPrecoReferencia('testarDuplicidadePrecoReferencia', res);
}
