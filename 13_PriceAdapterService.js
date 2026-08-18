/**
 * 13_PriceAdapterService.gs
 * ============================================================
 * Adaptador Seguro de Precos — MVP 1.5 Manus
 * ============================================================
 * Escolhe a fonte de preco com base nos metadados de mercado do
 * produto. Nesta fase nao faz scraping, nao usa credenciais e nao
 * inventa preco: quando nao houver API configurada/confiavel, retorna
 * falha estruturada com fallback manual permitido.
 * ============================================================
 */

var PriceAdapterService = (function () {

  var ABA_PRODUTOS = CONFIG.ABAS.PRODUTOS_ATIVOS;
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;

  function _normalizar(valor) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function _buscarProduto(idProduto) {
    if (Utils.eVazio(idProduto)) return null;
    var registro = SheetService.buscarPrimeiroPorCampo(ABA_PRODUTOS, C_PROD.ID_PRODUTO, idProduto);
    return registro ? registro.dados : null;
  }

  function _nomeProduto(produto) {
    return produto ? (produto[C_PROD.NOME_PRODUTO] || '') : '';
  }

  function _hoje() {
    return Utils.formatarData(new Date());
  }

  function _metadados(idProduto) {
    try {
      if (typeof ProdutoMercadoService !== 'undefined' && ProdutoMercadoService.obterFontePreferencial) {
        var meta = ProdutoMercadoService.obterFontePreferencial(idProduto);
        if (meta && meta.sucesso) return meta;
      }
    } catch (e) {
      console.warn('[13_PriceAdapterService] Falha ao obter metadados: ' + e.message);
    }

    return {
      sucesso: true,
      idProduto: idProduto,
      fontePrecoPreferencial: 'Manual',
      mercadoReferencia: 'Manual',
      paisRegiao: '',
      idioma: '',
      erro: null
    };
  }

  function _falha(payload, fonte, status, erro, linkReferencia) {
    payload = payload || {};
    var produto = _buscarProduto(payload.idProduto);
    var meta = _metadados(payload.idProduto);

    return {
      sucesso: false,
      fonte: fonte || meta.fontePrecoPreferencial || 'Manual',
      idProduto: payload.idProduto || '',
      nomeProduto: payload.nomeProduto || _nomeProduto(produto),
      precoUnitario: null,
      moeda: null,
      dataReferencia: _hoje(),
      linkReferencia: linkReferencia || '',
      status: status || 'FALHA_BUSCA_AUTOMATICA',
      origem: 'AUTOMATICO',
      precisaConfirmacaoManual: true,
      permitirFallbackManual: true,
      erro: erro || 'Não foi possível obter preço automaticamente com segurança.',
      mercadoReferencia: meta.mercadoReferencia || '',
      fontePrecoPreferencial: meta.fontePrecoPreferencial || '',
      paisRegiao: meta.paisRegiao || '',
      idioma: meta.idioma || ''
    };
  }

  function montarUrlBuscaLigaPokemon(produto) {
    var nome = typeof produto === 'string' ? produto : _nomeProduto(produto);
    return 'https://www.ligapokemon.com.br/?view=cards%2Fsearch&card=' + encodeURIComponent(nome || '');
  }

  function buscarPrecoLigaPokemon(payload) {
    payload = payload || {};
    var produto = _buscarProduto(payload.idProduto);
    var link = montarUrlBuscaLigaPokemon(produto || payload.nomeProduto || '');
    return _falha(payload, 'Liga Pokémon', 'FONTE_BR_MANUAL_NESTA_FASE',
      'Liga Pokémon fica como referência/manual nesta fase. Nenhum preço foi inferido automaticamente.', link);
  }

  function buscarPrecoPokemonTcgApi(payload) {
    return _falha(payload || {}, 'Pokémon TCG API', 'API_NAO_CONFIGURADA_NESTA_FASE',
      'Pokémon TCG API ainda não foi configurada nesta fase. Use fallback manual.');
  }

  function buscarPrecoCardmarket(payload) {
    return _falha(payload || {}, 'Cardmarket', 'API_NAO_CONFIGURADA_NESTA_FASE',
      'Cardmarket ainda não foi configurado nesta fase. Use fallback manual.');
  }

  function buscarPreco(payload) {
    payload = payload || {};
    var meta = _metadados(payload.idProduto);
    var mercado = _normalizar(payload.mercadoReferencia || meta.mercadoReferencia);
    var fonte = _normalizar(payload.fonte || payload.fontePrecoPreferencial || meta.fontePrecoPreferencial);

    if (mercado === _normalizar('Liga Pokémon') || fonte === _normalizar('Liga Pokémon')) {
      return buscarPrecoLigaPokemon(payload);
    }

    if (mercado === _normalizar('TCGPlayer') || fonte === _normalizar('Pokémon TCG API') || fonte === _normalizar('TCGPlayer')) {
      return buscarPrecoPokemonTcgApi(payload);
    }

    if (mercado === _normalizar('Cardmarket') || fonte === _normalizar('Cardmarket')) {
      return buscarPrecoCardmarket(payload);
    }

    return _falha(payload, meta.fontePrecoPreferencial || 'Manual', 'FONTE_MANUAL',
      'Produto sem fonte automática confiável configurada. Use registro manual de preço.');
  }

  function atualizarPrecoProduto(idProduto, opcoes) {
    opcoes = opcoes || {};
    var busca = buscarPreco({
      idProduto: idProduto,
      fonte: opcoes.fonte,
      mercadoReferencia: opcoes.mercadoReferencia
    });

    if (!busca.sucesso) {
      LogService.warning('PriceAdapterService', 'atualizarPrecoProduto', busca.erro, idProduto);
      return {
        sucesso: false,
        idProduto: idProduto,
        busca: busca,
        registro: null,
        atualizacaoMercado: null,
        erro: busca.erro
      };
    }

    return {
      sucesso: false,
      idProduto: idProduto,
      busca: busca,
      registro: null,
      atualizacaoMercado: null,
      erro: 'Registro automático não habilitado nesta fase.'
    };
  }

  function atualizarPrecosCarteira(filtros) {
    filtros = filtros || {};
    var produtos = ProdutoMercadoService.listarMetadadosProdutosAtivos(filtros.negocio || '');
    var resultados = [];

    produtos.forEach(function(produto) {
      resultados.push(atualizarPrecoProduto(produto.idProduto, {
        fonte: filtros.fonte,
        mercadoReferencia: filtros.mercadoReferencia
      }));
    });

    return {
      sucesso: true,
      totalProdutos: produtos.length,
      atualizadosAutomaticamente: 0,
      falhas: resultados.length,
      resultados: resultados,
      observacao: 'Nesta fase o adapter roteia fontes e retorna fallback manual; não grava preço automático.'
    };
  }

  return {
    buscarPreco: buscarPreco,
    buscarPrecoLigaPokemon: buscarPrecoLigaPokemon,
    buscarPrecoPokemonTcgApi: buscarPrecoPokemonTcgApi,
    buscarPrecoCardmarket: buscarPrecoCardmarket,
    atualizarPrecoProduto: atualizarPrecoProduto,
    atualizarPrecosCarteira: atualizarPrecosCarteira,
    montarUrlBuscaLigaPokemon: montarUrlBuscaLigaPokemon
  };

})();
