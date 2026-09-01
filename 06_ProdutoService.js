/**
 * 06_ProdutoService.gs
 * ============================================================
 * Serviço de Produto — MVP 1.5 Manus
 * ============================================================
 * Responsabilidades:
 *  - Buscar produto ativo por ID ou nome
 *  - Validar produto para uso em compra, venda ou abertura
 *  - Cadastrar novo produto com geração de ID e chave
 *  - Validar fracionamento Pokémon
 *  - Retornar dados de produto para uso em outros services
 *  - Registrar logs de produto
 *
 * Dependências: 00_Config, 02_Utils, 03_SheetService, 04_IdService, 14_LogService
 * Abas impactadas: Produtos_Ativos
 * Abas consultadas: Configuracoes
 *
 * REGRAS CRÍTICAS (Doc 04 §8.4, Doc 07 §6):
 *  - Produto inativo não pode ser usado em novas operações
 *  - Produto CS nunca é fracionável
 *  - Produto Pokémon fracionável deve ter Quantidade Gerada Padrão > 0
 *  - Produto Pokémon fracionável deve ter Produto Gerado Padrão cadastrado e ativo
 *  - Chave Produto deve ser única (Negócio + Nome normalizado + Condição + Coleção)
 *  - ID nunca é preenchido pelo usuário
 * ============================================================
 */

