/**
 * 07_CompraService.gs
 * ============================================================
 * Serviço de Compra — MVP 1.5 Manus
 * ============================================================
 * Responsabilidades:
 *  - Validar payload de compra (cabeçalho + itens)
 *  - Calcular rateio de frete, taxas e desconto por item
 *  - Gerar IDs de compra, item, lote e movimento
 *  - Gravar Compras, Itens_Compra, Lotes_Estoque, Movimentos_Estoque
 *  - Registrar logs técnicos
 *  - Prevenir duplicidade via ID Requisição
 *  - Impedir gravação parcial (atomicidade lógica)
 *
 * Dependências: 00_Config, 02_Utils, 03_SheetService, 04_IdService,
 *               06_ProdutoService, 08_EstoqueService, 14_LogService
 * Abas gravadas: Compras, Itens_Compra, Lotes_Estoque, Movimentos_Estoque, Logs_Sistema
 * Abas consultadas: Produtos_Ativos, Configuracoes
 *
 * REGRAS CRÍTICAS (Doc 05):
 *  - Toda compra válida gera lote e movimento
 *  - Custo Unitário Final = (VlrTotalBruto + CustoRateado) / Quantidade
 *  - Todo lote entra como Disponível
 *  - Lote sem produto, quantidade ou custo é bloqueado
 *  - Compra não pode ficar gravada pela metade
 *  - ID Requisição previne duplicidade
 * ============================================================
 */

