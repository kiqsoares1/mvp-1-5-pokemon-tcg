/**
 * ============================================================
 * 02_Utils.gs — Utilitários Gerais do Sistema
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Funções utilitárias reutilizáveis por todos os módulos:
 * datas, timezone, normalização de texto, timestamps,
 * validação de vazio, formatação numérica e helpers genéricos.
 *
 * Dependências: 00_Config.gs
 * ============================================================
 */

var Utils = (function() {

  // ============================================================
  // DATAS E TIMEZONE
  // ============================================================

  /**
   * Retorna a data/hora atual no timezone configurado.
   * @returns {Date}
   */
  function agora() {
    return new Date();
  }

  /**
   * Formata uma Date como string no padrão DD/MM/YYYY HH:MM:SS.
   * @param {Date} data
   * @returns {string}
   */
  function formatarDataHora(data) {
    if (!data || !(data instanceof Date)) data = agora();
    return Utilities.formatDate(data, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  }

  /**
   * Formata uma Date como string no padrão DD/MM/YYYY.
   * @param {Date} data
   * @returns {string}
   */
  function formatarData(data) {
    if (!data || !(data instanceof Date)) data = agora();
    return Utilities.formatDate(data, CONFIG.TIMEZONE, 'dd/MM/yyyy');
  }

  /**
   * Retorna timestamp atual como string formatada DD/MM/YYYY HH:MM:SS.
   * @returns {string}
   */
  function timestamp() {
    return formatarDataHora(agora());
  }

  /**
   * Retorna timestamp compacto para uso em IDs: YYYYMMDDHHMMSS.
   * @returns {string}
   */
  function timestampCompacto() {
    return Utilities.formatDate(agora(), CONFIG.TIMEZONE, 'yyyyMMddHHmmss');
  }

  /**
   * Calcula diferença em dias entre duas datas.
   * @param {Date} dataInicio
   * @param {Date} dataFim - Padrão: agora()
   * @returns {number} Número de dias (inteiro)
   */
  function diasEntre(dataInicio, dataFim) {
    if (!dataInicio) return null;
    if (!dataFim) dataFim = agora();
    var diff = dataFim.getTime() - dataInicio.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Adiciona N dias a uma data.
   * @param {Date} data
   * @param {number} dias
   * @returns {Date}
   */
  function adicionarDias(data, dias) {
    var nova = new Date(data.getTime());
    nova.setDate(nova.getDate() + dias);
    return nova;
  }

  /**
   * Converte string DD/MM/YYYY para objeto Date.
   * @param {string} str
   * @returns {Date|null}
   */
  function parsarData(str) {
    if (!str || typeof str !== 'string') return null;
    var partes = str.trim().split('/');
    if (partes.length !== 3) return null;
    var dia = parseInt(partes[0], 10);
    var mes = parseInt(partes[1], 10);
    var ano = parseInt(partes[2], 10);
    if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
    try {
      var data = new Date(ano, mes - 1, dia);
      // new Date(...) com componentes fora do intervalo válido "rola" para
      // o mês/dia seguinte em vez de lançar erro (ex.: 31/13/2026 vira uma
      // data de 2027) — confere que os componentes voltam intactos.
      if (isNaN(data.getTime()) ||
          data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Converte para Date o que vier de uma célula de planilha.
   *
   * parsarData() só aceita a string 'dd/mm/aaaa'. Mas o Google Sheets
   * converte sozinho o que parece data numa Date de verdade, e aí a
   * célula volta como objeto — `String(valor).split(' ')[0]` vira 'Mon' e
   * parsarData devolve null. Quem comparava datas assim recebia null em
   * silêncio e caía num caminho alternativo sem perceber.
   *
   * Aceita: Date, 'dd/mm/aaaa' e 'dd/mm/aaaa hh:mm:ss'.
   *
   * @param {*} valor
   * @returns {Date|null}
   */
  function paraData(valor) {
    if (valor instanceof Date) {
      return isNaN(valor.getTime()) ? null : valor;
    }
    if (valor === null || valor === undefined) return null;
    return parsarData(String(valor).trim().split(' ')[0]);
  }

  // ============================================================
  // TEXTO E NORMALIZAÇÃO
  // ============================================================

  /**
   * Remove espaços extras e normaliza string.
   * @param {*} valor
   * @returns {string}
   */
  function normalizar(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).trim().replace(/\s+/g, ' ');
  }

  /**
   * Normaliza uma string para comparação: trim, minúsculas e sem acento.
   * Usado para comparar campos livres (negócio, categoria, etc.) sem que
   * uma diferença de acentuação faça um filtro bater silenciosamente em
   * um módulo e falhar em outro — vários serviços tinham cada um sua
   * própria versão local desta função, algumas removendo acento e outras
   * não, o que causava esse tipo de inconsistência.
   * @param {*} valor
   * @returns {string}
   */
  function normalizarChave(valor) {
    return normalizar(valor)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  /**
   * Converte string para maiúsculas normalizadas.
   * @param {string} str
   * @returns {string}
   */
  function maiusculo(str) {
    return normalizar(str).toUpperCase();
  }

  /**
   * Converte string para minúsculas normalizadas.
   * @param {string} str
   * @returns {string}
   */
  function minusculo(str) {
    return normalizar(str).toLowerCase();
  }

  /**
   * Trunca string ao comprimento máximo, adicionando '...' se necessário.
   * @param {string} str
   * @param {number} max
   * @returns {string}
   */
  function truncar(str, max) {
    str = normalizar(str);
    if (str.length <= max) return str;
    return str.substring(0, max - 3) + '...';
  }

  // ============================================================
  // VALIDAÇÃO DE VAZIO
  // ============================================================

  /**
   * Verifica se um valor é vazio (null, undefined, string vazia).
   * @param {*} valor
   * @returns {boolean}
   */
  function eVazio(valor) {
    if (valor === null || valor === undefined) return true;
    if (typeof valor === 'string' && valor.trim() === '') return true;
    return false;
  }

  /**
   * Verifica se um valor NÃO é vazio.
   * @param {*} valor
   * @returns {boolean}
   */
  function naoVazio(valor) {
    return !eVazio(valor);
  }

  /**
   * Lança erro se o valor for vazio.
   * @param {*} valor
   * @param {string} nomeCampo
   */
  function exigirNaoVazio(valor, nomeCampo) {
    if (eVazio(valor)) {
      throw new Error('Campo obrigatório não preenchido: ' + nomeCampo);
    }
  }

  // ============================================================
  // FORMATAÇÃO NUMÉRICA
  // ============================================================

  /**
   * Formata número como moeda BRL (R$ 1.234,56).
   * @param {number} valor
   * @returns {string}
   */
  function formatarMoeda(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return 'R$ 0,00';
    var numero = Number(valor);
    var sinal = numero < 0 ? '-' : '';
    return sinal + 'R$ ' + Math.abs(numero).toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Formata número como percentual (12,34%).
   * @param {number} valor - Valor decimal (ex: 0.1234 → 12,34%)
   * @returns {string}
   */
  function formatarPercentual(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) return '0,00%';
    return (Number(valor) * 100).toFixed(2).replace('.', ',') + '%';
  }

  /**
   * Converte string de moeda BRL para número.
   * @param {string} str - Ex: "R$ 1.234,56"
   * @returns {number}
   */
  function parsarMoeda(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    var limpo = String(str)
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    var num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Arredonda número para N casas decimais.
   * @param {number} valor
   * @param {number} casas - Padrão: 2
   * @returns {number}
   */
  function arredondar(valor, casas) {
    casas = casas !== undefined ? casas : 2;
    var fator = Math.pow(10, casas);
    return Math.round(valor * fator) / fator;
  }

  // ============================================================
  // HELPERS GENÉRICOS
  // ============================================================

  /**
   * Retorna o email do usuário ativo (para auditoria).
   * @returns {string}
   */
  function usuarioAtivo() {
    try {
      return Session.getActiveUser().getEmail() || 'sistema';
    } catch (e) {
      return 'sistema';
    }
  }

  /**
   * Verifica se um valor está em uma lista.
   * @param {*} valor
   * @param {Array} lista
   * @returns {boolean}
   */
  function estaNaLista(valor, lista) {
    if (!lista || !Array.isArray(lista)) return false;
    return lista.indexOf(valor) !== -1;
  }

  /**
   * Converte array de objetos em array de arrays (para escrita em Sheets).
   * @param {Array<Object>} objetos
   * @param {Array<string>} chaves - Ordem das colunas
   * @returns {Array<Array>}
   */
  function objetosParaLinhas(objetos, chaves) {
    return objetos.map(function(obj) {
      return chaves.map(function(k) {
        return obj[k] !== undefined ? obj[k] : '';
      });
    });
  }

  /**
   * Converte array de arrays em array de objetos usando cabeçalhos.
   * @param {Array<Array>} linhas
   * @param {Array<string>} cabecalhos
   * @returns {Array<Object>}
   */
  function linhasParaObjetos(linhas, cabecalhos) {
    return linhas.map(function(linha) {
      var obj = {};
      cabecalhos.forEach(function(col, i) {
        obj[col] = linha[i] !== undefined ? linha[i] : '';
      });
      return obj;
    });
  }

  /**
   * Gera um UUID v4 simples (para uso interno, não criptográfico).
   * @returns {string}
   */
  function uuid() {
    return Utilities.getUuid();
  }

  /**
   * Pausa a execução por N milissegundos.
   * @param {number} ms
   */
  function sleep(ms) {
    Utilities.sleep(ms);
  }

  /**
   * Exibe alerta simples ao usuário.
   * @param {string} titulo
   * @param {string} mensagem
   */
  function alerta(titulo, mensagem) {
    SpreadsheetApp.getUi().alert(titulo, mensagem,
      SpreadsheetApp.getUi().ButtonSet.OK);
  }

  /**
   * Exibe toast (notificação temporária) no rodapé da planilha.
   * @param {string} mensagem
   * @param {string} titulo - Padrão: 'MVP 1.5'
   * @param {number} segundos - Padrão: 3
   */
  function toast(mensagem, titulo, segundos) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      mensagem,
      titulo || 'MVP 1.5',
      segundos || 3
    );
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    agora:              agora,
    formatarDataHora:   formatarDataHora,
    formatarData:       formatarData,
    timestamp:          timestamp,
    timestampCompacto:  timestampCompacto,
    diasEntre:          diasEntre,
    adicionarDias:      adicionarDias,
    parsarData:         parsarData,
    paraData:           paraData,
    normalizar:         normalizar,
    normalizarChave:    normalizarChave,
    maiusculo:          maiusculo,
    minusculo:          minusculo,
    truncar:            truncar,
    eVazio:             eVazio,
    naoVazio:           naoVazio,
    exigirNaoVazio:     exigirNaoVazio,
    formatarMoeda:      formatarMoeda,
    formatarPercentual: formatarPercentual,
    parsarMoeda:        parsarMoeda,
    arredondar:         arredondar,
    usuarioAtivo:       usuarioAtivo,
    estaNaLista:        estaNaLista,
    objetosParaLinhas:  objetosParaLinhas,
    linhasParaObjetos:  linhasParaObjetos,
    uuid:               uuid,
    sleep:              sleep,
    alerta:             alerta,
    toast:              toast
  };

})();
