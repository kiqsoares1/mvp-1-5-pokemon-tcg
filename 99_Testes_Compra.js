/**
 * 99_Testes_Compra.gs
 * ============================================================
 * Asserts reais do rateio de compra (07_CompraService).
 *
 * Todos os testes deste arquivo usam CompraService.calcularPrevia,
 * que NÃO escreve nada na planilha — só calcula. Podem ser rodados
 * na HML sem sujar Compras, Itens_Compra ou Lotes_Estoque.
 *
 * A regra que estes testes protegem (Doc 05 §11):
 *   Custo Adicional Líquido = Frete + Taxas - Desconto
 *   Participação            = VlrTotalBrutoItem / SomaTotalBruta
 *   Custo Adicional Rateado = Participação × CustoAdicionalLíquido
 *   Custo Total Final       = VlrTotalBruto + CustoAdicionalRateado
 *
 * O invariante que importa: **nenhum centavo pode evaporar nem
 * aparecer do nada no rateio**. A soma do que foi rateado entre os
 * itens tem que dar exatamente o custo adicional líquido, mesmo
 * quando a divisão não é exata — é para isso que o último item
 * absorve a diferença de arredondamento.
 * ============================================================
 */

function _testeCompraTolerancia_() {
  return 0.005; // meio centavo
}

function _testeCompraFalhar_(mensagem, contexto) {
  throw new Error('FALHA DE RATEIO: ' + mensagem +
    (contexto ? ' | ' + JSON.stringify(contexto) : ''));
}

/**
 * Exige que o valor seja um número finito antes de compará-lo.
 *
 * Existe por causa de um bug real deste próprio arquivo: a primeira
 * versão lia `custoAdicionalRateado` (nome interno do _calcularRateio)
 * em vez de `custoRateado` (nome que calcularPrevia realmente expõe).
 * O campo vinha `undefined`, a soma virava NaN, e **NaN passa em
 * qualquer comparação** — `Math.abs(NaN - 30) > 0.005` é false. Os
 * asserts ficaram verdes sem conferir nada.
 *
 * Toda leitura de campo numérico da prévia passa por aqui agora: se o
 * campo sumir ou for renomeado, o teste quebra alto em vez de mentir.
 */
function _testeCompraExigirNumero_(valor, ondeVeio) {
  if (typeof valor !== 'number' || !isFinite(valor)) {
    _testeCompraFalhar_('valor não numérico onde se esperava número — campo ausente, ' +
      'renomeado ou NaN', { origem: ondeVeio, valor: String(valor), tipo: typeof valor });
  }
  return valor;
}

/**
 * Procura um produto ativo do negócio informado para servir de
 * massa de teste. Retorna null se não houver — o teste vira
 * "pré-condição ausente" em vez de falha.
 */
function _testeCompraProdutoAtivo_(negocio) {
  var C = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var produtos = SheetService.getDadosComoObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS);
  for (var i = 0; i < produtos.length; i++) {
    var p = produtos[i];
    if (Utils.normalizar(p[C.ATIVO] || '') !== 'Sim') continue;
    if (negocio && p[C.NEGOCIO] !== negocio) continue;
    return p;
  }
  return null;
}

function _testeCompraPrevia_(itens, frete, taxas, desconto) {
  return CompraService.calcularPrevia({
    cabecalho: {
      dataCompra: Utils.formatarData(new Date()),
      negocio: 'Pokémon TCG',
      fornecedor: 'Teste Rateio',
      frete: frete,
      taxas: taxas,
      desconto: desconto,
      observacao: 'Prévia de teste — não grava nada'
    },
    itens: itens
  });
}

/**
 * Verifica os invariantes do rateio sobre uma prévia já calculada.
 * Separado para poder ser reaproveitado por vários cenários.
 */
