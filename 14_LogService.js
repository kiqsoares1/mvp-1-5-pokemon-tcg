/**
 * ============================================================
 * 14_LogService.gs — Serviço de Logs do Sistema
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Gravação de logs na aba Logs_Sistema.
 * Padroniza severidades, payload mínimo, e permite log de
 * instalação, validação, erros e eventos técnicos.
 *
 * Dependências: 00_Config.gs, 02_Utils.gs, 03_SheetService.gs,
 *               04_IdService.gs
 *
 * Severidades: INFO | WARNING | ERROR | CRITICAL
 * ============================================================
 */

var LogService = (function() {

  // Ordem dos campos em Logs_Sistema conforme cabeçalho
  var _CAMPOS_ORDEM = [
    'ID Log',
    'Data/Hora',
    'Usuário',
    'Módulo',
    'Operação',
    'Severidade',
    'Mensagem',
    'Referência ID'
  ];

  // ============================================================
  // GRAVAÇÃO DE LOGS
  // ============================================================

  /**
   * Grava um log na aba Logs_Sistema.
   * @param {string} modulo    - Nome do módulo/arquivo .gs
   * @param {string} operacao  - Nome da função/operação
   * @param {string} severidade - INFO | WARNING | ERROR | CRITICAL
   * @param {string} mensagem  - Descrição do evento
   * @param {string} [refId]   - ID de referência (compra, venda, etc.)
   */
  function gravar(modulo, operacao, severidade, mensagem, refId) {
    try {
      var linha = [
        IdService.gerarIdLog(),
        Utils.timestamp(),
        Utils.usuarioAtivo(),
        Utils.truncar(modulo || 'sistema', 50),
        Utils.truncar(operacao || '-', 80),
        severidade || 'INFO',
        Utils.truncar(mensagem || '', 500),
        refId || ''
      ];
      SheetService.appendLinha(CONFIG.ABAS.LOGS_SISTEMA, linha);
    } catch (e) {
      // Log silencioso para não criar loop infinito
      console.error('[14_LogService] Erro ao gravar log: ' + e.message);
    }
  }

  /**
   * Grava log de severidade INFO.
   * @param {string} modulo
   * @param {string} operacao
   * @param {string} mensagem
   * @param {string} [refId]
   */
  function info(modulo, operacao, mensagem, refId) {
    gravar(modulo, operacao, 'INFO', mensagem, refId);
  }

  /**
   * Grava log de severidade WARNING.
   * @param {string} modulo
   * @param {string} operacao
   * @param {string} mensagem
   * @param {string} [refId]
   */
  function warning(modulo, operacao, mensagem, refId) {
    gravar(modulo, operacao, 'WARNING', mensagem, refId);
  }

  /**
   * Grava log de severidade ERROR.
   * @param {string} modulo
   * @param {string} operacao
   * @param {string} mensagem
   * @param {string} [refId]
   */
  function error(modulo, operacao, mensagem, refId) {
    gravar(modulo, operacao, 'ERROR', mensagem, refId);
  }

  /**
   * Grava log de severidade CRITICAL.
   * @param {string} modulo
   * @param {string} operacao
   * @param {string} mensagem
   * @param {string} [refId]
   */
  function critical(modulo, operacao, mensagem, refId) {
    gravar(modulo, operacao, 'CRITICAL', mensagem, refId);
  }

  // ============================================================
  // FUNÇÕES DE EXIBIÇÃO E MANUTENÇÃO
  // ============================================================

  /**
   * Exibe os últimos N logs em um alerta.
   * @param {number} quantidade - Padrão: 20
   */
  function exibirUltimosLogs(quantidade) {
    quantidade = quantidade || 20;
    try {
      var dados = SheetService.getDados(CONFIG.ABAS.LOGS_SISTEMA);
      if (dados.length === 0) {
        Utils.alerta('Logs do Sistema', 'Nenhum log registrado.');
        return;
      }
      var ultimos = dados.slice(-quantidade).reverse();
      var linhas = ultimos.map(function(linha) {
        return '[' + linha[5] + '] ' + linha[1] + ' | ' + linha[3] + '.' + linha[4] + ': ' + linha[6];
      });
      Utils.alerta(
        'Últimos ' + Math.min(quantidade, dados.length) + ' Logs',
        linhas.join('\n')
      );
    } catch (e) {
      Utils.alerta('Erro', 'Não foi possível ler os logs: ' + e.message);
    }
  }

  /**
   * Remove logs com mais de N dias.
   * @param {number} dias - Padrão: 90
   */
  function limparLogsAntigos(dias) {
    dias = dias || 90;
    try {
      var sheet = SheetService.getSheet(CONFIG.ABAS.LOGS_SISTEMA);
      var dados = SheetService.getDados(CONFIG.ABAS.LOGS_SISTEMA);
      var limite = new Date();
      limite.setDate(limite.getDate() - dias);
      var removidos = 0;

      // Percorre de baixo para cima para não deslocar índices, agrupando
      // blocos contíguos de linhas a remover num único deleteRows() em vez
      // de uma chamada deleteRow() por linha (abas de log antigas podem
      // ter milhares de linhas a limpar de uma vez).
      var fimBloco = -1; // índice de linha da planilha (1-based) do fim do bloco atual
      for (var i = dados.length - 1; i >= 0; i--) {
        var dataLog = Utils.paraData(dados[i][1]);
        var linhaPlanilha = i + 2; // +2: cabeçalho + 0-based
        var remover = dataLog && dataLog < limite;

        if (remover) {
          removidos++;
          if (fimBloco === -1) fimBloco = linhaPlanilha;
          continue;
        }

        if (fimBloco !== -1) {
          sheet.deleteRows(linhaPlanilha + 1, fimBloco - linhaPlanilha);
          fimBloco = -1;
        }
      }
      if (fimBloco !== -1) {
        sheet.deleteRows(2, fimBloco - 1);
      }

      info('14_LogService', 'limparLogsAntigos',
        'Limpeza de logs: ' + removidos + ' registros removidos (>' + dias + ' dias).');
      Utils.alerta('Limpeza de Logs',
        '✅ ' + removidos + ' logs removidos (mais de ' + dias + ' dias).');
    } catch (e) {
      Utils.alerta('Erro', 'Erro ao limpar logs: ' + e.message);
    }
  }

  /**
   * Exporta logs para um arquivo TSV na pasta configurada em Config_App.
   * Requer que DRIVE_FOLDER_ID esteja definido em Config_App.
   * Não cria arquivos fora da pasta raiz do projeto.
   */
  function exportarLogs() {
    try {
      // Verificar se DRIVE_FOLDER_ID está configurado
      var folderId = SheetService.lerConfigApp('DRIVE_FOLDER_ID');
      if (!folderId || folderId.trim() === '' || folderId === 'undefined') {
        Utils.alerta(
          'Exportar Logs — Bloqueado',
          '\u26a0\ufe0f N\u00e3o foi poss\u00edvel exportar os logs.\n\n' +
          'O par\u00e2metro DRIVE_FOLDER_ID n\u00e3o est\u00e1 configurado em Config_App.\n\n' +
          'Para habilitar a exporta\u00e7\u00e3o:\n' +
          '1. Abra a aba Config_App\n' +
          '2. Adicione a linha: DRIVE_FOLDER_ID | <ID da pasta Logs no Drive>\n' +
          '3. O ID da pasta est\u00e1 na URL do Drive ap\u00f3s "/folders/"'
        );
        warning('14_LogService', 'exportarLogs',
          'Exporta\u00e7\u00e3o bloqueada: DRIVE_FOLDER_ID n\u00e3o configurado em Config_App.');
        return;
      }

      var dados = SheetService.getDados(CONFIG.ABAS.LOGS_SISTEMA);
      if (dados.length === 0) {
        Utils.alerta('Exportar Logs', 'Nenhum log para exportar.');
        return;
      }

      // Verificar se a pasta existe no Drive
      var pasta;
      try {
        pasta = DriveApp.getFolderById(folderId);
      } catch (folderErr) {
        Utils.alerta(
          'Exportar Logs — Erro de Pasta',
          '\u274c A pasta configurada em DRIVE_FOLDER_ID n\u00e3o foi encontrada.\n' +
          'ID configurado: ' + folderId + '\n' +
          'Verifique se o ID est\u00e1 correto e se voc\u00ea tem acesso.'
        );
        error('14_LogService', 'exportarLogs',
          'Pasta n\u00e3o encontrada: ' + folderId + ' | ' + folderErr.message);
        return;
      }

      // Gerar conteúdo TSV
      var cabecalhos = SheetService.getCabecalhos(CONFIG.ABAS.LOGS_SISTEMA);
      var linhas = [cabecalhos.join('\t')];
      dados.forEach(function(linha) {
        linhas.push(linha.map(function(c) { return String(c); }).join('\t'));
      });
      var conteudo = linhas.join('\n');
      var nomeArquivo = 'Logs_Sistema_' + Utils.timestampCompacto() + '.tsv';

      // Criar arquivo DENTRO da pasta configurada
      var arquivo = pasta.createFile(nomeArquivo, conteudo, MimeType.PLAIN_TEXT);

      info('14_LogService', 'exportarLogs',
        'Logs exportados: ' + nomeArquivo +
        ' | Pasta: ' + pasta.getName() +
        ' | ID arquivo: ' + arquivo.getId());

      Utils.alerta('Exportar Logs',
        '\u2705 Logs exportados com sucesso!\n' +
        'Arquivo: ' + nomeArquivo + '\n' +
        'Pasta: ' + pasta.getName() + '\n' +
        'ID Drive: ' + arquivo.getId());

    } catch (e) {
      error('14_LogService', 'exportarLogs', 'Erro ao exportar logs: ' + e.message);
      Utils.alerta('Erro', 'Erro ao exportar logs: ' + e.message);
    }
  }

  /**
   * Conta logs por severidade.
   * @returns {Object} {INFO: n, WARNING: n, ERROR: n, CRITICAL: n}
   */
  function contarPorSeveridade() {
    try {
      var dados = SheetService.getDados(CONFIG.ABAS.LOGS_SISTEMA);
      var contagem = { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 };
      dados.forEach(function(linha) {
        var sev = String(linha[5]);
        if (contagem.hasOwnProperty(sev)) contagem[sev]++;
      });
      return contagem;
    } catch (e) {
      return { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 };
    }
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    gravar:              gravar,
    info:                info,
    warning:             warning,
    error:               error,
    critical:            critical,
    exibirUltimosLogs:   exibirUltimosLogs,
    limparLogsAntigos:   limparLogsAntigos,
    exportarLogs:        exportarLogs,
    contarPorSeveridade: contarPorSeveridade
  };

})();

// ============================================================
// ATALHOS GLOBAIS — permitem uso direto: logInfo(...) etc.
// Usados por todos os módulos para simplicidade.
// ============================================================

function logInfo(modulo, operacao, mensagem, refId) {
  LogService.info(modulo, operacao, mensagem, refId);
}

function logWarning(modulo, operacao, mensagem, refId) {
  LogService.warning(modulo, operacao, mensagem, refId);
}

function logError(modulo, operacao, mensagem, refId) {
  LogService.error(modulo, operacao, mensagem, refId);
}

function logCritical(modulo, operacao, mensagem, refId) {
  LogService.critical(modulo, operacao, mensagem, refId);
}
