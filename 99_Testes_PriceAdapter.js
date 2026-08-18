/**
 * PENDENCIA (v1.6.0): este roteiro de teste manual ainda referencia
 * "CS Skins" / "Trade Lock", removidos do escopo do projeto.
 * Nao roda automaticamente; ajustar massas de teste para Pokemon TCG
 * antes de reutilizar este roteiro.
 */

/**
 * tests/99_Testes_PriceAdapter.gs
 * ============================================================
 * Testes manuais temporarios da fase 12A.
 * Valida metadados no preco vigente e fallback seguro do adapter.
 * Nao grava precos automaticamente e nao altera lotes.
 * ============================================================
 */

function _mostrarResultadoPriceAdapter(nomeTeste, resultado) {
  Logger.log(nomeTeste + ': ' + JSON.stringify(resultado, null, 2));
  try {
    SpreadsheetApp.getUi().alert(nomeTeste + '\n' + JSON.stringify(resultado, null, 2));
  } catch (e) {
    Logger.log('UI indisponivel: ' + e.message);
  }
}

function _buscarProdutoAtivoPriceAdapter(negocio) {
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var produtos = SheetService.getDadosComoObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS);

  for (var i = 0; i < produtos.length; i++) {
    var ativo = String(produtos[i][C_PROD.ATIVO] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (ativo !== 'sim') continue;
    if (negocio && String(produtos[i][C_PROD.NEGOCIO]) !== negocio) continue;
    return produtos[i];
  }

  throw new Error('Nenhum produto ativo encontrado' + (negocio ? ' para ' + negocio : '') + '.');
}

function testarPrecoVigenteComMetadadosMercado() {
  var produto = _buscarProdutoAtivoPriceAdapter();
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];
  var res = PrecoReferenciaService.obterPrecoVigente(idProduto);
  _mostrarResultadoPriceAdapter('testarPrecoVigenteComMetadadosMercado', res);
}

function testarPriceAdapterPokemonBrasilFallbackManual() {
  var produto = _buscarProdutoAtivoPriceAdapter('Pokémon TCG');
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];
  var res = PriceAdapterService.buscarPreco({ idProduto: idProduto });
  _mostrarResultadoPriceAdapter('testarPriceAdapterPokemonBrasilFallbackManual', res);
}

function testarPriceAdapterCSBuffFallbackManual() {
  var produto = _buscarProdutoAtivoPriceAdapter('CS Skins');
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];
  var res = PriceAdapterService.buscarPreco({ idProduto: idProduto });
  _mostrarResultadoPriceAdapter('testarPriceAdapterCSBuffFallbackManual', res);
}

function testarMontarUrlsReferenciaPreco() {
  var produtoPokemon = _buscarProdutoAtivoPriceAdapter('Pokémon TCG');
  var produtoCS = _buscarProdutoAtivoPriceAdapter('CS Skins');

  var res = {
    ligaPokemon: PriceAdapterService.montarUrlBuscaLigaPokemon(produtoPokemon),
    buff163: PriceAdapterService.montarUrlBuscaBuff163(produtoCS)
  };
  _mostrarResultadoPriceAdapter('testarMontarUrlsReferenciaPreco', res);
}

function testarAtualizarPrecosCarteiraSeguro() {
  var res = PriceAdapterService.atualizarPrecosCarteira({});
  _mostrarResultadoPriceAdapter('testarAtualizarPrecosCarteiraSeguro', {
    sucesso: res.sucesso,
    totalProdutos: res.totalProdutos,
    atualizadosAutomaticamente: res.atualizadosAutomaticamente,
    falhas: res.falhas,
    observacao: res.observacao,
    primeiraFalha: res.resultados && res.resultados.length ? res.resultados[0] : null
  });
}
