/**
 * ============================================================
 * 03_SheetService.gs — Serviço de Acesso às Abas
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Leitura e escrita segura nas abas da planilha.
 * Busca por cabeçalho, append de linhas, leitura de ranges,
 * mapeamento de colunas por nome e uso de LockService.
 * Sem lógica de negócio.
 *
 * Dependências: 00_Config.gs, 02_Utils.gs
 *
 * CORREÇÃO v2 (2026-06-07):
 * - Adicionado objetoParaLinha(nomeAba, objetoLinha)
 * - appendLinha e appendLinhas aceitam objeto OU array
 * - Campos ausentes no objeto geram warning no log
 * - Campos obrigatórios ausentes geram erro quando aplicável
 * ============================================================
 */

var SheetService = (function() {

  var _ss = null;

  // Cache de cabeçalhos por aba para evitar múltiplas leituras
  var _cacheCabecalhos = {};

  /**
   * Retorna o Spreadsheet ativo (com cache).
   * @returns {Spreadsheet}
   */
  function getSpreadsheet() {
    if (!_ss) _ss = SpreadsheetApp.getActiveSpreadsheet();
    return _ss;
  }

  /**
   * Retorna uma Sheet pelo nome.
   * Lança erro se não encontrada.
   * @param {string} nomeAba
   * @returns {Sheet}
   */
  function getSheet(nomeAba) {
    var sheet = getSpreadsheet().getSheetByName(nomeAba);
    if (!sheet) {
      throw new Error('Aba não encontrada: "' + nomeAba + '"');
    }
    return sheet;
  }

  /**
   * Verifica se uma aba existe.
   * @param {string} nomeAba
   * @returns {boolean}
   */
  function abaExiste(nomeAba) {
    return getSpreadsheet().getSheetByName(nomeAba) !== null;
  }

  /**
   * Retorna a linha de cabeçalhos (linha 1) de uma aba como array.
   * Usa cache interno para evitar múltiplas leituras na mesma execução.
   * @param {string} nomeAba
   * @returns {Array<string>}
   */
  function getCabecalhos(nomeAba) {
    if (_cacheCabecalhos[nomeAba]) return _cacheCabecalhos[nomeAba];
    var sheet = getSheet(nomeAba);
    var ultimaCol = sheet.getLastColumn();
    if (ultimaCol === 0) {
      _cacheCabecalhos[nomeAba] = [];
      return [];
    }
    var cabs = sheet.getRange(1, 1, 1, ultimaCol).getValues()[0];
    _cacheCabecalhos[nomeAba] = cabs;
    return cabs;
  }

  /**
   * Invalida o cache de cabeçalhos de uma aba (usar após alterar cabeçalhos).
   * @param {string} nomeAba
   */
  function invalidarCacheCabecalhos(nomeAba) {
    delete _cacheCabecalhos[nomeAba];
  }

  /**
   * Retorna mapa de {nomeCampo: indiceColuna_1based} para uma aba.
   * @param {string} nomeAba
   * @returns {Object}
   */
  function getMapaColunas(nomeAba) {
    var cabecalhos = getCabecalhos(nomeAba);
    var mapa = {};
    cabecalhos.forEach(function(col, i) {
      if (col) mapa[col] = i + 1; // 1-based
    });
    return mapa;
  }

  /**
   * Retorna o índice de coluna (1-based) de um campo em uma aba.
   * Lança erro se não encontrado.
   * @param {string} nomeAba
   * @param {string} nomeCampo
   * @returns {number}
   */
  function getIndiceColuna(nomeAba, nomeCampo) {
    var mapa = getMapaColunas(nomeAba);
    var idx = mapa[nomeCampo];
    if (!idx) {
      throw new Error('Campo "' + nomeCampo + '" não encontrado na aba "' + nomeAba + '"');
    }
    return idx;
  }

  // ============================================================
  // CONVERSÃO OBJETO → ARRAY (CORREÇÃO v2)
  // ============================================================

  /**
   * Converte um objeto (chave=nome do campo, valor=dado) em array
   * na ordem exata dos cabeçalhos reais da aba.
   *
   * Regras:
   * - Campos do objeto que não existem na aba são ignorados (warning no log).
   * - Campos da aba que não estão no objeto recebem string vazia.
   * - Campos obrigatórios ausentes geram erro quando camposObrigatorios informado.
   *
   * @param {string} nomeAba
   * @param {Object} objetoLinha - Objeto com chaves = nomes dos campos
   * @param {Array<string>} [camposObrigatorios] - Lista de campos que não podem ser vazios
   * @returns {Array} Array de valores na ordem dos cabeçalhos
   */
  function objetoParaLinha(nomeAba, objetoLinha, camposObrigatorios) {
    var cabecalhos = getCabecalhos(nomeAba);
    if (!cabecalhos || cabecalhos.length === 0) {
      throw new Error('Aba "' + nomeAba + '" não possui cabeçalhos. Não é possível converter objeto para linha.');
    }

    // Verificar campos obrigatórios ausentes
    if (camposObrigatorios && camposObrigatorios.length > 0) {
      var ausentes = [];
      camposObrigatorios.forEach(function(campo) {
        var val = objetoLinha[campo];
        if (val === undefined || val === null || val === '') {
          ausentes.push(campo);
        }
      });
      if (ausentes.length > 0) {
        throw new Error(
          'Campos obrigatórios ausentes ao gravar em "' + nomeAba + '": ' + ausentes.join(', ')
        );
      }
    }

    // Verificar campos do objeto que não existem na aba (warning)
    var camposAba = {};
    cabecalhos.forEach(function(c) { if (c) camposAba[c] = true; });
    var camposIgnorados = [];
    Object.keys(objetoLinha).forEach(function(chave) {
      if (chave && !camposAba[chave]) {
        camposIgnorados.push(chave);
      }
    });
    if (camposIgnorados.length > 0) {
      // Warning silencioso — não bloqueia, mas registra
      console.warn('[03_SheetService] objetoParaLinha: campos ignorados em "' +
        nomeAba + '": ' + camposIgnorados.join(', '));
    }

    // Montar array na ordem dos cabeçalhos
    return cabecalhos.map(function(campo) {
      if (!campo) return '';
      var val = objetoLinha[campo];
      return (val !== undefined && val !== null) ? val : '';
    });
  }

  /**
   * Normaliza uma linha para array, aceitando objeto ou array.
   * Se for objeto, converte usando objetoParaLinha.
   * Se for array, retorna como está.
   * @param {string} nomeAba
   * @param {Array|Object} linha
   * @param {Array<string>} [camposObrigatorios]
   * @returns {Array}
   */
  function _normalizarLinha(nomeAba, linha, camposObrigatorios) {
    if (Array.isArray(linha)) return linha;
    if (linha !== null && typeof linha === 'object') {
      return objetoParaLinha(nomeAba, linha, camposObrigatorios);
    }
    throw new Error('[03_SheetService] _normalizarLinha: linha deve ser Array ou Object. Recebido: ' + typeof linha);
  }

  // ============================================================
  // LEITURA
  // ============================================================

  /**
   * Retorna todos os dados de uma aba como array de arrays.
   * Exclui a linha de cabeçalho.
   * @param {string} nomeAba
   * @returns {Array<Array>}
   */
  function getDados(nomeAba) {
    var sheet = getSheet(nomeAba);
    var ultimaLinha = sheet.getLastRow();
    var ultimaCol   = sheet.getLastColumn();
    if (ultimaLinha <= 1 || ultimaCol === 0) return [];
    return sheet.getRange(2, 1, ultimaLinha - 1, ultimaCol).getValues();
  }

  /**
   * Retorna todos os dados de uma aba como array de objetos,
   * usando os cabeçalhos como chaves.
   * @param {string} nomeAba
   * @returns {Array<Object>}
   */
  function getDadosComoObjetos(nomeAba) {
    var cabecalhos = getCabecalhos(nomeAba);
    var dados = getDados(nomeAba);
    return Utils.linhasParaObjetos(dados, cabecalhos);
  }

  /**
   * Retorna dados de um range específico.
   * @param {string} nomeAba
   * @param {number} linhaInicio - 1-based
   * @param {number} colunaInicio - 1-based
   * @param {number} numLinhas
   * @param {number} numColunas
   * @returns {Array<Array>}
   */
  function getRange(nomeAba, linhaInicio, colunaInicio, numLinhas, numColunas) {
    var sheet = getSheet(nomeAba);
    return sheet.getRange(linhaInicio, colunaInicio, numLinhas, numColunas).getValues();
  }

  // ============================================================
  // ESCRITA
  // ============================================================

  /**
   * Adiciona uma linha ao final de uma aba com LockService.
   * Aceita Array ou Object.
   * Se Object, converte automaticamente para array conforme cabeçalhos da aba.
   *
   * @param {string} nomeAba
   * @param {Array|Object} linha - Array de valores OU Objeto {campo: valor}
   * @param {Array<string>} [camposObrigatorios] - Campos que não podem ser vazios (só para Object)
   * @returns {number} Número da linha inserida
   */
  function appendLinha(nomeAba, linha, camposObrigatorios) {
    var linhaArray = _normalizarLinha(nomeAba, linha, camposObrigatorios);
    var lock = LockService.getDocumentLock();
    lock.waitLock(10000); // aguarda até 10s
    try {
      var sheet = getSheet(nomeAba);
      sheet.appendRow(linhaArray);
      return sheet.getLastRow();
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Adiciona múltiplas linhas ao final de uma aba com LockService.
   * Aceita Array<Array> ou Array<Object>.
   * Se Array<Object>, converte cada objeto para array conforme cabeçalhos da aba.
   *
   * @param {string} nomeAba
   * @param {Array<Array>|Array<Object>} linhas
   * @param {Array<string>} [camposObrigatorios] - Campos obrigatórios (só para Object)
   * @returns {number} Número da última linha inserida
   */
  function appendLinhas(nomeAba, linhas, camposObrigatorios) {
    if (!linhas || linhas.length === 0) return 0;

    // Normalizar cada linha para array
    var linhasArray = linhas.map(function(linha) {
      return _normalizarLinha(nomeAba, linha, camposObrigatorios);
    });

    var lock = LockService.getDocumentLock();
    lock.waitLock(15000);
    try {
      var sheet = getSheet(nomeAba);
      var ultimaLinha = sheet.getLastRow();
      var numColunas = linhasArray[0].length;
      var range = sheet.getRange(
        ultimaLinha + 1, 1, linhasArray.length, numColunas
      );
      range.setValues(linhasArray);
      return sheet.getLastRow();
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Atualiza uma célula específica em uma aba.
   * @param {string} nomeAba
   * @param {number} linha - 1-based
   * @param {number} coluna - 1-based
   * @param {*} valor
   */
  function setCelula(nomeAba, linha, coluna, valor) {
    var sheet = getSheet(nomeAba);
    sheet.getRange(linha, coluna).setValue(valor);
  }

  /**
   * Atualiza uma célula pelo nome do campo (cabeçalho).
   * @param {string} nomeAba
   * @param {number} numLinha - 1-based (linha de dados, incluindo cabeçalho)
   * @param {string} nomeCampo
   * @param {*} valor
   */
  function setCelulaPorCampo(nomeAba, numLinha, nomeCampo, valor) {
    var idx = getIndiceColuna(nomeAba, nomeCampo);
    setCelula(nomeAba, numLinha, idx, valor);
  }

  /**
   * Atualiza uma linha inteira em uma aba.
   * @param {string} nomeAba
   * @param {number} numLinha - 1-based
   * @param {Array|Object} valores
   */
  function setLinha(nomeAba, numLinha, valores) {
    var linhaArray = _normalizarLinha(nomeAba, valores);
    var sheet = getSheet(nomeAba);
    sheet.getRange(numLinha, 1, 1, linhaArray.length).setValues([linhaArray]);
  }

  // ============================================================
  // BUSCA
  // ============================================================

  /**
   * Busca linhas em uma aba onde o campo tem o valor especificado.
   * @param {string} nomeAba
   * @param {string} nomeCampo
   * @param {*} valor
   * @returns {Array<{linha: number, dados: Object}>}
   */
  function buscarPorCampo(nomeAba, nomeCampo, valor) {
    var cabecalhos = getCabecalhos(nomeAba);
    var dados = getDados(nomeAba);
    var idxCampo = cabecalhos.indexOf(nomeCampo);
    if (idxCampo === -1) {
      throw new Error('Campo "' + nomeCampo + '" não encontrado em "' + nomeAba + '"');
    }
    var resultados = [];
    dados.forEach(function(linha, i) {
      if (String(linha[idxCampo]) === String(valor)) {
        var obj = {};
        cabecalhos.forEach(function(col, j) { obj[col] = linha[j]; });
        resultados.push({ linha: i + 2, dados: obj }); // +2 por cabeçalho + 0-based
      }
    });
    return resultados;
  }

  /**
   * Busca a primeira linha onde o campo tem o valor especificado.
   * @param {string} nomeAba
   * @param {string} nomeCampo
   * @param {*} valor
   * @returns {{linha: number, dados: Object}|null}
   */
  function buscarPrimeiroPorCampo(nomeAba, nomeCampo, valor) {
    var resultados = buscarPorCampo(nomeAba, nomeCampo, valor);
    return resultados.length > 0 ? resultados[0] : null;
  }

  // ============================================================
  // UTILITÁRIOS
  // ============================================================

  /**
   * Retorna o número da última linha com dados em uma aba.
   * @param {string} nomeAba
   * @returns {number}
   */
  function getUltimaLinha(nomeAba) {
    return getSheet(nomeAba).getLastRow();
  }

  /**
   * Retorna o número total de linhas de dados (excluindo cabeçalho).
   * @param {string} nomeAba
   * @returns {number}
   */
  function contarLinhas(nomeAba) {
    var ultima = getUltimaLinha(nomeAba);
    return ultima <= 1 ? 0 : ultima - 1;
  }

  /**
   * Limpa dados de uma aba (mantém cabeçalho).
   * Requer confirmação explícita via parâmetro.
   * @param {string} nomeAba
   * @param {boolean} confirmar - Deve ser true para executar
   */
  function limparDados(nomeAba, confirmar) {
    if (!confirmar) {
      throw new Error('limparDados requer confirmar=true. Operação cancelada.');
    }
    var sheet = getSheet(nomeAba);
    var ultimaLinha = sheet.getLastRow();
    if (ultimaLinha > 1) {
      sheet.getRange(2, 1, ultimaLinha - 1, sheet.getLastColumn()).clearContent();
    }
    // Invalidar cache após limpar
    invalidarCacheCabecalhos(nomeAba);
  }

  /**
   * Lê um parâmetro de Config_App pelo nome.
   * @param {string} nomeParam
   * @returns {string|null}
   */
  function lerConfigApp(nomeParam) {
    try {
      var dados = getDados(CONFIG.ABAS.CONFIG_APP);
      for (var i = 0; i < dados.length; i++) {
        if (String(dados[i][0]) === nomeParam) {
          return String(dados[i][1]);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Lê todos os parâmetros de Config_App como objeto {param: valor}.
   * @returns {Object}
   */
  function lerTodosConfigApp() {
    try {
      var dados = getDados(CONFIG.ABAS.CONFIG_APP);
      var params = {};
      dados.forEach(function(linha) {
        if (linha[0]) params[String(linha[0])] = String(linha[1]);
      });
      return params;
    } catch (e) {
      return {};
    }
  }

  /**
   * Lê todos os valores de um grupo em Configuracoes.
   * @param {string} nomeGrupo
   * @returns {Array<string>}
   */
  function lerGrupoConfiguracoes(nomeGrupo) {
    try {
      var dados = getDados(CONFIG.ABAS.CONFIGURACOES);
      var valores = [];
      dados.forEach(function(linha) {
        if (String(linha[0]) === nomeGrupo && linha[1]) {
          valores.push(String(linha[1]));
        }
      });
      return valores;
    } catch (e) {
      return [];
    }
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    getSpreadsheet:           getSpreadsheet,
    getSheet:                 getSheet,
    abaExiste:                abaExiste,
    getCabecalhos:            getCabecalhos,
    invalidarCacheCabecalhos: invalidarCacheCabecalhos,
    getMapaColunas:           getMapaColunas,
    getIndiceColuna:          getIndiceColuna,
    objetoParaLinha:          objetoParaLinha,   // NOVO v2
    getDados:                 getDados,
    getDadosComoObjetos:      getDadosComoObjetos,
    getRange:                 getRange,
    appendLinha:              appendLinha,        // ATUALIZADO v2
    appendLinhas:             appendLinhas,       // ATUALIZADO v2
    setCelula:                setCelula,
    setCelulaPorCampo:        setCelulaPorCampo,  // NOVO v2
    setLinha:                 setLinha,
    buscarPorCampo:           buscarPorCampo,
    buscarPrimeiroPorCampo:   buscarPrimeiroPorCampo,
    getUltimaLinha:           getUltimaLinha,
    contarLinhas:             contarLinhas,
    limparDados:              limparDados,
    lerConfigApp:             lerConfigApp,
    lerTodosConfigApp:        lerTodosConfigApp,
    lerGrupoConfiguracoes:    lerGrupoConfiguracoes
  };

})();