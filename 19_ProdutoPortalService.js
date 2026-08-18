/**
 * 19_ProdutoPortalService.gs
 * ============================================================
 * Wrappers de Produto para o Portal HTMLService — MVP 1.5 Manus
 * ============================================================
 * Permite listar produtos, cadastrar produto base via ProdutoService
 * e atualizar somente metadados de mercado em Produtos_Ativos.
 * Nao altera compra, venda, estoque, financeiro ou preco realizado.
 * ============================================================
 */

function uiListarProdutosMercado(negocio) {
  return ProdutoPortalService.uiListarProdutosMercado(negocio);
}

function uiCadastrarProduto(payload) {
  return ProdutoPortalService.uiCadastrarProduto(payload);
}

function uiAtualizarMetadadosProduto(payload) {
  return ProdutoPortalService.uiAtualizarMetadadosProduto(payload);
}

var ProdutoPortalService = (function () {

  var ABA = CONFIG.ABAS.PRODUTOS_ATIVOS;
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var CAMPOS_MERCADO = {
    PAIS_REGIAO: 'País / Região',
    IDIOMA: 'Idioma',
    MERCADO_REFERENCIA: 'Mercado Referência',
    FONTE_PRECO_PREFERENCIAL: 'Fonte Preço Preferencial'
  };

  function _normalizar(valor) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function _ok(dados) {
    dados = dados || {};
    dados.sucesso = dados.sucesso !== false;
    return dados;
  }

  function _erro(operacao, e) {
    try { LogService.error('ProdutoPortalService', operacao, e.message || String(e)); } catch (_) {}
    return { sucesso: false, erro: e.message || String(e), detalhes: [e.message || String(e)] };
  }

  function _cabecalhos() {
    return SheetService.getCabecalhos(ABA);
  }

  function _mapaColunas() {
    var mapa = {};
    _cabecalhos().forEach(function(campo, i) {
      if (campo) mapa[campo] = i + 1;
    });
    return mapa;
  }

  function _validarCabecalhosMercado() {
    var cab = _cabecalhos();
    var esperados = [
      CAMPOS_MERCADO.PAIS_REGIAO,
      CAMPOS_MERCADO.IDIOMA,
      CAMPOS_MERCADO.MERCADO_REFERENCIA,
      CAMPOS_MERCADO.FONTE_PRECO_PREFERENCIAL
    ];
    return esperados.filter(function(campo) { return cab.indexOf(campo) === -1; });
  }

  function _produtoAtivo(produto) {
    return _normalizar(produto[C_PROD.ATIVO]) === 'sim';
  }

  function _filtrarNegocio(produto, negocio) {
    if (!negocio || negocio === 'Todos') return true;
    return _normalizar(produto[C_PROD.NEGOCIO]) === _normalizar(negocio);
  }

  function uiListarProdutosMercado(negocio) {
    try {
      var produtos = SheetService.getDadosComoObjetos(ABA)
        .filter(function(p) { return _produtoAtivo(p) && _filtrarNegocio(p, negocio); })
        .map(function(p) {
          var meta = ProdutoMercadoService.obterMetadadosProduto(p[C_PROD.ID_PRODUTO]);
          var m = meta && meta.metadados ? meta.metadados : {};
          return {
            idProduto: p[C_PROD.ID_PRODUTO],
            negocio: p[C_PROD.NEGOCIO],
            nomeProduto: p[C_PROD.NOME_PRODUTO],
            tipoModelo: p[C_PROD.TIPO_MODELO],
            colecaoJogo: p[C_PROD.COLECAO_JOGO],
            estadoCondicao: p[C_PROD.ESTADO_CONDICAO],
            unidadeControle: p[C_PROD.UNIDADE_CONTROLE],
            fracionavel: p[C_PROD.FRACIONAVEL],
            qtdGeradaPadrao: p[C_PROD.QTD_GERADA_PADRAO],
            produtoGeradoPadrao: p[C_PROD.PRODUTO_GERADO],
            paisRegiao: m.paisRegiao || '',
            idioma: m.idioma || '',
            mercadoReferencia: m.mercadoReferencia || '',
            fontePrecoPreferencial: m.fontePrecoPreferencial || ''
          };
        });
      return _ok({ produtos: produtos, cabecalhosMercadoAusentes: _validarCabecalhosMercado() });
    } catch (e) { return _erro('uiListarProdutosMercado', e); }
  }

  function uiAtualizarMetadadosProduto(payload) {
    try {
      payload = payload || {};
      if (Utils.eVazio(payload.idProduto)) throw new Error('ID Produto é obrigatório.');

      var ausentes = _validarCabecalhosMercado();
      if (ausentes.length > 0) {
        return { sucesso: false, erro: 'Cabeçalhos de mercado ausentes: ' + ausentes.join(', '), detalhes: ausentes };
      }

      var registro = SheetService.buscarPrimeiroPorCampo(ABA, C_PROD.ID_PRODUTO, payload.idProduto);
      if (!registro) throw new Error('Produto não encontrado: ' + payload.idProduto);

      var sheet = SheetService.getSheet(ABA);
      var mapa = _mapaColunas();
      var updates = {};
      updates[CAMPOS_MERCADO.PAIS_REGIAO] = payload.paisRegiao || '';
      updates[CAMPOS_MERCADO.IDIOMA] = payload.idioma || '';
      updates[CAMPOS_MERCADO.MERCADO_REFERENCIA] = payload.mercadoReferencia || '';
      updates[CAMPOS_MERCADO.FONTE_PRECO_PREFERENCIAL] = payload.fontePrecoPreferencial || '';

      Object.keys(updates).forEach(function(campo) {
        sheet.getRange(registro.linha, mapa[campo]).setValue(updates[campo]);
      });

      LogService.info('ProdutoPortalService', 'uiAtualizarMetadadosProduto', 'Metadados de mercado atualizados: ' + payload.idProduto, payload.idProduto);
      return _ok({ idProduto: payload.idProduto, metadados: updates, erro: null });
    } catch (e) { return _erro('uiAtualizarMetadadosProduto', e); }
  }

  function uiCadastrarProduto(payload) {
    try {
      payload = payload || {};
      var dados = {
        negocio: payload.negocio,
        nomeProduto: payload.nomeProduto,
        tipoModelo: payload.tipoModelo,
        colecaoJogo: payload.colecaoJogo,
        estadoCondicao: payload.estadoCondicao,
        unidadeControle: payload.unidadeControle,
        fracionavel: payload.fracionavel,
        qtdGeradaPadrao: payload.qtdGeradaPadrao,
        produtoGeradoPadrao: payload.produtoGeradoPadrao,
        observacoes: payload.observacoes
      };

      var cadastro = ProdutoService.cadastrar(dados);
      if (!cadastro || !cadastro.sucesso) return cadastro;

      var meta = uiAtualizarMetadadosProduto({
        idProduto: cadastro.idProduto,
        paisRegiao: payload.paisRegiao,
        idioma: payload.idioma,
        mercadoReferencia: payload.mercadoReferencia,
        fontePrecoPreferencial: payload.fontePrecoPreferencial
      });

      return _ok({
        idProduto: cadastro.idProduto,
        cadastro: cadastro,
        metadados: meta,
        erro: meta.sucesso === false ? meta.erro : null
      });
    } catch (e) { return _erro('uiCadastrarProduto', e); }
  }

  return {
    uiListarProdutosMercado: uiListarProdutosMercado,
    uiCadastrarProduto: uiCadastrarProduto,
    uiAtualizarMetadadosProduto: uiAtualizarMetadadosProduto
  };

})();
