/**
 * 99_Testes_DadosDemo.gs
 * ============================================================
 * Gerador de massa de dados de demonstração/teste — MVP 1.5
 * ============================================================
 * Roda inteiramente pelos serviços públicos reais (ProdutoService,
 * CompraService, EstoqueService, VendaService, SociosService,
 * FinanceiroService) — respeita todas as regras de negócio, FIFO,
 * rateio de custo e participação societária. Nunca escreve direto
 * numa aba da planilha.
 *
 * OBJETIVO: povoar a planilha HML com um volume razoável de dados
 * (sócios, produtos, compras, abertura de box, vendas, despesas,
 * retiradas) para validar visualmente o Dashboard, o estoque e o
 * módulo societário — não é um teste de regressão automatizado.
 *
 * COMO USAR: no editor do Apps Script, selecionar a função
 * `gerarDadosDemo` no dropdown "Selecionar função" e clicar em
 * Executar. Pode rodar mais de uma vez — sócios e produtos são
 * reaproveitados se já existirem (busca por nome antes de criar);
 * compras, vendas, despesas e retiradas sempre criam um novo lote.
 *
 * Copiar/rodar apenas em homologação (HML) — nunca em produção.
 * ============================================================
 */

function _demoData_(diasAtras) {
  return Utils.formatarData(Utils.adicionarDias(new Date(), -diasAtras));
}

/**
 * Trava de segurança: bloqueia execução fora de HML e sem confirmação
 * explícita do usuário. Sem isso, gerarDadosDemo()/limparDadosDemo() podem
 * gravar aporte fictício ou apagar o livro financeiro real dos sócios se
 * rodados por engano numa planilha de produção.
 */
function _demoExigirAmbienteHml_(tituloConfirmacao, mensagemConfirmacao) {
  var ambiente = SheetService.lerConfigApp('AMBIENTE') || CONFIG.AMBIENTE;
  if (String(ambiente).toUpperCase() !== 'HML') {
    throw new Error('Bloqueado: ambiente atual é "' + ambiente + '", não HML. ' +
      'Esta função só pode rodar em planilha de homologação.');
  }
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(tituloConfirmacao, mensagemConfirmacao, ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) {
    throw new Error('Cancelado pelo usuário.');
  }
}

function _demoLog_(rotulo, resultado) {
  var ok = resultado && resultado.sucesso;
  Logger.log((ok ? '✅ ' : '❌ ') + rotulo + ': ' + JSON.stringify(resultado));
  return resultado;
}

function _demoBuscarOuCriarSocio_(nome) {
  var existentes = SociosService.listarSocios(true);
  for (var i = 0; i < existentes.length; i++) {
    if (Utils.normalizar(existentes[i].nome) === Utils.normalizar(nome)) return existentes[i].idSocio;
  }
  var res = SociosService.cadastrarSocio({ nome: nome, email: '' });
  if (!res.sucesso) throw new Error('Falha ao cadastrar sócio ' + nome + ': ' + res.erro);
  Logger.log('Sócio criado: ' + nome + ' (' + res.idSocio + ')');
  return res.idSocio;
}

function _demoBuscarOuCriarProduto_(nomeProduto, dados) {
  var existentes = ProdutoService.listarAtivosParaNegocio('Pokémon TCG');
  for (var i = 0; i < existentes.length; i++) {
    if (Utils.normalizar(existentes[i].nomeProduto) === Utils.normalizar(nomeProduto)) return existentes[i].idProduto;
  }
  var res = ProdutoService.cadastrar(dados);
  if (!res.sucesso) throw new Error('Falha ao cadastrar produto ' + nomeProduto + ': ' + res.erro);
  Logger.log('Produto criado: ' + nomeProduto + ' (' + res.idProduto + ')');
  return res.idProduto;
}