var CompraService = (function () {

  // ============================================================
  // CONSTANTES INTERNAS
  // ============================================================
  var ABA_COMPRAS    = CONFIG.ABAS.COMPRAS;
  var ABA_ITENS      = CONFIG.ABAS.ITENS_COMPRA;
  var ABA_LOTES      = CONFIG.ABAS.LOTES_ESTOQUE;
  var ABA_MOVIMENTOS = CONFIG.ABAS.MOVIMENTOS_ESTOQUE;

  var C_COMPRA  = CONFIG.CAMPOS.COMPRAS;
  var C_ITEM    = CONFIG.CAMPOS.ITENS_COMPRA;
  var C_LOTE    = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var C_MOV     = CONFIG.CAMPOS.MOVIMENTOS_ESTOQUE;

  var NEGOCIO_POKEMON = 'Pokémon TCG';
  var NEGOCIOS_VALIDOS = CONFIG.LISTAS.NEGOCIOS;

  // Prefixo do log que marca uma compra efetivamente gravada. É o que a
  // verificação de duplicidade por log procura. Alterar aqui e na mensagem
  // de sucesso juntos.
  var MARCA_LOG_COMPRA_REGISTRADA = 'Compra registrada:';

  // ============================================================
  // FUNÇÕES PRIVADAS — VALIDAÇÃO
  // ============================================================

  /**
   * Valida o cabeçalho da compra.
   * Retorna { valido, erros[] }
   */
  function _validarCabecalho(cabecalho) {
    var erros = [];

    // Data obrigatória e válida
    if (Utils.eVazio(cabecalho.dataCompra)) {
      erros.push('Informe uma Data da Compra válida.');
    } else {
      var dt = Utils.parsarData(cabecalho.dataCompra);
      if (!dt) erros.push('Data da Compra inválida: ' + cabecalho.dataCompra);
    }

    // Negócio obrigatório e válido
    if (Utils.eVazio(cabecalho.negocio)) {
      erros.push('O negócio da compra é obrigatório.');
    } else if (!Utils.estaNaLista(cabecalho.negocio, NEGOCIOS_VALIDOS)) {
      erros.push('O negócio da compra é inválido. Use apenas: ' + NEGOCIOS_VALIDOS.join(', '));
    }

    // Frete, taxas e desconto: numéricos e não negativos
    var frete    = Utils.parsarMoeda(cabecalho.frete    || 0);
    var taxas    = Utils.parsarMoeda(cabecalho.taxas    || 0);
    var desconto = Utils.parsarMoeda(cabecalho.desconto || 0);

    if (isNaN(frete)    || frete    < 0) erros.push('Frete deve ser um valor numérico maior ou igual a zero.');
    if (isNaN(taxas)    || taxas    < 0) erros.push('Taxas devem ser um valor numérico maior ou igual a zero.');
    if (isNaN(desconto) || desconto < 0) erros.push('Desconto deve ser um valor numérico maior ou igual a zero.');

    return { valido: erros.length === 0, erros: erros };
  }

  /**
   * Valida os itens da compra.
   * Retorna { valido, erros[], itensParsados[] }
   */
  function _validarItens(itens, negocio) {
    var erros = [];
    var itensParsados = [];

    if (!itens || itens.length === 0) {
      erros.push('Adicione pelo menos um item à compra antes de salvar.');
      return { valido: false, erros: erros, itensParsados: [] };
    }

    for (var i = 0; i < itens.length; i++) {
      var item = itens[i];
      var idx  = i + 1;

      // Produto obrigatório e ativo
      if (Utils.eVazio(item.idProduto)) {
        erros.push('Item ' + idx + ': Selecione um produto ativo e compatível com o negócio da compra.');
        continue;
      }

      var validProd = ProdutoService.validarParaCompra(item.idProduto, negocio);
      if (!validProd.valido) {
        erros.push('Item ' + idx + ': ' + validProd.erro);
        continue;
      }

      // Quantidade obrigatória e inteira > 0
      var qtd = parseInt(item.quantidade || 0, 10);
      if (isNaN(qtd) || qtd <= 0) {
        erros.push('Item ' + idx + ': Informe uma quantidade inteira maior que zero.');
        continue;
      }

      // Valor unitário bruto obrigatório e >= 0
      var vlrUnit = Utils.parsarMoeda(item.valorUnitarioBruto);
      if (isNaN(vlrUnit) || vlrUnit < 0) {
        erros.push('Item ' + idx + ': Informe o valor unitário bruto do item.');
        continue;
      }

      itensParsados.push({
        idProduto:        item.idProduto,
        produto:          validProd.produto,
        quantidade:       qtd,
        valorUnitBruto:   vlrUnit,
        valorTotalBruto:  Utils.arredondar(qtd * vlrUnit, 2),
        observacao:       item.observacao || ''
      });
    }

    return { valido: erros.length === 0, erros: erros, itensParsados: itensParsados };
  }

  // ============================================================
  // FUNÇÕES PRIVADAS — CÁLCULO
  // ============================================================

  /**
   * Calcula rateio de custos adicionais por item.
   * Fórmulas (Doc 05 §11):
   *   Custo Adicional Líquido = Frete + Taxas - Desconto
   *   Participação = VlrTotalBrutoItem / SomaTotalBruta
   *   Custo Adicional Rateado = Participação × CustoAdicionalLíquido
   *   Custo Total Final = VlrTotalBruto + CustoAdicionalRateado
   *   Custo Unitário Final = CustoTotalFinal / Quantidade
   */
  function _calcularRateio(itens, frete, taxas, desconto) {
    var custoAdicionalLiquido = Utils.arredondar(frete + taxas - desconto, 2);
    var somaTotalBruta = 0;
    for (var i = 0; i < itens.length; i++) {
      somaTotalBruta += itens[i].valorTotalBruto;
    }
    somaTotalBruta = Utils.arredondar(somaTotalBruta, 2);

    var resultado = [];
    var somaRateado = 0;

    for (var j = 0; j < itens.length; j++) {
      var item = itens[j];
      var participacao = somaTotalBruta > 0
        ? Utils.arredondar(item.valorTotalBruto / somaTotalBruta, 6)
        : 0;

      var custoRateado;
      // Último item absorve diferença de arredondamento
      if (j === itens.length - 1) {
        custoRateado = Utils.arredondar(custoAdicionalLiquido - somaRateado, 2);
      } else {
        custoRateado = Utils.arredondar(participacao * custoAdicionalLiquido, 2);
        somaRateado += custoRateado;
      }

      var custoTotalFinal = Utils.arredondar(item.valorTotalBruto + custoRateado, 2);
      var custoUnitFinal  = item.quantidade > 0
        ? Utils.arredondar(custoTotalFinal / item.quantidade, 4)
        : 0;

      resultado.push({
        idProduto:          item.idProduto,
        produto:            item.produto,
        quantidade:         item.quantidade,
        valorUnitBruto:     item.valorUnitBruto,
        valorTotalBruto:    item.valorTotalBruto,
        participacaoRateio: participacao,
        custoAdicionalRateado: custoRateado,
        custoTotalFinal:    custoTotalFinal,
        custoUnitFinal:     custoUnitFinal,
        observacao:         item.observacao
      });
    }

    return {
      itens:                resultado,
      somaTotalBruta:       somaTotalBruta,
      custoAdicionalLiquido: custoAdicionalLiquido
    };
  }

  // ============================================================
  // FUNÇÕES PRIVADAS — MONTAGEM DE LINHAS
  // ============================================================

  /**
   * Monta linha de cabeçalho para aba Compras.
   */
  function _montarLinhaCompra(idCompra, cabecalho, valorProdutos, custoTotal, idRequisicao) {
    var linha = {};
    linha[C_COMPRA.ID_COMPRA]       = idCompra;
    linha[C_COMPRA.DATA_COMPRA]     = cabecalho.dataCompra;
    linha[C_COMPRA.NEGOCIO]         = cabecalho.negocio;
    linha[C_COMPRA.FORNECEDOR]      = cabecalho.fornecedor || '';
    linha[C_COMPRA.VALOR_PRODUTOS]  = valorProdutos;
    linha[C_COMPRA.FRETE]           = Utils.parsarMoeda(cabecalho.frete    || 0);
    linha[C_COMPRA.TAXAS]           = Utils.parsarMoeda(cabecalho.taxas    || 0);
    linha[C_COMPRA.DESCONTO]        = Utils.parsarMoeda(cabecalho.desconto || 0);
    linha[C_COMPRA.CUSTO_TOTAL]     = custoTotal;
    linha[C_COMPRA.STATUS]          = 'Registrada';
    linha[C_COMPRA.DATA_REGISTRO]   = Utils.timestamp();
    linha[C_COMPRA.USUARIO_REGISTRO]= Utils.usuarioAtivo();
    // Observação e ID Requisição (campos extras se existirem na aba)
    if (cabecalho.observacao) linha['Observação'] = cabecalho.observacao;
    if (idRequisicao)         linha['ID Requisição'] = idRequisicao;
    return linha;
  }

  /**
   * Monta linha de item para aba Itens_Compra.
   */
  function _montarLinhaItem(idItem, idCompra, dataCompra, negocio, itemCalc, idLote) {
    var p = itemCalc.produto;
    var linha = {};
    linha[C_ITEM.ID_ITEM]           = idItem;
    linha[C_ITEM.ID_COMPRA]         = idCompra;
    linha[C_ITEM.NEGOCIO]           = negocio;
    linha[C_ITEM.ID_PRODUTO]        = itemCalc.idProduto;
    linha[C_ITEM.PRODUTO]           = p[CONFIG.CAMPOS.PRODUTOS_ATIVOS.NOME_PRODUTO] || '';
    linha[C_ITEM.QUANTIDADE]        = itemCalc.quantidade;
    linha[C_ITEM.VALOR_UNIT_BRUTO]  = itemCalc.valorUnitBruto;
    linha[C_ITEM.VALOR_TOTAL_BRUTO] = itemCalc.valorTotalBruto;
    linha[C_ITEM.PARTICIPACAO_RATEIO] = itemCalc.participacaoRateio;
    linha[C_ITEM.CUSTO_ADICIONAL]   = itemCalc.custoAdicionalRateado;
    linha[C_ITEM.CUSTO_UNIT_FINAL]  = itemCalc.custoUnitFinal;
    linha[C_ITEM.CUSTO_TOTAL_FINAL] = itemCalc.custoTotalFinal;
    linha[C_ITEM.ID_LOTE_GERADO]    = idLote;
    linha[C_ITEM.STATUS]            = 'Lote Gerado';
    if (itemCalc.observacao) linha['Observação Item'] = itemCalc.observacao;
    return linha;
  }

  /**
   * Monta linha de lote para aba Lotes_Estoque.
   * Toda compra nasce Disponível (Trade Lock era regra exclusiva de
   * CS Skins e foi removido em v1.6.0).
   * Doc 05 §16.3
   */
  function _montarLinhaLote(idLote, idCompra, idItem, dataCompra, negocio, itemCalc) {
    var p = itemCalc.produto;
    var qtd = itemCalc.quantidade;

    var linha = {};
    linha[C_LOTE.ID_LOTE]           = idLote;
    linha[C_LOTE.ID_PRODUTO]        = itemCalc.idProduto;
    linha[C_LOTE.PRODUTO]           = p[CONFIG.CAMPOS.PRODUTOS_ATIVOS.NOME_PRODUTO] || '';
    linha[C_LOTE.NEGOCIO]           = negocio;
    linha[C_LOTE.TIPO_ORIGEM]       = 'Compra';
    linha[C_LOTE.ID_ORIGEM]         = idCompra;
    linha[C_LOTE.ID_ITEM_ORIGEM]    = idItem;
    linha[C_LOTE.QTD_TOTAL]         = qtd;
    linha[C_LOTE.QTD_DISPONIVEL]    = qtd;
    linha[C_LOTE.QTD_HOLD]          = 0;
    linha[C_LOTE.QTD_VENDIDA]       = 0;
    linha[C_LOTE.QTD_TRANSFORMADA]  = 0;
    linha[C_LOTE.CUSTO_UNIT]        = itemCalc.custoUnitFinal;
    linha[C_LOTE.CUSTO_TOTAL]       = itemCalc.custoTotalFinal;
    linha[C_LOTE.VLR_MERCADO_UNIT]  = '';
    linha[C_LOTE.VLR_MERCADO_TOTAL] = '';
    linha[C_LOTE.GANHO_PERDA]       = '';
    linha[C_LOTE.STATUS]            = 'Disponível';
    linha[C_LOTE.DATA_CRIACAO]      = Utils.timestamp();
    return linha;
  }

  /**
   * Monta linha de movimento para aba Movimentos_Estoque.
   * Doc 05 §17.2 e §17.3
   */
  function _montarLinhaMovimento(idMovimento, dataCompra, negocio, itemCalc, idLote, idItem) {
    var p = itemCalc.produto;

    var linha = {};
    linha[C_MOV.ID_MOVIMENTO]       = idMovimento;
    linha[C_MOV.DATA_MOVIMENTO]     = dataCompra;
    linha[C_MOV.TIPO_MOVIMENTO]     = 'Compra';
    linha[C_MOV.ID_LOTE]            = idLote;
    linha[C_MOV.PRODUTO]            = p[CONFIG.CAMPOS.PRODUTOS_ATIVOS.NOME_PRODUTO] || '';
    linha[C_MOV.NEGOCIO]            = negocio;
    linha[C_MOV.QTD_MOVIMENTO]      = itemCalc.quantidade;
    linha[C_MOV.SALDO_ANTERIOR]     = 0;
    linha[C_MOV.SALDO_POSTERIOR]    = itemCalc.quantidade;
    linha[C_MOV.REF_OPERACAO]       = idItem;
    linha[C_MOV.DATA_REGISTRO]      = Utils.timestamp();
    linha[C_MOV.USUARIO_REGISTRO]   = Utils.usuarioAtivo();
    return linha;
  }

  // ============================================================
  // FUNÇÕES PRIVADAS — PREVENÇÃO DE DUPLICIDADE
  // ============================================================

  /**
   * Verifica se ID Requisição já foi processado.
   *
   * CORREÇÃO v2 (2026-06-07):
   * Dupla verificação:
   *   1. Busca na aba Compras pelo campo 'ID Requisição' (fonte primária)
   *   2. Busca em Logs_Sistema por 'Referência ID' (fonte secundária)
   * Garante que uma mesma requisição não gere duas compras,
   * mesmo que o log tenha falhado ou a aba Compras não tenha o campo.
   *
   * @param {string} idRequisicao
   * @returns {boolean}
   */
  function _idRequisicaoJaProcessado(idRequisicao) {
    if (Utils.eVazio(idRequisicao)) return false;

    // Verificação primária: aba Compras (campo 'ID Requisição')
    try {
      var cabecalhos = SheetService.getCabecalhos(ABA_COMPRAS);
      if (cabecalhos.indexOf('ID Requisição') !== -1) {
        var compras = SheetService.buscarPorCampo(ABA_COMPRAS, 'ID Requisição', idRequisicao);
        if (compras && compras.length > 0) {
          console.warn('[07_CompraService] Duplicidade detectada em Compras: ' + idRequisicao);
          return true;
        }
      }
    } catch (e) {
      console.warn('[07_CompraService] Erro ao verificar duplicidade em Compras: ' + e.message);
    }

    // Verificação secundária: Logs_Sistema (campo 'Referência ID')
    try {
      // Só o log de compra REGISTRADA conta. Um log de erro técnico com a
      // mesma Referência ID significa que a gravação falhou, não que ela
      // aconteceu — contá-lo recusaria a retentativa de uma compra que
      // nunca entrou. Mesmo defeito que travava toda venda em VendaService.
      var logs = SheetService.buscarPorCampo(
        CONFIG.ABAS.LOGS_SISTEMA,
        'Referência ID',
        idRequisicao
      );
      for (var i = 0; i < logs.length; i++) {
        var msg = String(logs[i].dados[CONFIG.CAMPOS.LOGS_SISTEMA.MENSAGEM] || '');
        if (msg.indexOf(MARCA_LOG_COMPRA_REGISTRADA) === 0) {
          console.warn('[07_CompraService] Duplicidade detectada em Logs_Sistema: ' + idRequisicao);
          return true;
        }
      }
    } catch (e) {
      console.warn('[07_CompraService] Erro ao verificar duplicidade em Logs_Sistema: ' + e.message);
    }

    return false;
  }

  // ============================================================
  // FUNÇÃO PRINCIPAL PÚBLICA — SALVAR COMPRA
  // ============================================================

  /**
   * Salva uma compra completa: cabeçalho, itens, lotes e movimentos.
   * Implementa atomicidade lógica: valida tudo antes de gravar.
   *
   * @param {Object} payload - {
   *   idRequisicao: string (UUID para prevenção de duplicidade),
   *   cabecalho: {
   *     dataCompra, negocio, fornecedor, frete, taxas, desconto, observacao
   *   },
   *   itens: [{
   *     idProduto, quantidade, valorUnitarioBruto, observacao
   *   }]
   * }
   * @returns {Object} { sucesso, idCompra, idsLotes[], idsMov[], erro, detalhes }
   */

  // Gravação sem lock próprio — usadas dentro do LockService.getScriptLock()
  // de salvarCompra. SheetService.appendLinha/appendLinhas adquirem seu
  // próprio LockService.getDocumentLock() a cada chamada; usá-las aqui
  // dentro do lock externo já ativo significa 4 aquisições/liberações de
  // lock extras e redundantes por compra (o scriptLock externo já
  // serializa a gravação inteira). Mesmo padrão já usado em VendaService.
  function _appendObjetoSemLock(nomeAba, objeto) {
    var sheet = SheetService.getSheet(nomeAba);
    var linhaArray = SheetService.objetoParaLinha(nomeAba, objeto);
    sheet.appendRow(linhaArray);
    return sheet.getLastRow();
  }

  function _appendObjetosSemLock(nomeAba, objetos) {
    if (!objetos || objetos.length === 0) return 0;
    var sheet = SheetService.getSheet(nomeAba);
    var linhas = objetos.map(function(obj) {
      return SheetService.objetoParaLinha(nomeAba, obj);
    });
    var ultimaLinha = sheet.getLastRow();
    sheet.getRange(ultimaLinha + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
    return sheet.getLastRow();
  }

  function salvarCompra(payload) {
    var idRequisicao = payload.idRequisicao || Utils.uuid();

    // --- Prevenção de duplicidade ---
    if (_idRequisicaoJaProcessado(idRequisicao)) {
      LogService.warning('CompraService', 'salvarCompra',
        'Requisição duplicada ignorada: ' + idRequisicao, idRequisicao);
      return {
        sucesso: false,
        idCompra: null, idsLotes: [], idsMov: [],
        erro: 'Esta compra já foi processada anteriormente. Código: ' + idRequisicao,
        detalhes: []
      };
    }

    var cabecalho = payload.cabecalho || {};
    var itens     = payload.itens     || [];

    // --- Validar cabeçalho ---
    var valCab = _validarCabecalho(cabecalho);
    if (!valCab.valido) {
      return {
        sucesso: false, idCompra: null, idsLotes: [], idsMov: [],
        erro: valCab.erros.join(' | '), detalhes: valCab.erros
      };
    }

    // --- Validar itens ---
    var valItens = _validarItens(itens, cabecalho.negocio);
    if (!valItens.valido) {
      return {
        sucesso: false, idCompra: null, idsLotes: [], idsMov: [],
        erro: valItens.erros.join(' | '), detalhes: valItens.erros
      };
    }

    // --- Calcular rateio ---
    var frete    = Utils.parsarMoeda(cabecalho.frete    || 0);
    var taxas    = Utils.parsarMoeda(cabecalho.taxas    || 0);
    var desconto = Utils.parsarMoeda(cabecalho.desconto || 0);

    // Validar desconto excessivo
    var somaBruta = 0;
    for (var x = 0; x < valItens.itensParsados.length; x++) {
      somaBruta += valItens.itensParsados[x].valorTotalBruto;
    }
    var custoTotal = Utils.arredondar(somaBruta + frete + taxas - desconto, 2);
    if (custoTotal < 0) {
      return {
        sucesso: false, idCompra: null, idsLotes: [], idsMov: [],
        erro: 'O desconto informado é maior que o valor total da compra. Ajuste o desconto antes de salvar.',
        detalhes: []
      };
    }

    var rateio = _calcularRateio(valItens.itensParsados, frete, taxas, desconto);

    // --- Gerar todos os IDs em memória antes de gravar ---
    var idCompra = IdService.gerarIdCompra();
    var idsItens = [], idsLotes = [], idsMov = [];
    for (var k = 0; k < rateio.itens.length; k++) {
      idsItens.push(IdService.gerarIdItemCompra());
      idsLotes.push(IdService.gerarIdLote());
      idsMov.push(IdService.gerarIdMovimento());
    }

    // --- Montar todas as linhas em memória ---
    var linhaCompra = _montarLinhaCompra(
      idCompra, cabecalho, rateio.somaTotalBruta, custoTotal, idRequisicao
    );

    var linhasItens = [], linhasLotes = [], linhasMov = [];
    for (var m = 0; m < rateio.itens.length; m++) {
      var itemCalc = rateio.itens[m];
      var idItem   = idsItens[m];
      var idLote   = idsLotes[m];
      var idMov    = idsMov[m];

      // Bloquear lote sem produto, quantidade ou custo (regra crítica)
      if (Utils.eVazio(itemCalc.idProduto)) {
        return {
          sucesso: false, idCompra: null, idsLotes: [], idsMov: [],
          erro: 'Item ' + (m+1) + ': Produto é obrigatório para criar lote.',
          detalhes: []
        };
      }
      if (itemCalc.quantidade <= 0) {
        return {
          sucesso: false, idCompra: null, idsLotes: [], idsMov: [],
          erro: 'Item ' + (m+1) + ': Quantidade inválida para criar lote.',
          detalhes: []
        };
      }
      if (itemCalc.custoUnitFinal < 0) {
        return {
          sucesso: false, idCompra: null, idsLotes: [], idsMov: [],
          erro: 'Item ' + (m+1) + ': Custo unitário inválido para criar lote.',
          detalhes: []
        };
      }

      linhasItens.push(_montarLinhaItem(idItem, idCompra, cabecalho.dataCompra, cabecalho.negocio, itemCalc, idLote));
      linhasLotes.push(_montarLinhaLote(idLote, idCompra, idItem, cabecalho.dataCompra, cabecalho.negocio, itemCalc));
      linhasMov.push(_montarLinhaMovimento(idMov, cabecalho.dataCompra, cabecalho.negocio, itemCalc, idLote, idItem));
    }

    // --- Gravar com LockService (atomicidade lógica) ---
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(15000);

      // Gravar na ordem: Compras → Itens_Compra → Lotes_Estoque → Movimentos_Estoque
      _appendObjetoSemLock(ABA_COMPRAS, linhaCompra);
      _appendObjetosSemLock(ABA_ITENS,      linhasItens);
      _appendObjetosSemLock(ABA_LOTES,      linhasLotes);
      _appendObjetosSemLock(ABA_MOVIMENTOS, linhasMov);

      lock.releaseLock();

      // Log de sucesso — registra idRequisicao como Referência ID
      // CORREÇÃO v2: idRequisicao no log garante verificação secundária de duplicidade
      LogService.info('CompraService', 'salvarCompra',
        MARCA_LOG_COMPRA_REGISTRADA + ' ' + idCompra + ' | ' + rateio.itens.length + ' item(ns) | Negócio: ' + cabecalho.negocio + ' | Req: ' + idRequisicao,
        idRequisicao);

      return {
        sucesso:  true,
        idCompra: idCompra,
        idsLotes: idsLotes,
        idsMov:   idsMov,
        erro:     null,
        detalhes: [
          'Compra: ' + idCompra,
          'Itens: ' + idsItens.join(', '),
          'Lotes: ' + idsLotes.join(', '),
          'Movimentos: ' + idsMov.join(', ')
        ]
      };

    } catch (e) {
      try { lock.releaseLock(); } catch (le) {}

      // Log de falha técnica
      LogService.error('CompraService', 'salvarCompra',
        'Erro ao gravar compra: ' + e.message + ' | Requisição: ' + idRequisicao,
        idRequisicao);

      return {
        sucesso:  false,
        idCompra: null,
        idsLotes: [],
        idsMov:   [],
        erro:     'A compra não foi concluída com segurança. Nenhum lançamento deve ser considerado válido até a conferência técnica. Código da tentativa: ' + idRequisicao,
        detalhes: ['Erro técnico: ' + e.message]
      };
    }
  }

  /**
   * Retorna prévia de cálculo da compra sem gravar.
   * Útil para exibir custo unitário final antes de confirmar.
   *
   * @param {Object} payload - mesmo formato de salvarCompra
   * @returns {Object} { valido, itensCalculados[], custoTotal, erro }
   */
  function calcularPrevia(payload) {
    var cabecalho = payload.cabecalho || {};
    var itens     = payload.itens     || [];

    var valCab = _validarCabecalho(cabecalho);
    if (!valCab.valido) {
      return { valido: false, itensCalculados: [], custoTotal: 0, erro: valCab.erros.join(' | ') };
    }

    var valItens = _validarItens(itens, cabecalho.negocio);
    if (!valItens.valido) {
      return { valido: false, itensCalculados: [], custoTotal: 0, erro: valItens.erros.join(' | ') };
    }

    var frete    = Utils.parsarMoeda(cabecalho.frete    || 0);
    var taxas    = Utils.parsarMoeda(cabecalho.taxas    || 0);
    var desconto = Utils.parsarMoeda(cabecalho.desconto || 0);
    var rateio   = _calcularRateio(valItens.itensParsados, frete, taxas, desconto);
    var custoTotal = Utils.arredondar(rateio.somaTotalBruta + frete + taxas - desconto, 2);

    var resumo = rateio.itens.map(function (it) {
      return {
        idProduto:         it.idProduto,
        nomeProduto:       it.produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.NOME_PRODUTO] || '',
        quantidade:        it.quantidade,
        valorUnitBruto:    it.valorUnitBruto,
        valorTotalBruto:   it.valorTotalBruto,
        custoRateado:      it.custoAdicionalRateado,
        custoTotalFinal:   it.custoTotalFinal,
        custoUnitFinal:    it.custoUnitFinal
      };
    });

    return {
      valido:           true,
      itensCalculados:  resumo,
      somaTotalBruta:   rateio.somaTotalBruta,
      custoTotal:       custoTotal,
      erro:             null
    };
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    salvarCompra:   salvarCompra,
    calcularPrevia: calcularPrevia
  };

})();
