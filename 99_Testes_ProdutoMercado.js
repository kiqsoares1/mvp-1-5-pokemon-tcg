/**
 * PENDENCIA (v1.6.0): este roteiro de teste manual ainda referencia
 * "CS Skins" / "Trade Lock", removidos do escopo do projeto.
 * Nao roda automaticamente; ajustar massas de teste para Pokemon TCG
 * antes de reutilizar este roteiro.
 */

/**
 * tests/99_Testes_ProdutoMercado.gs
 * ============================================================
 * Testes manuais temporarios para metadados de mercado do produto.
 * Nao grava dados, nao altera compra/venda/estoque/precos.
 * ============================================================
 */

function _mostrarResultadoProdutoMercado(nomeTeste, resultado) {
  Logger.log(nomeTeste + ': ' + JSON.stringify(resultado, null, 2));
  try {
    SpreadsheetApp.getUi().alert(nomeTeste + '\n' + JSON.stringify(resultado, null, 2));
  } catch (e) {
    Logger.log('UI indisponivel: ' + e.message);
  }
}

function _buscarProdutoAtivoProdutoMercado(negocio) {
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

function testarValidarCabecalhosProdutoMercado() {
  var res = ProdutoMercadoService.validarCabecalhosMetadados();
  _mostrarResultadoProdutoMercado('testarValidarCabecalhosProdutoMercado', res);
}

function testarObterMetadadosProdutoMercado() {
  var produto = _buscarProdutoAtivoProdutoMercado();
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];
  var res = ProdutoMercadoService.obterMetadadosProduto(idProduto);
  _mostrarResultadoProdutoMercado('testarObterMetadadosProdutoMercado', res);
}

function testarFontePreferencialPokemon() {
  var produto = _buscarProdutoAtivoProdutoMercado('Pokémon TCG');
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];
  var res = ProdutoMercadoService.obterFontePreferencial(idProduto);
  _mostrarResultadoProdutoMercado('testarFontePreferencialPokemon', res);
}

function testarFontePreferencialCS() {
  var produto = _buscarProdutoAtivoProdutoMercado('CS Skins');
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];
  var res = ProdutoMercadoService.obterFontePreferencial(idProduto);
  _mostrarResultadoProdutoMercado('testarFontePreferencialCS', res);
}

function testarListarMetadadosProdutosAtivos() {
  var res = ProdutoMercadoService.listarMetadadosProdutosAtivos();
  _mostrarResultadoProdutoMercado('testarListarMetadadosProdutosAtivos', {
    quantidade: res.length,
    produtos: res.slice(0, 20)
  });
}