function gerarDadosDemo() {
  var resumo = { socios: [], produtos: {}, compras: [], aberturas: [], vendas: [], despesas: [], retiradas: [], erros: [] };

  try {
    _demoExigirAmbienteHml_('Gerar dados demo',
      'Isso vai gravar sócios, aportes (R$10.000 cada), compras, vendas, despesas e ' +
      'retiradas fictícias nesta planilha. Confirmar apenas se esta é a planilha de homologação (HML)?');

    // ------------------------------------------------------------
    // 1. Sócios + aportes (R$10.000 cada — participação ~33% cada)
    // ------------------------------------------------------------
    var idKaique = _demoBuscarOuCriarSocio_('Kaique');
    var idSamuel = _demoBuscarOuCriarSocio_('Samuel');
    var idLucas  = _demoBuscarOuCriarSocio_('Lucas');
    resumo.socios = [idKaique, idSamuel, idLucas];

    [[idKaique, 'Kaique'], [idSamuel, 'Samuel'], [idLucas, 'Lucas']].forEach(function (par, idx) {
      var r = SociosService.registrarAporte({
        idSocio: par[0],
        valor: 10000,
        data: _demoData_(40 - idx),
        formaPagamento: 'Pix',
        origem: 'Aporte inicial de demonstração',
        observacao: 'Massa de dados demo'
      });
      _demoLog_('Aporte ' + par[1], r);
    });

    // ------------------------------------------------------------
    // 2. Produtos (booster antes do box — box referencia o booster
    //    como Produto Gerado Padrão)
    // ------------------------------------------------------------
    var idBooster = _demoBuscarOuCriarProduto_('Booster Escarlate e Violeta 151 Avulso', {
      negocio: 'Pokémon TCG', nomeProduto: 'Booster Escarlate e Violeta 151 Avulso',
      tipoModelo: 'Booster', colecaoJogo: 'Escarlate e Violeta 151', estadoCondicao: 'Novo/Lacrado',
      unidadeControle: 'Unidade', fracionavel: 'Não'
    });

    var idBox = _demoBuscarOuCriarProduto_('Box Booster Escarlate e Violeta 151 (36un)', {
      negocio: 'Pokémon TCG', nomeProduto: 'Box Booster Escarlate e Violeta 151 (36un)',
      tipoModelo: 'Box Booster', colecaoJogo: 'Escarlate e Violeta 151', estadoCondicao: 'Novo/Lacrado',
      unidadeControle: 'Caixa', fracionavel: 'Sim', qtdGeradaPadrao: 36, produtoGeradoPadrao: idBooster
    });

    var idETB = _demoBuscarOuCriarProduto_('ETB Escarlate e Violeta 151', {
      negocio: 'Pokémon TCG', nomeProduto: 'ETB Escarlate e Violeta 151',
      tipoModelo: 'Elite Trainer Box', colecaoJogo: 'Escarlate e Violeta 151', estadoCondicao: 'Novo/Lacrado',
      unidadeControle: 'Caixa', fracionavel: 'Não'
    });

    var idBlister = _demoBuscarOuCriarProduto_('Blister Paldea Evolved', {
      negocio: 'Pokémon TCG', nomeProduto: 'Blister Paldea Evolved',
      tipoModelo: 'Blister', colecaoJogo: 'Paldea Evolved', estadoCondicao: 'Novo/Lacrado',
      unidadeControle: 'Unidade', fracionavel: 'Não'
    });

    var idColecao = _demoBuscarOuCriarProduto_('Coleção Especial Charizard ex', {
      negocio: 'Pokémon TCG', nomeProduto: 'Coleção Especial Charizard ex',
      tipoModelo: 'Coleção Especial', colecaoJogo: 'Obsidian Flames', estadoCondicao: 'Novo/Lacrado',
      unidadeControle: 'Caixa', fracionavel: 'Não'
    });

    resumo.produtos = { idBooster: idBooster, idBox: idBox, idETB: idETB, idBlister: idBlister, idColecao: idColecao };

    // ------------------------------------------------------------
    // 3. Compras — 10 boxes no total, mais especiais e boosters
    //    avulsos, em 3 compras com frete/taxas/desconto (rateio).
    // ------------------------------------------------------------
    var compra1 = CompraService.salvarCompra({
      cabecalho: { dataCompra: _demoData_(30), negocio: 'Pokémon TCG', fornecedor: 'Distribuidora Central', frete: 30, taxas: 0, desconto: 20, observacao: 'Compra demo 1' },
      itens: [
        { idProduto: idBox, quantidade: 4, valorUnitarioBruto: 250 },
        { idProduto: idETB, quantidade: 3, valorUnitarioBruto: 180 }
      ]
    });
    _demoLog_('Compra 1', compra1);

    var compra2 = CompraService.salvarCompra({
      cabecalho: { dataCompra: _demoData_(22), negocio: 'Pokémon TCG', fornecedor: 'Card Shop Paulista', frete: 25, taxas: 0, desconto: 15, observacao: 'Compra demo 2' },
      itens: [
        { idProduto: idBox, quantidade: 4, valorUnitarioBruto: 255 },
        { idProduto: idBlister, quantidade: 5, valorUnitarioBruto: 45 },
        { idProduto: idColecao, quantidade: 2, valorUnitarioBruto: 120 }
      ]
    });
    _demoLog_('Compra 2', compra2);

    var compra3 = CompraService.salvarCompra({
      cabecalho: { dataCompra: _demoData_(15), negocio: 'Pokémon TCG', fornecedor: 'Importados TCG', frete: 20, taxas: 0, desconto: 10, observacao: 'Compra demo 3' },
      itens: [
        { idProduto: idBox, quantidade: 2, valorUnitarioBruto: 260 },
        { idProduto: idBooster, quantidade: 10, valorUnitarioBruto: 15 },
        { idProduto: idColecao, quantidade: 3, valorUnitarioBruto: 125 }
      ]
    });
    _demoLog_('Compra 3', compra3);

    resumo.compras = [compra1, compra2, compra3];

    // ------------------------------------------------------------
    // 4. Abertura de 3 boxes (fracionamento FIFO) -> gera boosters
    //    avulsos. Sobram 7 boxes lacradas em estoque para venda.
    // ------------------------------------------------------------
    for (var a = 0; a < 3; a++) {
      var abertura = EstoqueService.registrarAberturaPorProduto({
        idProduto: idBox,
        qtdAbrir: 1,
        dataAbertura: _demoData_(8 - a),
        observacao: 'Abertura demo ' + (a + 1)
      });
      _demoLog_('Abertura box ' + (a + 1), abertura);
      resumo.aberturas.push(abertura);
    }

    // ------------------------------------------------------------
    // 5. Vendas — 26 vendas espalhadas nos últimos ~9 dias, preço
    //    sempre acima do custo do lote consumido.
    // ------------------------------------------------------------
    var planoVendas = [];
    for (var i = 0; i < 10; i++) planoVendas.push({ idProduto: idBooster, quantidade: (i % 3) + 1, preco: 22 });
    for (var j = 0; j < 6; j++)  planoVendas.push({ idProduto: idBox, quantidade: 1, preco: 340 });
    for (var k = 0; k < 3; k++)  planoVendas.push({ idProduto: idETB, quantidade: 1, preco: 240 });
    for (var m = 0; m < 4; m++)  planoVendas.push({ idProduto: idBlister, quantidade: 1, preco: 65 });
    for (var n = 0; n < 3; n++)  planoVendas.push({ idProduto: idColecao, quantidade: 1, preco: 175 });

    planoVendas.forEach(function (v, idx) {
      var diasAtras = Math.max(0, 9 - Math.floor(idx * 10 / planoVendas.length));
      var res = VendaService.salvarVenda({
        cabecalho: {
          dataVenda: _demoData_(diasAtras),
          negocio: 'Pokémon TCG',
          cliente: 'Cliente Demo ' + (idx + 1),
          taxaVenda: 0, freteVenda: 0, descontoVenda: 0,
          observacao: 'Venda demo'
        },
        itens: [{ idProduto: v.idProduto, quantidade: v.quantidade, valorUnitarioVenda: v.preco }]
      });
      _demoLog_('Venda ' + (idx + 1) + ' (' + v.idProduto + ')', res);
      resumo.vendas.push(res);
    });

    // ------------------------------------------------------------
    // 6. Despesas — 8, mesclando natureza Fixa e Variável.
    // ------------------------------------------------------------
    var despesasPlano = [
      { categoria: 'Taxa Plataforma', natureza: 'Variável', valor: 45,  descricao: 'Taxa marketplace demo 1' },
      { categoria: 'Frete',           natureza: 'Variável', valor: 30,  descricao: 'Frete de envio demo' },
      { categoria: 'Embalagem',       natureza: 'Variável', valor: 60,  descricao: 'Caixas e plástico bolha' },
      { categoria: 'Operacional',     natureza: 'Fixa',     valor: 150, descricao: 'Armazenamento mensal (mês 1)' },
      { categoria: 'Outro',           natureza: 'Variável', valor: 25,  descricao: 'Despesa diversa demo' },
      { categoria: 'Operacional',     natureza: 'Fixa',     valor: 150, descricao: 'Armazenamento mensal (mês 2)' },
      { categoria: 'Taxa Plataforma', natureza: 'Variável', valor: 38,  descricao: 'Taxa marketplace demo 2' },
      { categoria: 'Embalagem',       natureza: 'Variável', valor: 40,  descricao: 'Etiquetas e fitas' }
    ];
    despesasPlano.forEach(function (d, idx) {
      var res = FinanceiroService.registrarDespesa({
        idRequisicao: Utils.uuid(),
        data: _demoData_(18 - idx * 2),
        negocio: 'Pokémon TCG',
        categoria: d.categoria,
        natureza: d.natureza,
        valor: d.valor,
        descricao: d.descricao,
        observacao: 'Despesa demo'
      });
      _demoLog_('Despesa ' + (idx + 1), res);
      resumo.despesas.push(res);
    });

    // ------------------------------------------------------------
    // 7. Retiradas — 2, cada uma pedindo 40% do limite calculado
    //    na hora (menor valor entre lucro disponível e cota do
    //    caixa livre), para ficar sempre dentro do permitido.
    // ------------------------------------------------------------
    [[idKaique, 'Kaique'], [idSamuel, 'Samuel']].forEach(function (par) {
      var max = SociosService.calcularRetiradaMaxima(par[0]);
      if (max > 10) {
        var valor = Utils.arredondar(max * 0.4, 2);
        var r = SociosService.solicitarRetirada({
          idSocio: par[0],
          valorSolicitado: valor,
          data: _demoData_(1),
          formaPagamento: 'Pix',
          observacao: 'Retirada demo'
        });
        _demoLog_('Retirada ' + par[1], r);
        resumo.retiradas.push(r);
      } else {
        Logger.log('Retirada ' + par[1] + ' pulada: limite disponível insuficiente (' + max + ').');
      }
    });

  } catch (e) {
    resumo.erros.push(e.message);
    Logger.log('❌ ERRO em gerarDadosDemo: ' + e.message);
  }

  Logger.log('=== RESUMO gerarDadosDemo ===');
  Logger.log(JSON.stringify(resumo, null, 2));
  return resumo;
}

