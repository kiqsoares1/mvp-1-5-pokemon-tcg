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
    var res = validarAbasSilencioso();
    var totalAbas = Object.keys(CONFIG.ABAS).length;
    var msg = res.ok
      ? '✅ Todas as ' + totalAbas + ' abas obrigatórias estão presentes.'
      : '❌ Abas ausentes (' + res.ausentes.length + '):\n' + res.ausentes.join('\n');

    logInfo('05_ValidationService', 'validarAbas',
      res.ok ? 'Validação de abas: OK' : 'Abas ausentes: ' + res.ausentes.join(', '));

    Utils.alerta('Validação de Abas', msg);
    return res;
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
   *
   * Toda chave de CONFIG.CAMPOS é, por convenção do projeto, a mesma chave
   * em CONFIG.ABAS (ex: CONFIG.CAMPOS.PRODUTOS_ATIVOS ↔ CONFIG.ABAS.PRODUTOS_ATIVOS)
   * — por isso o nome real da aba é lido direto de CONFIG.ABAS[aliasAba], sem
   * precisar de um mapa paralelo. Um mapa manual duplicado aqui já causou o
   * risco de uma aba nova em CONFIG.CAMPOS ser esquecida no mapa e ficar
   * silenciosamente fora da validação (nenhum erro reportado).
   * @returns {{ok: boolean, erros: Array<string>}}
   */
  function validarTodosCabecalhos() {
    var erros = [];

    Object.keys(CONFIG.CAMPOS).forEach(function(aliasAba) {
      var nomeAba = CONFIG.ABAS[aliasAba];
      if (!nomeAba) {
        erros.push('[CONFIG] Alias "' + aliasAba + '" existe em CONFIG.CAMPOS mas não em CONFIG.ABAS.');
        return;
      }
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
    var res = validarConfigAppSilencioso();
    var msg = res.ok
      ? '✅ Config_App: todos os ' + CONFIG.PARAMS_OBRIGATORIOS.length + ' parâmetros presentes.'
      : '❌ Config_App: parâmetros ausentes:\n' + res.ausentes.join('\n');

    logInfo('05_ValidationService', 'validarConfigApp',
      res.ok ? 'Config_App OK' : 'Parâmetros ausentes: ' + res.ausentes.join(', '));

    Utils.alerta('Validação Config_App', msg);
    return res;
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
    var res = validarConfiguracoesSilencioso();
    var msg = res.ok
      ? '✅ Configuracoes: todos os ' + CONFIG.GRUPOS_CONFIGURACOES_OBRIGATORIOS.length + ' grupos presentes.'
      : '❌ Configuracoes: grupos ausentes:\n' + res.ausentes.join('\n');

    logInfo('05_ValidationService', 'validarConfiguracoes',
      res.ok ? 'Configuracoes OK' : 'Grupos ausentes: ' + res.ausentes.join(', '));

    Utils.alerta('Validação Configuracoes', msg);
    return res;
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
    var todosGrupos = SheetService.lerTodosGruposConfiguracoes();
    var ausentes = CONFIG.GRUPOS_CONFIGURACOES_OBRIGATORIOS.filter(function(grupo) {
      return !todosGrupos[grupo] || todosGrupos[grupo].length === 0;
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