function _testeCompraConferirInvariantes_(previa, frete, taxas, desconto, rotulo) {
  var tol = _testeCompraTolerancia_();

  if (!previa || previa.valido !== true) {
    _testeCompraFalhar_(rotulo + ': prévia deveria ser válida', previa);
  }

  var adicionalEsperado = Utils.arredondar(frete + taxas - desconto, 2);
  var somaRateado = 0;
  var somaBruta = 0;
  var somaTotalFinal = 0;

  if (previa.itensCalculados.length === 0) {
    _testeCompraFalhar_(rotulo + ': prévia voltou sem itens calculados', previa);
  }
  _testeCompraExigirNumero_(previa.custoTotal, rotulo + '.custoTotal');

  for (var i = 0; i < previa.itensCalculados.length; i++) {
    var it = previa.itensCalculados[i];
    // Nomes conforme a projeção pública de calcularPrevia — NÃO os nomes
    // internos do _calcularRateio. Ver _testeCompraExigirNumero_.
    somaRateado    += _testeCompraExigirNumero_(it.custoRateado,     rotulo + '[' + i + '].custoRateado');
    somaBruta      += _testeCompraExigirNumero_(it.valorTotalBruto,  rotulo + '[' + i + '].valorTotalBruto');
    somaTotalFinal += _testeCompraExigirNumero_(it.custoTotalFinal,  rotulo + '[' + i + '].custoTotalFinal');
    _testeCompraExigirNumero_(it.custoUnitFinal, rotulo + '[' + i + '].custoUnitFinal');

    // Custo unitário final tem que ser coerente com o total do item.
    // Se este assert quebrar, o Lote_Estoque nasce com custo errado e
    // TODO lucro calculado a partir dele fica errado também.
    var totalRecomposto = Utils.arredondar(it.custoUnitFinal * it.quantidade, 2);
    if (Math.abs(totalRecomposto - it.custoTotalFinal) > 0.01) {
      _testeCompraFalhar_(rotulo + ': custo unitário × quantidade não recompõe o custo total do item', {
        item: i, custoUnitFinal: it.custoUnitFinal, quantidade: it.quantidade,
        esperado: it.custoTotalFinal, recomposto: totalRecomposto
      });
    }
  }

  somaRateado = Utils.arredondar(somaRateado, 2);
  somaBruta = Utils.arredondar(somaBruta, 2);
  somaTotalFinal = Utils.arredondar(somaTotalFinal, 2);

  // O invariante central: nada evapora, nada aparece do nada.
  if (Math.abs(somaRateado - adicionalEsperado) > tol) {
    _testeCompraFalhar_(rotulo + ': a soma do rateado não fecha com Frete + Taxas - Desconto', {
      esperado: adicionalEsperado, encontrado: somaRateado,
      diferenca: Utils.arredondar(somaRateado - adicionalEsperado, 4)
    });
  }

  var custoTotalEsperado = Utils.arredondar(somaBruta + adicionalEsperado, 2);
  if (Math.abs(previa.custoTotal - custoTotalEsperado) > tol) {
    _testeCompraFalhar_(rotulo + ': custoTotal da compra não bate com bruto + adicional', {
      somaBruta: somaBruta, adicional: adicionalEsperado,
      esperado: custoTotalEsperado, encontrado: previa.custoTotal
    });
  }

  if (Math.abs(somaTotalFinal - custoTotalEsperado) > tol) {
    _testeCompraFalhar_(rotulo + ': soma dos custos finais dos itens não bate com o custo total da compra', {
      esperado: custoTotalEsperado, encontrado: somaTotalFinal
    });
  }

  return {
    rotulo: rotulo,
    adicionalEsperado: adicionalEsperado,
    somaRateado: somaRateado,
    custoTotal: previa.custoTotal
  };
}

/**
 * Caso normal: dois itens de valores diferentes, frete + taxas com
 * desconto. Confere que o rateio é proporcional ao valor de cada item.
 */
function testarRateioCompraProporcional() {
  var produto = _testeCompraProdutoAtivo_('Pokémon TCG');
  if (!produto) {
    return { sucesso: false, erro: 'Pré-condição ausente: cadastre ao menos um produto ativo de Pokémon TCG.' };
  }
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];

  // Item A: 2 × 100 = 200 (2/3 do bruto). Item B: 1 × 100 = 100 (1/3).
  var frete = 30, taxas = 0, desconto = 0;
  var previa = _testeCompraPrevia_([
    { idProduto: idProduto, quantidade: 2, valorUnitarioBruto: 100 },
    { idProduto: idProduto, quantidade: 1, valorUnitarioBruto: 100 }
  ], frete, taxas, desconto);

  var res = _testeCompraConferirInvariantes_(previa, frete, taxas, desconto, 'proporcional');

  // Proporção explícita: com bruto 200/100, o frete de 30 tem que sair
  // 20 para o item A e 10 para o B. Um bug que ratear "por item" em vez
  // de "por valor" passaria nos invariantes de soma, mas não aqui.
  var itens = previa.itensCalculados;
  if (Math.abs(itens[0].custoRateado - 20) > 0.01 ||
      Math.abs(itens[1].custoRateado - 10) > 0.01) {
    _testeCompraFalhar_('rateio não ficou proporcional ao valor bruto (esperado 20 / 10)', {
      itemA: itens[0].custoRateado,
      itemB: itens[1].custoRateado
    });
  }

  Logger.log(JSON.stringify(res));
  return res;
}

