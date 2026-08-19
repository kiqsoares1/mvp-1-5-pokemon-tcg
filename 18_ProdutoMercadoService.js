/**
 * 18_ProdutoMercadoService.gs
 * ============================================================
 * Servico de Metadados de Mercado do Produto — MVP 1.5 Manus
 * ============================================================
 * Le metadados opcionais de mercado em Produtos_Ativos para orientar
 * futuras buscas de preco por regiao/fonte sem alterar compra, venda,
 * estoque, financeiro ou custo historico.
 *
 * Campos opcionais esperados em Produtos_Ativos:
 *  - País / Região
 *  - Idioma
 *  - Mercado Referência
 *  - Fonte Preço Preferencial
 *
 * Este service NAO cria colunas automaticamente.
 * ============================================================
 */

var ProdutoMercadoService = (function () {

  var ABA_PRODUTOS = CONFIG.ABAS.PRODUTOS_ATIVOS;
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;

  var CAMPOS_MERCADO = {
    PAIS_REGIAO: 'País / Região',
    IDIOMA: 'Idioma',
    MERCADO_REFERENCIA: 'Mercado Referência',
    FONTE_PRECO_PREFERENCIAL: 'Fonte Preço Preferencial'
  };

  var DEFAULTS_POR_NEGOCIO = {
    POKEMON: {
      paisRegiao: 'Brasil',
      idioma: 'Português',
      mercadoReferencia: 'Liga Pokémon',
      fontePrecoPreferencial: 'Manual'
    }
  };

  function _normalizar(valor) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function _normalizarChave(campo) {
    return _normalizar(campo).replace(/[^a-z0-9]/g, '');
  }

  function _cabecalhos() {
    return SheetService.getCabecalhos(ABA_PRODUTOS);
  }

  function _temCampo(campo) {
    return _cabecalhos().indexOf(campo) !== -1;
  }

  function _lerCampo(obj, aliases) {
    if (!obj) return '';

    for (var i = 0; i < aliases.length; i++) {
      if (Object.prototype.hasOwnProperty.call(obj, aliases[i])) {
        return obj[aliases[i]];
      }
    }

    var mapa = {};
    Object.keys(obj).forEach(function(chave) {
      mapa[_normalizarChave(chave)] = chave;
    });

    for (var j = 0; j < aliases.length; j++) {
      var chaveReal = mapa[_normalizarChave(aliases[j])];
      if (chaveReal) return obj[chaveReal];
    }

    return '';
  }

  function _buscarProduto(idProduto) {
    if (Utils.eVazio(idProduto)) return null;
    var registro = SheetService.buscarPrimeiroPorCampo(ABA_PRODUTOS, C_PROD.ID_PRODUTO, idProduto);
    return registro ? registro.dados : null;
  }

  function _defaultsParaProduto(produto) {
    return DEFAULTS_POR_NEGOCIO.POKEMON;
  }

  function _resolverMetadados(produto) {
    var defaults = _defaultsParaProduto(produto);

    var paisRegiao = _lerCampo(produto, [
      CAMPOS_MERCADO.PAIS_REGIAO,
      'Pais / Regiao',
      'País/Região',
      'Pais/Regiao',
      'Região',
      'Regiao'
    ]) || defaults.paisRegiao;

    var idioma = _lerCampo(produto, [
      CAMPOS_MERCADO.IDIOMA,
      'Idioma Produto',
      'Língua',
      'Lingua'
    ]) || defaults.idioma;

    var mercadoReferencia = _lerCampo(produto, [
      CAMPOS_MERCADO.MERCADO_REFERENCIA,
      'Mercado de Referência',
      'Mercado Referencia',
      'Mercado'
    ]) || defaults.mercadoReferencia;

    var fontePrecoPreferencial = _lerCampo(produto, [
      CAMPOS_MERCADO.FONTE_PRECO_PREFERENCIAL,
      'Fonte Preferencial',
      'Fonte Preco Preferencial',
      'Fonte Preço'
    ]) || defaults.fontePrecoPreferencial;

    return {
      paisRegiao: paisRegiao,
      idioma: idioma,
      mercadoReferencia: mercadoReferencia,
      fontePrecoPreferencial: fontePrecoPreferencial
    };
  }

  function obterMetadadosProduto(idProduto) {
    var produto = _buscarProduto(idProduto);
    if (!produto) {
      return {
        sucesso: false,
        idProduto: idProduto,
        erro: 'Produto não encontrado: ' + idProduto,
        metadados: null,
        limitacoes: []
      };
    }

    var metadados = _resolverMetadados(produto);
    var camposAusentes = validarCabecalhosMetadados().ausentes;

    return {
      sucesso: true,
      idProduto: idProduto,
      produto: _lerCampo(produto, [C_PROD.NOME_PRODUTO, 'Nome Produto', 'Produto']),
      negocio: _lerCampo(produto, [C_PROD.NEGOCIO, 'Negócio', 'Negocio']),
      metadados: metadados,
      erro: null,
      limitacoes: camposAusentes.length > 0
        ? ['Cabeçalhos opcionais ausentes em Produtos_Ativos: ' + camposAusentes.join(', ') + '. Foram usados defaults por negócio.']
        : []
    };
  }

  function obterFontePreferencial(idProduto) {
    var res = obterMetadadosProduto(idProduto);
    if (!res.sucesso) return {
      sucesso: false,
      idProduto: idProduto,
      fontePrecoPreferencial: 'Manual',
      mercadoReferencia: 'Manual',
      erro: res.erro
    };

    return {
      sucesso: true,
      idProduto: idProduto,
      fontePrecoPreferencial: res.metadados.fontePrecoPreferencial,
      mercadoReferencia: res.metadados.mercadoReferencia,
      paisRegiao: res.metadados.paisRegiao,
      idioma: res.metadados.idioma,
      erro: null
    };
  }

  function listarMetadadosProdutosAtivos(negocio) {
    var produtos = SheetService.getDadosComoObjetos(ABA_PRODUTOS);
    var resultado = [];

    produtos.forEach(function(produto) {
      var ativo = _lerCampo(produto, [C_PROD.ATIVO, 'Ativo?', 'Ativo']);
      if (_normalizar(ativo) !== 'sim') return;

      var negocioProduto = _lerCampo(produto, [C_PROD.NEGOCIO, 'Negócio', 'Negocio']);
      if (negocio && _normalizar(negocioProduto) !== _normalizar(negocio)) return;

      var idProduto = _lerCampo(produto, [C_PROD.ID_PRODUTO, 'ID Produto']);
      var metadados = _resolverMetadados(produto);
      resultado.push({
        idProduto: idProduto,
        produto: _lerCampo(produto, [C_PROD.NOME_PRODUTO, 'Nome Produto', 'Produto']),
        negocio: negocioProduto,
        paisRegiao: metadados.paisRegiao,
        idioma: metadados.idioma,
        mercadoReferencia: metadados.mercadoReferencia,
        fontePrecoPreferencial: metadados.fontePrecoPreferencial
      });
    });

    return resultado;
  }

  function validarCabecalhosMetadados() {
    var obrigatoriosFase = [
      CAMPOS_MERCADO.PAIS_REGIAO,
      CAMPOS_MERCADO.IDIOMA,
      CAMPOS_MERCADO.MERCADO_REFERENCIA,
      CAMPOS_MERCADO.FONTE_PRECO_PREFERENCIAL
    ];

    var ausentes = obrigatoriosFase.filter(function(campo) {
      return !_temCampo(campo);
    });

    return {
      ok: ausentes.length === 0,
      presentes: obrigatoriosFase.filter(function(campo) { return ausentes.indexOf(campo) === -1; }),
      ausentes: ausentes,
      camposEsperados: CAMPOS_MERCADO
    };
  }

  return {
    CAMPOS_MERCADO: CAMPOS_MERCADO,
    obterMetadadosProduto: obterMetadadosProduto,
    obterFontePreferencial: obterFontePreferencial,
    listarMetadadosProdutosAtivos: listarMetadadosProdutosAtivos,
    validarCabecalhosMetadados: validarCabecalhosMetadados,
    // Versão pura (sem leitura de planilha) de _resolverMetadados, para
    // quem já tem o objeto do produto em memória (evita releitura de
    // Produtos_Ativos por produto em loops de listagem).
    resolverMetadadosDoProduto: _resolverMetadados
  };

})();
