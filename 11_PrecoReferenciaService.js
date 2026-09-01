/**
 * 11_PrecoReferenciaService.gs
 * ============================================================
 * Servico de Preco de Referencia — MVP 1.5 Manus
 * ============================================================
 * Registra precos manuais de referencia, classifica vigencia,
 * atualiza valor de mercado de lotes e identifica produtos sem
 * preco ou com preco vencido. Inclui metadados de mercado do
 * produto quando ProdutoMercadoService estiver disponivel.
 *
 * Nao altera custo historico nem lucro realizado.
 * ============================================================
 */

var PrecoReferenciaService = (function () {

  var ABA_REF = CONFIG.ABAS.REFERENCIAS_PRECO;
  var ABA_PROD = CONFIG.ABAS.PRODUTOS_ATIVOS;
  var ABA_LOTES = CONFIG.ABAS.LOTES_ESTOQUE;
  var ABA_LOGS = CONFIG.ABAS.LOGS_SISTEMA;

  var C_REF = CONFIG.CAMPOS.REFERENCIAS_PRECO;
  var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var C_LOTE = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var C_LOG = CONFIG.CAMPOS.LOGS_SISTEMA;

  function _numero(valor) {
    return Utils.parsarMoeda(valor || 0);
  }

  function _normalizar(valor) {
    return Utils.normalizarChave(valor);
  }

  function _normalizarChave(campo) {
    return _normalizar(campo).replace(/[^a-z0-9]/g, '');
  }

  function _data(valor) {
    if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    return Utils.paraData(valor);
  }

  function _diasDesde(dataReferencia) {
    var data = _data(dataReferencia);
    if (!data) return null;
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    data.setHours(0, 0, 0, 0);
    return Math.floor((hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24));
  }

  function _cabecalhos(nomeAba) {
    return SheetService.getCabecalhos(nomeAba);
  }

  function _temCampo(cabecalhos, campo) {
    return cabecalhos.indexOf(campo) !== -1;
  }

  function _setSeExiste(linha, cabecalhos, campo, valor) {
    if (campo && _temCampo(cabecalhos, campo)) linha[campo] = valor;
  }

  function _filtrarPorCabecalho(nomeAba, linha) {
    var cabecalhos = _cabecalhos(nomeAba);
    var filtrada = {};
    Object.keys(linha).forEach(function(campo) {
      if (_temCampo(cabecalhos, campo)) filtrada[campo] = linha[campo];
    });
    return filtrada;
  }

  function _lerCampo(obj, aliases) {
    if (!obj) return '';
    for (var i = 0; i < aliases.length; i++) {
      if (Object.prototype.hasOwnProperty.call(obj, aliases[i])) return obj[aliases[i]];
    }

    var mapa = {};
    Object.keys(obj).forEach(function(chave) {
      mapa[_normalizarChave(chave)] = chave;
    });

    for (var j = 0; j < aliases.length; j++) {
      var real = mapa[_normalizarChave(aliases[j])];
      if (real) return obj[real];
    }
    return '';
  }

  function _erro(operacao, mensagem, refId) {
    LogService.warning('PrecoReferenciaService', operacao, mensagem, refId || '');
    return { sucesso: false, idReferencia: null, erro: mensagem, detalhes: [mensagem] };
  }

  function _buscarProduto(idProduto) {
    if (Utils.eVazio(idProduto)) return null;
    var registro = SheetService.buscarPrimeiroPorCampo(ABA_PROD, C_PROD.ID_PRODUTO, idProduto);
    return registro ? registro.dados : null;
  }

  function _produtoAtivo(produto) {
    var ativo = _lerCampo(produto, [C_PROD.ATIVO, 'Ativo?', 'Ativo', 'ativo']);
    if (Utils.eVazio(ativo)) return false;
    return _normalizar(ativo) === 'sim';
  }

  function _produtoNegocio(produto) {
    return _lerCampo(produto, [C_PROD.NEGOCIO, 'Negócio', 'Negocio', 'negocio']);
  }

  function _metadadosMercadoProduto(idProduto) {
    try {
      if (typeof ProdutoMercadoService === 'undefined' || !ProdutoMercadoService.obterMetadadosProduto) {
        return {
          paisRegiao: '',
          idioma: '',
          mercadoReferencia: '',
          fontePrecoPreferencial: '',
          limitacoesMercado: ['ProdutoMercadoService indisponível.']
        };
      }
      var res = ProdutoMercadoService.obterMetadadosProduto(idProduto);
      if (!res || !res.sucesso) {
        return {
          paisRegiao: '',
          idioma: '',
          mercadoReferencia: '',
          fontePrecoPreferencial: '',
          limitacoesMercado: res && res.erro ? [res.erro] : []
        };
      }
      return {
        paisRegiao: res.metadados.paisRegiao,
        idioma: res.metadados.idioma,
        mercadoReferencia: res.metadados.mercadoReferencia,
        fontePrecoPreferencial: res.metadados.fontePrecoPreferencial,
        limitacoesMercado: res.limitacoes || []
      };
    } catch (e) {
      return {
        paisRegiao: '',
        idioma: '',
        mercadoReferencia: '',
        fontePrecoPreferencial: '',
        limitacoesMercado: ['Erro ao obter metadados de mercado: ' + e.message]
      };
    }
  }

  function _anexarMetadadosPreco(obj, idProduto) {
    var meta = _metadadosMercadoProduto(idProduto);
    obj.paisRegiao = meta.paisRegiao;
    obj.idioma = meta.idioma;
    obj.mercadoReferencia = meta.mercadoReferencia;
    obj.fontePrecoPreferencial = meta.fontePrecoPreferencial;
    obj.limitacoesMercado = meta.limitacoesMercado;
    return obj;
  }

  function _idRequisicaoJaProcessado(idRequisicao) {
    if (Utils.eVazio(idRequisicao)) return false;

    try {
      var cab = _cabecalhos(ABA_REF);
      if (_temCampo(cab, 'ID Requisição')) {
        var refs = SheetService.buscarPorCampo(ABA_REF, 'ID Requisição', idRequisicao);
        if (refs && refs.length > 0) return true;
      }
    } catch (e) {
      console.warn('[11_PrecoReferenciaService] Falha ao verificar duplicidade em Referencias_Preco: ' + e.message);
    }

    try {
      // Fallback só usado quando Referencias_Preco não tem coluna "ID
      // Requisição" (ou a busca acima falhou tecnicamente). Checa
      // Módulo+Severidade em vez de um trecho fixo da mensagem de log —
      // texto de mensagem pode mudar em qualquer revisão futura e
      // quebraria essa proteção silenciosamente.
      var logs = SheetService.buscarPorCampo(ABA_LOGS, C_LOG.REF_ID, idRequisicao);
      for (var i = 0; i < logs.length; i++) {
        var dados = logs[i].dados;
        if (String(dados[C_LOG.MODULO]) === 'PrecoReferenciaService' &&
            String(dados[C_LOG.SEVERIDADE]) === 'INFO') {
          return true;
        }
      }
    } catch (le) {
      console.warn('[11_PrecoReferenciaService] Falha ao verificar duplicidade em Logs: ' + le.message);
    }

    return false;
  }

  function _diasParametro(nome, padrao) {
    try {
      var valor = SheetService.lerConfigApp(nome);
      var num = parseInt(valor, 10);
      return isNaN(num) || num <= 0 ? padrao : num;
    } catch (e) {
      return padrao;
    }
  }

  /**
   * @param {string} dataReferencia
   * @param {number} [diasAtualizadoParam] - se informado, pula a leitura de
   *   Config_App (uso interno para listagens em lote, ver _diasParametrosPadrao_).
   * @param {number} [diasAtencaoParam]
   */
  function classificarStatusPreco(dataReferencia, diasAtualizadoParam, diasAtencaoParam) {
    if (Utils.eVazio(dataReferencia)) return 'Sem Preço';
    var dias = _diasDesde(dataReferencia);
    if (dias === null || isNaN(dias)) return 'Sem Preço';

    var diasAtualizado = diasAtualizadoParam !== undefined ? diasAtualizadoParam : _diasParametro('PRECO_DIAS_ATUALIZADO', 30);
    var diasAtencao = diasAtencaoParam !== undefined ? diasAtencaoParam : _diasParametro('PRECO_DIAS_ATENCAO', 60);

    if (dias <= diasAtualizado) return 'Atualizado';
    if (dias <= diasAtencao) return 'Atenção';
    return 'Vencido';
  }

  /** Lê os dois parâmetros de dias de Config_App uma única vez. */
  function _diasParametrosPadrao_() {
    return {
      atualizado: _diasParametro('PRECO_DIAS_ATUALIZADO', 30),
      atencao: _diasParametro('PRECO_DIAS_ATENCAO', 60)
    };
  }

  function registrarPrecoReferencia(payload) {
    payload = payload || {};
    var idRequisicao = payload.idRequisicao || '';
    var preco = _numero(payload.precoUnitario);

    if (_idRequisicaoJaProcessado(idRequisicao)) {
      return _erro('registrarPrecoReferencia', 'Este preço de referência já foi processado anteriormente. Código: ' + idRequisicao, idRequisicao);
    }

    if (isNaN(preco) || preco <= 0) {
      return _erro('registrarPrecoReferencia', 'Preço unitário deve ser maior que zero.', idRequisicao);
    }

    var produto = _buscarProduto(payload.idProduto);
    if (!produto) {
      return _erro('registrarPrecoReferencia', 'Produto não encontrado: ' + (payload.idProduto || ''), idRequisicao);
    }

    if (!_produtoAtivo(produto)) {
      return _erro('registrarPrecoReferencia', 'Produto inativo não pode receber preço de referência: ' + payload.idProduto, idRequisicao);
    }

    var negocioProduto = _produtoNegocio(produto);
    if (_normalizar(negocioProduto) !== _normalizar(payload.negocio)) {
      return _erro('registrarPrecoReferencia', 'Negócio divergente para o produto ' + payload.idProduto + '. Produto: ' + negocioProduto + ' | Payload: ' + payload.negocio, idRequisicao);
    }

    var dataReferencia = payload.dataReferencia || Utils.formatarData(new Date());
    if (!_data(dataReferencia)) {
      return _erro('registrarPrecoReferencia', 'Data de referência inválida: ' + dataReferencia, idRequisicao);
    }

    var idReferencia = IdService.gerarIdReferencia();
    var cab = _cabecalhos(ABA_REF);
    var status = classificarStatusPreco(dataReferencia);
    var dias = _diasDesde(dataReferencia);
    var nomeProduto = _lerCampo(produto, [C_PROD.NOME_PRODUTO, 'Produto', 'Nome Produto']);
    // Guardada para uso futuro em deduplicação (mesmo produto+condição+
    // fonte+data) — hoje só é gravada, ainda não é lida/consultada em
    // nenhum lugar do sistema. Não implementar checagem de duplicidade
    // baseada nela sem confirmar a regra com o dono do produto primeiro.
    var chavePreco = [payload.idProduto, payload.estadoCondicao || '', payload.fonte || '', dataReferencia].join('|');

    var linha = {};
    linha[C_REF.ID_REF] = idReferencia;
    linha[C_REF.DATA_REF] = dataReferencia;
    linha[C_REF.ID_PRODUTO] = payload.idProduto;
    linha[C_REF.PRODUTO] = nomeProduto;
    linha[C_REF.NEGOCIO] = payload.negocio;
    linha[C_REF.ESTADO_CONDICAO] = payload.estadoCondicao || '';
    linha[C_REF.PRECO_UNIT] = preco;
    linha[C_REF.PRECO_USADO] = preco;
    linha[C_REF.FONTE] = payload.fonte || 'Manual';
    linha[C_REF.LINK_REF] = payload.linkReferencia || '';
    linha[C_REF.STATUS_PRECO] = status;
    linha[C_REF.DIAS_ATUALIZACAO] = dias;
    linha[C_REF.CHAVE_PRECO] = chavePreco;
    linha[C_REF.DATA_REGISTRO] = Utils.timestamp();
    linha[C_REF.USUARIO_REGISTRO] = Utils.usuarioAtivo();

    _setSeExiste(linha, cab, 'Observação', payload.observacao || '');
    _setSeExiste(linha, cab, 'ID Requisição', idRequisicao);

    try {
      SheetService.appendLinha(ABA_REF, _filtrarPorCabecalho(ABA_REF, linha));
      LogService.info('PrecoReferenciaService', 'registrarPrecoReferencia',
        'Preco registrado: ' + idReferencia + ' | Produto: ' + payload.idProduto + ' | Valor: ' + preco,
        idRequisicao || idReferencia);
      return {
        sucesso: true,
        idReferencia: idReferencia,
        erro: null,
        detalhes: ['Preço registrado: ' + idReferencia + ' | Produto: ' + payload.idProduto + ' | Valor: ' + preco]
      };
    } catch (e) {
      LogService.error('PrecoReferenciaService', 'registrarPrecoReferencia', 'Erro técnico ao registrar preço: ' + e.message, idRequisicao);
      return { sucesso: false, idReferencia: null, erro: 'Erro técnico ao registrar preço: ' + e.message, detalhes: [e.message] };
    }
  }

  function _ordenarRefsValidas_(refsDoProduto) {
    var validas = [];
    (refsDoProduto || []).forEach(function(r) {
      var preco = _numero(r[C_REF.PRECO_UNIT]);
      var dataRef = _data(r[C_REF.DATA_REF]);
      if (preco <= 0 || !dataRef) return;
      validas.push({ dados: r, preco: preco, data: dataRef });
    });

    validas.sort(function(a, b) {
      var diffData = b.data.getTime() - a.data.getTime();
      if (diffData !== 0) return diffData;
      return String(b.dados[C_REF.ID_REF]).localeCompare(String(a.dados[C_REF.ID_REF]));
    });

    return validas;
  }

  function _refsValidasProduto(idProduto) {
    var refs = SheetService.getDadosComoObjetos(ABA_REF);
    var doProduto = refs.filter(function(r) { return String(r[C_REF.ID_PRODUTO]) === String(idProduto); });
    return _ordenarRefsValidas_(doProduto);
  }

  /**
   * Lê Referencias_Preco uma única vez e agrupa por ID Produto — usado
   * por listagens que chamam obterPrecoVigente para vários produtos
   * (evita reler a aba inteira uma vez por produto).
   */
  function _agruparRefsPorProduto_() {
    var refs = SheetService.getDadosComoObjetos(ABA_REF);
    var porProduto = {};
    refs.forEach(function(r) {
      var id = String(r[C_REF.ID_PRODUTO]);
      if (!porProduto[id]) porProduto[id] = [];
      porProduto[id].push(r);
    });
    var validasPorProduto = {};
    Object.keys(porProduto).forEach(function(id) {
      validasPorProduto[id] = _ordenarRefsValidas_(porProduto[id]);
    });
    return validasPorProduto;
  }

  /**
   * @param {string} idProduto
   * @param {Array} [refsPreCarregadas] - se informado (já ordenadas por
   *   _ordenarRefsValidas_/_agruparRefsPorProduto_), pula a releitura de
   *   Referencias_Preco. Uso interno para listagens em lote.
   * @param {{atualizado:number, atencao:number}} [diasPreCarregados] - se
   *   informado, pula a releitura de Config_App. Uso interno para
   *   listagens em lote.
   */
  function obterPrecoVigente(idProduto, refsPreCarregadas, diasPreCarregados) {
    var validas = refsPreCarregadas || _refsValidasProduto(idProduto);
    if (validas.length === 0) {
      return _anexarMetadadosPreco({
        idProduto: idProduto,
        precoUnitario: 0,
        fonte: '',
        dataReferencia: '',
        statusPreco: 'Sem Preço',
        diasDesdeAtualizacao: null,
        observacao: ''
      }, idProduto);
    }

    var ref = validas[0].dados;
    var dataReferencia = ref[C_REF.DATA_REF];
    var dias = diasPreCarregados || {};
    return _anexarMetadadosPreco({
      idProduto: idProduto,
      idReferencia: ref[C_REF.ID_REF],
      precoUnitario: _numero(ref[C_REF.PRECO_UNIT]),
      fonte: ref[C_REF.FONTE] || '',
      dataReferencia: dataReferencia,
      statusPreco: classificarStatusPreco(dataReferencia, dias.atualizado, dias.atencao),
      diasDesdeAtualizacao: _diasDesde(dataReferencia),
      observacao: _lerCampo(ref, ['Observação', 'Observacao', 'observacao'])
    }, idProduto);
  }

  function _mapaColunas(nomeAba) {
    var cabecalhos = _cabecalhos(nomeAba);
    var mapa = {};
    cabecalhos.forEach(function(c, i) { if (c) mapa[c] = i + 1; });
    return mapa;
  }

  function _atualizarCampo(sheet, linha, mapa, campo, valor) {
    if (mapa[campo]) sheet.getRange(linha, mapa[campo]).setValue(valor);
  }

  function atualizarValorMercadoProduto(idProduto) {
    var preco = obterPrecoVigente(idProduto);
    if (!preco || preco.statusPreco === 'Sem Preço') {
      LogService.warning('PrecoReferenciaService', 'atualizarValorMercadoProduto', 'Produto sem preço vigente: ' + idProduto, idProduto);
      return { sucesso: false, idProduto: idProduto, lotesAtualizados: 0, erro: 'Produto sem preço vigente.', limitacoes: ['Cadastre um preço de referência válido antes de atualizar mercado.'] };
    }

    var cab = _cabecalhos(ABA_LOTES);
    var camposMercado = [C_LOTE.VLR_MERCADO_UNIT, C_LOTE.VLR_MERCADO_TOTAL, C_LOTE.GANHO_PERDA];
    var ausentes = [];
    camposMercado.forEach(function(campo) { if (!_temCampo(cab, campo)) ausentes.push(campo); });
    if (ausentes.length > 0) {
      var msg = 'Campos de mercado ausentes em Lotes_Estoque: ' + ausentes.join(', ');
      LogService.warning('PrecoReferenciaService', 'atualizarValorMercadoProduto', msg, idProduto);
      return { sucesso: false, idProduto: idProduto, lotesAtualizados: 0, erro: msg, limitacoes: ['Nenhuma coluna foi criada automaticamente.'] };
    }

    var registros = SheetService.buscarPorCampo(ABA_LOTES, C_LOTE.ID_PRODUTO, idProduto);
    var sheet = SheetService.getSheet(ABA_LOTES);
    var mapa = _mapaColunas(ABA_LOTES);
    var atualizados = [];
    var lock = LockService.getDocumentLock();

    try {
      lock.waitLock(15000);
      registros.forEach(function(reg) {
        var lote = reg.dados;
        var qtd = _numero(lote[C_LOTE.QTD_DISPONIVEL]) + _numero(lote[C_LOTE.QTD_HOLD]);
        var custoUnit = _numero(lote[C_LOTE.CUSTO_UNIT]);
        var valorMercadoTotal = Utils.arredondar(qtd * preco.precoUnitario, 2);
        var custoEmEstoque = Utils.arredondar(qtd * custoUnit, 2);
        var ganhoPerda = Utils.arredondar(valorMercadoTotal - custoEmEstoque, 2);

        _atualizarCampo(sheet, reg.linha, mapa, C_LOTE.VLR_MERCADO_UNIT, preco.precoUnitario);
        _atualizarCampo(sheet, reg.linha, mapa, C_LOTE.VLR_MERCADO_TOTAL, valorMercadoTotal);
        _atualizarCampo(sheet, reg.linha, mapa, C_LOTE.GANHO_PERDA, ganhoPerda);

        atualizados.push({
          idLote: lote[C_LOTE.ID_LOTE],
          quantidadeMercado: qtd,
          valorMercadoUnitario: preco.precoUnitario,
          valorMercadoTotal: valorMercadoTotal,
          ganhoPerdaNaoRealizada: ganhoPerda
        });
      });
    } catch (e) {
      LogService.error('PrecoReferenciaService', 'atualizarValorMercadoProduto', 'Erro técnico ao atualizar mercado: ' + e.message, idProduto);
      return { sucesso: false, idProduto: idProduto, lotesAtualizados: 0, erro: e.message, limitacoes: [] };
    } finally {
      try { lock.releaseLock(); } catch (le) {}
    }

    LogService.info('PrecoReferenciaService', 'atualizarValorMercadoProduto',
      'Valor de mercado atualizado | Produto: ' + idProduto + ' | Lotes: ' + atualizados.length,
      idProduto);

    return {
      sucesso: true,
      idProduto: idProduto,
      precoVigente: preco,
      lotesAtualizados: atualizados.length,
      detalhes: atualizados,
      limitacoes: ['Custo histórico, custo vendido e lucro realizado não foram alterados.'],
      erro: null
    };
  }

  function _produtosAtivos() {
    var produtos = SheetService.getDadosComoObjetos(ABA_PROD);
    var ativos = [];
    produtos.forEach(function(p) {
      if (_produtoAtivo(p)) ativos.push(p);
    });
    return ativos;
  }

  function listarProdutosSemPreco() {
    var resultado = [];
    var refsPorProduto = _agruparRefsPorProduto_();
    var dias = _diasParametrosPadrao_();
    _produtosAtivos().forEach(function(p) {
      var idProduto = p[C_PROD.ID_PRODUTO];
      var preco = obterPrecoVigente(idProduto, refsPorProduto[String(idProduto)] || [], dias);
      if (preco.statusPreco === 'Sem Preço') {
        resultado.push({
          idProduto: idProduto,
          produto: p[C_PROD.NOME_PRODUTO] || '',
          negocio: _produtoNegocio(p),
          paisRegiao: preco.paisRegiao,
          idioma: preco.idioma,
          mercadoReferencia: preco.mercadoReferencia,
          fontePrecoPreferencial: preco.fontePrecoPreferencial,
          statusPreco: 'Sem Preço'
        });
      }
    });
    return resultado;
  }

  function listarProdutosComPrecoVencido() {
    var resultado = [];
    var refsPorProduto = _agruparRefsPorProduto_();
    var dias = _diasParametrosPadrao_();
    _produtosAtivos().forEach(function(p) {
      var idProduto = p[C_PROD.ID_PRODUTO];
      var preco = obterPrecoVigente(idProduto, refsPorProduto[String(idProduto)] || [], dias);
      if (preco.statusPreco === 'Vencido') {
        resultado.push({
          idProduto: idProduto,
          produto: p[C_PROD.NOME_PRODUTO] || '',
          negocio: _produtoNegocio(p),
          paisRegiao: preco.paisRegiao,
          idioma: preco.idioma,
          mercadoReferencia: preco.mercadoReferencia,
          fontePrecoPreferencial: preco.fontePrecoPreferencial,
          precoUnitario: preco.precoUnitario,
          fonte: preco.fonte,
          dataReferencia: preco.dataReferencia,
          diasDesdeAtualizacao: preco.diasDesdeAtualizacao,
          statusPreco: preco.statusPreco
        });
      }
    });
    return resultado;
  }

  /**
   * Retorna um mapa {idProduto: precoVigente} para vários produtos de
   * uma vez, lendo Referencias_Preco e Config_App uma única vez em vez
   * de por produto. Uso recomendado em telas do Portal que exibem preço
   * vigente para uma lista de lotes/produtos (Dashboard, Estoque).
   * @param {Array<string>} idsProdutos
   * @returns {Object<string, Object>}
   */
  function obterPrecosVigentesEmLote(idsProdutos) {
    var refsPorProduto = _agruparRefsPorProduto_();
    var dias = _diasParametrosPadrao_();
    var mapa = {};
    (idsProdutos || []).forEach(function(idProduto) {
      var chave = String(idProduto);
      if (mapa.hasOwnProperty(chave)) return;
      mapa[chave] = obterPrecoVigente(idProduto, refsPorProduto[chave] || [], dias);
    });
    return mapa;
  }

  return {
    registrarPrecoReferencia: registrarPrecoReferencia,
    atualizarValorMercadoProduto: atualizarValorMercadoProduto,
    classificarStatusPreco: classificarStatusPreco,
    obterPrecoVigente: obterPrecoVigente,
    obterPrecosVigentesEmLote: obterPrecosVigentesEmLote,
    listarProdutosSemPreco: listarProdutosSemPreco,
    listarProdutosComPrecoVencido: listarProdutosComPrecoVencido
  };

})();
