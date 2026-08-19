/**
 * * 10_FinanceiroService.gs
 * ============================================================
 * Servico Financeiro Gerencial — MVP 1.5 Manus
 * ============================================================
 * Registra aportes, resgates e despesas operacionais, e calcula
 * resumo financeiro realizado sem alterar custo historico,
 * estoque, dashboards, triggers ou telas.
 *
 * Dependencias: 00_Config, 02_Utils, 03_SheetService,
 *               04_IdService, 14_LogService
 * ============================================================
 */

 var FinanceiroService = (function () {

 var ABA_CAPITAL = CONFIG.ABAS.APORTES_RESGATES;
 var ABA_DESPESAS = CONFIG.ABAS.DESPESAS;
 var ABA_VENDAS = CONFIG.ABAS.VENDAS;
 var ABA_ITENS_VENDA = CONFIG.ABAS.ITENS_VENDA;
 var ABA_COMPRAS = CONFIG.ABAS.COMPRAS;
 var ABA_LOTES = CONFIG.ABAS.LOTES_ESTOQUE;
 var ABA_LOGS = CONFIG.ABAS.LOGS_SISTEMA;

 var C_CAP = CONFIG.CAMPOS.APORTES_RESGATES;
 var C_DESP = CONFIG.CAMPOS.DESPESAS;
 var C_VENDA = CONFIG.CAMPOS.VENDAS;
 var C_ITEM = CONFIG.CAMPOS.ITENS_VENDA;
 var C_COMPRA = CONFIG.CAMPOS.COMPRAS;
 var C_LOTE = CONFIG.CAMPOS.LOTES_ESTOQUE;
 var C_LOG = CONFIG.CAMPOS.LOGS_SISTEMA;

 function _numero(valor) {
 return Utils.parsarMoeda(valor || 0);
 }

 function _normalizar(valor) {
 // Usa Utils.normalizarChave (trim + minúsculas + sem acento) para bater
 // com a normalização usada em PrecoReferenciaService/UiService — antes
 // esta função não removia acento, então "Pokemon TCG" (sem acento) podia
 // bater no filtro de estoque/preço mas não no financeiro.
 return Utils.normalizarChave(valor);
 }

 function _data(valor) {
 if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
 return Utils.parsarData(String(valor || '').split(' ')[0]);
 }

 function _entreDatas(valor, inicio, fim) {
 var data = _data(valor);
 if (!data) return false;
 if (inicio && data.getTime() < inicio.getTime()) return false;
 if (fim && data.getTime() > fim.getTime()) return false;
 return true;
 }

 function _cabecalhos(nomeAba) {
 return SheetService.getCabecalhos(nomeAba);
 }

 function _temCampo(cabecalhos, campo) {
 return cabecalhos.indexOf(campo) !== -1;
 }

 function _setSeExiste(linha, cabecalhos, campo, valor) {
 if (campo && _temCampo(cabecalhos, campo)) linha[campo] = valor;
 }

 function _filtrarPorCabecalho(nomeAba, linha) {
 var cabecalhos = _cabecalhos(nomeAba);
 var filtrada = {};
 Object.keys(linha).forEach(function(campo) {
 if (_temCampo(cabecalhos, campo)) filtrada[campo] = linha[campo];
 });
 return filtrada;
 }

 function _appendObjeto(nomeAba, linha) {
 var filtrada = _filtrarPorCabecalho(nomeAba, linha);
 return SheetService.appendLinha(nomeAba, filtrada);
 }

 function _erro(operacao, mensagem, idRequisicao) {
 LogService.warning('FinanceiroService', operacao, mensagem, idRequisicao || '');
 return {
 sucesso: false,
 id: null,
 erro: mensagem,
 detalhes: [mensagem]
 };
 }

 function _sucesso(operacao, mensagem, id, idRequisicao) {
 LogService.info('FinanceiroService', operacao, mensagem + ' | Financeiro registrado | Req: ' + (idRequisicao || ''), idRequisicao || id || '');
 return {
 sucesso: true,
 id: id,
 erro: null,
 detalhes: [mensagem]
 };
 }

 function _validarPayloadBase(payload, campoData, campoValor) {
 var erros = [];
 payload = payload || {};

 if (Utils.eVazio(payload.idRequisicao)) erros.push('ID Requisição é obrigatório.');
 if (Utils.eVazio(payload[campoData])) erros.push('Data é obrigatória.');
 else if (!_data(payload[campoData])) erros.push('Data inválida: ' + payload[campoData]);
 if (Utils.eVazio(payload.negocio)) erros.push('Negócio é obrigatório.');

 var valor = _numero(payload[campoValor]);
 if (isNaN(valor) || valor <= 0) erros.push('Valor deve ser maior que zero.');

 return { valido: erros.length === 0, erros: erros, valor: valor };
 }

 function _idRequisicaoJaProcessado(nomeAba, idRequisicao) {
 if (Utils.eVazio(idRequisicao)) return false;

 try {
 var cab = _cabecalhos(nomeAba);
 if (_temCampo(cab, 'ID Requisição')) {
 var registros = SheetService.buscarPorCampo(nomeAba, 'ID Requisição', idRequisicao);
 if (registros && registros.length > 0) return true;
 }
 } catch (e) {
 console.warn('[10_FinanceiroService] Falha ao verificar duplicidade em ' + nomeAba + ': ' + e.message);
 }

 try {
 // Fallback só usado quando a aba de destino não tem coluna "ID Requisição"
 // (ou a busca acima falhou tecnicamente). Checa Módulo+Severidade em vez
 // de um trecho fixo da mensagem de log — texto de mensagem pode mudar em
 // qualquer revisão futura e quebraria essa proteção silenciosamente.
 var logs = SheetService.buscarPorCampo(ABA_LOGS, C_LOG.REF_ID, idRequisicao);
 for (var i = 0; i < logs.length; i++) {
 var dados = logs[i].dados;
 if (String(dados[C_LOG.MODULO]) === 'FinanceiroService' &&
 String(dados[C_LOG.SEVERIDADE]) === 'INFO') {
 return true;
 }
 }
 } catch (le) {
 console.warn('[10_FinanceiroService] Falha ao verificar duplicidade em Logs: ' + le.message);
 }

 return false;
 }

 function _montarObservacaoCapital(payload) {
 var partes = [];
 if (!Utils.eVazio(payload.origem)) partes.push('Origem: ' + payload.origem);
 if (!Utils.eVazio(payload.observacao)) partes.push(payload.observacao);
 return partes.join(' | ');
 }

 function _registrarCapital(tipo, payload) {
 payload = payload || {};
 var operacao = tipo === 'Aporte' ? 'registrarAporte' : 'registrarResgate';
 var validacao = _validarPayloadBase(payload, 'data', 'valor');
 if (!validacao.valido) {
 return _erro(operacao, validacao.erros.join(' | '), payload.idRequisicao || '');
 }

 if (_idRequisicaoJaProcessado(ABA_CAPITAL, payload.idRequisicao)) {
 return _erro(operacao, 'Esta movimentação financeira já foi processada anteriormente. Código: ' + payload.idRequisicao, payload.idRequisicao);
 }

 var idCapital = IdService.gerarIdCapital();
 var cab = _cabecalhos(ABA_CAPITAL);
 var linha = {};
 linha[C_CAP.ID_CAPITAL] = idCapital;
 linha[C_CAP.DATA_CAPITAL] = payload.data;
 linha[C_CAP.TIPO] = tipo;
 linha[C_CAP.NEGOCIO] = payload.negocio;
 linha[C_CAP.VALOR] = validacao.valor;
 linha[C_CAP.OBSERVACAO] = _montarObservacaoCapital(payload);
 linha[C_CAP.DATA_REGISTRO] = Utils.timestamp();
 linha[C_CAP.USUARIO_REGISTRO] = Utils.usuarioAtivo();

 _setSeExiste(linha, cab, 'Origem', payload.origem || '');
 _setSeExiste(linha, cab, 'ID Requisição', payload.idRequisicao);

 try {
 _appendObjeto(ABA_CAPITAL, linha);
 return _sucesso(operacao, tipo + ' registrado: ' + idCapital + ' | Valor: ' + validacao.valor, idCapital, payload.idRequisicao);
 } catch (e) {
 LogService.error('FinanceiroService', operacao, 'Erro técnico ao registrar ' + tipo + ': ' + e.message, payload.idRequisicao);
 return { sucesso: false, id: null, erro: 'Erro técnico ao registrar ' + tipo + ': ' + e.message, detalhes: [e.message] };
 }
 }

 function registrarAporte(payload) {
 return _registrarCapital('Aporte', payload);
 }

 function registrarResgate(payload) {
 return _registrarCapital('Resgate', payload);
 }

 function registrarDespesa(payload) {
 payload = payload || {};
 var validacao = _validarPayloadBase(payload, 'data', 'valor');
 if (Utils.eVazio(payload.categoria)) validacao.erros.push('Categoria é obrigatória.');
 if (Utils.eVazio(payload.descricao)) validacao.erros.push('Descrição é obrigatória.');
 if (Utils.eVazio(payload.natureza)) {
 validacao.erros.push('Natureza (Fixa/Variável) é obrigatória.');
 } else if (!Utils.estaNaLista(payload.natureza, CONFIG.LISTAS.NATUREZA_DESPESA)) {
 validacao.erros.push('Natureza inválida. Use: ' + CONFIG.LISTAS.NATUREZA_DESPESA.join(', '));
 }
 validacao.valido = validacao.erros.length === 0;

 if (!validacao.valido) {
 return _erro('registrarDespesa', validacao.erros.join(' | '), payload.idRequisicao || '');
 }

 if (_idRequisicaoJaProcessado(ABA_DESPESAS, payload.idRequisicao)) {
 return _erro('registrarDespesa', 'Esta despesa já foi processada anteriormente. Código: ' + payload.idRequisicao, payload.idRequisicao);
 }

 var idDespesa = IdService.gerarIdDespesa();
 var cab = _cabecalhos(ABA_DESPESAS);
 var linha = {};
 linha[C_DESP.ID_DESPESA] = idDespesa;
 linha[C_DESP.DATA_DESPESA] = payload.data;
 linha[C_DESP.CATEGORIA] = payload.categoria;
 linha[C_DESP.NEGOCIO] = payload.negocio || 'Pokémon TCG';
 linha[C_DESP.VALOR] = validacao.valor;
 linha[C_DESP.DESCRICAO] = payload.descricao;
 linha[C_DESP.DATA_REGISTRO] = Utils.timestamp();
 linha[C_DESP.USUARIO_REGISTRO] = Utils.usuarioAtivo();

 _setSeExiste(linha, cab, C_DESP.NATUREZA, payload.natureza);
 _setSeExiste(linha, cab, 'Observação', payload.observacao || '');
 _setSeExiste(linha, cab, 'ID Requisição', payload.idRequisicao);

 try {
 _appendObjeto(ABA_DESPESAS, linha);
 } catch (e) {
 LogService.error('FinanceiroService', 'registrarDespesa', 'Erro técnico ao registrar despesa: ' + e.message, payload.idRequisicao);
 return { sucesso: false, id: null, erro: 'Erro técnico ao registrar despesa: ' + e.message, detalhes: [e.message] };
 }

 var resultado = _sucesso('registrarDespesa', 'Despesa registrada: ' + idDespesa + ' | Valor: ' + validacao.valor, idDespesa, payload.idRequisicao);

 // Despesa paga do próprio bolso de um sócio vira aporte automático dele
 // (regra de negócio: não existe reembolso separado, nem empréstimo de
 // sócio para a empresa). Roda depois da despesa já estar gravada; falha
 // aqui não desfaz a despesa, só fica em log para correção manual.
 if (!Utils.eVazio(payload.pagoDoBolsoPorSocio)) {
 try {
 if (typeof SociosService !== 'undefined' && SociosService.converterDespesaEmAporte_) {
 var resAporte = SociosService.converterDespesaEmAporte_(
 payload.pagoDoBolsoPorSocio, validacao.valor, idDespesa, payload.observacao || '');
 resultado.aporteConvertido = resAporte;
 if (!resAporte || !resAporte.sucesso) {
 LogService.error('FinanceiroService', 'registrarDespesa',
 'Despesa ' + idDespesa + ' marcada como paga do bolso, mas falhou ao converter em aporte: ' +
 (resAporte ? resAporte.erro : 'SociosService indisponível'), idDespesa);
 }
 }
 } catch (se) {
 LogService.error('FinanceiroService', 'registrarDespesa',
 'Falha ao converter despesa ' + idDespesa + ' em aporte de sócio: ' + se.message, idDespesa);
 }
 }

 return resultado;
 }

 function _passaFiltros(registro, campoNegocio, campoData, filtros) {
 if (filtros.negocio && _normalizar(registro[campoNegocio]) !== _normalizar(filtros.negocio)) return false;
 return _entreDatas(registro[campoData], filtros._dataInicio, filtros._dataFim);
 }

 function _somar(lista, campo) {
 var total = 0;
 lista.forEach(function(item) { total += _numero(item[campo]); });
 return Utils.arredondar(total, 2);
 }

 function _calcularCapital(filtros) {
 var registros = SheetService.getDadosComoObjetos(ABA_CAPITAL);
 var aportes = 0;
 var resgates = 0;

 registros.forEach(function(r) {
 if (!_passaFiltros(r, C_CAP.NEGOCIO, C_CAP.DATA_CAPITAL, filtros)) return;
 var tipo = _normalizar(r[C_CAP.TIPO]);
 var valor = _numero(r[C_CAP.VALOR]);
 if (tipo === 'aporte') aportes += valor;
 if (tipo === 'resgate') resgates += valor;
 });

 aportes = Utils.arredondar(aportes, 2);
 resgates = Utils.arredondar(resgates, 2);
 return {
 aportes: aportes,
 resgates: resgates,
 capitalLiquido: Utils.arredondar(aportes - resgates, 2)
 };
 }

 function _calcularDespesas(filtros) {
 var registros = SheetService.getDadosComoObjetos(ABA_DESPESAS);
 var despesas = 0;

 registros.forEach(function(r) {
 if (_passaFiltros(r, C_DESP.NEGOCIO, C_DESP.DATA_DESPESA, filtros)) {
 despesas += _numero(r[C_DESP.VALOR]);
 }
 });

 return Utils.arredondar(despesas, 2);
 }

 /**
 * Quebra as despesas do período em Fixas vs Variáveis, com base em
 * CONFIG.LISTAS.NATUREZA_DESPESA. Despesas sem natureza informada
 * (registros antigos ou aba sem a coluna ainda) entram em "semNatureza".
 */
 function _calcularDespesasPorNatureza(filtros) {
 var registros = SheetService.getDadosComoObjetos(ABA_DESPESAS);
 var resultado = { fixas: 0, variaveis: 0, semNatureza: 0 };

 var NATUREZA_FIXA = _normalizar(CONFIG.LISTAS.NATUREZA_DESPESA[0]); // 'Fixa'
 var NATUREZA_VARIAVEL = _normalizar(CONFIG.LISTAS.NATUREZA_DESPESA[1]); // 'Variável'

 registros.forEach(function(r) {
 if (!_passaFiltros(r, C_DESP.NEGOCIO, C_DESP.DATA_DESPESA, filtros)) return;
 var valor = _numero(r[C_DESP.VALOR]);
 var natureza = _normalizar(r[C_DESP.NATUREZA]);
 if (natureza === NATUREZA_FIXA) resultado.fixas += valor;
 else if (natureza === NATUREZA_VARIAVEL) resultado.variaveis += valor;
 else resultado.semNatureza += valor;
 });

 resultado.fixas = Utils.arredondar(resultado.fixas, 2);
 resultado.variaveis = Utils.arredondar(resultado.variaveis, 2);
 resultado.semNatureza = Utils.arredondar(resultado.semNatureza, 2);
 return resultado;
 }

 /**
 * Lista as despesas mais recentes (para exibição em tela), sem alterar
 * nenhum cálculo existente.
 * @param {number} limite
 */
 function listarDespesas(limite) {
 var registros = SheetService.getDadosComoObjetos(ABA_DESPESAS);
 limite = limite || 50;
 return registros.slice(-limite).reverse();
 }

 function _vendasFiltradas(filtros) {
 var vendas = SheetService.getDadosComoObjetos(ABA_VENDAS);
 var porId = {};
 var lista = [];

 vendas.forEach(function(v) {
 if (_passaFiltros(v, C_VENDA.NEGOCIO, C_VENDA.DATA_VENDA, filtros)) {
 porId[String(v[C_VENDA.ID_VENDA])] = true;
 lista.push(v);
 }
 });

 return { lista: lista, porId: porId };
 }

 function _calcularVendasEItens(filtros) {
 var vendas = _vendasFiltradas(filtros);
 var receitaBruta = _somar(vendas.lista, C_VENDA.VALOR_BRUTO);
 var receitaLiquida = _somar(vendas.lista, C_VENDA.VALOR_LIQUIDO);
 var itens = SheetService.getDadosComoObjetos(ABA_ITENS_VENDA);
 var custoVendido = 0;
 var lucroBruto = 0;

 itens.forEach(function(i) {
 var idVenda = String(i[C_ITEM.ID_VENDA]);
 if (!vendas.porId[idVenda]) return;
 custoVendido += _numero(i[C_ITEM.CUSTO_TOTAL_VENDIDO]);
 if (!Utils.eVazio(i[C_ITEM.LUCRO_BRUTO])) {
 lucroBruto += _numero(i[C_ITEM.LUCRO_BRUTO]);
 } else {
 lucroBruto += _numero(i[C_ITEM.VALOR_TOTAL_ITEM]) - _numero(i[C_ITEM.CUSTO_TOTAL_VENDIDO]);
 }
 });

 custoVendido = Utils.arredondar(custoVendido, 2);
 lucroBruto = Utils.arredondar(lucroBruto, 2);

 return {
 receitaBrutaVendas: receitaBruta,
 receitaLiquidaVendas: receitaLiquida,
 custoVendido: custoVendido,
 lucroBrutoRealizado: lucroBruto,
 lucroLiquidoRealizado: Utils.arredondar(receitaLiquida - custoVendido, 2)
 };
 }

 function _calcularCompras(filtros) {
 var compras = SheetService.getDadosComoObjetos(ABA_COMPRAS);
 var total = 0;

 compras.forEach(function(c) {
 if (_passaFiltros(c, C_COMPRA.NEGOCIO, C_COMPRA.DATA_COMPRA, filtros)) {
 total += _numero(c[C_COMPRA.CUSTO_TOTAL]);
 }
 });

 return Utils.arredondar(total, 2);
 }

 function _calcularEstoqueCusto(filtros) {
 var lotes = SheetService.getDadosComoObjetos(ABA_LOTES);
 var total = 0;

 lotes.forEach(function(l) {
 if (filtros.negocio && _normalizar(l[C_LOTE.NEGOCIO]) !== _normalizar(filtros.negocio)) return;
 var qtd = _numero(l[C_LOTE.QTD_DISPONIVEL]) + _numero(l[C_LOTE.QTD_HOLD]);
 var custoUnit = _numero(l[C_LOTE.CUSTO_UNIT]);
 total += qtd * custoUnit;
 });

 return Utils.arredondar(total, 2);
 }

 function calcularResumoFinanceiro(filtros) {
 filtros = filtros || {};
 filtros._dataInicio = filtros.dataInicio ? _data(filtros.dataInicio) : null;
 filtros._dataFim = filtros.dataFim ? _data(filtros.dataFim) : null;

 try {
 var capital = _calcularCapital(filtros);
 var despesas = _calcularDespesas(filtros);
 var despesasPorNatureza = _calcularDespesasPorNatureza(filtros);
 var vendas = _calcularVendasEItens(filtros);
 var totalCompras = _calcularCompras(filtros);
 var estoqueCusto = _calcularEstoqueCusto(filtros);
 var lucroAposDespesas = Utils.arredondar(vendas.lucroLiquidoRealizado - despesas, 2);
 var caixaTeorico = Utils.arredondar(capital.capitalLiquido - totalCompras + vendas.receitaLiquidaVendas - despesas, 2);

 var resumo = {
 sucesso: true,
 filtros: {
 negocio: filtros.negocio || '',
 dataInicio: filtros.dataInicio || '',
 dataFim: filtros.dataFim || ''
 },
 totais: {
 aportes: capital.aportes,
 resgates: capital.resgates,
 despesas: despesas,
 despesasFixas: despesasPorNatureza.fixas,
 despesasVariaveis: despesasPorNatureza.variaveis,
 despesasSemNatureza: despesasPorNatureza.semNatureza,
 capitalLiquido: capital.capitalLiquido,
 receitaRealizadaVendas: vendas.receitaBrutaVendas,
 receitaLiquidaVendas: vendas.receitaLiquidaVendas,
 custoVendido: vendas.custoVendido,
 lucroBrutoRealizado: vendas.lucroBrutoRealizado,
 lucroLiquidoRealizado: vendas.lucroLiquidoRealizado,
 lucroLiquidoAposDespesas: lucroAposDespesas,
 totalCompras: totalCompras,
 valorEstoquePeloCusto: estoqueCusto,
 caixaTeoricoAproximado: caixaTeorico
 },
 limitacoes: [
 'Caixa teórico aproximado usa capital líquido - compras + receita líquida de vendas - despesas.',
 'Valor de estoque usa custo histórico e quantidades disponíveis e em hold.',
 'Ganho/perda não realizada e preço de referência não entram no lucro realizado.'
 ],
 erro: null
 };

 LogService.info('FinanceiroService', 'calcularResumoFinanceiro', 'Resumo financeiro calculado', filtros.negocio || '');
 return resumo;
 } catch (e) {
 LogService.error('FinanceiroService', 'calcularResumoFinanceiro', 'Erro técnico ao calcular resumo: ' + e.message, filtros.negocio || '');
 return { sucesso: false, filtros: filtros, totais: {}, limitacoes: [], erro: e.message };
 }
 }

 return {
 registrarAporte: registrarAporte,
 registrarResgate: registrarResgate,
 registrarDespesa: registrarDespesa,
 listarDespesas: listarDespesas,
 calcularResumoFinanceiro: calcularResumoFinanceiro
 };

 })();

