/**
 * ============================================================
 * 05_ValidationService.gs — Serviço de Validação Estrutural
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Validações estruturais do ambiente:
 * - Existência de abas obrigatórias
 * - Existência de cabeçalhos obrigatórios
 * - Parâmetros mínimos em Config_App
 * - Listas mínimas em Configuracoes
 * - Integridade mínima do ambiente HML
 *
 * Dependências: 00_Config.gs, 02_Utils.gs, 03_SheetService.gs,
 *               14_LogService.gs
 * ============================================================
 */

var ValidationService = (function() {

  // ============================================================
  // VALIDAÇÃO DE ABAS
  // ============================================================

  /**
   * Valida se todas as abas obrigatórias existem.
   * Exibe alerta com resultado e grava log.
   * @returns {{ok: boolean, ausentes: Array<string>}}
   */
  function validarAbas() {
    var todasAbas = Object.values(CONFIG.ABAS);
    var ausentes = [];

    todasAbas.forEach(function(nomeAba) {
      if (!SheetService.abaExiste(nomeAba)) {
        ausentes.push(nomeAba);
      }
    });

    var ok = ausentes.length === 0;
    var msg = ok
      ? '✅ Todas as ' + todasAbas.length + ' abas obrigatórias estão presentes.'
      : '❌ Abas ausentes (' + ausentes.length + '):\n' + ausentes.join('\n');

    logInfo('05_ValidationService', 'validarAbas',
      ok ? 'Validação de abas: OK' : 'Abas ausentes: ' + ausentes.join(', '));

    Utils.alerta('Validação de Abas', msg);
    return { ok: ok, ausentes: ausentes };
  }

  // ============================================================
  // VALIDAÇÃO DE CABEÇALHOS
  // ============================================================

  /**
   * Valida cabeçalhos de uma aba específica.
   * @param {string} nomeAba
   * @param {Array<string>} camposObrigatorios
   * @returns {{ok: boolean, ausentes: Array<string>}}
   */
  function validarCabecalhosAba(nomeAba, camposObrigatorios) {
    if (!SheetService.abaExiste(nomeAba)) {
      return { ok: false, ausentes: ['ABA_AUSENTE: ' + nomeAba] };
    }
    var cabecalhos = SheetService.getCabecalhos(nomeAba);
    var ausentes = camposObrigatorios.filter(function(campo) {
      return cabecalhos.indexOf(campo) === -1;
    });
    return { ok: ausentes.length === 0, ausentes: ausentes };
  }

  /**
   * Valida cabeçalhos de todas as abas com campos definidos em CONFIG.CAMPOS.
   * Usa mapeamento explícito para aliases que diferem entre CONFIG.CAMPOS e CONFIG.ABAS.
   * @returns {{ok: boolean, erros: Array<string>}}
   */
  function validarTodosCabecalhos() {
    var erros = [];

    // Mapeamento explícito: alias em CONFIG.CAMPOS → nome real da aba
    // Necessário para aliases que diferem de CONFIG.ABAS (ex: MAPA_SALDOS vs MAPA_SALDOS_PATRIMONIO)
    var MAPA_ALIAS_ABA = {
      PRODUTOS_ATIVOS:      CONFIG.ABAS.PRODUTOS_ATIVOS,
      COMPRAS:              CONFIG.ABAS.COMPRAS,
      ITENS_COMPRA:         CONFIG.ABAS.ITENS_COMPRA,
      VENDAS:               CONFIG.ABAS.VENDAS,
      ITENS_VENDA:          CONFIG.ABAS.ITENS_VENDA,
      LOTES_ESTOQUE:        CONFIG.ABAS.LOTES_ESTOQUE,
      MOVIMENTOS_ESTOQUE:   CONFIG.ABAS.MOVIMENTOS_ESTOQUE,
      POKEMON_ABERTURA_BOX: CONFIG.ABAS.POKEMON_ABERTURA_BOX,
      APORTES_RESGATES:     CONFIG.ABAS.APORTES_RESGATES,
      DESPESAS:             CONFIG.ABAS.DESPESAS,
      REFERENCIAS_PRECO:    CONFIG.ABAS.REFERENCIAS_PRECO,
      CONFIGURACOES:        CONFIG.ABAS.CONFIGURACOES,
      LOGS_SISTEMA:         CONFIG.ABAS.LOGS_SISTEMA,
      CONFIG_APP:           CONFIG.ABAS.CONFIG_APP,
      EXECUCOES_TESTES:     CONFIG.ABAS.EXECUCOES_TESTES,
      ERROS_SISTEMA:        CONFIG.ABAS.ERROS_SISTEMA,
      // Abas de resumo/dashboard (adicionadas na correção v2)
      DASHBOARD:            CONFIG.ABAS.DASHBOARD,
      RESUMO_CAPITAL_LUCRO: CONFIG.ABAS.RESUMO_CAPITAL_LUCRO,
      MAPA_SALDOS:          CONFIG.ABAS.MAPA_SALDOS,
      EXEMPLOS_TESTE:       CONFIG.ABAS.EXEMPLOS_TESTE,
      // Módulo societário (v1.6.0)
      SOCIOS:                  CONFIG.ABAS.SOCIOS,
      APORTES_SOCIOS:          CONFIG.ABAS.APORTES_SOCIOS,
      HISTORICO_PARTICIPACOES: CONFIG.ABAS.HISTORICO_PARTICIPACOES,
      RETIRADAS:               CONFIG.ABAS.RETIRADAS,
      LUCRO_POR_ITEM_SOCIO:    CONFIG.ABAS.LUCRO_POR_ITEM_SOCIO,
      RESUMO_SOCIOS:           CONFIG.ABAS.RESUMO_SOCIOS
    };

    Object.keys(CONFIG.CAMPOS).forEach(function(aliasAba) {
      var nomeAba = MAPA_ALIAS_ABA[aliasAba];
      if (!nomeAba) return; // alias sem mapeamento: ignorar
      var campos = Object.values(CONFIG.CAMPOS[aliasAba]);
      var resultado = validarCabecalhosAba(nomeAba, campos);
      if (!resultado.ok) {
        resultado.ausentes.forEach(function(campo) {
          erros.push('[' + nomeAba + '] Campo ausente: ' + campo);
        });
      }
    });

    return { ok: erros.length === 0, erros: erros };
  }

  // ============================================================
  // VALIDAÇÃO DE Config_App
  // ============================================================

  /**
   * Valida se todos os parâmetros obrigatórios estão em Config_App.
   * Exibe alerta com resultado e grava log.
   * @returns {{ok: boolean, ausentes: Array<string>}}
   */
  function validarConfigApp() {
    var params = SheetService.lerTodosConfigApp();
    var ausentes = CONFIG.PARAMS_OBRIGATORIOS.filter(function(p) {
      return !params[p] || Utils.eVazio(params[p]);
    });

    var ok = ausentes.length === 0;
    var msg = ok
      ? '✅ Config_App: todos os ' + CONFIG.PARAMS_OBRIGATORIOS.length + ' parâmetros presentes.'
      : '❌ Config_App: parâmetros ausentes:\n' + ausentes.join('\n');

    logInfo('05_ValidationService', 'validarConfigApp',
      ok ? 'Config_App OK' : 'Parâmetros ausentes: ' + ausentes.join(', '));

    Utils.alerta('Validação Config_App', msg);
    return { ok: ok, ausentes: ausentes };
  }

  // ============================================================
  // VALIDAÇÃO DE Configuracoes
  // ============================================================

  /**
   * Valida se todos os grupos obrigatórios estão em Configuracoes.
   * Exibe alerta com resultado e grava log.
   * @returns {{ok: boolean, ausentes: Array<string>}}
   */
  function validarConfiguracoes() {
    var ausentes = [];

    CONFIG.GRUPOS_CONFIGURACOES_OBRIGATORIOS.forEach(function(grupo) {
      var valores = SheetService.lerGrupoConfiguracoes(grupo);
      if (valores.length === 0) {
        ausentes.push(grupo);
      }
    });

    var ok = ausentes.length === 0;
    var msg = ok
      ? '✅ Configuracoes: todos os ' + CONFIG.GRUPOS_CONFIGURACOES_OBRIGATORIOS.length + ' grupos presentes.'
      : '❌ Configuracoes: grupos ausentes:\n' + ausentes.join('\n');

    logInfo('05_ValidationService', 'validarConfiguracoes',
      ok ? 'Configuracoes OK' : 'Grupos ausentes: ' + ausentes.join(', '));

    Utils.alerta('Validação Configuracoes', msg);
    return { ok: ok, ausentes: ausentes };
  }

  // ============================================================
  // VALIDAÇÃO COMPLETA DA ESTRUTURA
  // ============================================================

  /**
   * Executa validação completa do ambiente HML.
   * Valida abas, cabeçalhos, Config_App e Configuracoes.
   * Exibe relatório consolidado e grava log.
   * @returns {{ok: boolean, relatorio: Array<string>}}
   */
  function validarEstruturaCompleta() {
    var relatorio = [];
    var tudoOk = true;

    Utils.toast('Validando estrutura...', 'MVP 1.5', 5);

    // 1. Abas
    var resAbas = validarAbasSilencioso();
    if (resAbas.ok) {
      relatorio.push('✅ Abas: todas presentes (' + Object.keys(CONFIG.ABAS).length + ')');
    } else {
      relatorio.push('❌ Abas ausentes: ' + resAbas.ausentes.join(', '));
      tudoOk = false;
    }

    // 2. Cabeçalhos
    var resCab = validarTodosCabecalhos();
    if (resCab.ok) {
      relatorio.push('✅ Cabeçalhos: todos presentes');
    } else {
      relatorio.push('❌ Cabeçalhos com problemas (' + resCab.erros.length + '):');
      resCab.erros.slice(0, 5).forEach(function(e) { relatorio.push('  ' + e); });
      if (resCab.erros.length > 5) relatorio.push('  ... e mais ' + (resCab.erros.length - 5));
      tudoOk = false;
    }

    // 3. Config_App
    var resConfig = validarConfigAppSilencioso();
    if (resConfig.ok) {
      relatorio.push('✅ Config_App: todos os parâmetros presentes');
    } else {
      relatorio.push('❌ Config_App ausentes: ' + resConfig.ausentes.join(', '));
      tudoOk = false;
    }

    // 4. Configuracoes
    var resConf = validarConfiguracoesSilencioso();
    if (resConf.ok) {
      relatorio.push('✅ Configuracoes: todos os grupos presentes');
    } else {
      relatorio.push('❌ Configuracoes ausentes: ' + resConf.ausentes.join(', '));
      tudoOk = false;
    }

    // Resultado final
    relatorio.unshift(
      tudoOk
        ? '✅ ESTRUTURA VÁLIDA — Ambiente HML pronto.'
        : '⚠️ ESTRUTURA COM PROBLEMAS — Corrija antes de usar.'
    );

    logInfo('05_ValidationService', 'validarEstruturaCompleta',
      tudoOk ? 'Validação completa: OK' : 'Validação completa: com erros');

    Utils.alerta(
      tudoOk ? '✅ Validação Completa' : '⚠️ Validação com Problemas',
      relatorio.join('\n')
    );

    return { ok: tudoOk, relatorio: relatorio };
  }

  // ============================================================
  // VERSÕES SILENCIOSAS (sem alerta, para uso interno)
  // ============================================================

  function validarAbasSilencioso() {
    var todasAbas = Object.values(CONFIG.ABAS);
    var ausentes = todasAbas.filter(function(a) { return !SheetService.abaExiste(a); });
    return { ok: ausentes.length === 0, ausentes: ausentes };
  }

  function validarConfigAppSilencioso() {
    var params = SheetService.lerTodosConfigApp();
    var ausentes = CONFIG.PARAMS_OBRIGATORIOS.filter(function(p) {
      return !params[p] || Utils.eVazio(params[p]);
    });
    return { ok: ausentes.length === 0, ausentes: ausentes };
  }

  function validarConfiguracoesSilencioso() {
    var ausentes = CONFIG.GRUPOS_CONFIGURACOES_OBRIGATORIOS.filter(function(grupo) {
      return SheetService.lerGrupoConfiguracoes(grupo).length === 0;
    });
    return { ok: ausentes.length === 0, ausentes: ausentes };
  }

  /**
   * Validação silenciosa completa — retorna resultado sem exibir alertas.
   * Usada por InstallService e GovernanceService.
   * @returns {{ok: boolean, erros: Array<string>}}
   */
  function validarSilencioso() {
    var erros = [];

    var resAbas = validarAbasSilencioso();
    if (!resAbas.ok) erros.push('Abas ausentes: ' + resAbas.ausentes.join(', '));

    var resCab = validarTodosCabecalhos();
    if (!resCab.ok) erros = erros.concat(resCab.erros.slice(0, 3));

    var resConfig = validarConfigAppSilencioso();
    if (!resConfig.ok) erros.push('Config_App: ' + resConfig.ausentes.join(', '));

    var resConf = validarConfiguracoesSilencioso();
    if (!resConf.ok) erros.push('Configuracoes: ' + resConf.ausentes.join(', '));

    return { ok: erros.length === 0, erros: erros };
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    validarAbas:               validarAbas,
    validarCabecalhosAba:      validarCabecalhosAba,
    validarTodosCabecalhos:    validarTodosCabecalhos,
    validarConfigApp:          validarConfigApp,
    validarConfiguracoes:      validarConfiguracoes,
    validarEstruturaCompleta:  validarEstruturaCompleta,
    validarSilencioso:         validarSilencioso
  };

})();