var ProdutoService = (function () {

  // ============================================================
  // CONSTANTES INTERNAS
  // ============================================================
  var ABA    = CONFIG.ABAS.PRODUTOS_ATIVOS;
  var CAMPOS = CONFIG.CAMPOS.PRODUTOS_ATIVOS;

  var NEGOCIOS_VALIDOS  = CONFIG.LISTAS.NEGOCIOS;
  var NEGOCIO_POKEMON   = 'Pokémon TCG';

  // ============================================================
  // FUNÇÕES PRIVADAS
  // ============================================================

  /**
   * Monta a chave única de produto para detecção de duplicidade.
   * Chave = Negócio + NomeNormalizado + Condição + Coleção
   */
  function _montarChave(negocio, nome, condicao, colecao) {
    var partes = [
      Utils.normalizar(negocio  || ''),
      Utils.normalizar(nome     || ''),
      Utils.normalizar(condicao || ''),
      Utils.normalizar(colecao  || '')
    ];
    return partes.join('|');
  }

  /**
   * Retorna todos os produtos da aba como array de objetos.
   */
  function _listarTodos() {
    return SheetService.getDadosComoObjetos(ABA);
  }

  function _extrairDadosProduto(produto) {
    if (!produto) return null;

    if (produto.dados && typeof produto.dados === 'object') {
      var dados = produto.dados;

      if (produto.linha) {
        dados._linha = produto.linha;
      }

      return dados;
    }

    return produto;
  }

  function _normalizarValorProduto(valor) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function _normalizarChaveCampo(campo) {
    return _normalizarValorProduto(campo)
      .replace(/[^a-z0-9]/g, '');
  }

  function _lerCampo(produto, aliases) {
    var dados = _extrairDadosProduto(produto);
    if (!dados) return '';

    for (var i = 0; i < aliases.length; i++) {
      if (Object.prototype.hasOwnProperty.call(dados, aliases[i])) {
        return dados[aliases[i]];
      }
    }

    var mapa = {};

    Object.keys(dados).forEach(function(chave) {
      mapa[_normalizarChaveCampo(chave)] = chave;
    });

    for (var j = 0; j < aliases.length; j++) {
      var chaveReal = mapa[_normalizarChaveCampo(aliases[j])];

      if (chaveReal) {
        return dados[chaveReal];
      }
    }

    return '';
  }

  /**
   * Busca produto por ID Produto (campo CAMPOS.ID_PRODUTO).
   * Retorna o objeto do produto ou null.
   */
  function _buscarPorId(idProduto) {
    if (Utils.eVazio(idProduto)) return null;

    var registro = SheetService.buscarPrimeiroPorCampo(
      ABA,
      CAMPOS.ID_PRODUTO,
      idProduto
    );

    return _extrairDadosProduto(registro);
  }

  /**
   * Verifica se produto está ativo.
   */
  function _eAtivo(produto) {
    if (!produto) return false;

    var ativo = _lerCampo(produto, [
      CAMPOS.ATIVO,
      'Ativo?',
      'Ativo',
      'ativo'
    ]);

    if (Utils.eVazio(ativo)) return false;

    return _normalizarValorProduto(ativo) === 'sim';
  }

  /**
   * Verifica se produto pertence ao negócio informado.
   */
  function _pertenceAoNegocio(produto, negocio) {
    if (!produto) return false;

    var negocioProduto = _lerCampo(produto, [
      CAMPOS.NEGOCIO,
      'Negócio',
      'Negocio',
      'negocio'
    ]);

    return _normalizarValorProduto(negocioProduto) === _normalizarValorProduto(negocio);
  }

  /**
   * Valida se produto pode ser fracionado (Pokémon).
   * Retorna objeto { valido, motivo }.
   */
  function _validarFracionamento(produto) {
    if (!produto) return { valido: false, motivo: 'Produto não encontrado.' };

    var negocio = Utils.normalizar(produto[CAMPOS.NEGOCIO] || '');
    if (negocio !== Utils.normalizar(NEGOCIO_POKEMON)) {
      return { valido: false, motivo: 'Apenas produtos Pokémon TCG podem ser fracionados.' };
    }

    // _normalizarValorProduto (minúsculas, sem acento) e não Utils.normalizar
    // (só trim): a planilha grava 'Sim' com maiúscula, então comparar o
    // resultado de Utils.normalizar com 'sim' nunca bate. Ver _eAtivo.
    var fracionavel = _normalizarValorProduto(produto[CAMPOS.FRACIONAVEL] || '');
    if (fracionavel !== 'sim') {
      return { valido: false, motivo: 'Produto não está marcado como fracionável.' };
    }

    var qtdPadrao = parseInt(produto[CAMPOS.QTD_GERADA_PADRAO] || 0, 10);
    if (!qtdPadrao || qtdPadrao <= 0) {
      return { valido: false, motivo: 'Produto fracionável sem Quantidade Gerada Padrão definida.' };
    }

    var idGerado = produto[CAMPOS.PRODUTO_GERADO];
    if (Utils.eVazio(idGerado)) {
      return { valido: false, motivo: 'Produto fracionável sem Produto Gerado Padrão definido.' };
    }

    // Verificar se produto gerado existe e está ativo
    var produtoGerado = _buscarPorId(idGerado);
    if (!produtoGerado) {
      return { valido: false, motivo: 'Produto Gerado Padrão não encontrado em Produtos_Ativos.' };
    }
    if (!_eAtivo(produtoGerado)) {
      return { valido: false, motivo: 'Produto Gerado Padrão está inativo.' };
    }

    return { valido: true, motivo: 'OK', produtoGerado: produtoGerado };
  }

  // ============================================================
  // FUNÇÕES PÚBLICAS
  // ============================================================

  /**
   * Busca produto ativo por ID.
   * Retorna objeto do produto ou null se não encontrado ou inativo.
   * Registra log de erro se produto não encontrado.
   */
  function buscarPorId(idProduto) {
    var produto = _buscarPorId(idProduto);
    if (!produto) {
      LogService.warning('ProdutoService', 'buscarPorId',
        'Produto não encontrado: ' + idProduto, idProduto);
      return null;
    }
    return produto;
  }

  /**
   * Busca produto ativo por ID e valida se está ativo.
   * Retorna { produto, erro } onde erro é null se OK.
   */
  function buscarProdutoAtivo(idProduto) {
    var produto = _buscarPorId(idProduto);
    if (!produto) {
      return { produto: null, erro: 'Produto não encontrado: ' + idProduto };
    }
    if (!_eAtivo(produto)) {
      return { produto: null, erro: 'Produto inativo não pode ser usado em novas operações.' };
    }
    return { produto: produto, erro: null };
  }

  /**
   * Lista todos os produtos ativos de um negócio.
   * Retorna array de objetos { idProduto, nomeProduto, tipoModelo, estado }.
   */
  function listarAtivosParaNegocio(negocio) {
    var todos = _listarTodos();
    var resultado = [];
    for (var i = 0; i < todos.length; i++) {
      var p = todos[i];
      if (_eAtivo(p) && _pertenceAoNegocio(p, negocio)) {
        resultado.push({
          idProduto:   p[CAMPOS.ID_PRODUTO],
          nomeProduto: p[CAMPOS.NOME_PRODUTO],
          tipoModelo:  p[CAMPOS.TIPO_MODELO],
          estado:      p[CAMPOS.ESTADO_CONDICAO],
          colecao:     p[CAMPOS.COLECAO_JOGO],
          fracionavel: _normalizarValorProduto(p[CAMPOS.FRACIONAVEL]) === 'sim'
        });
      }
    }
    return resultado;
  }

  /**
   * Valida produto para uso em compra.
   * Verifica: existe, ativo, pertence ao negócio.
   * Retorna { valido, produto, erro }.
   */
  function validarParaCompra(idProduto, negocio) {
    var resultado = buscarProdutoAtivo(idProduto);
    if (resultado.erro) {
      return { valido: false, produto: null, erro: resultado.erro };
    }
    var produto = resultado.produto;
    if (!_pertenceAoNegocio(produto, negocio)) {
      return {
        valido: false,
        produto: null,
        erro: 'Produto ' + idProduto + ' não pertence ao negócio ' + negocio + '.'
      };
    }
    return { valido: true, produto: produto, erro: null };
  }

  /**
   * Valida produto para abertura Pokémon.
   * Verifica: existe, ativo, Pokémon TCG, fracionável, produto gerado ativo.
   * Retorna { valido, produto, produtoGerado, qtdPadrao, erro }.
   */
  function validarParaAbertura(idProduto) {
    var resultado = buscarProdutoAtivo(idProduto);
    if (resultado.erro) {
      return { valido: false, produto: null, produtoGerado: null, qtdPadrao: 0, erro: resultado.erro };
    }
    var produto = resultado.produto;

    // Deve ser Pokémon TCG
    if (!_pertenceAoNegocio(produto, NEGOCIO_POKEMON)) {
      return {
        valido: false, produto: null, produtoGerado: null, qtdPadrao: 0,
        erro: 'Apenas produtos Pokémon TCG podem ser abertos.'
      };
    }

    // Validar fracionamento
    var frac = _validarFracionamento(produto);
    if (!frac.valido) {
      return { valido: false, produto: null, produtoGerado: null, qtdPadrao: 0, erro: frac.motivo };
    }

    var idGerado  = produto[CAMPOS.PRODUTO_GERADO];
    var qtdPadrao = parseInt(produto[CAMPOS.QTD_GERADA_PADRAO] || 0, 10);
    var prodGerado = frac.produtoGerado; // já buscado por _validarFracionamento, evita releitura

    LogService.info('ProdutoService', 'validarParaAbertura',
      'Produto validado para abertura: ' + idProduto + ' → gera ' + qtdPadrao + 'x ' + idGerado,
      idProduto);

    return {
      valido:        true,
      produto:       produto,
      produtoGerado: prodGerado,
      qtdPadrao:     qtdPadrao,
      erro:          null
    };
  }

  /**
   * Cadastra novo produto.
   * Valida campos obrigatórios, detecta duplicidade por chave, gera ID e grava.
   * Retorna { sucesso, idProduto, erro }.
   *
   * @param {Object} dados - { negocio, nomeProduto, tipoModelo, colecaoJogo, estadoCondicao,
   *                           unidadeControle, fracionavel, qtdGeradaPadrao, produtoGeradoPadrao,
   *                           observacoes }
   */
  function cadastrar(dados) {
    // --- Validações obrigatórias ---
    if (Utils.eVazio(dados.negocio)) {
      return { sucesso: false, idProduto: null, erro: 'Negócio é obrigatório.' };
    }
    if (!Utils.estaNaLista(dados.negocio, NEGOCIOS_VALIDOS)) {
      return { sucesso: false, idProduto: null, erro: 'Negócio inválido. Use: ' + NEGOCIOS_VALIDOS.join(', ') };
    }
    if (Utils.eVazio(dados.nomeProduto)) {
      return { sucesso: false, idProduto: null, erro: 'Nome do Produto é obrigatório.' };
    }
    if (Utils.eVazio(dados.tipoModelo)) {
      return { sucesso: false, idProduto: null, erro: 'Tipo / Modelo é obrigatório.' };
    }
    if (Utils.eVazio(dados.unidadeControle)) {
      return { sucesso: false, idProduto: null, erro: 'Unidade de Controle é obrigatória.' };
    }

    // --- Regras específicas de fracionamento Pokémon ---
    var ehPokemon = Utils.normalizar(dados.negocio) === Utils.normalizar(NEGOCIO_POKEMON);
    var fracionavel = _normalizarValorProduto(dados.fracionavel) === 'sim';

    if (fracionavel) {
      if (!ehPokemon) {
        return { sucesso: false, idProduto: null, erro: 'Apenas produtos Pokémon TCG podem ser fracionáveis.' };
      }
      var qtdPadrao = parseInt(dados.qtdGeradaPadrao || 0, 10);
      if (!qtdPadrao || qtdPadrao <= 0) {
        return { sucesso: false, idProduto: null, erro: 'Produto fracionável requer Quantidade Gerada Padrão > 0.' };
      }
      if (Utils.eVazio(dados.produtoGeradoPadrao)) {
        return { sucesso: false, idProduto: null, erro: 'Produto fracionável requer Produto Gerado Padrão.' };
      }
      // Verificar se produto gerado existe e está ativo
      var prodGerado = _buscarPorId(dados.produtoGeradoPadrao);
      if (!prodGerado) {
        return { sucesso: false, idProduto: null, erro: 'Produto Gerado Padrão não encontrado.' };
      }
      if (!_eAtivo(prodGerado)) {
        return { sucesso: false, idProduto: null, erro: 'Produto Gerado Padrão está inativo.' };
      }
    }

    // --- Detecção de duplicidade por chave ---
    var chave = _montarChave(dados.negocio, dados.nomeProduto, dados.estadoCondicao, dados.colecaoJogo);
    var todos  = _listarTodos();
    for (var i = 0; i < todos.length; i++) {
      var p = todos[i];
      var chaveExistente = p[CAMPOS.CHAVE_PRODUTO] || _montarChave(
        p[CAMPOS.NEGOCIO], p[CAMPOS.NOME_PRODUTO], p[CAMPOS.ESTADO_CONDICAO], p[CAMPOS.COLECAO_JOGO]
      );
      if (chaveExistente === chave && _eAtivo(p)) {
        LogService.warning('ProdutoService', 'cadastrar',
          'Possível duplicidade detectada para chave: ' + chave, null);
        // Não bloqueia, apenas alerta — conforme Doc 04 §8.4 "Status Validação: Duplicidade possível"
      }
    }

    // --- Gerar ID ---
    var idProduto = IdService.gerarIdProduto();
    var agora     = Utils.timestamp();
    var usuario   = Utils.usuarioAtivo();

    // --- Montar linha ---
    var linha = {};
    linha[CAMPOS.ID_PRODUTO]         = idProduto;
    linha[CAMPOS.NEGOCIO]            = dados.negocio;
    linha[CAMPOS.NOME_PRODUTO]       = dados.nomeProduto;
    linha[CAMPOS.TIPO_MODELO]        = dados.tipoModelo;
    linha[CAMPOS.COLECAO_JOGO]       = dados.colecaoJogo       || '';
    linha[CAMPOS.ESTADO_CONDICAO]    = dados.estadoCondicao    || '';
    linha[CAMPOS.UNIDADE_CONTROLE]   = dados.unidadeControle;
    linha[CAMPOS.FRACIONAVEL]        = fracionavel ? 'Sim' : 'Não';
    linha[CAMPOS.QTD_GERADA_PADRAO]  = fracionavel ? parseInt(dados.qtdGeradaPadrao, 10) : '';
    linha[CAMPOS.PRODUTO_GERADO]     = fracionavel ? dados.produtoGeradoPadrao : '';
    linha[CAMPOS.ATIVO]              = 'Sim';
    linha[CAMPOS.CHAVE_PRODUTO]      = chave;
    linha[CAMPOS.DATA_CRIACAO]       = agora;
    linha[CAMPOS.USUARIO_CRIACAO]    = usuario;

    // --- Gravar ---
    try {
      SheetService.appendLinha(ABA, linha);
      LogService.info('ProdutoService', 'cadastrar',
        'Produto cadastrado com sucesso: ' + idProduto + ' | ' + dados.nomeProduto, idProduto);
      return { sucesso: true, idProduto: idProduto, erro: null };
    } catch (e) {
      LogService.error('ProdutoService', 'cadastrar',
        'Erro ao gravar produto: ' + e.message, null);
      return { sucesso: false, idProduto: null, erro: 'Erro ao gravar produto: ' + e.message };
    }
  }

  /**
   * Retorna dados resumidos de um produto para exibição em tela.
   * Retorna null se não encontrado ou inativo.
   */
  function resumoParaTela(idProduto) {
    var resultado = buscarProdutoAtivo(idProduto);
    if (resultado.erro) return null;
    var p = resultado.produto;
    return {
      idProduto:    p[CAMPOS.ID_PRODUTO],
      negocio:      p[CAMPOS.NEGOCIO],
      nomeProduto:  p[CAMPOS.NOME_PRODUTO],
      tipoModelo:   p[CAMPOS.TIPO_MODELO],
      colecaoJogo:  p[CAMPOS.COLECAO_JOGO],
      estado:       p[CAMPOS.ESTADO_CONDICAO],
      unidade:      p[CAMPOS.UNIDADE_CONTROLE],
      fracionavel:  _normalizarValorProduto(p[CAMPOS.FRACIONAVEL]) === 'sim',
      qtdPadrao:    parseInt(p[CAMPOS.QTD_GERADA_PADRAO] || 0, 10),
      produtoGerado: p[CAMPOS.PRODUTO_GERADO] || ''
    };
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    buscarPorId:          buscarPorId,
    buscarProdutoAtivo:   buscarProdutoAtivo,
    listarAtivosParaNegocio: listarAtivosParaNegocio,
    validarParaCompra:    validarParaCompra,
    validarParaAbertura:  validarParaAbertura,
    cadastrar:            cadastrar,
    resumoParaTela:       resumoParaTela
  };

})();
