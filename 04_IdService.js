/**
 * ============================================================
 * 04_IdService.gs — Serviço de Geração de IDs
 * MVP 1.5 — Sistema de Gestão Pokémon TCG
 * ============================================================
 * Geração de IDs padronizados e únicos para todas as entidades
 * do sistema. Padrão: PREFIXO-YYYYMMDDHHMMSS-XXXX
 *
 * Dependências: 00_Config.gs, 02_Utils.gs
 * ============================================================
 */

var IdService = (function() {

  /**
   * Gera um sufixo aleatório de 4 caracteres alfanuméricos.
   * @returns {string}
   */
  function _sufixo() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var result = '';
    for (var i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Gera um ID padronizado para uma entidade.
   * Formato: PREFIXO-YYYYMMDDHHMMSS-XXXX
   * Exemplo: CMP-20260607143022-A3F7
   *
   * @param {string} tipoEntidade - Chave de CONFIG.ID_PREFIXOS
   *   Valores válidos: COMPRA, ITEM_COMPRA, VENDA, ITEM_VENDA,
   *   LOTE, MOVIMENTO, ABERTURA, APORTE, DESPESA, REFERENCIA,
   *   PRODUTO, LOG, ERRO, TESTE
   * @returns {string}
   */
  function gerarId(tipoEntidade) {
    var prefixo = CONFIG.ID_PREFIXOS[tipoEntidade];
    if (!prefixo) {
      throw new Error('Tipo de entidade inválido para geração de ID: ' + tipoEntidade);
    }
    return prefixo + '-' + Utils.timestampCompacto() + '-' + _sufixo();
  }

  /**
   * Gera ID de Compra.
   * @returns {string} Ex: CMP-20260607143022-A3F7
   */
  function gerarIdCompra() {
    return gerarId('COMPRA');
  }

  /**
   * Gera ID de Item de Compra.
   * @returns {string} Ex: ITC-20260607143022-B2K9
   */
  function gerarIdItemCompra() {
    return gerarId('ITEM_COMPRA');
  }

  /**
   * Gera ID de Venda.
   * @returns {string} Ex: VND-20260607143022-C5M1
   */
  function gerarIdVenda() {
    return gerarId('VENDA');
  }

  /**
   * Gera ID de Item de Venda.
   * @returns {string} Ex: ITV-20260607143022-D8N4
   */
  function gerarIdItemVenda() {
    return gerarId('ITEM_VENDA');
  }

  /**
   * Gera ID de Lote de Estoque.
   * @returns {string} Ex: LOT-20260607143022-E1P6
   */
  function gerarIdLote() {
    return gerarId('LOTE');
  }

  /**
   * Gera ID de Movimento de Estoque.
   * @returns {string} Ex: MOV-20260607143022-F4Q2
   */
  function gerarIdMovimento() {
    return gerarId('MOVIMENTO');
  }

  /**
   * Gera ID de Abertura de Box Pokémon.
   * @returns {string} Ex: ABR-20260607143022-G7R8
   */
  function gerarIdAbertura() {
    return gerarId('ABERTURA');
  }

  /**
   * Gera ID de Aporte/Resgate de Capital.
   * @returns {string} Ex: CAP-20260607143022-H0S3
   */
  function gerarIdCapital() {
    return gerarId('APORTE');
  }

  /**
   * Gera ID de Despesa.
   * @returns {string} Ex: DSP-20260607143022-I3T5
   */
  function gerarIdDespesa() {
    return gerarId('DESPESA');
  }

  /**
   * Gera ID de Referência de Preço.
   * @returns {string} Ex: REF-20260607143022-J6U7
   */
  function gerarIdReferencia() {
    return gerarId('REFERENCIA');
  }

  /**
   * Gera ID de Produto.
   * @returns {string} Ex: PRD-20260607143022-K9V0
   */
  function gerarIdProduto() {
    return gerarId('PRODUTO');
  }

  /**
   * Gera ID de Log.
   * @returns {string} Ex: LOG-20260607143022-L2W4
   */
  function gerarIdLog() {
    return gerarId('LOG');
  }

  /**
   * Gera ID de Erro.
   * @returns {string} Ex: ERR-20260607143022-M5X6
   */
  function gerarIdErro() {
    return gerarId('ERRO');
  }

  /**
   * Gera ID de Teste.
   * @returns {string} Ex: TST-20260607143022-N8Y1
   */
  function gerarIdTeste() {
    return gerarId('TESTE');
  }

  /**
   * Valida se uma string tem o formato de ID do sistema.
   * Formato esperado: XXX-YYYYMMDDHHMMSS-XXXX
   * @param {string} id
   * @returns {boolean}
   */
  function validarFormato(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[A-Z]{2,4}-\d{14}-[A-Z0-9]{4}$/.test(id);
  }

  /**
   * Extrai o tipo/prefixo de um ID.
   * @param {string} id
   * @returns {string|null}
   */
  function extrairPrefixo(id) {
    if (!validarFormato(id)) return null;
    return id.split('-')[0];
  }

  // ============================================================
  // INTERFACE PÚBLICA
  // ============================================================
  return {
    gerarId:            gerarId,
    gerarIdCompra:      gerarIdCompra,
    gerarIdItemCompra:  gerarIdItemCompra,
    gerarIdVenda:       gerarIdVenda,
    gerarIdItemVenda:   gerarIdItemVenda,
    gerarIdLote:        gerarIdLote,
    gerarIdMovimento:   gerarIdMovimento,
    gerarIdAbertura:    gerarIdAbertura,
    gerarIdCapital:     gerarIdCapital,
    gerarIdDespesa:     gerarIdDespesa,
    gerarIdReferencia:  gerarIdReferencia,
    gerarIdProduto:     gerarIdProduto,
    gerarIdLog:         gerarIdLog,
    gerarIdErro:        gerarIdErro,
    gerarIdTeste:       gerarIdTeste,
    validarFormato:     validarFormato,
    extrairPrefixo:     extrairPrefixo
  };

})();
