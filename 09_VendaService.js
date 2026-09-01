/**
 * 09_VendaService.gs
 * ============================================================
 * Serviço de Venda — MVP 1.5 Manus
 * ============================================================
 * Registra venda operacional consumindo estoque por FIFO.
 * Escopo: validação, bloqueios, cálculo de custo/lucro, itens,
 * movimentos, atualização de lotes e logs. Sem telas HTML.
 *
 * Dependências: 00_Config, 02_Utils, 03_SheetService,
 *               04_IdService, 06_ProdutoService, 14_LogService
 * ============================================================
 */

var VendaService = (function () {

  var ABA_VENDAS    = CONFIG.ABAS.VENDAS;
  var ABA_ITENS     = CONFIG.ABAS.ITENS_VENDA;
  var ABA_LOTES     = CONFIG.ABAS.LOTES_ESTOQUE;
  var ABA_MOV       = CONFIG.ABAS.MOVIMENTOS_ESTOQUE;
  var ABA_LOGS      = CONFIG.ABAS.LOGS_SISTEMA;

  var C_VENDA = CONFIG.CAMPOS.VENDAS;
  var C_ITEM  = CONFIG.CAMPOS.ITENS_VENDA;
  var C_LOTE  = CONFIG.CAMPOS.LOTES_ESTOQUE;
  var C_MOV   = CONFIG.CAMPOS.MOVIMENTOS_ESTOQUE;
  var C_PROD  = CONFIG.CAMPOS.PRODUTOS_ATIVOS;
  var C_LOG   = CONFIG.CAMPOS.LOGS_SISTEMA;

  // Prefixo do log que marca uma venda efetivamente gravada. É o que a
  // verificação de duplicidade por log procura — qualquer outro log com a
  // mesma Referência ID (início da venda, erro de validação) não significa
  // que a venda existe. Alterar aqui e na mensagem de sucesso juntos.
  var MARCA_LOG_VENDA_REGISTRADA = 'Venda registrada:';

  var NEGOCIOS_VALIDOS = CONFIG.LISTAS.NEGOCIOS;

  function _normalizar(valor) {
    return Utils.normalizar(valor).toLowerCase();
  }

  function _numero(valor) {
    return Utils.parsarMoeda(valor || 0);
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

  function _mapaColunas(nomeAba) {
    var cabecalhos = _cabecalhos(nomeAba);
    var mapa = {};
    cabecalhos.forEach(function(c, i) {
      if (c) mapa[c] = i + 1;
    });
    return mapa;
  }

  function _appendObjetoSemLock(nomeAba, objeto) {
    var sheet = SheetService.getSheet(nomeAba);
    var linhaArray = SheetService.objetoParaLinha(nomeAba, objeto);
    sheet.appendRow(linhaArray);
    return sheet.getLastRow();
  }

  function _appendObjetosSemLock(nomeAba, objetos) {
    if (!objetos || objetos.length === 0) return 0;
    var sheet = SheetService.getSheet(nomeAba);
    var linhas = objetos.map(function(obj) {
      return SheetService.objetoParaLinha(nomeAba, obj);
    });
    var ultimaLinha = sheet.getLastRow();
    sheet.getRange(ultimaLinha + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
    return sheet.getLastRow();
  }

  function _atualizarCamposLinhaSemLock(nomeAba, numeroLinha, atualizacoes) {
    var sheet = SheetService.getSheet(nomeAba);
    var mapa = _mapaColunas(nomeAba);
    Object.keys(atualizacoes).forEach(function(campo) {
      if (mapa[campo]) {
        sheet.getRange(numeroLinha, mapa[campo]).setValue(atualizacoes[campo]);
      }
    });
  }

  function _erro(mensagem, detalhes, idRequisicao, operacaoLog) {
    LogService.warning('VendaService', operacaoLog || 'salvarVenda', mensagem, idRequisicao || '');
    return {
      sucesso: false,
      idVenda: null,
      idsItens: [],
      idsMov: [],
      erro: mensagem,
      detalhes: detalhes || [mensagem]
    };
  }

  function _idRequisicaoJaProcessado(idRequisicao) {
    if (Utils.eVazio(idRequisicao)) return false;

    try {
      var cabVendas = _cabecalhos(ABA_VENDAS);
      if (_temCampo(cabVendas, 'ID Requisição')) {
        var vendas = SheetService.buscarPorCampo(ABA_VENDAS, 'ID Requisição', idRequisicao);
        if (vendas && vendas.length > 0) return true;
      }
    } catch (e) {
      console.warn('[09_VendaService] Falha ao verificar duplicidade em Vendas: ' + e.message);
    }

    // Verificação secundária, para quando a aba Vendas não tem a coluna
    // 'ID Requisição': procura nos logs. Só vale o log de venda REGISTRADA.
    //
    // Antes esta checagem aceitava QUALQUER log com esta Referência ID — e
    // salvarVenda grava um log "Iniciando venda" com essa mesma referência
    // logo no começo, antes de chegar aqui. O resultado é que toda venda
    // encontrava o próprio log de início e se bloqueava como duplicada:
    // nenhuma venda conseguia ser salva. O log de erro de validação tinha o
    // mesmo efeito, envenenando o idRequisicao de uma tentativa que nunca
    // chegou a gravar nada.
    try {
      var logs = SheetService.buscarPorCampo(ABA_LOGS, C_LOG.REF_ID, idRequisicao);
      for (var i = 0; i < logs.length; i++) {
        var msg = String(logs[i].dados[C_LOG.MENSAGEM] || '');
        if (msg.indexOf(MARCA_LOG_VENDA_REGISTRADA) === 0) return true;
      }
    } catch (le) {
      console.warn('[09_VendaService] Falha ao verificar duplicidade em Logs: ' + le.message);
    }

    return false;
  }

  function _validarCabecalho(cabecalho) {
    var erros = [];
    if (Utils.eVazio(cabecalho.dataVenda)) {
      erros.push('Data da venda é obrigatória.');
    } else if (!Utils.parsarData(cabecalho.dataVenda)) {
      erros.push('Data da venda inválida: ' + cabecalho.dataVenda);
    }

    if (Utils.eVazio(cabecalho.negocio)) {
      erros.push('Negócio da venda é obrigatório.');
    } else if (!Utils.estaNaLista(cabecalho.negocio, NEGOCIOS_VALIDOS)) {
      erros.push('Negócio da venda inválido. Use: ' + NEGOCIOS_VALIDOS.join(', '));
    }

    var taxas = _numero(cabecalho.taxaVenda || cabecalho.taxas || 0);
    var frete = _numero(cabecalho.freteVenda || cabecalho.frete || 0);
    var desconto = _numero(cabecalho.descontoVenda || cabecalho.desconto || 0);
    if (isNaN(taxas) || taxas < 0) erros.push('Taxas da venda devem ser maior ou igual a zero.');
    if (isNaN(frete) || frete < 0) erros.push('Frete da venda deve ser maior ou igual a zero.');
    if (isNaN(desconto) || desconto < 0) erros.push('Desconto da venda deve ser maior ou igual a zero.');

    return { valido: erros.length === 0, erros: erros };
  }

  function _validarItens(itens, negocio) {
    var erros = [];
    var itensValidos = [];

    if (!itens || itens.length === 0) {
      return { valido: false, erros: ['Adicione pelo menos um item à venda.'], itens: [] };
    }

    for (var i = 0; i < itens.length; i++) {
      var item = itens[i];
      var idx = i + 1;

      if (Utils.eVazio(item.idProduto)) {
        erros.push('Item ' + idx + ': produto é obrigatório.');
        continue;
      }

      var validProd = ProdutoService.validarParaCompra(item.idProduto, negocio);
      if (!validProd.valido) {
        erros.push('Item ' + idx + ': ' + validProd.erro);
        continue;
      }

      var quantidade = parseInt(item.quantidade || 0, 10);
      if (isNaN(quantidade) || quantidade <= 0) {
        erros.push('Item ' + idx + ': quantidade vendida deve ser maior que zero.');
        continue;
      }

      var valorUnitarioVenda = _numero(item.valorUnitarioVenda);
      if (isNaN(valorUnitarioVenda) || valorUnitarioVenda <= 0) {
        erros.push('Item ' + idx + ': valor unitário de venda deve ser maior que zero.');
        continue;
      }

      itensValidos.push({
        indice: idx,
        idProduto: item.idProduto,
        produto: validProd.produto,
        quantidade: quantidade,
        valorUnitarioVenda: valorUnitarioVenda,
        observacao: item.observacao || ''
      });
    }

    return { valido: erros.length === 0, erros: erros, itens: itensValidos };
  }

  function _linhaDataSerial(valor) {
    if (valor instanceof Date) return valor.getTime();
    var parsed = Utils.paraData(valor);
    return parsed ? parsed.getTime() : 9999999999999;
  }

  function _carregarLotesProduto(idProduto) {
    var registros = SheetService.buscarPorCampo(ABA_LOTES, C_LOTE.ID_PRODUTO, idProduto);
    return registros.map(function(reg) {
      var l = reg.dados;
      return {
        linha: reg.linha,
        dados: l,
        idLote: l[C_LOTE.ID_LOTE],
        idProduto: l[C_LOTE.ID_PRODUTO],
        produto: l[C_LOTE.PRODUTO],
        negocio: l[C_LOTE.NEGOCIO],
        qtdDisponivel: parseFloat(l[C_LOTE.QTD_DISPONIVEL] || 0),
        qtdVendida: parseFloat(l[C_LOTE.QTD_VENDIDA] || 0),
        qtdHold: parseFloat(l[C_LOTE.QTD_HOLD] || 0),
        custoUnit: parseFloat(l[C_LOTE.CUSTO_UNIT] || 0),
        status: _normalizar(l[C_LOTE.STATUS] || ''),
        dataCriacao: l[C_LOTE.DATA_CRIACAO]
      };
    });
  }

  function _planejarFIFO(itens, idRequisicao) {
    var lotesPorProduto = {};
    var alocacoes = [];
    var erros = [];

    itens.forEach(function(item) {
      if (!lotesPorProduto[item.idProduto]) {
        var lotes = _carregarLotesProduto(item.idProduto);
        lotes.sort(function(a, b) {
          var da = _linhaDataSerial(a.dataCriacao);
          var db = _linhaDataSerial(b.dataCriacao);
          if (da !== db) return da - db;
          return a.linha - b.linha;
        });
        lotesPorProduto[item.idProduto] = lotes;
      }

      var todos = lotesPorProduto[item.idProduto];
      var bloqueadoHold = false;
      var restante = item.quantidade;

      for (var i = 0; i < todos.length && restante > 0; i++) {
        var lote = todos[i];
        if (lote.status === 'hold' || lote.qtdHold > 0) {
          bloqueadoHold = true;
          continue;
        }
        if (lote.status === 'encerrado') continue;
        if (lote.status !== 'disponível' && lote.status !== 'disponivel' && lote.status !== 'parcial') continue;
        if (lote.qtdDisponivel <= 0) continue;

        var consumir = Math.min(restante, lote.qtdDisponivel);
        var saldoAnterior = lote.qtdDisponivel;
        var saldoPosterior = Utils.arredondar(saldoAnterior - consumir, 4);
        var receitaBruta = Utils.arredondar(consumir * item.valorUnitarioVenda, 2);
        var custoVendido = Utils.arredondar(consumir * lote.custoUnit, 2);
        var lucroBruto = Utils.arredondar(receitaBruta - custoVendido, 2);

        alocacoes.push({
          item: item,
          lote: lote,
          quantidade: consumir,
          saldoAnterior: saldoAnterior,
          saldoPosterior: saldoPosterior,
          receitaBruta: receitaBruta,
          custoUnit: lote.custoUnit,
          custoVendido: custoVendido,
          lucroBruto: lucroBruto
        });

        lote.qtdDisponivel = saldoPosterior;
        lote.qtdVendida = Utils.arredondar(lote.qtdVendida + consumir, 4);
        restante = Utils.arredondar(restante - consumir, 4);
      }

      if (restante > 0) {
        if (bloqueadoHold) {
          erros.push('Item ' + item.indice + ': lote em Hold não pode ser vendido.');
          LogService.warning('VendaService', 'bloqueioHold', erros[erros.length - 1], idRequisicao || '');
        } else {
          erros.push('Item ' + item.indice + ': saldo disponível insuficiente para o produto ' + item.idProduto + '.');
          LogService.warning('VendaService', 'bloqueioSaldoInsuficiente', erros[erros.length - 1], idRequisicao || '');
        }
      }
    });

    return { valido: erros.length === 0, erros: erros, alocacoes: alocacoes };
  }

  function _montarVenda(idVenda, cabecalho, totais, idRequisicao) {
    var cab = _cabecalhos(ABA_VENDAS);
    var linha = {};
    linha[C_VENDA.ID_VENDA] = idVenda;
    linha[C_VENDA.DATA_VENDA] = cabecalho.dataVenda;
    linha[C_VENDA.NEGOCIO] = cabecalho.negocio;
    linha[C_VENDA.CLIENTE_CANAL] = cabecalho.cliente || cabecalho.clienteCanal || '';
    linha[C_VENDA.VALOR_BRUTO] = totais.receitaBruta;
    linha[C_VENDA.TAXAS] = totais.taxas;
    linha[C_VENDA.DESCONTO] = totais.desconto;
    linha[C_VENDA.VALOR_LIQUIDO] = totais.valorLiquido;
    linha[C_VENDA.STATUS] = 'Concluída';
    linha[C_VENDA.DATA_REGISTRO] = Utils.timestamp();
    linha[C_VENDA.USUARIO_REGISTRO] = Utils.usuarioAtivo();

    _setSeExiste(linha, cab, 'Frete Venda', totais.frete);
    _setSeExiste(linha, cab, 'Custo Total Vendido', totais.custoVendido);
    _setSeExiste(linha, cab, 'Lucro Bruto', totais.lucroBruto);
    _setSeExiste(linha, cab, 'Lucro Líquido', totais.lucroLiquido);
    _setSeExiste(linha, cab, 'Observação', cabecalho.observacao || '');
    _setSeExiste(linha, cab, 'ID Requisição', idRequisicao || '');

    return linha;
  }

  function _montarItemVenda(idItem, idVenda, alocacao) {
    var cab = _cabecalhos(ABA_ITENS);
    var item = alocacao.item;
    var lote = alocacao.lote;
    var margem = alocacao.receitaBruta > 0
      ? Utils.arredondar(alocacao.lucroBruto / alocacao.receitaBruta, 6)
      : 0;

    var linha = {};
    linha[C_ITEM.ID_ITEM] = idItem;
    linha[C_ITEM.ID_VENDA] = idVenda;
    linha[C_ITEM.NEGOCIO] = item.produto[C_PROD.NEGOCIO] || lote.negocio;
    linha[C_ITEM.ID_LOTE] = lote.idLote;
    linha[C_ITEM.ID_PRODUTO] = item.idProduto;
    linha[C_ITEM.PRODUTO] = item.produto[C_PROD.NOME_PRODUTO] || lote.produto || '';
    linha[C_ITEM.QTD_VENDIDA] = alocacao.quantidade;
    linha[C_ITEM.PRECO_UNIT_VENDA] = item.valorUnitarioVenda;
    linha[C_ITEM.VALOR_TOTAL_ITEM] = alocacao.receitaBruta;
    linha[C_ITEM.CUSTO_UNIT_LOTE] = alocacao.custoUnit;
    linha[C_ITEM.CUSTO_TOTAL_VENDIDO] = alocacao.custoVendido;
    linha[C_ITEM.LUCRO_BRUTO] = alocacao.lucroBruto;
    linha[C_ITEM.MARGEM] = margem;

    _setSeExiste(linha, cab, 'Observação Item', item.observacao || '');
    _setSeExiste(linha, cab, 'Data Registro', Utils.timestamp());
    _setSeExiste(linha, cab, 'Usuário Registro', Utils.usuarioAtivo());

    return linha;
  }

  function _montarMovimento(idMov, dataVenda, idItemVenda, alocacao) {
    var cab = _cabecalhos(ABA_MOV);
    var item = alocacao.item;
    var lote = alocacao.lote;
    var linha = {};
    linha[C_MOV.ID_MOVIMENTO] = idMov;
    linha[C_MOV.DATA_MOVIMENTO] = dataVenda;
    linha[C_MOV.TIPO_MOVIMENTO] = 'Venda';
    linha[C_MOV.ID_LOTE] = lote.idLote;
    linha[C_MOV.PRODUTO] = item.produto[C_PROD.NOME_PRODUTO] || lote.produto || '';
    linha[C_MOV.NEGOCIO] = item.produto[C_PROD.NEGOCIO] || lote.negocio;
    linha[C_MOV.QTD_MOVIMENTO] = alocacao.quantidade;
    linha[C_MOV.SALDO_ANTERIOR] = alocacao.saldoAnterior;
    linha[C_MOV.SALDO_POSTERIOR] = alocacao.saldoPosterior;
    linha[C_MOV.REF_OPERACAO] = idItemVenda;
    linha[C_MOV.DATA_REGISTRO] = Utils.timestamp();
    linha[C_MOV.USUARIO_REGISTRO] = Utils.usuarioAtivo();

    _setSeExiste(linha, cab, 'ID Produto', item.idProduto);
    _setSeExiste(linha, cab, 'Observação', item.observacao || '');

    return linha;
  }

  function _montarAtualizacoesLotes(alocacoes) {
    var porLote = {};
    alocacoes.forEach(function(a) {
      var id = a.lote.idLote;
      if (!porLote[id]) {
        porLote[id] = {
          linha: a.lote.linha,
          qtdDisponivelFinal: a.saldoPosterior,
          qtdVendidaFinal: a.lote.qtdVendida
        };
      } else {
        porLote[id].qtdDisponivelFinal = a.saldoPosterior;
        porLote[id].qtdVendidaFinal = a.lote.qtdVendida;
      }
    });
    return porLote;
  }

  function _totais(cabecalho, alocacoes) {
    var receitaBruta = 0;
    var custoVendido = 0;
    var lucroBruto = 0;
    alocacoes.forEach(function(a) {
      receitaBruta += a.receitaBruta;
      custoVendido += a.custoVendido;
      lucroBruto += a.lucroBruto;
    });

    var taxas = _numero(cabecalho.taxaVenda || cabecalho.taxas || 0);
    var frete = _numero(cabecalho.freteVenda || cabecalho.frete || 0);
    var desconto = _numero(cabecalho.descontoVenda || cabecalho.desconto || 0);
    var valorLiquido = Utils.arredondar(receitaBruta - taxas - frete - desconto, 2);
    var lucroLiquido = Utils.arredondar(receitaBruta - custoVendido - taxas - frete - desconto, 2);

    return {
      receitaBruta: Utils.arredondar(receitaBruta, 2),
      custoVendido: Utils.arredondar(custoVendido, 2),
      lucroBruto: Utils.arredondar(lucroBruto, 2),
      taxas: taxas,
      frete: frete,
      desconto: desconto,
      valorLiquido: valorLiquido,
      lucroLiquido: lucroLiquido
    };
  }

  function salvarVenda(payload) {
    payload = payload || {};
    var idRequisicao = payload.idRequisicao || Utils.uuid();
    var cabecalho = payload.cabecalho || {};
    var itens = payload.itens || [];

    LogService.info('VendaService', 'salvarVenda', 'Iniciando venda. Req: ' + idRequisicao, idRequisicao);

    var valCab = _validarCabecalho(cabecalho);
    if (!valCab.valido) return _erro(valCab.erros.join(' | '), valCab.erros, idRequisicao, 'validarCabecalho');

    var valItens = _validarItens(itens, cabecalho.negocio);
    if (!valItens.valido) return _erro(valItens.erros.join(' | '), valItens.erros, idRequisicao, 'validarItens');

    // A checagem de duplicidade e o planejamento FIFO (que decide quanto
    // consumir de cada lote) rodam DENTRO do lock: se ficassem antes, duas
    // vendas concorrentes do mesmo produto poderiam planejar a partir do
    // mesmo saldo e a segunda gravaria por cima com dado desatualizado,
    // permitindo vender mais do que o estoque real (`return` dentro do
    // `try` ainda passa pelo `finally`, então o lock é sempre liberado).
    var idVenda, idsItens = [], idsMov = [], totais, plano;
    var lock = LockService.getDocumentLock();
    try {
      lock.waitLock(15000);

      if (_idRequisicaoJaProcessado(idRequisicao)) {
        return _erro('Esta venda já foi processada anteriormente. Código: ' + idRequisicao,
          [], idRequisicao, 'bloqueioDuplicidade');
      }

      plano = _planejarFIFO(valItens.itens, idRequisicao);
      if (!plano.valido) return _erro(plano.erros.join(' | '), plano.erros, idRequisicao, 'planejarFIFO');

      totais = _totais(cabecalho, plano.alocacoes);
      if (totais.valorLiquido < 0) {
        return _erro('Taxas, frete e desconto excedem a receita bruta da venda.', [], idRequisicao, 'validarTotais');
      }

      idVenda = IdService.gerarIdVenda();
      var linhasItens = [];
      var linhasMov = [];

      for (var i = 0; i < plano.alocacoes.length; i++) {
        var idItem = IdService.gerarIdItemVenda();
        var idMov = IdService.gerarIdMovimento();
        idsItens.push(idItem);
        idsMov.push(idMov);
        linhasItens.push(_montarItemVenda(idItem, idVenda, plano.alocacoes[i]));
        linhasMov.push(_montarMovimento(idMov, cabecalho.dataVenda, idItem, plano.alocacoes[i]));
      }

      var linhaVenda = _montarVenda(idVenda, cabecalho, totais, idRequisicao);
      var updatesLotes = _montarAtualizacoesLotes(plano.alocacoes);

      _appendObjetoSemLock(ABA_VENDAS, linhaVenda);
      _appendObjetosSemLock(ABA_ITENS, linhasItens);
      _appendObjetosSemLock(ABA_MOV, linhasMov);

      Object.keys(updatesLotes).forEach(function(idLote) {
        var u = updatesLotes[idLote];
        var novoStatus = u.qtdDisponivelFinal <= 0 ? 'Encerrado' : 'Disponível';
        var atualizacoes = {};
        atualizacoes[C_LOTE.QTD_DISPONIVEL] = u.qtdDisponivelFinal;
        atualizacoes[C_LOTE.QTD_VENDIDA] = u.qtdVendidaFinal;
        atualizacoes[C_LOTE.STATUS] = novoStatus;
        atualizacoes['Saldo Atual'] = u.qtdDisponivelFinal;
        _atualizarCamposLinhaSemLock(ABA_LOTES, u.linha, atualizacoes);
      });

    } catch (e) {
      LogService.error('VendaService', 'salvarVenda', 'Erro técnico ao gravar venda: ' + e.message, idRequisicao);
      return {
        sucesso: false,
        idVenda: null,
        idsItens: [],
        idsMov: [],
        erro: 'Erro técnico ao gravar venda: ' + e.message,
        detalhes: [e.message]
      };
    } finally {
      try { lock.releaseLock(); } catch (le) {}
    }

    LogService.info('VendaService', 'salvarVenda',
      MARCA_LOG_VENDA_REGISTRADA + ' ' + idVenda + ' | Itens: ' + idsItens.length + ' | Req: ' + idRequisicao,
      idRequisicao);

    // Reconhecimento de lucro por sócio (módulo societário, v1.6.0).
    // Roda após a venda estar gravada; falha aqui não desfaz a venda,
    // apenas fica registrada em log para correção manual posterior.
    try {
      if (typeof SociosService !== 'undefined' && SociosService.reconhecerLucroDaVenda) {
        var itensParaSocios = plano.alocacoes.map(function(aloc, idx) {
          return { idItemVenda: idsItens[idx], lucroBrutoItem: aloc.lucroBruto };
        });
        SociosService.reconhecerLucroDaVenda(idVenda, cabecalho.dataVenda, itensParaSocios);
      }
    } catch (se) {
      LogService.error('VendaService', 'salvarVenda',
        'Falha ao reconhecer lucro por sócio: ' + se.message, idVenda);
    }

    return {
      sucesso: true,
      idVenda: idVenda,
      idsItens: idsItens,
      idsMov: idsMov,
      erro: null,
      detalhes: [
        'Venda: ' + idVenda,
        'Itens venda: ' + idsItens.join(', '),
        'Movimentos: ' + idsMov.join(', ')
      ],
      totais: totais
    };
  }

  return {
    salvarVenda: salvarVenda
  };

})();
