/**
 * * 12_UiService.gs
 * ============================================================
 * Servico de Interface HTMLService — MVP 1.5 Manus
 * ============================================================
 * Camada fina entre Portal.html e services de negocio. Nao duplica
 * regras criticas: apenas consulta dados, encaminha payloads e retorna
 * objetos amigaveis para o front-end.
 * ============================================================
 */

 function abrirPortalMVP() {
 return UiService.abrirPortalMVP();
 }

 function include(filename) {
 return UiService.include(filename);
 }

 function uiObterResumoHome() { return UiService.uiObterResumoHome(); }
 function uiListarProdutosAtivos(negocio) { return UiService.uiListarProdutosAtivos(negocio); }
 function uiListarProdutosFracionaveis() { return UiService.uiListarProdutosFracionaveis(); }
 function uiConsultarEstoque(filtros) { return UiService.uiConsultarEstoque(filtros); }
 function uiObterCarteiraMercado(filtros) { return UiService.uiObterCarteiraMercado(filtros); }
 function uiAtualizarPrecosCarteira(filtros) { return UiService.uiAtualizarPrecosCarteira(filtros); }
 function uiBuscarPrecoProduto(payload) { return UiService.uiBuscarPrecoProduto(payload); }
 function uiRegistrarPrecoManual(payload) { return UiService.uiRegistrarPrecoManual(payload); }
 function uiSalvarCompra(payload) { return UiService.uiSalvarCompra(payload); }
 function uiSalvarVenda(payload) { return UiService.uiSalvarVenda(payload); }
 function uiRegistrarAberturaPokemon(payload) { return UiService.uiRegistrarAberturaPokemon(payload); }
 function uiRegistrarAporte(payload) { return UiService.uiRegistrarAporte(payload); }
 function uiRegistrarResgate(payload) { return UiService.uiRegistrarResgate(payload); }
 function uiRegistrarDespesa(payload) { return UiService.uiRegistrarDespesa(payload); }
 function uiListarDespesas(limite) { return UiService.uiListarDespesas(limite); }
 function uiObterResumoFinanceiro(filtros) { return UiService.uiObterResumoFinanceiro(filtros); }
 function uiObterUltimosLogs(limite) { return UiService.uiObterUltimosLogs(limite); }
 function uiExecutarHealthCheck() { return UiService.uiExecutarHealthCheck(); }

 // --- Módulo Societário (v1.6.0) ---
 function uiListarSocios() { return UiService.uiListarSocios(); }
 function uiCadastrarSocio(payload) { return UiService.uiCadastrarSocio(payload); }
 function uiRegistrarAporteSocio(payload) { return UiService.uiRegistrarAporteSocio(payload); }
 function uiListarAportesSocios() { return UiService.uiListarAportesSocios(); }
 function uiSolicitarRetirada(payload) { return UiService.uiSolicitarRetirada(payload); }
 function uiListarRetiradas() { return UiService.uiListarRetiradas(); }
 function uiObterDashboardGeral() { return UiService.uiObterDashboardGeral(); }
 function uiObterSerieMensal(meses) { return UiService.uiObterSerieMensal(meses); }

 var UiService = (function () {

 var C_PROD = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
 var C_LOTE = CONFIG.CAMPOS.LOTES_ESTOQUE;
 var C_VENDA = CONFIG.CAMPOS.VENDAS;
 var C_ITEM = CONFIG.CAMPOS.ITENS_VENDA;
 var C_LOG = CONFIG.CAMPOS.LOGS_SISTEMA;

 function _ok(dados) {
 dados = dados || {};
 dados.sucesso = dados.sucesso !== false;
 return dados;
 }

 function _erro(operacao, e) {
 try {
 LogService.error('UiService', operacao, e.message || String(e));
 } catch (_) {}
 return { sucesso: false, erro: e.message || String(e), detalhes: [e.message || String(e)] };
 }

 function _numero(valor) {
 return Utils.parsarMoeda(valor || 0);
 }

 function _normalizar(valor) {
 return Utils.normalizarChave(valor);
 }

 function _filtrarNegocio(obj, campo, negocio) {
 if (!negocio || negocio === 'Todos') return true;
 return _normalizar(obj[campo]) === _normalizar(negocio);
 }

 function _cabecalhos(nomeAba) {
 return SheetService.getCabecalhos(nomeAba);
 }

 function _lerObjetos(nomeAba) {
 try {
 return SheetService.getDadosComoObjetos(nomeAba);
 } catch (e) {
 return [];
 }
 }

 function _produtoAtivo(produto) {
 return _normalizar(produto[C_PROD.ATIVO]) === 'sim';
 }

 function _precoVigente(idProduto) {
 try {
 return PrecoReferenciaService.obterPrecoVigente(idProduto);
 } catch (e) {
 return { statusPreco: 'Sem Preço', precoUnitario: 0, fonte: '', dataReferencia: '', mercadoReferencia: '', fontePrecoPreferencial: '' };
 }
 }

 function abrirPortalMVP() {
 var template = HtmlService.createTemplateFromFile('Portal');
 template.appConfig = {
 sistema: CONFIG.SISTEMA_NOME,
 ambiente: CONFIG.AMBIENTE,
 versao: CONFIG.VERSAO
 };
 var html = template.evaluate()
 .setTitle('MVP 1.5 Portal')
 .setWidth(1200)
 .setHeight(760);
 SpreadsheetApp.getUi().showModalDialog(html, 'MVP 1.5 Portal');
 }

 function include(filename) {
 return HtmlService.createHtmlOutputFromFile(filename).getContent();
 }

 function uiListarProdutosAtivos(negocio) {
 try {
 var produtos = _lerObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS)
 .filter(function(p) { return _produtoAtivo(p) && _filtrarNegocio(p, C_PROD.NEGOCIO, negocio); })
 .map(function(p) {
 // Resolvedor puro (sem I/O) usando o produto já carregado em memória —
 // evita reler Produtos_Ativos inteira por produto do loop.
 var meta = {};
 try { meta = ProdutoMercadoService.resolverMetadadosDoProduto(p) || {}; } catch (_) {}
 return {
 idProduto: p[C_PROD.ID_PRODUTO],
 nomeProduto: p[C_PROD.NOME_PRODUTO],
 negocio: p[C_PROD.NEGOCIO],
 tipoModelo: p[C_PROD.TIPO_MODELO],
 colecao: p[C_PROD.COLECAO_JOGO],
 estado: p[C_PROD.ESTADO_CONDICAO],
 paisRegiao: meta.paisRegiao || '',
 idioma: meta.idioma || '',
 mercadoReferencia: meta.mercadoReferencia || '',
 fontePrecoPreferencial: meta.fontePrecoPreferencial || ''
 };
 });
 return _ok({ produtos: produtos });
 } catch (e) { return _erro('uiListarProdutosAtivos', e); }
 }

 function uiConsultarEstoque(filtros) {
 try {
 filtros = filtros || {};
 var lotesFiltrados = _lerObjetos(CONFIG.ABAS.LOTES_ESTOQUE)
 .filter(function(l) { return _filtrarNegocio(l, C_LOTE.NEGOCIO, filtros.negocio); })
 .filter(function(l) { return !filtros.statusLote || String(l[C_LOTE.STATUS]) === filtros.statusLote; })
 .filter(function(l) { return !filtros.idProduto || String(l[C_LOTE.ID_PRODUTO]) === String(filtros.idProduto); });

 // Busca o preço vigente de todos os produtos envolvidos de uma vez só
 // (uma leitura de Referencias_Preco/Config_App), em vez de reler a
 // aba inteira uma vez por lote — Home/Dashboard chamam esta função a
 // cada carregamento de tela.
 var idsProdutos = lotesFiltrados.map(function(l) { return l[C_LOTE.ID_PRODUTO]; });
 var precosPorProduto = {};
 try { precosPorProduto = PrecoReferenciaService.obterPrecosVigentesEmLote(idsProdutos); } catch (_) {}

 var lotes = lotesFiltrados.map(function(l) {
 var preco = precosPorProduto[String(l[C_LOTE.ID_PRODUTO])] || _precoVigente(l[C_LOTE.ID_PRODUTO]);
 return {
 idLote: l[C_LOTE.ID_LOTE],
 idProduto: l[C_LOTE.ID_PRODUTO],
 produto: l[C_LOTE.PRODUTO],
 negocio: l[C_LOTE.NEGOCIO],
 statusLote: l[C_LOTE.STATUS],
 quantidadeTotal: _numero(l[C_LOTE.QTD_TOTAL]),
 quantidadeDisponivel: _numero(l[C_LOTE.QTD_DISPONIVEL]),
 quantidadeVendida: _numero(l[C_LOTE.QTD_VENDIDA]),
 custoUnitario: _numero(l[C_LOTE.CUSTO_UNIT]),
 custoTotal: _numero(l[C_LOTE.CUSTO_TOTAL]),
 valorMercadoUnitario: _numero(l[C_LOTE.VLR_MERCADO_UNIT]),
 valorMercadoTotal: _numero(l[C_LOTE.VLR_MERCADO_TOTAL]),
 ganhoPerdaNaoRealizada: _numero(l[C_LOTE.GANHO_PERDA]),
 fontePreco: preco.fonte || preco.fontePrecoPreferencial || '',
 statusPreco: preco.statusPreco || 'Sem Preço'
 };
 });
 return _ok({ lotes: lotes });
 } catch (e) { return _erro('uiConsultarEstoque', e); }
 }

 function uiObterCarteiraMercado(filtros) {
 try {
 filtros = filtros || {};
 var estoque = uiConsultarEstoque(filtros);
 if (!estoque.sucesso) return estoque;
 var porProduto = {};
 estoque.lotes.forEach(function(l) {
 var key = l.idProduto;
 if (!porProduto[key]) {
 porProduto[key] = {
 negocio: l.negocio,
 produto: l.produto,
 idProduto: l.idProduto,
 quantidadeTotal: 0,
 quantidadeDisponivel: 0,
 custoTotalHistorico: 0,
 valorMercadoTotal: 0,
 ganhoPerdaNaoRealizada: 0,
 fontePreco: l.fontePreco,
 statusPreco: l.statusPreco
 };
 }
 porProduto[key].quantidadeTotal += l.quantidadeTotal;
 porProduto[key].quantidadeDisponivel += l.quantidadeDisponivel;
 porProduto[key].custoTotalHistorico += l.custoTotal;
 porProduto[key].valorMercadoTotal += l.valorMercadoTotal;
 porProduto[key].ganhoPerdaNaoRealizada += l.ganhoPerdaNaoRealizada;
 });
 var linhas = Object.keys(porProduto).map(function(k) {
 var p = porProduto[k];
 p.percentualGanhoPerda = p.custoTotalHistorico > 0 ? Utils.arredondar(p.ganhoPerdaNaoRealizada / p.custoTotalHistorico, 4) : 0;
 return p;
 });
 var resumo = _resumoCarteira(linhas);
 return _ok({ resumo: resumo, produtos: linhas });
 } catch (e) { return _erro('uiObterCarteiraMercado', e); }
 }

 function _resumoCarteira(linhas) {
 var resumo = { custoHistoricoTotal: 0, valorMercadoTotal: 0, ganhoPerdaNaoRealizada: 0, produtosComEstoque: 0 };
 linhas.forEach(function(l) {
 resumo.custoHistoricoTotal += l.custoTotalHistorico;
 resumo.valorMercadoTotal += l.valorMercadoTotal;
 resumo.ganhoPerdaNaoRealizada += l.ganhoPerdaNaoRealizada;
 if (l.quantidadeTotal > 0) resumo.produtosComEstoque++;
 });
 resumo.percentualGanhoPerda = resumo.custoHistoricoTotal > 0 ? Utils.arredondar(resumo.ganhoPerdaNaoRealizada / resumo.custoHistoricoTotal, 4) : 0;
 return resumo;
 }

 function uiObterResumoHome() {
 try {
 var carteira = uiObterCarteiraMercado({});
 var financeiro = FinanceiroService.calcularResumoFinanceiro({});
 var semPreco = PrecoReferenciaService.listarProdutosSemPreco();
 var vencidos = PrecoReferenciaService.listarProdutosComPrecoVencido();
 return _ok({
 ambiente: CONFIG.AMBIENTE,
 versao: CONFIG.VERSAO,
 carteira: carteira.resumo || {},
 financeiro: financeiro.totais || {},
 produtosSemPreco: semPreco.length,
 precosVencidos: vencidos.length,
 dataAtualizacao: Utils.timestamp()
 });
 } catch (e) { return _erro('uiObterResumoHome', e); }
 }

 function uiAtualizarPrecosCarteira(filtros) {
 try { return PriceAdapterService.atualizarPrecosCarteira(filtros || {}); }
 catch (e) { return _erro('uiAtualizarPrecosCarteira', e); }
 }

 function uiBuscarPrecoProduto(payload) {
 try { return PriceAdapterService.buscarPreco(payload || {}); }
 catch (e) { return _erro('uiBuscarPrecoProduto', e); }
 }

 function uiRegistrarPrecoManual(payload) {
 try { return PrecoReferenciaService.registrarPrecoReferencia(payload || {}); }
 catch (e) { return _erro('uiRegistrarPrecoManual', e); }
 }

 function uiSalvarCompra(payload) {
 try { return CompraService.salvarCompra(payload || {}); }
 catch (e) { return _erro('uiSalvarCompra', e); }
 }

 function uiSalvarVenda(payload) {
 try { return VendaService.salvarVenda(payload || {}); }
 catch (e) { return _erro('uiSalvarVenda', e); }
 }

 function uiRegistrarAberturaPokemon(payload) {
 try {
 payload = payload || {};
 // Compatibilidade: se vier idProduto, escolhe o lote mais antigo (FIFO)
 // automaticamente. Se vier idLoteOrigem (uso legado/manual), respeita.
 if (payload.idProduto && !payload.idLoteOrigem) {
 return EstoqueService.registrarAberturaPorProduto(payload);
 }
 return EstoqueService.registrarAbertura(payload);
 }
 catch (e) { return _erro('uiRegistrarAberturaPokemon', e); }
 }

 function uiListarProdutosFracionaveis() {
 try {
 var produtos = _lerObjetos(CONFIG.ABAS.PRODUTOS_ATIVOS)
 .filter(function(p) {
 return Utils.normalizar(p[C_PROD.ATIVO] || '') === 'Sim' &&
 Utils.normalizar(p[C_PROD.FRACIONAVEL] || '') === 'Sim';
 })
 .map(function(p) {
 return {
 idProduto: p[C_PROD.ID_PRODUTO],
 nomeProduto: p[C_PROD.NOME_PRODUTO],
 colecaoJogo: p[C_PROD.COLECAO_JOGO] || ''
 };
 });
 return _ok({ produtos: produtos });
 } catch (e) { return _erro('uiListarProdutosFracionaveis', e); }
 }

 /**
 * BLOQUEADO PROPOSITALMENTE (v1.6.1): aporte/resgate de capital genérico,
 * sem vínculo com um sócio, não é mais permitido pela tela. Toda entrada
 * de capital é aporte de um sócio (ver uiRegistrarAporteSocio) e toda
 * saída é retirada de um sócio (ver uiSolicitarRetirada) — isso mantém
 * Socios/Historico_Participacoes como fonte única da verdade sobre quem
 * tem quanto na empresa. A função de backend continua existindo (chamada
 * internamente por SociosService para espelhar em Aportes_Resgates), só
 * a porta de entrada direta pela UI é que foi fechada.
 */
 function uiRegistrarAporte(payload) {
 return { sucesso: false, erro: 'Aporte de capital deve ser feito na tela Sócios, vinculado a um sócio específico.' };
 }

 function uiRegistrarResgate(payload) {
 return { sucesso: false, erro: 'Retirada de capital deve ser feita na tela Sócios, vinculada a um sócio específico.' };
 }

 function uiRegistrarDespesa(payload) {
 try { return FinanceiroService.registrarDespesa(payload || {}); }
 catch (e) { return _erro('uiRegistrarDespesa', e); }
 }

 function uiListarDespesas(limite) {
 try { return _ok({ despesas: FinanceiroService.listarDespesas(limite || 50) }); }
 catch (e) { return _erro('uiListarDespesas', e); }
 }

 function uiObterResumoFinanceiro(filtros) {
 try { return FinanceiroService.calcularResumoFinanceiro(filtros || {}); }
 catch (e) { return _erro('uiObterResumoFinanceiro', e); }
 }

 function uiObterUltimosLogs(limite) {
 try {
 limite = limite || 20;
 var logs = _lerObjetos(CONFIG.ABAS.LOGS_SISTEMA).slice(-limite).reverse().map(function(l) {
 return {
 dataHora: l[C_LOG.DATA_HORA],
 modulo: l[C_LOG.MODULO],
 operacao: l[C_LOG.OPERACAO],
 severidade: l[C_LOG.SEVERIDADE],
 mensagem: l[C_LOG.MENSAGEM],
 refId: l[C_LOG.REF_ID]
 };
 });
 return _ok({ logs: logs });
 } catch (e) { return _erro('uiObterUltimosLogs', e); }
 }

 function uiExecutarHealthCheck() {
 try {
 var validacao = ValidationService.validarSilencioso();
 var logs = LogService.contarPorSeveridade();
 return _ok({
 ambiente: CONFIG.AMBIENTE,
 versao: CONFIG.VERSAO,
 estruturaOk: validacao.ok,
 errosEstrutura: validacao.erros || [],
 logs: logs,
 contagens: {
 produtos: SheetService.contarLinhas(CONFIG.ABAS.PRODUTOS_ATIVOS),
 compras: SheetService.contarLinhas(CONFIG.ABAS.COMPRAS),
 vendas: SheetService.contarLinhas(CONFIG.ABAS.VENDAS),
 lotes: SheetService.contarLinhas(CONFIG.ABAS.LOTES_ESTOQUE)
 }
 });
 } catch (e) { return _erro('uiExecutarHealthCheck', e); }
 }

 // ============================================================
 // MÓDULO SOCIETÁRIO (v1.6.0)
 // ============================================================

 function uiListarSocios() {
 try {
 var socios = SociosService.listarSocios(false);
 var alerta = SociosService.verificarAlertaFaturamentoMEI();
 return _ok({ socios: socios, alertaMei: alerta, caixaLivre: SociosService.calcularCaixaLivre() });
 } catch (e) { return _erro('uiListarSocios', e); }
 }

 function uiCadastrarSocio(payload) {
 try { return SociosService.cadastrarSocio(payload || {}); }
 catch (e) { return _erro('uiCadastrarSocio', e); }
 }

 function uiRegistrarAporteSocio(payload) {
 try { return SociosService.registrarAporte(payload || {}); }
 catch (e) { return _erro('uiRegistrarAporteSocio', e); }
 }

 function uiListarAportesSocios() {
 try {
 var dados = SheetService.getDadosComoObjetos(CONFIG.ABAS.APORTES_SOCIOS);
 return _ok({ aportes: dados.slice(-50).reverse() });
 } catch (e) { return _erro('uiListarAportesSocios', e); }
 }

 function uiSolicitarRetirada(payload) {
 try { return SociosService.solicitarRetirada(payload || {}); }
 catch (e) { return _erro('uiSolicitarRetirada', e); }
 }

 function uiListarRetiradas() {
 try {
 var dados = SheetService.getDadosComoObjetos(CONFIG.ABAS.RETIRADAS);
 return _ok({ retiradas: dados.slice(-50).reverse() });
 } catch (e) { return _erro('uiListarRetiradas', e); }
 }

 /**
 * Visão geral consolidada (Dashboard): quanto cada sócio tem, capital
 * total da empresa, quanto está alocado em estoque vs quanto está livre
 * (caixa), lista de produtos e status/valor total do estoque.
 * Combina dados já calculados por SociosService e FinanceiroService —
 * não introduz nova fonte de verdade.
 */
 function uiObterDashboardGeral() {
 try {
 var socios = SociosService.listarSocios(false);
 var caixaLivre = SociosService.calcularCaixaLivre();
 var alertaMei = SociosService.verificarAlertaFaturamentoMEI();

 var carteira = uiObterCarteiraMercado({});
 var financeiro = FinanceiroService.calcularResumoFinanceiro({});

 var capitalTotalSocios = socios.reduce(function(acc, s) {
 return acc + (Number(s.totalAportado) || 0);
 }, 0);

 return _ok({
 socios: socios,
 caixaLivre: caixaLivre,
 alertaMei: alertaMei,
 capitalTotalSocios: capitalTotalSocios,
 totalProdutosCadastrados: SheetService.contarLinhas(CONFIG.ABAS.PRODUTOS_ATIVOS),
 carteira: carteira.resumo || {},
 produtosEstoque: (carteira.produtos || []).slice().sort(function(a, b) {
 return (b.valorMercadoTotal || 0) - (a.valorMercadoTotal || 0);
 }),
 financeiro: financeiro.totais || {},
 dataAtualizacao: Utils.timestamp()
 });
 } catch (e) { return _erro('uiObterDashboardGeral', e); }
 }

  /**
   * Série mensal dos últimos N meses, para os gráficos do Dashboard.
   *
   * Lê Vendas, Itens_Venda e Despesas uma única vez cada e agrega em
   * memória — não introduz nova fonte de verdade, apenas reorganiza por
   * mês o que VendaService e FinanceiroService já gravaram.
   *
   * Vendas canceladas são ignoradas. O lucro bruto vem de
   * Itens_Venda (já calculado na venda, com o custo FIFO do lote
   * consumido); o mês do item é o mês da venda a que ele pertence.
   *
   * @param {number} [meses] - Quantos meses retornar (default 12, máx 36).
   * @returns {{sucesso: boolean, meses: Array<Object>}}
   */
  function uiObterSerieMensal(meses) {
    try {
      var C_DESP = CONFIG.CAMPOS.DESPESAS;
      var qtd = Math.max(1, Math.min(36, Number(meses) || 12));

      var ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                   'jul', 'ago', 'set', 'out', 'nov', 'dez'];

      function chave(d) {
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
      }
      function dataDe(valor) {
        return Utils.parsarData(String(valor || '').split(' ')[0]);
      }

      // Esqueleto dos últimos `qtd` meses, do mais antigo para o mais
      // recente. Meses sem movimento ficam zerados em vez de sumir --
      // um buraco no gráfico esconderia justamente o mês parado.
      var hoje = new Date();
      var buckets = {};
      var serie = [];
      for (var i = qtd - 1; i >= 0; i--) {
        var d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        var k = chave(d);
        var bucket = {
          mes:           k,
          rotulo:        ABREV[d.getMonth()] + '/' + String(d.getFullYear()).slice(-2),
          faturamento:   0,
          lucroBruto:    0,
          despesas:      0,
          lucroLiquido:  0
        };
        buckets[k] = bucket;
        serie.push(bucket);
      }

      // Vendas: faturamento por mês + mapa ID Venda -> mês, usado logo
      // abaixo para atribuir o lucro de cada item ao mês certo.
      var mesPorVenda = {};
      SheetService.getDadosComoObjetos(CONFIG.ABAS.VENDAS).forEach(function(v) {
        var status = String(v[C_VENDA.STATUS] || '').toLowerCase();
        if (status === 'cancelada') return;
        var data = dataDe(v[C_VENDA.DATA_VENDA]);
        if (!data) return;
        var k = chave(data);
        mesPorVenda[v[C_VENDA.ID_VENDA]] = k;
        if (buckets[k]) buckets[k].faturamento += Number(v[C_VENDA.VALOR_BRUTO]) || 0;
      });

      SheetService.getDadosComoObjetos(CONFIG.ABAS.ITENS_VENDA).forEach(function(item) {
        var k = mesPorVenda[item[C_ITEM.ID_VENDA]];
        if (k && buckets[k]) buckets[k].lucroBruto += Number(item[C_ITEM.LUCRO_BRUTO]) || 0;
      });

      SheetService.getDadosComoObjetos(CONFIG.ABAS.DESPESAS).forEach(function(desp) {
        var data = dataDe(desp[C_DESP.DATA_DESPESA]);
        if (!data) return;
        var k = chave(data);
        if (buckets[k]) buckets[k].despesas += Number(desp[C_DESP.VALOR]) || 0;
      });

      serie.forEach(function(m) {
        m.faturamento  = Utils.arredondar(m.faturamento, 2);
        m.lucroBruto   = Utils.arredondar(m.lucroBruto, 2);
        m.despesas     = Utils.arredondar(m.despesas, 2);
        m.lucroLiquido = Utils.arredondar(m.lucroBruto - m.despesas, 2);
      });

      return _ok({ meses: serie });
    } catch (e) { return _erro('uiObterSerieMensal', e); }
  }


 return {
 abrirPortalMVP: abrirPortalMVP,
 include: include,
 uiObterResumoHome: uiObterResumoHome,
 uiListarProdutosAtivos: uiListarProdutosAtivos,
 uiListarProdutosFracionaveis: uiListarProdutosFracionaveis,
 uiConsultarEstoque: uiConsultarEstoque,
 uiObterCarteiraMercado: uiObterCarteiraMercado,
 uiAtualizarPrecosCarteira: uiAtualizarPrecosCarteira,
 uiBuscarPrecoProduto: uiBuscarPrecoProduto,
 uiRegistrarPrecoManual: uiRegistrarPrecoManual,
 uiSalvarCompra: uiSalvarCompra,
 uiSalvarVenda: uiSalvarVenda,
 uiRegistrarAberturaPokemon: uiRegistrarAberturaPokemon,
 uiRegistrarAporte: uiRegistrarAporte,
 uiRegistrarResgate: uiRegistrarResgate,
 uiRegistrarDespesa: uiRegistrarDespesa,
 uiListarDespesas: uiListarDespesas,
 uiObterResumoFinanceiro: uiObterResumoFinanceiro,
 uiObterUltimosLogs: uiObterUltimosLogs,
 uiExecutarHealthCheck: uiExecutarHealthCheck,
 uiListarSocios: uiListarSocios,
 uiCadastrarSocio: uiCadastrarSocio,
 uiRegistrarAporteSocio: uiRegistrarAporteSocio,
 uiListarAportesSocios: uiListarAportesSocios,
 uiSolicitarRetirada: uiSolicitarRetirada,
 uiListarRetiradas: uiListarRetiradas,
 uiObterDashboardGeral: uiObterDashboardGeral,
 uiObterSerieMensal: uiObterSerieMensal
 };

 })();