/**
 * Caso da divisão não exata: 3 itens iguais dividindo R$ 10,00.
 * 10 / 3 = 3,333... Se o código arredondasse os três para 3,33,
 * sumiria 1 centavo da compra. O último item tem que absorver.
 */
function testarRateioCompraArredondamentoNaoPerdeCentavo() {
  var produto = _testeCompraProdutoAtivo_('Pokémon TCG');
  if (!produto) {
    return { sucesso: false, erro: 'Pré-condição ausente: cadastre ao menos um produto ativo de Pokémon TCG.' };
  }
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];

  var frete = 10, taxas = 0, desconto = 0;
  var previa = _testeCompraPrevia_([
    { idProduto: idProduto, quantidade: 1, valorUnitarioBruto: 50 },
    { idProduto: idProduto, quantidade: 1, valorUnitarioBruto: 50 },
    { idProduto: idProduto, quantidade: 1, valorUnitarioBruto: 50 }
  ], frete, taxas, desconto);

  var res = _testeCompraConferirInvariantes_(previa, frete, taxas, desconto, 'arredondamento');
  Logger.log(JSON.stringify(res));
  return res;
}

/**
 * Desconto maior que frete + taxas: o custo adicional líquido fica
 * NEGATIVO e o rateio tem que distribuir crédito, não débito.
 * Este é o cenário onde um Math.abs() ou um Math.max(0, ...) mal
 * colocado esconderia o desconto do custo do estoque.
 */
function testarRateioCompraDescontoMaiorQueFrete() {
  var produto = _testeCompraProdutoAtivo_('Pokémon TCG');
  if (!produto) {
    return { sucesso: false, erro: 'Pré-condição ausente: cadastre ao menos um produto ativo de Pokémon TCG.' };
  }
  var idProduto = produto[CONFIG.CAMPOS.PRODUTOS_ATIVOS.ID_PRODUTO];

  var frete = 10, taxas = 5, desconto = 40; // líquido = -25
  var previa = _testeCompraPrevia_([
    { idProduto: idProduto, quantidade: 2, valorUnitarioBruto: 100 },
    { idProduto: idProduto, quantidade: 2, valorUnitarioBruto: 100 }
  ], frete, taxas, desconto);

  var res = _testeCompraConferirInvariantes_(previa, frete, taxas, desconto, 'desconto-negativo');

  if (res.adicionalEsperado >= 0) {
    _testeCompraFalhar_('cenário mal montado: o adicional deveria ser negativo', res);
  }
  for (var i = 0; i < previa.itensCalculados.length; i++) {
    if (previa.itensCalculados[i].custoRateado > 0) {
      _testeCompraFalhar_('com desconto maior que frete+taxas, o rateado de cada item deveria ser negativo', {
        item: i, valor: previa.itensCalculados[i].custoRateado
      });
    }
  }

  Logger.log(JSON.stringify(res));
  return res;
}

/**
 * Roda os três cenários de rateio numa tacada só.
 */
function testarRateioCompraCompleto() {
  var resultados = [
    testarRateioCompraProporcional(),
    testarRateioCompraArredondamentoNaoPerdeCentavo(),
    testarRateioCompraDescontoMaiorQueFrete()
  ];
  Logger.log(JSON.stringify(resultados, null, 2));
  try {
    SpreadsheetApp.getUi().alert('Rateio de compra\n\n' + JSON.stringify(resultados, null, 2));
  } catch (e) {
    Logger.log('UI indisponivel: ' + e.message);
  }
  return resultados;
}
