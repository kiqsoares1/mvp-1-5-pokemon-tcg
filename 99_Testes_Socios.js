/**
 * 99_Testes_Socios.gs
 * ============================================================
 * Asserts reais do módulo societário (20_SociosService).
 *
 * TODOS os testes deste arquivo são SOMENTE LEITURA: leem a aba
 * Socios e os cálculos derivados e conferem invariantes. Nenhum
 * deles registra aporte, retirada ou recalcula participação —
 * podem rodar na HML (e até na produção) sem alterar nada.
 *
 * O que protegem:
 *  - participação de cada sócio proporcional ao que aportou;
 *  - soma das participações dos ativos = 100%;
 *  - retirada máxima limitada pelos DOIS tetos (lucro individual
 *    disponível e cota sobre o caixa livre);
 *  - reserva mínima de caixa nunca é invadida, nem se todos os
 *    sócios sacarem o máximo ao mesmo tempo.
 * ============================================================
 */

function _testeSociosNumero_(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function _testeSociosFalhar_(mensagem, contexto) {
  throw new Error('FALHA DE REGRA SOCIETÁRIA: ' + mensagem +
    (contexto ? ' | ' + JSON.stringify(contexto) : ''));
}

/**
 * Participação de cada sócio ativo = Total Aportado dele / Total
 * Aportado geral, e a soma das participações fecha em 100%.
 *
 * Este é o número que decide quanto cada um pode tirar. Se ele
 * estiver errado, todo o resto do módulo está errado junto.
 */
function testarParticipacaoSocietaria() {
  var ativos = SociosService.listarSocios(true);
  if (ativos.length === 0) {
    return { sucesso: false, erro: 'Pré-condição ausente: nenhum sócio ativo cadastrado.' };
  }

  var totalGeral = 0;
  ativos.forEach(function(s) { totalGeral += s.totalAportado; });
  totalGeral = Utils.arredondar(totalGeral, 2);

  // Sem aporte nenhum, participação zerada é o estado correto —
  // não é falha, é sociedade que ainda não começou.
  if (totalGeral <= 0) {
    ativos.forEach(function(s) {
      if (s.participacaoAtual !== 0) {
        _testeSociosFalhar_('sem aportes, a participação deveria ser 0', {
          socio: s.nome, participacao: s.participacaoAtual
        });
      }
    });
    return { sucesso: true, observacao: 'Nenhum aporte registrado ainda; participações zeradas (correto).' };
  }

  var somaPct = 0;
  var detalhe = [];

  ativos.forEach(function(s) {
    var esperado = Utils.arredondar(s.totalAportado / totalGeral, 6);
    somaPct += s.participacaoAtual;
    detalhe.push({
      socio: s.nome,
      totalAportado: s.totalAportado,
      participacaoEsperada: esperado,
      participacaoNaPlanilha: s.participacaoAtual
    });

    // Tolerância de 1e-6: a própria gravação arredonda em 6 casas.
    if (Math.abs(s.participacaoAtual - esperado) > 0.000001) {
      _testeSociosFalhar_('participação não bate com o proporcional aportado', {
        socio: s.nome, aportado: s.totalAportado, totalGeral: totalGeral,
        esperado: esperado, encontrado: s.participacaoAtual
      });
    }
  });

  // Somatório: tolerância maior porque são N arredondamentos somados.
  if (Math.abs(somaPct - 1) > 0.00001 * ativos.length + 0.000001) {
    _testeSociosFalhar_('a soma das participações dos sócios ativos não fecha em 100%', {
      soma: somaPct, socios: ativos.length
    });
  }

  var res = { sucesso: true, totalAportadoGeral: totalGeral, somaParticipacoes: somaPct, socios: detalhe };
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/**
 * Retirada máxima = MENOR valor entre o lucro individual disponível
 * e a cota do sócio sobre o caixa livre. Nunca negativa, nunca acima
 * de nenhum dos dois tetos.
 *
 * O teto do lucro disponível impede que um sócio saque lucro que não
 * é dele; o teto da cota do caixa impede que ele saque dinheiro que
 * está imobilizado em estoque.
 */
function testarRetiradaMaxima() {
  var ativos = SociosService.listarSocios(true);
  if (ativos.length === 0) {
    return { sucesso: false, erro: 'Pré-condição ausente: nenhum sócio ativo cadastrado.' };
  }

  var caixaLivre = SociosService.calcularCaixaLivre();
  var detalhe = [];

  ativos.forEach(function(s) {
    var cota = Utils.arredondar(s.participacaoAtual * caixaLivre, 2);
    var esperado = Math.max(0, Math.min(s.lucroDisponivel, cota));
    var obtido = SociosService.calcularRetiradaMaxima(s.idSocio);

    detalhe.push({
      socio: s.nome,
      lucroDisponivel: s.lucroDisponivel,
      cotaCaixaLivre: cota,
      retiradaMaxima: obtido
    });

    if (Math.abs(obtido - esperado) > 0.01) {
      _testeSociosFalhar_('retirada máxima não é o menor entre lucro disponível e cota do caixa livre', {
        socio: s.nome, lucroDisponivel: s.lucroDisponivel,
        cotaCaixaLivre: cota, esperado: esperado, encontrado: obtido
      });
    }
    if (obtido < 0) {
      _testeSociosFalhar_('retirada máxima negativa', { socio: s.nome, valor: obtido });
    }
    if (obtido > s.lucroDisponivel + 0.01) {
      _testeSociosFalhar_('retirada máxima acima do lucro disponível do sócio', {
        socio: s.nome, lucroDisponivel: s.lucroDisponivel, retiradaMaxima: obtido
      });
    }
    if (obtido > cota + 0.01) {
      _testeSociosFalhar_('retirada máxima acima da cota do sócio sobre o caixa livre', {
        socio: s.nome, cota: cota, retiradaMaxima: obtido
      });
    }
  });

  var res = { sucesso: true, caixaLivre: caixaLivre, socios: detalhe };
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/**
 * Reserva mínima de caixa: o caixa livre é o caixa teórico MENOS a
 * reserva configurada em Config_App (RESERVA_MINIMA_CAIXA), e nunca
 * é negativo.
 *
 * O assert que realmente importa é o segundo: mesmo que TODOS os
 * sócios saquem o máximo no mesmo dia, o total sacado não pode
 * passar do caixa livre — ou seja, não pode comer a reserva.
 */
function testarReservaMinimaDeCaixa() {
  var resumo = FinanceiroService.calcularResumoFinanceiro({});
  var caixaTeorico = (resumo.totais && resumo.totais.caixaTeoricoAproximado) || 0;

  var reserva = _testeSociosNumero_(SheetService.lerConfigApp('RESERVA_MINIMA_CAIXA'));
  var esperado = Math.max(0, Utils.arredondar(caixaTeorico - reserva, 2));
  var caixaLivre = SociosService.calcularCaixaLivre();

  if (Math.abs(caixaLivre - esperado) > 0.01) {
    _testeSociosFalhar_('caixa livre não desconta a reserva mínima corretamente', {
      caixaTeorico: caixaTeorico, reservaMinima: reserva,
      esperado: esperado, encontrado: caixaLivre
    });
  }
  if (caixaLivre < 0) {
    _testeSociosFalhar_('caixa livre negativo', { caixaLivre: caixaLivre });
  }

  // Cenário do pior caso: todos sacam o máximo de uma vez.
  var ativos = SociosService.listarSocios(true);
  var somaMaximos = 0;
  ativos.forEach(function(s) {
    somaMaximos += SociosService.calcularRetiradaMaxima(s.idSocio);
  });
  somaMaximos = Utils.arredondar(somaMaximos, 2);

  // Tolerância de 1 centavo por sócio, por conta do arredondamento
  // de cada cota individual.
  if (somaMaximos > caixaLivre + 0.01 * ativos.length + 0.01) {
    _testeSociosFalhar_('a soma das retiradas máximas de todos os sócios invade a reserva mínima', {
      somaRetiradasMaximas: somaMaximos, caixaLivre: caixaLivre,
      reservaMinima: reserva, caixaTeorico: caixaTeorico
    });
  }

  var res = {
    sucesso: true,
    caixaTeorico: caixaTeorico,
    reservaMinima: reserva,
    caixaLivre: caixaLivre,
    somaRetiradasMaximas: somaMaximos,
    folga: Utils.arredondar(caixaLivre - somaMaximos, 2)
  };
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/**
 * Vendas cujo lucro nunca foi atribuído a ninguém.
 *
 * Não é um assert de regra — é um raio-x. O reconhecimento de lucro
 * roda no momento da venda e não tem reprocessamento, então uma venda
 * gravada sem sócio ativo cadastrado fica com o lucro sem dono para
 * sempre. Em PROD, qualquer número acima de zero aqui é dinheiro que
 * ninguém vai conseguir sacar.
 */
function testarVendasSemLucroAtribuido() {
  var r = SociosService.contarVendasSemLucroReconhecido();

  if (r.semLucro > r.total) {
    _testeSociosFalhar_('contador inconsistente: órfãs acima do total de vendas', r);
  }

  var res = {
    sucesso: true,
    vendasConsideradas: r.total,
    semLucroAtribuido: r.semLucro,
    exemplos: r.exemplos,
    observacao: r.semLucro > 0
      ? 'Em PROD isto seria problema: o lucro destas vendas não pertence a ninguém.'
      : 'Todas as vendas tiveram lucro atribuído.'
  };
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/**
 * Roda os testes societários numa tacada só.
 * Somente leitura — seguro de rodar a qualquer momento.
 */
function testarModuloSocietarioCompleto() {
  var resultados = {
    participacao: testarParticipacaoSocietaria(),
    retiradaMaxima: testarRetiradaMaxima(),
    reservaMinima: testarReservaMinimaDeCaixa(),
    vendasSemLucro: testarVendasSemLucroAtribuido()
  };
  Logger.log(JSON.stringify(resultados, null, 2));
  try {
    SpreadsheetApp.getUi().alert('Módulo societário\n\n' + JSON.stringify(resultados, null, 2));
  } catch (e) {
    Logger.log('UI indisponivel: ' + e.message);
  }
  return resultados;
}
