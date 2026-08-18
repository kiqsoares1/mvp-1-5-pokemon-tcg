/**
 * ============================================================
 * 01_Menu.gs — Menu Personalizado do Sistema
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Cria o menu personalizado no Google Sheets ao abrir a planilha.
 * ============================================================
 */

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();

    ui.createMenu('MVP 1.5')
      .addItem('Abrir Portal', 'abrirPortalMVP')
      .addSeparator()
      .addSubMenu(
        ui.createMenu('Instalação & Setup')
          .addItem('1. Criar Estrutura Base (planilha nova)', 'runCriarEstruturaBase')
          .addItem('2. Instalar / Inicializar Sistema', 'runInstall')
          .addItem('Health Check do Sistema', 'runHealthCheck')
          .addItem('Aplicar Proteções de Abas', 'runAplicarProtecoes')
          .addItem('Reaplicar Estrutura Base', 'runReaplicarEstrutura')
      )
      .addSeparator()
      .addSubMenu(
        ui.createMenu('Validação')
          .addItem('Validar Estrutura Completa', 'runValidarEstrutura')
          .addItem('Validar Config_App', 'runValidarConfigApp')
          .addItem('Validar Configuracoes', 'runValidarConfiguracoes')
          .addItem('Validar Abas Obrigatórias', 'runValidarAbas')
      )
      .addSeparator()
      .addSubMenu(
        ui.createMenu('Logs & Diagnóstico')
          .addItem('Ver Últimos 20 Logs', 'runVerUltimosLogs')
          .addItem('Limpar Logs Antigos (> 90 dias)', 'runLimparLogsAntigos')
          .addItem('Exportar Logs para Drive', 'runExportarLogs')
      )
      .addSeparator()
      .addSubMenu(
        ui.createMenu('Sócios')
          .addItem('Cadastrar Sócios Padrão (Kaique, Samuel, Lucas)', 'runCadastrarSociosPadrao')
      )
      .addSeparator()
      .addSubMenu(
        ui.createMenu('Utilitários')
          .addItem('Mostrar Versão do Sistema', 'runMostrarVersao')
          .addItem('Mostrar Parâmetros Ativos', 'runMostrarParametros')
          .addItem('Testar Geração de IDs', 'runTestarIds')
          .addItem('Testar Log de Sistema', 'runTestarLog')
      )
      .addToUi();

    try {
      logInfo('01_Menu', 'onOpen', 'Menu MVP 1.5 carregado com portal.');
    } catch (_) {}

  } catch (e) {
    console.error('[01_Menu] Erro ao criar menu: ' + e.message);
  }
}

function runCriarEstruturaBase() {
  try { InstallService.criarEstruturaBase(); } catch (e) { _menuErro('runCriarEstruturaBase', e); }
}

function runInstall() {
  try { InstallService.instalar(); } catch (e) { _menuErro('runInstall', e); }
}

function runHealthCheck() {
  try { InstallService.healthCheck(); } catch (e) { _menuErro('runHealthCheck', e); }
}

function runAplicarProtecoes() {
  try { GovernanceService.aplicarProtecoes(); } catch (e) { _menuErro('runAplicarProtecoes', e); }
}

function runReaplicarEstrutura() {
  try { InstallService.reaplicarEstrutura(); } catch (e) { _menuErro('runReaplicarEstrutura', e); }
}

function runValidarEstrutura() {
  try { ValidationService.validarEstruturaCompleta(); } catch (e) { _menuErro('runValidarEstrutura', e); }
}

function runValidarConfigApp() {
  try { ValidationService.validarConfigApp(); } catch (e) { _menuErro('runValidarConfigApp', e); }
}

function runValidarConfiguracoes() {
  try { ValidationService.validarConfiguracoes(); } catch (e) { _menuErro('runValidarConfiguracoes', e); }
}

function runValidarAbas() {
  try { ValidationService.validarAbas(); } catch (e) { _menuErro('runValidarAbas', e); }
}

