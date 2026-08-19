/**
 * 08_EstoqueService.gs
 * ============================================================
 * Serviço de Estoque — MVP 1.5 Manus
 * ============================================================
 * Responsabilidades:
 *  - Consultar saldo de lote por ID
 *  - Consultar lotes disponíveis de um produto
 *  - Registrar abertura Pokémon (fracionamento)
 *  - Atualizar saldos de lote (disponível, hold, vendido, transformado)
 *  - Gerar movimentos de estoque para qualquer operação
 *  - Bloquear operações inválidas (abertura sem saldo, etc.)
 *
 * Dependências: 00_Config, 02_Utils, 03_SheetService, 04_IdService,
 *               06_ProdutoService, 14_LogService
 * Abas gravadas: Lotes_Estoque, Movimentos_Estoque, Pokemon_Abertura_Box, Logs_Sistema
 * Abas consultadas: Produtos_Ativos, Configuracoes
 *
 * REGRAS CRÍTICAS (Doc 05 §16, Doc 07, Doc 08):
 *  - Abertura sem saldo disponível é bloqueada
 *  - Abertura de produto não fracionável é bloqueada
 *  - Custo total transferido = Qtd Aberta × Custo Unitário do Lote Origem
 *  - Custo unitário gerado = Custo Total Transferido / Qtd Total Gerada
 *
 * NOTA (v1.6.0): Trade Lock era regra exclusiva de CS Skins e foi
 * removido junto com o negócio.
 * ============================================================
 */

