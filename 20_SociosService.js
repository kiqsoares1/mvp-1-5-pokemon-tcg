/**
 * ============================================================
 * 20_SociosService.gs — Serviço Societário
 * MVP 1.5 — Gestão Pokémon TCG (v1.6.0)
 * ============================================================
 * Implementa a lógica societária dos sócios (Kaique, Samuel, Lucas
 * e futuros sócios cadastrados): aportes, participação proporcional
 * ao capital aportado, snapshot imutável de participação por venda,
 * reconhecimento de lucro por item vendido e cálculo de retirada
 * máxima.
 *
 * Regras de negócio (confirmadas com o dono do projeto):
 *  - Participação = participação nos lucros, sempre igual entre si
 *    (nunca dois campos numéricos diferentes para a mesma coisa).
 *  - Participação é proporcional ao total aportado por cada sócio
 *    em relação ao total aportado por todos. Recalculada a cada
 *    novo aporte.
 *  - Mudanças de participação nunca retroagem: cada venda grava a
 *    % vigente na data dela (snapshot imutável em
 *    Historico_Participacoes / Lucro_Por_Item_Socio).
 *  - Não existe empréstimo de sócio para a empresa — todo dinheiro
 *    que entra de um sócio é aporte de capital.
 *  - Não existe financiamento de lote por sócio específico — todo
 *    lucro segue a participação societária geral vigente.
 *  - Lucro realizado só quando a venda está concluída (o
 *    VendaService já grava toda venda como "Concluída").
 *  - Retirada máxima = MENOR valor entre (a) lucro individual
 *    disponível e (b) cota do sócio sobre o caixa livre da empresa
 *    (participação % × caixa livre, caixa livre = caixa teórico -
 *    reserva mínima configurável em Config_App).
 *  - Despesa paga por um sócio do próprio bolso vira aporte
 *    automático (não existe reembolso separado).
 *
 * Dependências: 00_Config, 02_Utils, 03_SheetService, 04_IdService,
 *               10_FinanceiroService, 14_LogService
 * Abas gravadas: Socios, Aportes_Socios, Historico_Participacoes,
 *                Retiradas, Lucro_Por_Item_Socio, Resumo_Socios
 * ============================================================
 */

