/**
 * * ============================================================
 * 17_InstallService.gs — Serviço de Instalação e Bootstrap
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Instalação inicial, health check, verificação de estrutura,
 * bootstrap do sistema e reaplicação de estrutura base.
 * Não sobrescreve dados existentes sem confirmação.
 *
 * Dependências: 00_Config.gs, 02_Utils.gs, 03_SheetService.gs,
 *               04_IdService.gs, 05_ValidationService.gs,
 *               14_LogService.gs, 16_GovernanceService.gs
 * ============================================================
 */

 var InstallService = (function() {

 // ============================================================
 // CRIAÇÃO DE ESTRUTURA BASE (planilha nova/vazia)
 // ============================================================

 // Mapeia o nome do grupo em Configuracoes para a chave em CONFIG.LISTAS
 var _GRUPO_PARA_LISTA = {
 'Negócios':               'NEGOCIOS',
 'Sim/Não':                'SIM_NAO',
 'Status Lote':            'STATUS_LOTE',
 'Status Venda':           'STATUS_VENDA',
 'Status Compra':          'STATUS_COMPRA',
 'Tipos Movimento':        'TIPOS_MOVIMENTO',
 'Severidades Log':        'SEVERIDADES_LOG',
 'Fontes Preço':           'FONTES_PRECO',
 'Categorias Despesa':     'CATEGORIAS_DESPESA',
 'Tipos Capital':          'TIPOS_CAPITAL',
 'Formas Pagamento Sócio': 'FORMAS_PAGAMENTO_SOCIO',
 'Status Retirada':        'STATUS_RETIRADA',
 'Natureza Despesa':       'NATUREZA_DESPESA'
 };

 /**
 * Cria as abas e cabeçalhos que ainda não existem, com base em
 * CONFIG.ABAS / CONFIG.CAMPOS, e semeia Config_App e Configuracoes
 * com os defaults de CONFIG.PARAMS_DEFAULT / CONFIG.LISTAS.
 *
 * Idempotente: nunca apaga aba ou dado existente, apenas cria o
 * que falta. Pensada para rodar uma única vez numa planilha nova
 * e vazia, mas segura para rodar de novo a qualquer momento.
 *
 * @returns {{ok: boolean, criadas: Array<string>, jaExistiam: Array<string>, erros: Array<string>}}
 */
 function criarEstruturaBase() {
 var ui = SpreadsheetApp.getUi();
 var resp = ui.alert(
 'Criar Estrutura Base',
 'Isso cria as abas e cabeçalhos que ainda não existem nesta planilha,\n' +
 'com base na configuração atual do sistema (Pokémon TCG + Sócios).\n\n' +
 'Nenhuma aba ou dado existente é apagado.\n\nContinuar?',
 ui.ButtonSet.YES_NO
 );
 if (resp !== ui.Button.YES) return { ok: false, criadas: [], jaExistiam: [], erros: ['Cancelado pelo usuário'] };

 var ss = SheetService.getSpreadsheet();
 var criadas = [];
 var jaExistiam = [];
 var colunasAdicionadas = [];
 var erros = [];

 Object.keys(CONFIG.ABAS).forEach(function(alias) {
 var nomeAba = CONFIG.ABAS[alias];
 try {
 if (SheetService.abaExiste(nomeAba)) {
 jaExistiam.push(nomeAba);
 var campos = CONFIG.CAMPOS[alias];
 if (campos) {
 var faltantes = _sincronizarColunasFaltantes(SheetService.getSheet(nomeAba), Object.values(campos));
 if (faltantes.length > 0) colunasAdicionadas.push(nomeAba + ' (' + faltantes.join(', ') + ')');
 }
 } else {
 var sheet = ss.insertSheet(nomeAba);
 var campos2 = CONFIG.CAMPOS[alias];
 if (campos2) {
 var cabecalhos = Object.values(campos2);
 sheet.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
 sheet.setFrozenRows(1);
 }
 criadas.push(nomeAba);
 }
 } catch (e) {
 erros.push(nomeAba + ': ' + e.message);
 }
 });

 // Remove a aba padrão "Sheet1" / "Página1" se ela ainda estiver vazia
 // (criada automaticamente pelo Google ao gerar uma spreadsheet nova).
 try {
 ['Sheet1', 'Página1', 'Planilha1'].forEach(function(nomePadrao) {
 var sh = ss.getSheetByName(nomePadrao);
 if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0 && sh.getLastColumn() === 0) {
 ss.deleteSheet(sh);
 }
 });
 } catch (e) { /* não crítico */ }

 // Semeia Config_App com os parâmetros default, se ainda vazia
 try {
 if (SheetService.abaExiste(CONFIG.ABAS.CONFIG_APP) && SheetService.contarLinhas(CONFIG.ABAS.CONFIG_APP) === 0) {
 var linhasParam = Object.keys(CONFIG.PARAMS_DEFAULT).map(function(k) {
 return [k, CONFIG.PARAMS_DEFAULT[k], typeof CONFIG.PARAMS_DEFAULT[k] === 'number' ? 'Número' : 'Texto', ''];
 });
 SheetService.getSheet(CONFIG.ABAS.CONFIG_APP).getRange(2, 1, linhasParam.length, 4).setValues(linhasParam);
 }
 } catch (e) { erros.push('Config_App (seed): ' + e.message); }

 // Semeia Configuracoes com as listas de valores válidos, se ainda vazia
 try {
 if (SheetService.abaExiste(CONFIG.ABAS.CONFIGURACOES) && SheetService.contarLinhas(CONFIG.ABAS.CONFIGURACOES) === 0) {
 var linhasConf = [];
 Object.keys(_GRUPO_PARA_LISTA).forEach(function(grupo) {
 var chaveLista = _GRUPO_PARA_LISTA[grupo];
 var valores = CONFIG.LISTAS[chaveLista] || [];
 valores.forEach(function(v) {
 linhasConf.push([grupo, v, 'Lista', 'Valores válidos para ' + grupo, 'Sim']);
 });
 });
 if (linhasConf.length > 0) {
 SheetService.getSheet(CONFIG.ABAS.CONFIGURACOES).getRange(2, 1, linhasConf.length, 5).setValues(linhasConf);
 }
 }
 } catch (e) { erros.push('Configuracoes (seed): ' + e.message); }

 logInfo('17_InstallService', 'criarEstruturaBase',
 'Estrutura base criada | Novas: ' + criadas.length + ' | Já existiam: ' + jaExistiam.length +
 ' | Colunas sincronizadas: ' + colunasAdicionadas.length + ' | Erros: ' + erros.length);

 var msg = 'Abas criadas (' + criadas.length + '): ' + (criadas.join(', ') || '-') + '\n' +
 'Já existiam (' + jaExistiam.length + ')\n' +
 (colunasAdicionadas.length > 0 ? 'Colunas adicionadas em abas existentes: ' + colunasAdicionadas.join(' | ') + '\n' : '') +
 (erros.length > 0 ? 'Erros: ' + erros.join('; ') : 'Sem erros.') +
 '\n\nPróximo passo: rode "Instalar / Inicializar Sistema" no menu.';
 ui.alert(erros.length > 0 ? 'Estrutura Base — Com Avisos' : 'Estrutura Base Criada', msg, ui.ButtonSet.OK);

 return { ok: erros.length === 0, criadas: criadas, jaExistiam: jaExistiam, colunasAdicionadas: colunasAdicionadas, erros: erros };
 }

 /**
 * Adiciona ao final de uma aba já existente qualquer cabeçalho de
 * `camposEsperados` que ainda não exista na linha 1. Não move, renomeia
 * ou apaga colunas existentes — apenas acrescenta o que falta.
 * @param {Sheet} sheet
 * @param {Array<string>} camposEsperados - valores de CONFIG.CAMPOS[alias]
 * @returns {Array<string>} nomes dos cabeçalhos que foram adicionados
 */
 function _sincronizarColunasFaltantes(sheet, camposEsperados) {
 var ultimaColuna = sheet.getLastColumn();
 var cabecalhosAtuais = ultimaColuna > 0
 ? sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0]
 : [];

 var faltantes = camposEsperados.filter(function(campo) {
 return cabecalhosAtuais.indexOf(campo) === -1;
 });

 if (faltantes.length > 0) {
 sheet.getRange(1, ultimaColuna + 1, 1, faltantes.length).setValues([faltantes]);
 }

 return faltantes;
 }

 // ============================================================
 // INSTALAÇÃO INICIAL
 // ============================================================

 /**
 * Executa a instalação/inicialização completa do sistema.
 * Verifica estrutura, aplica proteções, oculta abas auxiliares
 * e grava log de instalação.
 * Não sobrescreve dados existentes.
 */
 function instalar() {
 var ui = SpreadsheetApp.getUi();

 var resp = ui.alert(
 'Instalar MVP 1.5',
 'Este processo irá:\n' +
 '1. Verificar estrutura da planilha\n' +
 '2. Aplicar proteções nas abas técnicas\n' +
 '3. Ocultar abas auxiliares\n' +
 '4. Registrar log de instalação\n\n' +
 'Dados existentes NÃO serão apagados.\n\n' +
 'Deseja continuar?',
 ui.ButtonSet.YES_NO
 );

 if (resp !== ui.Button.YES) {
 Utils.toast('Instalação cancelada.', 'MVP 1.5', 3);
 return;
 }

 Utils.toast('Instalando MVP 1.5...', 'MVP 1.5', 10);
 logInfo('17_InstallService', 'instalar', 'Iniciando instalação do MVP 1.5.');

 var relatorio = [];
 var tudoOk = true;

 // 1. Verificar estrutura
 var resValidacao = ValidationService.validarSilencioso();
 if (resValidacao.ok) {
 relatorio.push('Estrutura: válida');
 } else {
 relatorio.push('Estrutura com problemas:');
 resValidacao.erros.forEach(function(e) { relatorio.push('  ' + e); });
 tudoOk = false;
 }

 // 2. Ocultar abas auxiliares
 var resOcultar = GovernanceService.ocultarAbasAuxiliares();
 relatorio.push(resOcultar.ok
 ? 'Abas auxiliares: ocultadas (' + resOcultar.ocultadas.length + ')'
 : 'Erro ao ocultar abas auxiliares');

 // 3. Aplicar proteções
 var resProtecoes = GovernanceService.aplicarProtecoesSilencioso
 ? GovernanceService.aplicarProtecoesSilencioso()
 : { ok: false, protegidas: [], erros: ['método não disponível'] };

 relatorio.push('Proteções: ' + resProtecoes.protegidas.length + ' abas protegidas');
 if (resProtecoes.erros.length > 0) {
 relatorio.push('Erros de proteção: ' + resProtecoes.erros.join(', '));
 }

 // 4. Log de instalação
 logInfo('17_InstallService', 'instalar',
 'Instalação concluída. Status: ' + (tudoOk ? 'OK' : 'COM AVISOS') +
 ' | Ambiente: ' + CONFIG.AMBIENTE + ' | Versão: ' + CONFIG.VERSAO);

 relatorio.unshift(
 tudoOk
 ? 'INSTALAÇÃO CONCLUÍDA COM SUCESSO'
 : 'INSTALAÇÃO CONCLUÍDA COM AVISOS'
 );

 ui.alert(
 tudoOk ? 'MVP 1.5 Instalado' : 'MVP 1.5 Instalado com Avisos',
 relatorio.join('\n'),
 ui.ButtonSet.OK
 );
 }

 // ============================================================
 // HEALTH CHECK
 // ============================================================

 /**
 * Executa health check completo do sistema.
 * Verifica estrutura, parâmetros, logs e status de proteções.
 */
 function healthCheck() {
 Utils.toast('Executando health check...', 'MVP 1.5', 5);
 logInfo('17_InstallService', 'healthCheck', 'Health check iniciado.');

 var relatorio = [];
 var tudoOk = true;

 // 1. Versão e ambiente
 var params = lerParametros();
 relatorio.push('Sistema: ' + CONFIG.SISTEMA_NOME);
 relatorio.push('Versão: ' + (params.VERSAO_APP || CONFIG.VERSAO));
 relatorio.push('Ambiente: ' + (params.AMBIENTE || CONFIG.AMBIENTE));
 relatorio.push('');

 // 2. Validação estrutural
 var resVal = ValidationService.validarSilencioso();
 if (resVal.ok) {
 relatorio.push('Estrutura: válida');
 } else {
 relatorio.push('Estrutura com erros (' + resVal.erros.length + '):');
 resVal.erros.slice(0, 3).forEach(function(e) { relatorio.push('  ' + e); });
 tudoOk = false;
 }

 // 3. Status de proteções
 var statusGov = GovernanceService.verificarStatus();
 relatorio.push('Abas protegidas: ' + statusGov.protegidas.length +
 '/' + CONFIG.ABAS_PROTEGIDAS.length);
 if (statusGov.naoProtegidas.length > 0) {
 relatorio.push('Sem proteção: ' + statusGov.naoProtegidas.join(', '));
 }
 relatorio.push('Abas auxiliares ocultas: ' + statusGov.ocultadas.length +
 '/' + CONFIG.ABAS_AUXILIARES.length);

 // 4. Contagem de logs
 var contLogs = LogService.contarPorSeveridade();
 relatorio.push('');
 relatorio.push('Logs: INFO=' + contLogs.INFO +
 ' | WARN=' + contLogs.WARNING +
 ' | ERR=' + contLogs.ERROR +
 ' | CRIT=' + contLogs.CRITICAL);

 // 5. Contagem de dados por aba principal
 relatorio.push('');
 relatorio.push('Dados:');
 var abasContar = ['PRODUTOS_ATIVOS', 'COMPRAS', 'VENDAS', 'LOTES_ESTOQUE'];
 abasContar.forEach(function(alias) {
 try {
 var count = SheetService.contarLinhas(CONFIG.ABAS[alias]);
 relatorio.push('  ' + CONFIG.ABAS[alias] + ': ' + count + ' registros');
 } catch (e) {
 relatorio.push('  ' + CONFIG.ABAS[alias] + ': erro ao contar');
 }
 });

 logInfo('17_InstallService', 'healthCheck',
 'Health check concluído. Status: ' + (tudoOk ? 'OK' : 'COM AVISOS'));

 SpreadsheetApp.getUi().alert(
 tudoOk ? 'Health Check — OK' : 'Health Check — Com Avisos',
 relatorio.join('\n'),
 SpreadsheetApp.getUi().ButtonSet.OK
 );
 }

 // ============================================================
 // REAPLICAÇÃO DE ESTRUTURA BASE
 // ============================================================

 /**
 * Reaaplica proteções e ocultações sem apagar dados.
 * Útil após importação ou restauração de backup.
 */
 function reaplicarEstrutura() {
 var ui = SpreadsheetApp.getUi();
 var resp = ui.alert(
 'Reaplicar Estrutura Base',
 'Reaplicará proteções e ocultações.\n' +
 'Dados NÃO serão apagados.\n\nContinuar?',
 ui.ButtonSet.YES_NO
 );
 if (resp !== ui.Button.YES) return;

 Utils.toast('Reaplicando estrutura...', 'MVP 1.5', 5);
 logInfo('17_InstallService', 'reaplicarEstrutura', 'Reaplicação de estrutura iniciada.');

 // Usa aplicarProtecoes() (não prepararAmbienteHML) para respeitar o
 // AMBIENTE atual (Config_App.AMBIENTE / CONFIG.AMBIENTE): rodar esta
 // função numa planilha já em PROD com proteção real (setWarningOnly(false))
 // não pode rebaixar silenciosamente essa proteção para "somente aviso".
 GovernanceService.ocultarAbasAuxiliares();
 GovernanceService.aplicarProtecoes();

 logInfo('17_InstallService', 'reaplicarEstrutura', 'Reaplicação concluída.');
 }

 // ============================================================
 // LEITURA DE PARÂMETROS
 // ============================================================

 /**
 * Lê todos os parâmetros de Config_App.
 * Retorna defaults de CONFIG.PARAMS_DEFAULT se Config_App não acessível.
 * @returns {Object}
 */
 function lerParametros() {
 try {
 var params = SheetService.lerTodosConfigApp();
 // Preenche com defaults para parâmetros ausentes
 Object.keys(CONFIG.PARAMS_DEFAULT).forEach(function(k) {
 if (!params[k]) params[k] = CONFIG.PARAMS_DEFAULT[k];
 });
 return params;
 } catch (e) {
 logWarning('17_InstallService', 'lerParametros',
 'Erro ao ler Config_App, usando defaults: ' + e.message);
 return CONFIG.PARAMS_DEFAULT;
 }
 }

 /**
 * Lê um parâmetro específico de Config_App.
 * Retorna o default de CONFIG.PARAMS_DEFAULT se não encontrado.
 * @param {string} nomeParam
 * @returns {*}
 */
 function lerParametro(nomeParam) {
 var params = lerParametros();
 return params[nomeParam] !== undefined
 ? params[nomeParam]
 : CONFIG.PARAMS_DEFAULT[nomeParam];
 }

 // ============================================================
 // INTERFACE PÚBLICA
 // ============================================================
 return {
 criarEstruturaBase: criarEstruturaBase,
 instalar:          instalar,
 healthCheck:       healthCheck,
 reaplicarEstrutura: reaplicarEstrutura,
 lerParametros:     lerParametros,
 lerParametro:      lerParametro
 };

 })();

