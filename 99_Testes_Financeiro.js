/**
 * tests/99_Testes_Financeiro.gs
 * ============================================================
 * Testes manuais temporarios do FinanceiroService.
 * Copiar para o Apps Script HML, executar uma funcao por vez e
 * conferir Logger/alerta.
 * ============================================================
 */

function _mostrarResultadoFinanceiro(nomeTeste, resultado) {
  Logger.log(nomeTeste + ': ' + JSON.stringify(resultado, null, 2));
  try {
    SpreadsheetApp.getUi().alert(nomeTeste + '\n' + JSON.stringify(resultado, null, 2));
  } catch (e) {
    Logger.log('UI indisponivel: ' + e.message);
  }
}

function _idReqFinanceiro(sufixo) {
  return 'TST-FIN-' + sufixo + '-' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMddHHmmss');
}

function testarRegistrarAporte() {
  var payload = {
    idRequisicao: _idReqFinanceiro('APORTE'),
    data: Utils.formatarData(new Date()),
    negocio: 'Pokémon TCG',
    valor: 1000,
    origem: 'Teste Apps Script',
    observacao: 'Aporte de teste financeiro'
  };

  var res = FinanceiroService.registrarAporte(payload);
  _mostrarResultadoFinanceiro('testarRegistrarAporte', res);
}

function testarRegistrarResgate() {
  var payload = {
    idRequisicao: _idReqFinanceiro('RESGATE'),
    data: Utils.formatarData(new Date()),
    negocio: 'Pokémon TCG',
    valor: 100,
    origem: 'Teste Apps Script',
    observacao: 'Resgate de teste financeiro'
  };

  var res = FinanceiroService.registrarResgate(payload);
  _mostrarResultadoFinanceiro('testarRegistrarResgate', res);
}

function testarRegistrarDespesa() {
  var payload = {
    idRequisicao: _idReqFinanceiro('DESPESA'),
    data: Utils.formatarData(new Date()),
    negocio: 'Pokémon TCG',
    categoria: 'Operacional',
    valor: 25,
    descricao: 'Despesa operacional de teste',
    observacao: 'Teste financeiro manual'
  };

  var res = FinanceiroService.registrarDespesa(payload);
  _mostrarResultadoFinanceiro('testarRegistrarDespesa', res);
}

function testarBloquearValorFinanceiroInvalido() {
  var aporteInvalido = FinanceiroService.registrarAporte({
    idRequisicao: _idReqFinanceiro('INVALIDO-APORTE'),
    data: Utils.formatarData(new Date()),
    negocio: 'Pokémon TCG',
    valor: 0,
    origem: 'Teste Apps Script',
    observacao: 'Valor invalido deve bloquear'
  });

  var despesaInvalida = FinanceiroService.registrarDespesa({
    idRequisicao: _idReqFinanceiro('INVALIDO-DESPESA'),
    data: Utils.formatarData(new Date()),
    negocio: 'Pokémon TCG',
    categoria: 'Operacional',
    valor: -10,
    descricao: 'Valor invalido deve bloquear'
  });

  var res = {
    aporteInvalido: aporteInvalido,
    despesaInvalida: despesaInvalida
  };
  _mostrarResultadoFinanceiro('testarBloquearValorFinanceiroInvalido', res);
}

function testarDuplicidadeFinanceira() {
  var idReq = _idReqFinanceiro('DUPLICIDADE');
  var payload = {
    idRequisicao: idReq,
    data: Utils.formatarData(new Date()),
    negocio: 'Pokémon TCG',
    valor: 50,
    origem: 'Teste Apps Script',
    observacao: 'Primeira chamada deve gravar; segunda deve bloquear'
  };

  var primeira = FinanceiroService.registrarAporte(payload);
  var segunda = FinanceiroService.registrarAporte(payload);

  var res = {
    primeira: primeira,
    segunda: segunda
  };
  _mostrarResultadoFinanceiro('testarDuplicidadeFinanceira', res);
}

function testarResumoFinanceiro() {
  var hoje = new Date();
  var inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  var fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  var filtros = {
    negocio: 'Pokémon TCG',
    dataInicio: Utils.formatarData(inicioMes),
    dataFim: Utils.formatarData(fimMes)
  };

  var res = FinanceiroService.calcularResumoFinanceiro(filtros);
  _mostrarResultadoFinanceiro('testarResumoFinanceiro', res);
}