var SociosService = (function () {

  var ABA_SOCIOS       = CONFIG.ABAS.SOCIOS;
  var ABA_APORTES      = CONFIG.ABAS.APORTES_SOCIOS;
  var ABA_HISTORICO    = CONFIG.ABAS.HISTORICO_PARTICIPACOES;
  var ABA_RETIRADAS    = CONFIG.ABAS.RETIRADAS;
  var ABA_LUCRO_ITEM   = CONFIG.ABAS.LUCRO_POR_ITEM_SOCIO;
  var ABA_RESUMO       = CONFIG.ABAS.RESUMO_SOCIOS;

  var C_SOCIO   = CONFIG.CAMPOS.SOCIOS;
  var C_APORTE  = CONFIG.CAMPOS.APORTES_SOCIOS;
  var C_HIST    = CONFIG.CAMPOS.HISTORICO_PARTICIPACOES;
  var C_RET     = CONFIG.CAMPOS.RETIRADAS;
  var C_LIS     = CONFIG.CAMPOS.LUCRO_POR_ITEM_SOCIO;
  var C_RESUMO  = CONFIG.CAMPOS.RESUMO_SOCIOS;

  var NEGOCIO_POKEMON = 'Pokémon TCG';

  function _numero(v) { return Utils.parsarMoeda(v || 0); }

  // ============================================================
  // CADASTRO DE SÓCIOS
  // ============================================================

  function listarSocios(apenasAtivos) {
    var registros = SheetService.getDadosComoObjetos(ABA_SOCIOS);
    return registros
      .filter(function(s) { return !apenasAtivos || Utils.normalizar(s[C_SOCIO.ATIVO] || '') === 'Sim'; })
      .map(function(s) {
        return {
          idSocio: s[C_SOCIO.ID_SOCIO],
          nome: s[C_SOCIO.NOME],
          email: s[C_SOCIO.EMAIL],
          ativo: s[C_SOCIO.ATIVO],
          totalAportado: _numero(s[C_SOCIO.TOTAL_APORTADO]),
          participacaoAtual: _numero(s[C_SOCIO.PARTICIPACAO_ATUAL]),
          lucroAtribuidoTotal: _numero(s[C_SOCIO.LUCRO_ATRIBUIDO_TOTAL]),
          lucroRetiradoTotal: _numero(s[C_SOCIO.LUCRO_RETIRADO_TOTAL]),
          lucroDisponivel: _numero(s[C_SOCIO.LUCRO_DISPONIVEL])
        };
      });
  }

  function _buscarSocio(idSocio) {
    return SheetService.buscarPrimeiroPorCampo(ABA_SOCIOS, C_SOCIO.ID_SOCIO, idSocio);
  }

  function cadastrarSocio(payload) {
    payload = payload || {};
    if (Utils.eVazio(payload.nome)) {
      return { sucesso: false, idSocio: null, erro: 'Nome do sócio é obrigatório.' };
    }

    var idSocio = IdService.gerarId('SOCIO');
    var linha = {};
    linha[C_SOCIO.ID_SOCIO] = idSocio;
    linha[C_SOCIO.NOME] = payload.nome;
    linha[C_SOCIO.EMAIL] = payload.email || '';
    linha[C_SOCIO.ATIVO] = 'Sim';
    linha[C_SOCIO.TOTAL_APORTADO] = 0;
    linha[C_SOCIO.PARTICIPACAO_ATUAL] = 0;
    linha[C_SOCIO.LUCRO_ATRIBUIDO_TOTAL] = 0;
    linha[C_SOCIO.LUCRO_RETIRADO_TOTAL] = 0;
    linha[C_SOCIO.LUCRO_DISPONIVEL] = 0;
    linha[C_SOCIO.DATA_ENTRADA] = Utils.formatarData(new Date());
    linha[C_SOCIO.DATA_ATUALIZACAO] = Utils.timestamp();

    SheetService.appendLinha(ABA_SOCIOS, linha);
    LogService.info('SociosService', 'cadastrarSocio', 'Sócio cadastrado: ' + idSocio + ' | ' + payload.nome, idSocio);

    // Novo sócio entra com 0 de capital — recalcula para manter o
    // histórico coerente (ele aparece com 0% até aportar).
    recalcularParticipacoes_(Utils.formatarData(new Date()), 'Novo sócio cadastrado: ' + payload.nome);

    return { sucesso: true, idSocio: idSocio, erro: null };
  }

  // ============================================================
  // PARTICIPAÇÃO SOCIETÁRIA
  // ============================================================

  /**
   * Recalcula a participação de todos os sócios ativos com base no
   * total aportado por cada um em relação ao total geral, e grava
   * um snapshot imutável em Historico_Participacoes para cada um.
   * Preserva todo o histórico anterior (nunca edita, só insere).
   */
  function recalcularParticipacoes_(dataVigencia, motivo) {
    var socios = SheetService.getDadosComoObjetos(ABA_SOCIOS);
    var ativos = socios.filter(function(s) { return Utils.normalizar(s[C_SOCIO.ATIVO] || '') === 'Sim'; });

    var totalGeral = 0;
    ativos.forEach(function(s) { totalGeral += _numero(s[C_SOCIO.TOTAL_APORTADO]); });
    totalGeral = Utils.arredondar(totalGeral, 2);

    var linhasHistorico = [];

    for (var i = 0; i < socios.length; i++) {
      var s = socios[i];
      var ehAtivo = Utils.normalizar(s[C_SOCIO.ATIVO] || '') === 'Sim';
      var totalSocio = _numero(s[C_SOCIO.TOTAL_APORTADO]);
      var pct = (ehAtivo && totalGeral > 0) ? Utils.arredondar(totalSocio / totalGeral, 6) : 0;

      // Atualiza "foto atual" na aba Socios (protegido por lock, os dois
      // campos gravados juntos numa única seção crítica)
      var linhaPlanilha = i + 2; // +2: cabeçalho + 0-based
      var camposParticipacao = {};
      camposParticipacao[C_SOCIO.PARTICIPACAO_ATUAL] = pct;
      camposParticipacao[C_SOCIO.DATA_ATUALIZACAO] = Utils.timestamp();
      SheetService.atualizarCamposLinha(ABA_SOCIOS, linhaPlanilha, camposParticipacao);

      if (ehAtivo) {
        var linhaHist = {};
        linhaHist[C_HIST.ID_HISTORICO] = IdService.gerarId('HISTORICO_PART');
        linhaHist[C_HIST.DATA_VIGENCIA] = dataVigencia;
        linhaHist[C_HIST.ID_SOCIO] = s[C_SOCIO.ID_SOCIO];
        linhaHist[C_HIST.SOCIO] = s[C_SOCIO.NOME];
        linhaHist[C_HIST.TOTAL_APORTADO_SOCIO] = totalSocio;
        linhaHist[C_HIST.TOTAL_APORTADO_GERAL] = totalGeral;
        linhaHist[C_HIST.PARTICIPACAO_PCT] = pct;
        linhaHist[C_HIST.MOTIVO] = motivo || '';
        linhaHist[C_HIST.DATA_REGISTRO] = Utils.timestamp();
        linhasHistorico.push(linhaHist);
      }
    }

    if (linhasHistorico.length > 0) {
      SheetService.appendLinhas(ABA_HISTORICO, linhasHistorico);
    }

    LogService.info('SociosService', 'recalcularParticipacoes_',
      'Participações recalculadas | Total aportado geral: ' + totalGeral + ' | Motivo: ' + (motivo || ''));

    atualizarResumoSocios();

    return { totalGeral: totalGeral, socios: linhasHistorico };
  }

  /**
   * Retorna a participação (%) vigente de um sócio em uma data
   * específica, olhando o snapshot de Historico_Participacoes mais
   * recente com Data Vigência <= data informada. Se não houver
   * nenhum snapshot anterior ou igual à data, usa o mais antigo
   * disponível (evita 0% em vendas registradas no mesmo dia do
   * primeiro aporte, antes do recálculo).
   */
  function _participacaoVigenteEm(idSocio, data) {
    var dataAlvo = (data instanceof Date) ? data : Utils.parsarData(String(data || '').split(' ')[0]);
    var registros = SheetService.buscarPorCampo(ABA_HISTORICO, C_HIST.ID_SOCIO, idSocio)
      .map(function(r) { return r.dados; })
      .filter(function(r) { return !Utils.eVazio(r[C_HIST.PARTICIPACAO_PCT]); });

    if (registros.length === 0) return 0;

    registros.sort(function(a, b) {
      var da = Utils.parsarData(String(a[C_HIST.DATA_VIGENCIA] || '').split(' ')[0]) || new Date(0);
      var db = Utils.parsarData(String(b[C_HIST.DATA_VIGENCIA] || '').split(' ')[0]) || new Date(0);
      return da - db;
    });

    if (!dataAlvo) return _numero(registros[registros.length - 1][C_HIST.PARTICIPACAO_PCT]);

    var vigente = registros[0];
    for (var i = 0; i < registros.length; i++) {
      var dReg = Utils.parsarData(String(registros[i][C_HIST.DATA_VIGENCIA] || '').split(' ')[0]);
      if (dReg && dReg.getTime() <= dataAlvo.getTime()) vigente = registros[i];
    }
    return _numero(vigente[C_HIST.PARTICIPACAO_PCT]);
  }

  // ============================================================
  // APORTES
  // ============================================================

  function registrarAporte(payload) {
    payload = payload || {};
    var idSocio = payload.idSocio;
    var valor = _numero(payload.valor);
    var idRequisicao = payload.idRequisicao || Utils.uuid();

    if (Utils.eVazio(idSocio)) return _erroAporte('idSocio é obrigatório.', idRequisicao);
    if (isNaN(valor) || valor <= 0) return _erroAporte('Valor deve ser maior que zero.', idRequisicao);

    var registroSocio = _buscarSocio(idSocio);
    if (!registroSocio) return _erroAporte('Sócio não encontrado: ' + idSocio, idRequisicao);

    // Tolerante: se a coluna "ID Requisição" não existir em Aportes_Socios,
    // buscarPorCampo lança erro — protege com try/catch.
    var jaProcessado = [];
    try {
      if (SheetService.getCabecalhos(ABA_APORTES).indexOf('ID Requisição') !== -1) {
        jaProcessado = SheetService.buscarPorCampo(ABA_APORTES, 'ID Requisição', idRequisicao);
        if (jaProcessado.length > 0) {
          return _erroAporte('Este aporte já foi processado anteriormente. Código: ' + idRequisicao, idRequisicao);
        }
      }
    } catch (e) { /* segue sem checagem de duplicidade se a coluna não existir */ }

    var data = payload.data || Utils.formatarData(new Date());
    var idAporte = IdService.gerarId('APORTE_SOCIO');

    var linha = {};
    linha[C_APORTE.ID_APORTE] = idAporte;
    linha[C_APORTE.DATA_APORTE] = data;
    linha[C_APORTE.ID_SOCIO] = idSocio;
    linha[C_APORTE.SOCIO] = registroSocio.dados[C_SOCIO.NOME];
    linha[C_APORTE.VALOR] = valor;
    linha[C_APORTE.FORMA_PAGAMENTO] = payload.formaPagamento || 'Pix';
    linha[C_APORTE.ORIGEM] = payload.origem || '';
    linha[C_APORTE.OBSERVACAO] = payload.observacao || '';
    linha[C_APORTE.DATA_REGISTRO] = Utils.timestamp();
    linha[C_APORTE.USUARIO_REGISTRO] = Utils.usuarioAtivo();
    if (SheetService.getCabecalhos(ABA_APORTES).indexOf('ID Requisição') !== -1) {
      linha['ID Requisição'] = idRequisicao;
    }

    // Reflete no Financeiro gerencial genérico (Aportes_Resgates):
    // todo aporte de sócio também é um aporte de capital da empresa.
    // Mantém os dois conceitos reconciliados sem duplicar tabela.
    var idCapitalVinculado = '';
    try {
      var resFin = FinanceiroService.registrarAporte({
        idRequisicao: idAporte + '-CAP',
        data: data,
        negocio: NEGOCIO_POKEMON,
        valor: valor,
        origem: 'Aporte de sócio: ' + registroSocio.dados[C_SOCIO.NOME],
        observacao: payload.observacao || ''
      });
      if (resFin.sucesso) idCapitalVinculado = resFin.id;
    } catch (fe) {
      LogService.error('SociosService', 'registrarAporte', 'Falha ao refletir no Financeiro: ' + fe.message, idAporte);
    }
    if (idCapitalVinculado && SheetService.getCabecalhos(ABA_APORTES).indexOf(C_APORTE.ID_CAPITAL_VINCULADO) !== -1) {
      linha[C_APORTE.ID_CAPITAL_VINCULADO] = idCapitalVinculado;
    }

    SheetService.appendLinha(ABA_APORTES, linha);

    // Atualiza total aportado do sócio (protegido por lock)
    var novoTotal = Utils.arredondar(_numero(registroSocio.dados[C_SOCIO.TOTAL_APORTADO]) + valor, 2);
    var camposTotal = {};
    camposTotal[C_SOCIO.TOTAL_APORTADO] = novoTotal;
    SheetService.atualizarCamposLinha(ABA_SOCIOS, registroSocio.linha, camposTotal);

    // Recalcula participação de todos os sócios ativos (regra: nunca retroage)
    recalcularParticipacoes_(data, 'Aporte ' + idAporte + ' (' + registroSocio.dados[C_SOCIO.NOME] + ')');

    LogService.info('SociosService', 'registrarAporte',
      'Aporte registrado: ' + idAporte + ' | Sócio: ' + registroSocio.dados[C_SOCIO.NOME] + ' | Valor: ' + valor, idAporte);

    return { sucesso: true, idAporte: idAporte, erro: null };
  }

  function _erroAporte(msg, idRequisicao) {
    LogService.warning('SociosService', 'registrarAporte', msg, idRequisicao || '');
    return { sucesso: false, idAporte: null, erro: msg };
  }

  /**
   * Despesa paga por um sócio do próprio bolso vira aporte
   * automático — não existe reembolso separado, pois não há
   * empréstimo de sócio para a empresa.
   */
  function converterDespesaEmAporte_(idSocio, valor, idDespesa, observacao) {
    return registrarAporte({
      idSocio: idSocio,
      valor: valor,
      formaPagamento: 'Despesa Convertida',
      origem: 'Despesa paga do próprio bolso: ' + idDespesa,
      observacao: observacao || '',
      idRequisicao: 'DESP-' + idDespesa
    });
  }

  // ============================================================
  // RECONHECIMENTO DE LUCRO POR VENDA
  // ============================================================

  /**
   * Grava o lucro de cada sócio ativo, por item vendido, como valor
   * fixo (não fórmula), usando a participação % vigente na data da
   * venda. Trava contra reconhecimento duplicado por ID Venda.
   *
   * @param {string} idVenda
   * @param {string} dataVenda
   * @param {Array<{idItemVenda: string, lucroBrutoItem: number}>} itensDaVenda
   */
  function reconhecerLucroDaVenda(idVenda, dataVenda, itensDaVenda) {
    if (Utils.eVazio(idVenda) || !itensDaVenda || itensDaVenda.length === 0) return { sucesso: false, erro: 'Venda ou itens ausentes.' };

    // Trava contra duplicidade: já existe lucro reconhecido para esta venda?
    var jaExiste = SheetService.buscarPorCampo(ABA_LUCRO_ITEM, C_LIS.ID_VENDA, idVenda);
    if (jaExiste.length > 0) {
      LogService.warning('SociosService', 'reconhecerLucroDaVenda',
        'Lucro já reconhecido anteriormente para a venda: ' + idVenda, idVenda);
      return { sucesso: false, erro: 'Lucro já reconhecido para esta venda.' };
    }

    var sociosAtivos = listarSocios(true);
    if (sociosAtivos.length === 0) return { sucesso: true, linhas: 0, erro: null };

    var linhas = [];
    var totalPorSocio = {}; // idSocio -> soma lucro atribuído nesta venda

    // A participação de cada sócio não muda entre os itens de uma mesma
    // venda (mesma dataVenda) — calcular uma vez aqui evita reler
    // Historico_Participacoes inteiro (itens × sócios) vezes por venda.
    var pctPorSocio = {};
    sociosAtivos.forEach(function(s) {
      pctPorSocio[s.idSocio] = _participacaoVigenteEm(s.idSocio, dataVenda);
    });

    itensDaVenda.forEach(function(item) {
      var lucroItem = _numero(item.lucroBrutoItem);
      sociosAtivos.forEach(function(s) {
        var pct = pctPorSocio[s.idSocio];
        if (pct <= 0) return;
        var lucroAtribuido = Utils.arredondar(lucroItem * pct, 4);

        var linha = {};
        linha[C_LIS.ID_LUCRO_ITEM_SOCIO] = IdService.gerarId('LUCRO_ITEM_SOCIO');
        linha[C_LIS.ID_VENDA] = idVenda;
        linha[C_LIS.ID_ITEM_VENDA] = item.idItemVenda;
        linha[C_LIS.DATA_VENDA] = dataVenda;
        linha[C_LIS.ID_SOCIO] = s.idSocio;
        linha[C_LIS.SOCIO] = s.nome;
        linha[C_LIS.PARTICIPACAO_PCT_APLICADA] = pct;
        linha[C_LIS.LUCRO_BRUTO_ITEM] = lucroItem;
        linha[C_LIS.LUCRO_ATRIBUIDO_SOCIO] = lucroAtribuido;
        linha[C_LIS.DATA_REGISTRO] = Utils.timestamp();
        linhas.push(linha);

        totalPorSocio[s.idSocio] = Utils.arredondar((totalPorSocio[s.idSocio] || 0) + lucroAtribuido, 4);
      });
    });

    if (linhas.length > 0) SheetService.appendLinhas(ABA_LUCRO_ITEM, linhas);

    // Atualiza lucro atribuído total / disponível de cada sócio impactado
    // (protegido por lock, os 3 campos gravados juntos por sócio)
    Object.keys(totalPorSocio).forEach(function(idSocio) {
      var reg = _buscarSocio(idSocio);
      if (!reg) return;
      var novoAtribuido = Utils.arredondar(_numero(reg.dados[C_SOCIO.LUCRO_ATRIBUIDO_TOTAL]) + totalPorSocio[idSocio], 2);
      var retirado = _numero(reg.dados[C_SOCIO.LUCRO_RETIRADO_TOTAL]);
      var disponivel = Utils.arredondar(novoAtribuido - retirado, 2);
      var campos = {};
      campos[C_SOCIO.LUCRO_ATRIBUIDO_TOTAL] = novoAtribuido;
      campos[C_SOCIO.LUCRO_DISPONIVEL] = disponivel;
      campos[C_SOCIO.DATA_ATUALIZACAO] = Utils.timestamp();
      SheetService.atualizarCamposLinha(ABA_SOCIOS, reg.linha, campos);
    });

    LogService.info('SociosService', 'reconhecerLucroDaVenda',
      'Lucro reconhecido para venda ' + idVenda + ' | Linhas: ' + linhas.length, idVenda);

    atualizarResumoSocios();

    return { sucesso: true, linhas: linhas.length, erro: null };
  }

  // ============================================================
  // CAIXA LIVRE E RETIRADAS
  // ============================================================

  /**
   * Caixa livre = caixa teórico da empresa - reserva mínima
   * configurável (Config_App RESERVA_MINIMA_CAIXA, default 0).
   */
  function calcularCaixaLivre() {
    var resumo = FinanceiroService.calcularResumoFinanceiro({});
    var caixaTeorico = (resumo.totais && resumo.totais.caixaTeoricoAproximado) || 0;
    var reservaMinima = _numero(SheetService.lerConfigApp('RESERVA_MINIMA_CAIXA'));
    if (isNaN(reservaMinima)) reservaMinima = 0;
    return Math.max(0, Utils.arredondar(caixaTeorico - reservaMinima, 2));
  }

  /**
   * Retirada máxima de um sócio = MENOR valor entre:
   *  (a) lucro individual disponível (atribuído - já retirado)
   *  (b) cota do sócio sobre o caixa livre (participação % × caixa livre)
   */
  function calcularRetiradaMaxima(idSocio) {
    var reg = _buscarSocio(idSocio);
    if (!reg) return 0;
    var lucroDisponivel = _numero(reg.dados[C_SOCIO.LUCRO_DISPONIVEL]);
    var participacao = _numero(reg.dados[C_SOCIO.PARTICIPACAO_ATUAL]);
    var caixaLivre = calcularCaixaLivre();
    var cotaCaixaLivre = Utils.arredondar(participacao * caixaLivre, 2);
    return Math.max(0, Math.min(lucroDisponivel, cotaCaixaLivre));
  }

  function solicitarRetirada(payload) {
    payload = payload || {};
    var idSocio = payload.idSocio;
    var valorSolicitado = _numero(payload.valorSolicitado);
    var idRequisicao = payload.idRequisicao || Utils.uuid();

    if (Utils.eVazio(idSocio)) return _erroRetirada('idSocio é obrigatório.', idRequisicao);
    if (isNaN(valorSolicitado) || valorSolicitado <= 0) return _erroRetirada('Valor solicitado deve ser maior que zero.', idRequisicao);

    var reg = _buscarSocio(idSocio);
    if (!reg) return _erroRetirada('Sócio não encontrado: ' + idSocio, idRequisicao);

    try {
      if (SheetService.getCabecalhos(ABA_RETIRADAS).indexOf('ID Requisição') !== -1) {
        var jaProcessado = SheetService.buscarPorCampo(ABA_RETIRADAS, 'ID Requisição', idRequisicao);
        if (jaProcessado.length > 0) return _erroRetirada('Esta retirada já foi processada anteriormente. Código: ' + idRequisicao, idRequisicao);
      }
    } catch (e) { /* segue sem checagem se a coluna não existir */ }

    var lucroDisponivel = _numero(reg.dados[C_SOCIO.LUCRO_DISPONIVEL]);
    var participacao = _numero(reg.dados[C_SOCIO.PARTICIPACAO_ATUAL]);
    var caixaLivre = calcularCaixaLivre();
    var cotaCaixaLivre = Utils.arredondar(participacao * caixaLivre, 2);
    var limite = Math.max(0, Math.min(lucroDisponivel, cotaCaixaLivre));
    var valorAprovado = Math.max(0, Math.min(valorSolicitado, limite));

    var status = valorAprovado <= 0
      ? 'Bloqueada'
      : (valorAprovado < valorSolicitado ? 'Aprovada Parcial' : 'Aprovada');

    var data = payload.data || Utils.formatarData(new Date());
    var idRetirada = IdService.gerarId('RETIRADA');

    var linha = {};
    linha[C_RET.ID_RETIRADA] = idRetirada;
    linha[C_RET.DATA_RETIRADA] = data;
    linha[C_RET.ID_SOCIO] = idSocio;
    linha[C_RET.SOCIO] = reg.dados[C_SOCIO.NOME];
    linha[C_RET.VALOR_SOLICITADO] = valorSolicitado;
    linha[C_RET.LUCRO_DISPONIVEL_NO_MOMENTO] = lucroDisponivel;
    linha[C_RET.COTA_CAIXA_LIVRE_NO_MOMENTO] = cotaCaixaLivre;
    linha[C_RET.VALOR_LIMITE_APLICADO] = limite;
    linha[C_RET.VALOR_APROVADO] = valorAprovado;
    linha[C_RET.FORMA_PAGAMENTO] = payload.formaPagamento || 'Pix';
    linha[C_RET.STATUS] = status;
    linha[C_RET.OBSERVACAO] = payload.observacao || '';
    linha[C_RET.DATA_REGISTRO] = Utils.timestamp();
    linha[C_RET.USUARIO_REGISTRO] = Utils.usuarioAtivo();
    if (SheetService.getCabecalhos(ABA_RETIRADAS).indexOf('ID Requisição') !== -1) {
      linha['ID Requisição'] = idRequisicao;
    }

    SheetService.appendLinha(ABA_RETIRADAS, linha);

    if (valorAprovado > 0) {
      var novoRetirado = Utils.arredondar(_numero(reg.dados[C_SOCIO.LUCRO_RETIRADO_TOTAL]) + valorAprovado, 2);
      var novoDisponivel = Utils.arredondar(lucroDisponivel - valorAprovado, 2);
      var camposRetirada = {};
      camposRetirada[C_SOCIO.LUCRO_RETIRADO_TOTAL] = novoRetirado;
      camposRetirada[C_SOCIO.LUCRO_DISPONIVEL] = novoDisponivel;
      camposRetirada[C_SOCIO.DATA_ATUALIZACAO] = Utils.timestamp();
      SheetService.atualizarCamposLinha(ABA_SOCIOS, reg.linha, camposRetirada);

      // Reflete no Financeiro gerencial genérico como saída de caixa (Resgate).
      try {
        FinanceiroService.registrarResgate({
          idRequisicao: idRetirada + '-CAP',
          data: data,
          negocio: NEGOCIO_POKEMON,
          valor: valorAprovado,
          origem: 'Retirada de lucro do sócio: ' + reg.dados[C_SOCIO.NOME],
          observacao: payload.observacao || ''
        });
      } catch (fe) {
        LogService.error('SociosService', 'solicitarRetirada', 'Falha ao refletir no Financeiro: ' + fe.message, idRetirada);
      }
    }

    LogService.info('SociosService', 'solicitarRetirada',
      'Retirada ' + status + ': ' + idRetirada + ' | Sócio: ' + reg.dados[C_SOCIO.NOME] +
      ' | Solicitado: ' + valorSolicitado + ' | Aprovado: ' + valorAprovado, idRetirada);

    atualizarResumoSocios();

    return { sucesso: true, idRetirada: idRetirada, status: status, valorAprovado: valorAprovado, valorLimite: limite, erro: null };
  }

  function _erroRetirada(msg, idRequisicao) {
    LogService.warning('SociosService', 'solicitarRetirada', msg, idRequisicao || '');
    return { sucesso: false, idRetirada: null, status: 'Bloqueada', valorAprovado: 0, erro: msg };
  }

  // ============================================================
  // RESUMO / PAINEL
  // ============================================================

  /**
   * Recalcula a aba Resumo_Socios (materializada) a partir do
   * estado atual de Socios + caixa livre. Chamada automaticamente
   * após aporte, retirada e reconhecimento de lucro.
   */
  function atualizarResumoSocios() {
    try {
      var caixaLivre = calcularCaixaLivre();
      var socios = listarSocios(true);
      var linhas = socios.map(function(s) {
        var cota = Utils.arredondar(s.participacaoAtual * caixaLivre, 2);
        var retiradaMaxima = Math.max(0, Math.min(s.lucroDisponivel, cota));
        var linha = {};
        linha[C_RESUMO.SOCIO] = s.nome;
        linha[C_RESUMO.PARTICIPACAO_ATUAL] = s.participacaoAtual;
        linha[C_RESUMO.TOTAL_APORTADO] = s.totalAportado;
        linha[C_RESUMO.LUCRO_ATRIBUIDO_TOTAL] = s.lucroAtribuidoTotal;
        linha[C_RESUMO.LUCRO_RETIRADO_TOTAL] = s.lucroRetiradoTotal;
        linha[C_RESUMO.LUCRO_DISPONIVEL] = s.lucroDisponivel;
        linha[C_RESUMO.COTA_CAIXA_LIVRE] = cota;
        linha[C_RESUMO.RETIRADA_MAXIMA_ATUAL] = retiradaMaxima;
        linha[C_RESUMO.DATA_ATUALIZACAO] = Utils.timestamp();
        return linha;
      });

      if (SheetService.abaExiste(ABA_RESUMO)) {
        SheetService.limparDados(ABA_RESUMO, true);
        if (linhas.length > 0) SheetService.appendLinhas(ABA_RESUMO, linhas);
      }
    } catch (e) {
      LogService.error('SociosService', 'atualizarResumoSocios', 'Falha ao atualizar resumo: ' + e.message);
    }
  }

  /**
   * Alerta (não bloqueante) quando o faturamento anual (soma do
   * Valor Bruto de Venda no ano corrente) se aproxima do teto do
   * MEI (default R$81.000/ano, configurável em Config_App).
   */
  function verificarAlertaFaturamentoMEI() {
    try {
      var teto = _numero(SheetService.lerConfigApp('TETO_ANUAL_MEI'));
      if (!teto || isNaN(teto) || teto <= 0) teto = 81000;

      var anoAtual = new Date().getFullYear();
      var vendas = SheetService.getDadosComoObjetos(CONFIG.ABAS.VENDAS);
      var C_VENDA = CONFIG.CAMPOS.VENDAS;
      var faturamento = 0;
      vendas.forEach(function(v) {
        var d = Utils.parsarData(String(v[C_VENDA.DATA_VENDA] || '').split(' ')[0]);
        if (d && d.getFullYear() === anoAtual) faturamento += _numero(v[C_VENDA.VALOR_BRUTO]);
      });
      faturamento = Utils.arredondar(faturamento, 2);
      var percentual = teto > 0 ? Utils.arredondar(faturamento / teto, 4) : 0;

      return {
        ano: anoAtual,
        faturamentoAnual: faturamento,
        tetoMei: teto,
        percentualDoTeto: percentual,
        alerta: percentual >= 0.8
      };
    } catch (e) {
      return { ano: new Date().getFullYear(), faturamentoAnual: 0, tetoMei: 81000, percentualDoTeto: 0, alerta: false };
    }
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    listarSocios:                  listarSocios,
    cadastrarSocio:                cadastrarSocio,
    recalcularParticipacoes_:      recalcularParticipacoes_,
    registrarAporte:               registrarAporte,
    converterDespesaEmAporte_:     converterDespesaEmAporte_,
    reconhecerLucroDaVenda:        reconhecerLucroDaVenda,
    calcularCaixaLivre:            calcularCaixaLivre,
    calcularRetiradaMaxima:        calcularRetiradaMaxima,
    solicitarRetirada:             solicitarRetirada,
    atualizarResumoSocios:         atualizarResumoSocios,
    verificarAlertaFaturamentoMEI: verificarAlertaFaturamentoMEI
  };

})();