var EstoqueService = (function () {

  // ============================================================
  // CONSTANTES INTERNAS
  // ============================================================
  var ABA_LOTES      = CONFIG.ABAS.LOTES_ESTOQUE;
  var ABA_MOVIMENTOS = CONFIG.ABAS.MOVIMENTOS_ESTOQUE;
  var ABA_ABERTURA   = CONFIG.ABAS.POKEMON_ABERTURA_BOX;

  var C_LOTE  = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var C_MOV   = CONFIG.CAMPOS.MOVIMENTOS_ESTOQUE;
  var C_ABR   = CONFIG.CAMPOS.POKEMON_ABERTURA_BOX;
  var C_PROD  = CONFIG.CAMPOS.PRODUTOS_ATIVOS;

  var NEGOCIO_POKEMON = 'Pokémon TCG';

  // ============================================================
  // FUNÇÕES PRIVADAS — GRAVAÇÃO SEM LOCK PRÓPRIO
  // ============================================================
  // Usadas dentro do LockService.getScriptLock() de registrarAbertura.
  // SheetService.appendLinha adquire seu próprio LockService.getDocumentLock()
  // a cada chamada; usá-la aqui dentro do lock externo já ativo significa
  // aquisições/liberações de lock extras e redundantes (o scriptLock
  // externo já serializa a gravação inteira). Mesmo padrão de VendaService.
  function _appendObjetoSemLock(nomeAba, objeto) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomeAba);
    var linhaArray = SheetService.objetoParaLinha(nomeAba, objeto);
    sheet.appendRow(linhaArray);
    return sheet.getLastRow();
  }

  // ============================================================
  // FUNÇÕES PRIVADAS — LEITURA DE LOTE
  // ============================================================

  /**
   * Busca lote por ID Lote.
   */
  function _buscarLotePorId(idLote) {
    if (Utils.eVazio(idLote)) return null;
    var registro = SheetService.buscarPrimeiroPorCampo(ABA_LOTES, C_LOTE.ID_LOTE, idLote);
    return registro ? registro.dados : null;
  }

  /**
   * Retorna linha real (índice) de um lote na aba para atualização.
   */
  function _encontrarLinhaLote(idLote) {
    var dados = SheetService.getDadosComoObjetos(ABA_LOTES);
    for (var i = 0; i < dados.length; i++) {
      if (dados[i][C_LOTE.ID_LOTE] === idLote) return i + 2; // +2 = header + 1-based
    }
    return -1;
  }

  // ============================================================
  // FUNÇÕES PÚBLICAS — CONSULTA
  // ============================================================

  /**
   * Retorna saldo atual de um lote por ID.
   * Retorna null se não encontrado.
   */
  function consultarLote(idLote) {
    var lote = _buscarLotePorId(idLote);
    if (!lote) return null;
    return {
      idLote:          lote[C_LOTE.ID_LOTE],
      idProduto:       lote[C_LOTE.ID_PRODUTO],
      produto:         lote[C_LOTE.PRODUTO],
      negocio:         lote[C_LOTE.NEGOCIO],
      qtdTotal:        parseFloat(lote[C_LOTE.QTD_TOTAL]       || 0),
      qtdDisponivel:   parseFloat(lote[C_LOTE.QTD_DISPONIVEL]  || 0),
      qtdHold:         parseFloat(lote[C_LOTE.QTD_HOLD]        || 0),
      qtdVendida:      parseFloat(lote[C_LOTE.QTD_VENDIDA]     || 0),
      qtdTransformada: parseFloat(lote[C_LOTE.QTD_TRANSFORMADA]|| 0),
      custoUnit:       parseFloat(lote[C_LOTE.CUSTO_UNIT]      || 0),
      custoTotal:      parseFloat(lote[C_LOTE.CUSTO_TOTAL]     || 0),
      status:          lote[C_LOTE.STATUS]
    };
  }

  /**
   * Lista lotes disponíveis de um produto (status Disponível ou Parcial, qtdDisponivel > 0).
   * Ordena por data de criação (FIFO).
   */
  function listarLotesDisponiveisPorProduto(idProduto) {
    var todos = SheetService.getDadosComoObjetos(ABA_LOTES);
    var resultado = [];
    for (var i = 0; i < todos.length; i++) {
      var l = todos[i];
      if (l[C_LOTE.ID_PRODUTO] !== idProduto) continue;
      var qtdDisp = parseFloat(l[C_LOTE.QTD_DISPONIVEL] || 0);
      var status  = Utils.normalizar(l[C_LOTE.STATUS] || '').toLowerCase();
      if (qtdDisp > 0 && (status === 'disponível' || status === 'parcial')) {
        resultado.push({
          idLote:       l[C_LOTE.ID_LOTE],
          produto:      l[C_LOTE.PRODUTO],
          qtdDisponivel: qtdDisp,
          custoUnit:    parseFloat(l[C_LOTE.CUSTO_UNIT] || 0),
          dataCriacao:  l[C_LOTE.DATA_CRIACAO]
        });
      }
    }
    // Ordenar FIFO por data de criação
    resultado.sort(function (a, b) {
      var da = Utils.parsarData(a.dataCriacao);
      var db = Utils.parsarData(b.dataCriacao);
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
    return resultado;
  }

  // ============================================================
  // FUNÇÕES PÚBLICAS — ATUALIZAÇÃO DE SALDO
  // ============================================================

  /**
   * Atualiza campos de saldo de um lote diretamente na planilha.
   * Uso interno por outros services (CompraService, VendaService, etc.).
   *
   * @param {string} idLote
   * @param {Object} atualizacoes - campos a atualizar, ex: { QTD_DISPONIVEL: 5, STATUS: 'Parcial' }
   * @returns {boolean} sucesso
   */
  function atualizarSaldoLote(idLote, atualizacoes) {
    var linhaIdx = _encontrarLinhaLote(idLote);
    if (linhaIdx < 0) {
      LogService.error('EstoqueService', 'atualizarSaldoLote',
        'Lote não encontrado para atualização: ' + idLote, idLote);
      return false;
    }

    var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_LOTES);
    if (!aba) return false;

    var cabecalhos = SheetService.getCabecalhos(ABA_LOTES);
    var mapa = {};
    for (var i = 0; i < cabecalhos.length; i++) {
      mapa[cabecalhos[i]] = i + 1; // 1-based
    }

    // Resolve os índices de coluna primeiro; se formarem um intervalo
    // contíguo, grava tudo com um único setValues() em vez de um
    // setValue() por campo (menos chamadas de API por atualização de lote).
    var colunas = [];
    for (var campo in atualizacoes) {
      if (!atualizacoes.hasOwnProperty(campo)) continue;
      var nomeCampo = C_LOTE[campo] || campo;
      var colIdx    = mapa[nomeCampo];
      if (colIdx) colunas.push({ col: colIdx, valor: atualizacoes[campo] });
    }
    if (colunas.length === 0) return true;

    colunas.sort(function(a, b) { return a.col - b.col; });
    var colMin = colunas[0].col;
    var colMax = colunas[colunas.length - 1].col;
    var contiguo = (colMax - colMin + 1) === colunas.length;

    if (contiguo) {
      var valoresAtuais = aba.getRange(linhaIdx, colMin, 1, colMax - colMin + 1).getValues()[0];
      colunas.forEach(function(c) { valoresAtuais[c.col - colMin] = c.valor; });
      aba.getRange(linhaIdx, colMin, 1, valoresAtuais.length).setValues([valoresAtuais]);
    } else {
      colunas.forEach(function(c) { aba.getRange(linhaIdx, c.col).setValue(c.valor); });
    }
    return true;
  }

  /**
   * Grava um movimento de estoque avulso.
   * Usado por operações de liberação de trade lock, ajuste, etc.
   *
   * CORREÇÃO v2 (2026-06-07):
   * Aceita idMovimento opcional no payload.
   * Se informado, usa o ID fornecido (garantindo que o ID gerado em memória
   * seja o mesmo gravado na aba Movimentos_Estoque).
   * Se não informado, gera novo ID internamente.
   * Retorna sempre o ID real gravado.
   */
  function gravarMovimento(dadosMovimento) {
    var idMov = dadosMovimento.idMovimento || IdService.gerarIdMovimento();
    var linha = {};
    linha[C_MOV.ID_MOVIMENTO]     = idMov;
    linha[C_MOV.DATA_MOVIMENTO]   = dadosMovimento.dataMovimento || Utils.formatarData(new Date());
    linha[C_MOV.TIPO_MOVIMENTO]   = dadosMovimento.tipoMovimento || 'Ajuste';
    linha[C_MOV.ID_LOTE]          = dadosMovimento.idLote        || '';
    linha[C_MOV.PRODUTO]          = dadosMovimento.produto        || '';
    linha[C_MOV.NEGOCIO]          = dadosMovimento.negocio        || '';
    linha[C_MOV.QTD_MOVIMENTO]    = dadosMovimento.quantidade     || 0;
    linha[C_MOV.SALDO_ANTERIOR]   = dadosMovimento.saldoAnterior  || 0;
    linha[C_MOV.SALDO_POSTERIOR]  = dadosMovimento.saldoPosterior || 0;
    linha[C_MOV.REF_OPERACAO]     = dadosMovimento.refOperacao    || '';
    linha[C_MOV.DATA_REGISTRO]    = Utils.timestamp();
    linha[C_MOV.USUARIO_REGISTRO] = Utils.usuarioAtivo();
    if (dadosMovimento.subtipo)   linha['Subtipo Movimento']      = dadosMovimento.subtipo;
    if (dadosMovimento.statusDestino) linha['Status Destino']     = dadosMovimento.statusDestino;
    if (dadosMovimento.custoUnit) linha['Custo Unitário Movimento'] = dadosMovimento.custoUnit;

    SheetService.appendLinha(ABA_MOVIMENTOS, linha);
    return idMov;
  }

  // ============================================================
  // FUNÇÕES PÚBLICAS — ABERTURA POKÉMON
  // ============================================================

  /**
   * Registra abertura de produto Pokémon fracionável.
   * Implementa atomicidade lógica: valida tudo antes de gravar.
   *
   * Fórmulas (Doc 07 §4.6, §4.7, Arquitetura Técnica):
   *   Custo Total Consumido = Qtd Aberta × Custo Unitário Lote Origem
   *   Qtd Total Gerada = Qtd Aberta × Qtd Gerada por Unidade
   *   Custo Unitário Gerado = Custo Total Consumido / Qtd Total Gerada
   *
   * @param {Object} payload - {
   *   idLoteOrigem: string,
   *   qtdAbrir: number,
   *   qtdGeradaPorUnidade: number (opcional — usa padrão do produto se omitido),
   *   dataAbertura: string (opcional — usa hoje),
   *   observacao: string (opcional)
   * }
   * @returns {Object} { sucesso, idAbertura, idLoteDestino, idMovOrigem, idMovDestino, erro }
   */
  function registrarAbertura(payload) {
    var idLoteOrigem      = payload.idLoteOrigem;
    var qtdAbrir          = parseInt(payload.qtdAbrir || 0, 10);
    var dataAbertura      = payload.dataAbertura || Utils.formatarData(new Date());
    var observacao        = payload.observacao   || '';

    // --- Validar lote origem ---
    var loteOrigem = _buscarLotePorId(idLoteOrigem);
    if (!loteOrigem) {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Lote de origem não encontrado: ' + idLoteOrigem };
    }

    // Deve ser Pokémon TCG
    if (Utils.normalizar(loteOrigem[C_LOTE.NEGOCIO] || '') !== Utils.normalizar(NEGOCIO_POKEMON)) {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Apenas lotes Pokémon TCG podem ser abertos.' };
    }

    // Verificar status — não pode estar em hold
    var statusLote = Utils.normalizar(loteOrigem[C_LOTE.STATUS] || '').toLowerCase();
    if (statusLote === 'hold') {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Lote em Hold não pode ser aberto. Libere o hold antes.' };
    }
    if (statusLote === 'encerrado') {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Lote encerrado não pode ser aberto.' };
    }

    // Verificar saldo disponível
    var qtdDisponivel = parseFloat(loteOrigem[C_LOTE.QTD_DISPONIVEL] || 0);
    if (qtdAbrir <= 0) {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Quantidade a abrir deve ser maior que zero.' };
    }
    if (qtdAbrir > qtdDisponivel) {
      return {
        sucesso: false, idAbertura: null, idLoteDestino: null,
        erro: 'Quantidade a abrir (' + qtdAbrir + ') é maior que o saldo disponível (' + qtdDisponivel + ').'
      };
    }

    // --- Validar produto fracionável ---
    var idProdutoOrigem = loteOrigem[C_LOTE.ID_PRODUTO];
    var validFrac = ProdutoService.validarParaAbertura(idProdutoOrigem);
    if (!validFrac.valido) {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: validFrac.erro };
    }

    // Quantidade gerada por unidade
    var qtdGeradaPorUnidade = parseInt(payload.qtdGeradaPorUnidade || validFrac.qtdPadrao, 10);
    if (!qtdGeradaPorUnidade || qtdGeradaPorUnidade <= 0) {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Quantidade Gerada por Unidade inválida.' };
    }

    var produtoGerado = validFrac.produtoGerado;
    var idProdutoGerado = produtoGerado[C_PROD.ID_PRODUTO];

    // --- Calcular custo (Doc 07 §4.6, §4.7) ---
    var custoUnitOrigem      = parseFloat(loteOrigem[C_LOTE.CUSTO_UNIT] || 0);
    var custoTotalConsumido  = Utils.arredondar(qtdAbrir * custoUnitOrigem, 2);
    var qtdTotalGerada       = qtdAbrir * qtdGeradaPorUnidade;
    var custoUnitGerado      = qtdTotalGerada > 0
      ? Utils.arredondar(custoTotalConsumido / qtdTotalGerada, 4)
      : 0;

    // --- Gerar IDs ---
    var idAbertura    = IdService.gerarIdAbertura();
    var idLoteDestino = IdService.gerarIdLote();
    var idMovOrigem   = IdService.gerarIdMovimento();
    var idMovDestino  = IdService.gerarIdMovimento();

    // --- Montar linha de abertura ---
    var linhaAbertura = {};
    linhaAbertura[C_ABR.ID_ABERTURA]          = idAbertura;
    linhaAbertura[C_ABR.DATA_ABERTURA]        = dataAbertura;
    linhaAbertura[C_ABR.ID_LOTE_ORIGEM]       = idLoteOrigem;
    linhaAbertura[C_ABR.PRODUTO_ORIGEM]       = loteOrigem[C_LOTE.PRODUTO] || '';
    linhaAbertura[C_ABR.QTD_ABERTA]           = qtdAbrir;
    linhaAbertura[C_ABR.CUSTO_UNIT_ORIGEM]    = custoUnitOrigem;
    linhaAbertura[C_ABR.CUSTO_TOTAL_CONSUMIDO]= custoTotalConsumido;
    linhaAbertura[C_ABR.ID_LOTE_DESTINO]      = idLoteDestino;
    linhaAbertura[C_ABR.PRODUTO_DESTINO]      = produtoGerado[C_PROD.NOME_PRODUTO] || '';
    linhaAbertura[C_ABR.QTD_GERADA_POR_UNIT]  = qtdGeradaPorUnidade;
    linhaAbertura[C_ABR.QTD_TOTAL_GERADA]     = qtdTotalGerada;
    linhaAbertura[C_ABR.CUSTO_UNIT_DESTINO]   = custoUnitGerado;
    linhaAbertura[C_ABR.STATUS]               = 'Registrada';
    linhaAbertura[C_ABR.DATA_REGISTRO]        = Utils.timestamp();
    linhaAbertura[C_ABR.USUARIO_REGISTRO]     = Utils.usuarioAtivo();
    if (observacao) linhaAbertura['Observação'] = observacao;

    // --- Montar lote destino ---
    var linhaLoteDestino = {};
    linhaLoteDestino[C_LOTE.ID_LOTE]          = idLoteDestino;
    linhaLoteDestino[C_LOTE.ID_PRODUTO]       = idProdutoGerado;
    linhaLoteDestino[C_LOTE.PRODUTO]          = produtoGerado[C_PROD.NOME_PRODUTO] || '';
    linhaLoteDestino[C_LOTE.NEGOCIO]          = NEGOCIO_POKEMON;
    linhaLoteDestino[C_LOTE.TIPO_ORIGEM]      = 'Abertura Pokémon';
    linhaLoteDestino[C_LOTE.ID_ORIGEM]        = idAbertura;
    linhaLoteDestino[C_LOTE.ID_ITEM_ORIGEM]   = idLoteOrigem;
    linhaLoteDestino[C_LOTE.QTD_TOTAL]        = qtdTotalGerada;
    linhaLoteDestino[C_LOTE.QTD_DISPONIVEL]   = qtdTotalGerada;
    linhaLoteDestino[C_LOTE.QTD_HOLD]         = 0;
    linhaLoteDestino[C_LOTE.QTD_VENDIDA]      = 0;
    linhaLoteDestino[C_LOTE.QTD_TRANSFORMADA] = 0;
    linhaLoteDestino[C_LOTE.CUSTO_UNIT]       = custoUnitGerado;
    linhaLoteDestino[C_LOTE.CUSTO_TOTAL]      = custoTotalConsumido;
    linhaLoteDestino[C_LOTE.STATUS]           = 'Disponível';
    linhaLoteDestino[C_LOTE.DATA_CRIACAO]     = Utils.timestamp();

    // --- Gravar com LockService ---
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(15000);

      // Revalida saldo dentro do lock: outra operação concorrente pode ter
      // consumido o mesmo lote entre a validação inicial e a aquisição do lock.
      var loteOrigemAtual = _buscarLotePorId(idLoteOrigem);
      if (!loteOrigemAtual) {
        lock.releaseLock();
        return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Lote de origem não encontrado: ' + idLoteOrigem };
      }
      qtdDisponivel = parseFloat(loteOrigemAtual[C_LOTE.QTD_DISPONIVEL] || 0);
      if (qtdAbrir > qtdDisponivel) {
        lock.releaseLock();
        return {
          sucesso: false, idAbertura: null, idLoteDestino: null,
          erro: 'Quantidade a abrir (' + qtdAbrir + ') é maior que o saldo disponível (' + qtdDisponivel + ').'
        };
      }

      // 1. Gravar abertura
      _appendObjetoSemLock(ABA_ABERTURA, linhaAbertura);

      // 2. Atualizar lote origem (baixar saldo disponível, aumentar transformada)
      var novaQtdDisp   = Utils.arredondar(qtdDisponivel - qtdAbrir, 4);
      var qtdTransf     = parseFloat(loteOrigemAtual[C_LOTE.QTD_TRANSFORMADA] || 0);
      var novaTransf    = Utils.arredondar(qtdTransf + qtdAbrir, 4);
      var novoStatusOrg = novaQtdDisp <= 0 ? 'Encerrado' : 'Parcial';

      atualizarSaldoLote(idLoteOrigem, {
        QTD_DISPONIVEL:  novaQtdDisp,
        QTD_TRANSFORMADA: novaTransf,
        STATUS:          novoStatusOrg
      });

      // 3. Criar lote destino
      _appendObjetoSemLock(ABA_LOTES, linhaLoteDestino);

      // 4. Movimento de saída/transformação do produto origem
      // CORREÇÃO v2: passa idMovOrigem para garantir que o ID gravado = ID retornado
      var idMovOrigemReal = gravarMovimento({
        idMovimento:    idMovOrigem,
        dataMovimento:  dataAbertura,
        tipoMovimento:  'Abertura',
        subtipo:        'Saída por Transformação',
        idLote:         idLoteOrigem,
        produto:        loteOrigem[C_LOTE.PRODUTO],
        negocio:        NEGOCIO_POKEMON,
        quantidade:     qtdAbrir,
        saldoAnterior:  qtdDisponivel,
        saldoPosterior: novaQtdDisp,
        refOperacao:    idAbertura,
        statusDestino:  'Transformado',
        custoUnit:      custoUnitOrigem
      });

      // 5. Movimento de entrada/geração do produto derivado
      // CORREÇÃO v2: passa idMovDestino para garantir que o ID gravado = ID retornado
      var idMovDestinoReal = gravarMovimento({
        idMovimento:    idMovDestino,
        dataMovimento:  dataAbertura,
        tipoMovimento:  'Abertura',
        subtipo:        'Entrada por Geração',
        idLote:         idLoteDestino,
        produto:        produtoGerado[C_PROD.NOME_PRODUTO],
        negocio:        NEGOCIO_POKEMON,
        quantidade:     qtdTotalGerada,
        saldoAnterior:  0,
        saldoPosterior: qtdTotalGerada,
        refOperacao:    idAbertura,
        statusDestino:  'Disponível',
        custoUnit:      custoUnitGerado
      });

      lock.releaseLock();

      LogService.info('EstoqueService', 'registrarAbertura',
        'Abertura registrada: ' + idAbertura +
        ' | Origem: ' + idLoteOrigem + ' (' + qtdAbrir + 'un)' +
        ' | Destino: ' + idLoteDestino + ' (' + qtdTotalGerada + 'un)' +
        ' | Custo unit gerado: R$' + custoUnitGerado,
        idAbertura);

      // CORREÇÃO v2: retorna IDs reais gravados (não os gerados em memória)
      return {
        sucesso:        true,
        idAbertura:     idAbertura,
        idLoteDestino:  idLoteDestino,
        idMovOrigem:    idMovOrigemReal,
        idMovDestino:   idMovDestinoReal,
        qtdTotalGerada: qtdTotalGerada,
        custoUnitGerado: custoUnitGerado,
        erro:           null
      };

    } catch (e) {
      try { lock.releaseLock(); } catch (le) {}
      LogService.error('EstoqueService', 'registrarAbertura',
        'Erro ao registrar abertura: ' + e.message, idLoteOrigem);
      return {
        sucesso: false, idAbertura: null, idLoteDestino: null,
        erro: 'Erro ao registrar abertura: ' + e.message
      };
    }
  }

  /**
   * Retorna prévia de abertura sem gravar.
   * Útil para exibir custo unitário gerado antes de confirmar.
   */
  function calcularPreviaAbertura(idLoteOrigem, qtdAbrir, qtdGeradaPorUnidade) {
    var lote = _buscarLotePorId(idLoteOrigem);
    if (!lote) return { valido: false, erro: 'Lote não encontrado.' };

    var qtdDisp = parseFloat(lote[C_LOTE.QTD_DISPONIVEL] || 0);
    if (qtdAbrir <= 0 || qtdAbrir > qtdDisp) {
      return { valido: false, erro: 'Quantidade inválida ou maior que saldo disponível (' + qtdDisp + ').' };
    }

    var validFrac = ProdutoService.validarParaAbertura(lote[C_LOTE.ID_PRODUTO]);
    if (!validFrac.valido) return { valido: false, erro: validFrac.erro };

    var qtdPorUnit = parseInt(qtdGeradaPorUnidade || validFrac.qtdPadrao, 10);
    var custoUnit  = parseFloat(lote[C_LOTE.CUSTO_UNIT] || 0);
    var custoTotal = Utils.arredondar(qtdAbrir * custoUnit, 2);
    var qtdGerada  = qtdAbrir * qtdPorUnit;
    var custoGerado = qtdGerada > 0 ? Utils.arredondar(custoTotal / qtdGerada, 4) : 0;

    return {
      valido:              true,
      loteOrigem:          idLoteOrigem,
      produtoOrigem:       lote[C_LOTE.PRODUTO],
      qtdAbrir:            qtdAbrir,
      custoUnitOrigem:     custoUnit,
      custoTotalConsumido: custoTotal,
      qtdGeradaPorUnidade: qtdPorUnit,
      qtdTotalGerada:      qtdGerada,
      custoUnitGerado:     custoGerado,
      produtoGerado:       validFrac.produtoGerado
        ? validFrac.produtoGerado[C_PROD.NOME_PRODUTO]
        : '',
      erro: null
    };
  }

  /**
   * Registra abertura escolhendo automaticamente o lote disponível
   * mais antigo (FIFO) de um produto — evita que o usuário precise
   * digitar o ID do lote manualmente na tela de Abertura Pokémon.
   *
   * @param {Object} payload - { idProduto, qtdAbrir, qtdGeradaPorUnidade, dataAbertura, observacao }
   * @returns {Object} mesmo retorno de registrarAbertura
   */
  function registrarAberturaPorProduto(payload) {
    payload = payload || {};
    var idProduto = payload.idProduto;
    if (Utils.eVazio(idProduto)) {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Produto é obrigatório.' };
    }

    var disponiveis = listarLotesDisponiveisPorProduto(idProduto);
    if (!disponiveis || disponiveis.length === 0) {
      return { sucesso: false, idAbertura: null, idLoteDestino: null, erro: 'Nenhum lote disponível para este produto.' };
    }

    // listarLotesDisponiveisPorProduto já ordena FIFO (mais antigo primeiro)
    var loteMaisAntigo = disponiveis[0];

    return registrarAbertura({
      idLoteOrigem: loteMaisAntigo.idLote,
      qtdAbrir: payload.qtdAbrir,
      qtdGeradaPorUnidade: payload.qtdGeradaPorUnidade,
      dataAbertura: payload.dataAbertura,
      observacao: payload.observacao
    });
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    consultarLote:                   consultarLote,
    listarLotesDisponiveisPorProduto: listarLotesDisponiveisPorProduto,
    atualizarSaldoLote:              atualizarSaldoLote,
    gravarMovimento:                 gravarMovimento,
    registrarAbertura:               registrarAbertura,
    registrarAberturaPorProduto:     registrarAberturaPorProduto,
    calcularPreviaAbertura:          calcularPreviaAbertura
  };

})();
