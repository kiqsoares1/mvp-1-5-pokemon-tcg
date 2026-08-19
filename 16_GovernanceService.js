/**
 * ============================================================
 * 16_GovernanceService.gs — Serviço de Governança e Proteção
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Aplica proteções nas abas técnicas/automáticas,
 * oculta abas auxiliares, prepara ambiente HML e
 * registra pendências de governança.
 *
 * Dependências: 00_Config.gs, 02_Utils.gs, 03_SheetService.gs,
 *               14_LogService.gs
 * ============================================================
 */

var GovernanceService = (function() {

  // ============================================================
  // PROTEÇÃO DE ABAS
  // ============================================================

  /**
   * Aplica proteção nas abas técnicas com comportamento por ambiente:
   *
   * - AMBIENTE = HML: usa setWarningOnly(true) — exibe aviso mas permite edição.
   *   Adequado para desenvolvimento e homologação.
   *
   * - AMBIENTE = PROD: usa setWarningOnly(false) — proteção real.
   *   Bloqueia edição para todos exceto editores autorizados.
   *   ATENÇÃO: Em PROD, exige confirmação explícita do usuário antes de aplicar.
   *
   * @param {boolean} [forcarProd] - Se true, aplica proteção PROD mesmo em HML (para testes).
   * @returns {{ok: boolean, protegidas: Array<string>, erros: Array<string>, modo: string}}
   */
  function aplicarProtecoes(forcarProd) {
    var protegidas = [];
    var erros = [];

    // Determinar modo de proteção pelo ambiente
    var ambiente = SheetService.lerConfigApp('AMBIENTE') || CONFIG.AMBIENTE;
    var modoProducao = (ambiente === 'PROD') || (forcarProd === true);

    // Exigir confirmação explícita para proteção real em PROD
    if (modoProducao) {
      var ui = SpreadsheetApp.getUi();
      var resp = ui.alert(
        '\u26a0\ufe0f Proteção PROD',
        'Você está prestes a aplicar PROTEÇÃO REAL (PROD).\n\n' +
        'Isso bloqueará a edição das abas técnicas para todos os usuários,\n' +
        'exceto os editores autorizados do arquivo.\n\n' +
        'Ambiente detectado: ' + ambiente + '\n\n' +
        'Deseja continuar?',
        ui.ButtonSet.YES_NO
      );
      if (resp !== ui.Button.YES) {
        Utils.toast('Proteção PROD cancelada pelo usuário.', 'MVP 1.5', 3);
        return { ok: false, protegidas: [], erros: ['Cancelado pelo usuário'], modo: 'PROD' };
      }
    }

    var modoLabel = modoProducao ? 'PROD (proteção real)' : 'HML (somente aviso)';
    Utils.toast('Aplicando proteções [' + modoLabel + ']...', 'MVP 1.5', 5);

    CONFIG.ABAS_PROTEGIDAS.forEach(function(nomeAba) {
      try {
        if (!SheetService.abaExiste(nomeAba)) {
          erros.push(nomeAba + ': aba não encontrada');
          return;
        }
        var sheet = SheetService.getSheet(nomeAba);

        // Remove proteções existentes antes de reaplicar
        var protecoesExistentes = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
        protecoesExistentes.forEach(function(p) { p.remove(); });

        // Aplica nova proteção com modo correto por ambiente
        var protecao = sheet.protect();
        protecao.setDescription(
          'Aba protegida pelo MVP 1.5 [' + ambiente + '] — não editar manualmente'
        );

        if (modoProducao) {
          // PROD: proteção real — bloqueia edição manual via UI para quem
          // não estiver listado como editor da proteção. NÃO chama
          // removeEditors(): o comportamento exato de quem fica com acesso
          // de edição por padrão em sheet.protect() precisa ser confirmado
          // na planilha real antes de restringir editores, para não travar
          // acidentalmente os sócios fora do owner (eles usam o Portal, que
          // grava via Apps Script, não via edição direta na UI).
          protecao.setWarningOnly(false);
        } else {
          // HML: apenas aviso ao tentar editar
          protecao.setWarningOnly(true);
        }

        protegidas.push(nomeAba);
      } catch (e) {
        erros.push(nomeAba + ': ' + e.message);
      }
    });

    var ok = erros.length === 0;
    logInfo('16_GovernanceService', 'aplicarProtecoes',
      'Proteções aplicadas [' + modoLabel + ']: ' + protegidas.length +
      ' | Erros: ' + erros.length +
      (erros.length > 0 ? ' | ' + erros.join('; ') : ''));

    var msg = '\u2705 Proteções aplicadas [' + modoLabel + ']: ' + protegidas.length + ' abas\n';
    if (protegidas.length > 0) msg += protegidas.join(', ') + '\n';
    if (erros.length > 0) msg += '\n\u274c Erros (' + erros.length + '):\n' + erros.join('\n');

    Utils.alerta('Proteção de Abas', msg);
    return { ok: ok, protegidas: protegidas, erros: erros, modo: ambiente };
  }

  /**
   * Remove todas as proteções das abas técnicas.
   * Usar apenas para manutenção ou reinstalação.
   * @returns {{ok: boolean, removidas: Array<string>}}
   */
  function removerProtecoes() {
    var removidas = [];
    CONFIG.ABAS_PROTEGIDAS.forEach(function(nomeAba) {
      try {
        if (!SheetService.abaExiste(nomeAba)) return;
        var sheet = SheetService.getSheet(nomeAba);
        var protecoes = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
        protecoes.forEach(function(p) { p.remove(); });
        removidas.push(nomeAba);
      } catch (e) {
        logWarning('16_GovernanceService', 'removerProtecoes',
          'Erro ao remover proteção de ' + nomeAba + ': ' + e.message);
      }
    });
    logInfo('16_GovernanceService', 'removerProtecoes',
      'Proteções removidas: ' + removidas.join(', '));
    return { ok: true, removidas: removidas };
  }

  // ============================================================
  // OCULTAÇÃO DE ABAS AUXILIARES
  // ============================================================

  /**
   * Oculta as abas auxiliares (Logs_Sistema, Config_App, etc.).
   * @returns {{ok: boolean, ocultadas: Array<string>}}
   */
  function ocultarAbasAuxiliares() {
    var ocultadas = [];
    CONFIG.ABAS_AUXILIARES.forEach(function(nomeAba) {
      try {
        if (!SheetService.abaExiste(nomeAba)) return;
        var sheet = SheetService.getSheet(nomeAba);
        sheet.hideSheet();
        ocultadas.push(nomeAba);
      } catch (e) {
        logWarning('16_GovernanceService', 'ocultarAbasAuxiliares',
          'Erro ao ocultar ' + nomeAba + ': ' + e.message);
      }
    });
    logInfo('16_GovernanceService', 'ocultarAbasAuxiliares',
      'Abas auxiliares ocultadas: ' + ocultadas.join(', '));
    return { ok: true, ocultadas: ocultadas };
  }

  /**
   * Exibe as abas auxiliares (para manutenção).
   * @returns {{ok: boolean, exibidas: Array<string>}}
   */
  function exibirAbasAuxiliares() {
    var exibidas = [];
    CONFIG.ABAS_AUXILIARES.forEach(function(nomeAba) {
      try {
        if (!SheetService.abaExiste(nomeAba)) return;
        var sheet = SheetService.getSheet(nomeAba);
        sheet.showSheet();
        exibidas.push(nomeAba);
      } catch (e) {
        logWarning('16_GovernanceService', 'exibirAbasAuxiliares',
          'Erro ao exibir ' + nomeAba + ': ' + e.message);
      }
    });
    logInfo('16_GovernanceService', 'exibirAbasAuxiliares',
      'Abas auxiliares exibidas: ' + exibidas.join(', '));
    return { ok: true, exibidas: exibidas };
  }

  // ============================================================
  // PREPARAÇÃO DO AMBIENTE HML
  // ============================================================

  /**
   * Prepara o ambiente HML: aplica proteções e oculta abas auxiliares.
   * @returns {{ok: boolean, relatorio: Array<string>}}
   */
  function prepararAmbienteHML() {
    var relatorio = [];

    Utils.toast('Preparando ambiente HML...', 'MVP 1.5', 5);
    logInfo('16_GovernanceService', 'prepararAmbienteHML', 'Iniciando preparação do ambiente HML.');

    // 1. Ocultar abas auxiliares
    var resOcultar = ocultarAbasAuxiliares();
    relatorio.push(resOcultar.ok
      ? '✅ Abas auxiliares ocultadas: ' + resOcultar.ocultadas.join(', ')
      : '⚠️ Erro ao ocultar abas auxiliares');

    // 2. Aplicar proteções
    var resProteger = aplicarProtecoesSilencioso();
    relatorio.push(resProteger.ok
      ? '✅ Proteções aplicadas: ' + resProteger.protegidas.length + ' abas'
      : '⚠️ Proteções com erros: ' + resProteger.erros.join(', '));

    var ok = resOcultar.ok && resProteger.ok;
    logInfo('16_GovernanceService', 'prepararAmbienteHML',
      ok ? 'Ambiente HML preparado com sucesso.' : 'Ambiente HML preparado com avisos.');

    Utils.alerta(
      ok ? '✅ Ambiente HML Pronto' : '⚠️ Ambiente HML com Avisos',
      relatorio.join('\n')
    );

    return { ok: ok, relatorio: relatorio };
  }

  /**
   * Versão silenciosa de aplicarProtecoes (sem alerta).
   * @returns {{ok: boolean, protegidas: Array<string>, erros: Array<string>}}
   */
  function aplicarProtecoesSilencioso() {
    var protegidas = [];
    var erros = [];

    CONFIG.ABAS_PROTEGIDAS.forEach(function(nomeAba) {
      try {
        if (!SheetService.abaExiste(nomeAba)) {
          erros.push(nomeAba + ': ausente');
          return;
        }
        var sheet = SheetService.getSheet(nomeAba);
        var existentes = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
        existentes.forEach(function(p) { p.remove(); });
        var protecao = sheet.protect();
        protecao.setDescription('Protegida pelo MVP 1.5');
        protecao.setWarningOnly(true);
        protegidas.push(nomeAba);
      } catch (e) {
        erros.push(nomeAba + ': ' + e.message);
      }
    });

    return { ok: erros.length === 0, protegidas: protegidas, erros: erros };
  }

  /**
   * Registra pendências de governança no Logs_Sistema.
   * @param {Array<string>} pendencias
   */
  function registrarPendencias(pendencias) {
    if (!pendencias || pendencias.length === 0) return;
    pendencias.forEach(function(p) {
      logWarning('16_GovernanceService', 'registrarPendencias', 'PENDÊNCIA: ' + p);
    });
  }

  /**
   * Verifica o status atual das proteções e ocultações.
   * @returns {{protegidas: Array<string>, naoProtegidas: Array<string>,
   *            ocultadas: Array<string>, visiveis: Array<string>}}
   */
  function verificarStatus() {
    var protegidas = [], naoProtegidas = [], ocultadas = [], visiveis = [];

    CONFIG.ABAS_PROTEGIDAS.forEach(function(nomeAba) {
      if (!SheetService.abaExiste(nomeAba)) return;
      var sheet = SheetService.getSheet(nomeAba);
      var prots = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      if (prots.length > 0) protegidas.push(nomeAba);
      else naoProtegidas.push(nomeAba);
    });

    CONFIG.ABAS_AUXILIARES.forEach(function(nomeAba) {
      if (!SheetService.abaExiste(nomeAba)) return;
      var sheet = SheetService.getSheet(nomeAba);
      if (sheet.isSheetHidden()) ocultadas.push(nomeAba);
      else visiveis.push(nomeAba);
    });

    return {
      protegidas:     protegidas,
      naoProtegidas:  naoProtegidas,
      ocultadas:      ocultadas,
      visiveis:       visiveis
    };
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    aplicarProtecoes:          aplicarProtecoes,
    aplicarProtecoesSilencioso: aplicarProtecoesSilencioso,
    removerProtecoes:          removerProtecoes,
    ocultarAbasAuxiliares:     ocultarAbasAuxiliares,
    exibirAbasAuxiliares:      exibirAbasAuxiliares,
    prepararAmbienteHML:       prepararAmbienteHML,
    registrarPendencias:       registrarPendencias,
    verificarStatus:           verificarStatus
  };

})();