/**
 * limparDadosDemo()
 * ------------------------------------------------------------
 * Apaga (mantendo cabecalho) todas as linhas das abas povoadas por
 * gerarDadosDemo(), para permitir regenerar a massa de dados do zero
 * sem duplicar socios/aportes/compras/vendas/etc.
 *
 * Copiar/rodar apenas em homologacao (HML) - nunca em producao.
 * ------------------------------------------------------------
 */
function limparDadosDemo() {
  _demoExigirAmbienteHml_('Limpar dados demo',
    'Isso vai APAGAR todos os dados de Sócios, Aportes, Participações, Retiradas, Lucro por ' +
    'Sócio, Produtos, Compras, Vendas, Estoque e Despesas desta planilha. Esta ação não pode ' +
    'ser desfeita. Confirmar apenas se esta é a planilha de homologação (HML)?');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abas = [
    'Socios', 'Aportes_Socios', 'Historico_Participacoes', 'Retiradas',
    'Lucro_Por_Item_Socio', 'Resumo_Socios',
    'Produtos_Ativos', 'Compras', 'Itens_Compra',
    'Vendas', 'Itens_Venda',
    'Lotes_Estoque', 'Movimentos_Estoque', 'Pokemon_Abertura_Box',
    'Despesas'
  ];
  var resultado = [];
  abas.forEach(function (nome) {
    var sh = ss.getSheetByName(nome);
    if (!sh) { resultado.push(nome + ': aba nao encontrada'); return; }
    var ultimaLinha = sh.getLastRow();
    if (ultimaLinha > 1) {
      sh.getRange(2, 1, ultimaLinha - 1, sh.getLastColumn()).clearContent();
      resultado.push(nome + ': ' + (ultimaLinha - 1) + ' linhas limpas');
    } else {
      resultado.push(nome + ': ja estava vazia');
    }
  });
  Logger.log(resultado.join('\n'));
  return resultado;
}