function runVerUltimosLogs() {
  try { LogService.exibirUltimosLogs(20); } catch (e) { _menuErro('runVerUltimosLogs', e); }
}

function runLimparLogsAntigos() {
  try {
    var ui = SpreadsheetApp.getUi();
    var resp = ui.alert(
      'Confirmar Limpeza',
      'Remover logs com mais de 90 dias? Esta ação não pode ser desfeita.',
      ui.ButtonSet.YES_NO
    );
    if (resp === ui.Button.YES) LogService.limparLogsAntigos(90);
  } catch (e) { _menuErro('runLimparLogsAntigos', e); }
}

function runExportarLogs() {
  try { LogService.exportarLogs(); } catch (e) { _menuErro('runExportarLogs', e); }
}

function runMostrarVersao() {
  try {
    var params = InstallService.lerParametros();
    var msg = 'Sistema: ' + CONFIG.SISTEMA_NOME + '\n'
            + 'Versão: ' + (params.VERSAO_APP || CONFIG.VERSAO) + '\n'
            + 'Ambiente: ' + (params.AMBIENTE || CONFIG.AMBIENTE) + '\n'
            + 'Timezone: ' + (params.TIMEZONE || CONFIG.TIMEZONE);
    SpreadsheetApp.getUi().alert('Versão do Sistema', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { _menuErro('runMostrarVersao', e); }
}

function runMostrarParametros() {
  try {
    var params = InstallService.lerParametros();
    var linhas = Object.keys(params).map(function(k) { return '- ' + k + ': ' + params[k]; });
    SpreadsheetApp.getUi().alert('Parâmetros Ativos (Config_App)', linhas.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { _menuErro('runMostrarParametros', e); }
}

function runTestarIds() {
  try {
    var exemplos = [
      'Compra: ' + IdService.gerarId('COMPRA'),
      'Item Compra: ' + IdService.gerarId('ITEM_COMPRA'),
      'Venda: ' + IdService.gerarId('VENDA'),
      'Lote: ' + IdService.gerarId('LOTE'),
      'Movimento: ' + IdService.gerarId('MOVIMENTO'),
      'Log: ' + IdService.gerarId('LOG')
    ];
    SpreadsheetApp.getUi().alert('Exemplos de IDs Gerados', exemplos.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { _menuErro('runTestarIds', e); }
}

function runCadastrarSociosPadrao() {
  try {
    var nomes = ['Kaique', 'Samuel', 'Lucas'];
    var existentes = SociosService.listarSocios(false).map(function(s) { return Utils.normalizar(s.nome).toLowerCase(); });
    var criados = [];
    nomes.forEach(function(nome) {
      if (existentes.indexOf(Utils.normalizar(nome).toLowerCase()) !== -1) return;
      var res = SociosService.cadastrarSocio({ nome: nome });
      if (res.sucesso) criados.push(nome);
    });
    var msg = criados.length > 0
      ? 'Sócios cadastrados: ' + criados.join(', ')
      : 'Nenhum sócio novo — Kaique, Samuel e Lucas já estavam cadastrados.';
    SpreadsheetApp.getUi().alert('Sócios Padrão', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { _menuErro('runCadastrarSociosPadrao', e); }
}

function runTestarLog() {
  try {
    logInfo('01_Menu', 'runTestarLog', 'Teste de log INFO executado pelo usuário.');
    logWarning('01_Menu', 'runTestarLog', 'Teste de log WARNING executado pelo usuário.');
    SpreadsheetApp.getUi().alert('Teste de Log', 'Logs gravados em Logs_Sistema com sucesso. Verifique a aba Logs_Sistema.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { _menuErro('runTestarLog', e); }
}

function _menuErro(funcao, e) {
  var msg = 'Erro em ' + funcao + ':\n' + e.message;
  try { logError('01_Menu', funcao, msg, e.stack || ''); } catch (_) {}
  SpreadsheetApp.getUi().alert('Erro', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
