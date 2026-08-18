/**
 * * ============================================================
 * 00_Config.gs — Configurações Globais do Sistema
 * MVP 1.5 — Sistema de Gestão Pokémon TCG + Sócios
 * ============================================================
 * Centraliza nomes de abas, cabeçalhos críticos, parâmetros,
 * constantes de ambiente e valores default.
 *
 * REGRA: Nenhum outro módulo deve usar strings literais de
 * nomes de abas ou campos. Sempre referenciar via CONFIG.
 *
 * Versão: 1.6.0
 * Ambiente: HML
 *
 * NOTA (migração v1.6.0): CS Skins foi removido do escopo do
 * projeto. Negócio, Trade Lock e fontes de preço específicas
 * de CS Skins (BUFF163, Steam) foram descontinuados. O sistema
 * opera exclusivamente Pokémon TCG + módulo societário (sócios,
 * aportes, participação, retiradas).
 * ============================================================
 */

 // ============================================================
 // IDENTIFICAÇÃO DO SISTEMA
 // ============================================================
 var CONFIG = {

 // --- Versão e Ambiente ---
 VERSAO: 'v1.6.0',
 AMBIENTE: 'HML',           // HML | PROD
 TIMEZONE: 'America/Sao_Paulo',
 SISTEMA_NOME: 'Gestão Pokémon TCG',

 // ============================================================
 // NOMES DAS ABAS (20 abas: 16 oficiais + 4 auxiliares)
 // ============================================================
 ABAS: {
 // --- Abas Oficiais (16) ---
 DASHBOARD:              'Dashboard',
 RESUMO_CAPITAL_LUCRO:   'Resumo_Capital_Lucro',
 MAPA_SALDOS:            'Mapa_Saldos_Patrimonio',
 PRODUTOS_ATIVOS:        'Produtos_Ativos',
 COMPRAS:                'Compras',
 ITENS_COMPRA:           'Itens_Compra',
 VENDAS:                 'Vendas',
 ITENS_VENDA:            'Itens_Venda',
 LOTES_ESTOQUE:          'Lotes_Estoque',
 MOVIMENTOS_ESTOQUE:     'Movimentos_Estoque',
 POKEMON_ABERTURA_BOX:   'Pokemon_Abertura_Box',
 APORTES_RESGATES:       'Aportes_Resgates',
 DESPESAS:               'Despesas',
 REFERENCIAS_PRECO:      'Referencias_Preco',
 CONFIGURACOES:          'Configuracoes',
 EXEMPLOS_TESTE:         'Exemplos_Teste',

 // --- Módulo Societário (novo em v1.6.0) ---
 SOCIOS:                 'Socios',
 APORTES_SOCIOS:         'Aportes_Socios',
 HISTORICO_PARTICIPACOES:'Historico_Participacoes',
 RETIRADAS:              'Retiradas',
 LUCRO_POR_ITEM_SOCIO:   'Lucro_Por_Item_Socio',
 RESUMO_SOCIOS:          'Resumo_Socios',

 // --- Abas Auxiliares (4) — ocultas e protegidas ---
 LOGS_SISTEMA:           'Logs_Sistema',
 CONFIG_APP:             'Config_App',
 EXECUCOES_TESTES:       'Execucoes_Testes',
 ERROS_SISTEMA:          'Erros_Sistema'
 },

 // ============================================================
 // CABEÇALHOS CRÍTICOS POR ABA
 // Apenas os campos mais usados em lógica de negócio.
 // ============================================================
 CAMPOS: {

 PRODUTOS_ATIVOS: {
 ID_PRODUTO:           'ID Produto',
 NEGOCIO:              'Negócio',
 NOME_PRODUTO:         'Nome Produto',
 TIPO_MODELO:          'Tipo / Modelo',
 COLECAO_JOGO:         'Coleção / Jogo',
 ESTADO_CONDICAO:      'Estado / Condição',
 UNIDADE_CONTROLE:     'Unidade de Controle',
 FRACIONAVEL:          'Produto Fracionável?',
 QTD_GERADA_PADRAO:    'Quantidade Gerada Padrão',
 PRODUTO_GERADO:       'Produto Gerado Padrão',
 ATIVO:                'Ativo?',
 CHAVE_PRODUTO:        'Chave Produto',
 PAIS_REGIAO:          'País / Região',
 IDIOMA:               'Idioma',
 MERCADO_REFERENCIA:   'Mercado Referência',
 FONTE_PRECO_PREFERENCIAL: 'Fonte Preço Preferencial',
 DATA_CRIACAO:         'Data Criação',
 USUARIO_CRIACAO:      'Usuário Criação'
 },

 COMPRAS: {
 ID_COMPRA:            'ID Compra',
 DATA_COMPRA:          'Data Compra',
 NEGOCIO:              'Negócio',
 FORNECEDOR:           'Fornecedor / Origem',
 VALOR_PRODUTOS:       'Valor Produtos',
 FRETE:                'Frete Compra',
 TAXAS:                'Taxas Compra',
 DESCONTO:             'Desconto',
 CUSTO_TOTAL:          'Custo Total Compra',
 STATUS:               'Status Compra',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 ITENS_COMPRA: {
 ID_ITEM:              'ID Item Compra',
 ID_COMPRA:            'ID Compra',
 NEGOCIO:              'Negócio',
 ID_PRODUTO:           'ID Produto',
 PRODUTO:              'Produto',
 QUANTIDADE:           'Quantidade',
 VALOR_UNIT_BRUTO:     'Valor Unitário Bruto',
 VALOR_TOTAL_BRUTO:    'Valor Total Bruto',
 PARTICIPACAO_RATEIO:  'Participação Rateio',
 CUSTO_ADICIONAL:      'Custo Adicional Rateado',
 CUSTO_UNIT_FINAL:     'Custo Unitário Final',
 CUSTO_TOTAL_FINAL:    'Custo Total Final',
 ID_LOTE_GERADO:       'ID Lote Gerado',
 STATUS:               'Status Item Compra'
 },

 VENDAS: {
 ID_VENDA:             'ID Venda',
 DATA_VENDA:           'Data Venda',
 NEGOCIO:              'Negócio',
 CLIENTE_CANAL:        'Cliente / Canal',
 VALOR_BRUTO:          'Valor Bruto Venda',
 TAXAS:                'Taxas Venda',
 DESCONTO:             'Desconto Venda',
 VALOR_LIQUIDO:        'Valor Líquido Venda',
 STATUS:               'Status Venda',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 ITENS_VENDA: {
 ID_ITEM:              'ID Item Venda',
 ID_VENDA:             'ID Venda',
 NEGOCIO:              'Negócio',
 ID_LOTE:              'ID Lote Consumido',
 ID_PRODUTO:           'ID Produto',
 PRODUTO:              'Produto',
 QTD_VENDIDA:          'Quantidade Vendida',
 PRECO_UNIT_VENDA:     'Preço Unitário Venda',
 VALOR_TOTAL_ITEM:     'Valor Total Venda Item',
 CUSTO_UNIT_LOTE:      'Custo Unitário do Lote',
 CUSTO_TOTAL_VENDIDO:  'Custo Total Vendido',
 LUCRO_BRUTO:          'Lucro Bruto Item',
 MARGEM:               'Margem Item'
 },

 LOTES_ESTOQUE: {
 ID_LOTE:              'ID Lote',
 ID_PRODUTO:           'ID Produto',
 PRODUTO:              'Produto',
 NEGOCIO:              'Negócio',
 TIPO_ORIGEM:          'Tipo Origem',
 ID_ORIGEM:            'ID Origem',
 ID_ITEM_ORIGEM:       'ID Item Origem',
 QTD_TOTAL:            'Quantidade Total',
 QTD_DISPONIVEL:       'Quantidade Disponível',
 QTD_HOLD:             'Quantidade em Hold',
 QTD_VENDIDA:          'Quantidade Vendida',
 QTD_TRANSFORMADA:     'Quantidade Transformada',
 CUSTO_UNIT:           'Custo Unitário Histórico',
 CUSTO_TOTAL:          'Custo Total',
 VLR_MERCADO_UNIT:     'Valor Mercado Unitário',
 VLR_MERCADO_TOTAL:    'Valor Mercado Total',
 GANHO_PERDA:          'Ganho/Perda Não Realizada',
 STATUS:               'Status Lote',
 DATA_CRIACAO:         'Data Criação'
 },

 MOVIMENTOS_ESTOQUE: {
 ID_MOVIMENTO:         'ID Movimento',
 DATA_MOVIMENTO:       'Data Movimento',
 TIPO_MOVIMENTO:       'Tipo Movimento',
 ID_LOTE:              'ID Lote',
 PRODUTO:              'Produto',
 NEGOCIO:              'Negócio',
 QTD_MOVIMENTO:        'Quantidade Movimento',
 SALDO_ANTERIOR:       'Saldo Anterior',
 SALDO_POSTERIOR:      'Saldo Posterior',
 REF_OPERACAO:         'Referência Operação',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 POKEMON_ABERTURA_BOX: {
 ID_ABERTURA:          'ID Abertura',
 DATA_ABERTURA:        'Data Abertura',
 ID_LOTE_ORIGEM:       'ID Lote Origem',
 PRODUTO_ORIGEM:       'Produto Origem',
 QTD_ABERTA:           'Quantidade Aberta',
 CUSTO_UNIT_ORIGEM:    'Custo Unitário Origem',
 CUSTO_TOTAL_CONSUMIDO:'Custo Total Consumido',
 ID_LOTE_DESTINO:      'ID Lote Destino',
 PRODUTO_DESTINO:      'Produto Destino',
 QTD_GERADA_POR_UNIT:  'Quantidade Gerada por Unidade',
 QTD_TOTAL_GERADA:     'Quantidade Total Gerada',
 CUSTO_UNIT_DESTINO:   'Custo Unitário Destino',
 STATUS:               'Status Abertura',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 APORTES_RESGATES: {
 ID_CAPITAL:           'ID Capital',
 DATA_CAPITAL:         'Data Capital',
 TIPO:                 'Tipo',
 NEGOCIO:              'Negócio',
 VALOR:                'Valor',
 OBSERVACAO:           'Observação',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 DESPESAS: {
 ID_DESPESA:           'ID Despesa',
 DATA_DESPESA:         'Data Despesa',
 CATEGORIA:            'Categoria',
 NATUREZA:             'Natureza (Fixa/Variável)',
 NEGOCIO:              'Negócio',
 VALOR:                'Valor',
 DESCRICAO:            'Descrição',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 REFERENCIAS_PRECO: {
 ID_REF:               'ID Referência',
 DATA_REF:             'Data Referência',
 ID_PRODUTO:           'ID Produto',
 PRODUTO:              'Produto',
 NEGOCIO:              'Negócio',
 ESTADO_CONDICAO:      'Estado / Condição',
 PRECO_UNIT:           'Preço Unitário',
 PRECO_USADO:          'Preço Usado pelo Sistema',
 FONTE:                'Fonte',
 LINK_REF:             'Link Referência',
 STATUS_PRECO:         'Status Preço',
 DIAS_ATUALIZACAO:     'Dias desde Atualização',
 CHAVE_PRECO:          'Chave Preço',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 CONFIGURACOES: {
 PARAMETRO:            'Parâmetro',
 VALOR:                'Valor',
 TIPO:                 'Tipo',
 DESCRICAO:            'Descrição',
 ATIVO:                'Ativo?'
 },

 LOGS_SISTEMA: {
 ID_LOG:               'ID Log',
 DATA_HORA:            'Data/Hora',
 USUARIO:              'Usuário',
 MODULO:               'Módulo',
 OPERACAO:             'Operação',
 SEVERIDADE:           'Severidade',
 MENSAGEM:             'Mensagem',
 REF_ID:               'Referência ID'
 },

 CONFIG_APP: {
 PARAMETRO:            'Parâmetro',
 VALOR:                'Valor',
 TIPO:                 'Tipo',
 DESCRICAO:            'Descrição'
 },

 EXECUCOES_TESTES: {
 ID_EXEC:              'ID Execução',
 DATA_EXEC:            'Data Execução',
 TESTE_ID:             'Teste ID',
 OBJETIVO:             'Objetivo',
 PRE_CONDICAO:         'Pré-condição',
 MASSA_DADOS:          'Massa Dados',
 PASSOS:               'Passos',
 RESULTADO_ESPERADO:   'Resultado Esperado',
 RESULTADO_OBTIDO:     'Resultado Obtido',
 EVIDENCIA:            'Evidência',
 STATUS:               'Status',
 CORRECAO:             'Correção',
 RETESTE:              'Reteste'
 },

 ERROS_SISTEMA: {
 ID_ERRO:              'ID Erro',
 DATA_HORA:            'Data/Hora',
 MODULO:               'Módulo',
 TIPO_ERRO:            'Tipo Erro',
 MENSAGEM:             'Mensagem',
 STACK_TRACE:          'Stack Trace',
 REF_ID:               'Referência ID',
 STATUS_RESOLUCAO:     'Status Resolução'
 },

 // --- Abas de Resumo / Dashboard (cabeçalhos mínimos para validação) ---
 DASHBOARD: {
 NEGOCIO:              'Negócio',
 CAPITAL_TOTAL:        'Capital Total',
 PATRIMONIO_TOTAL:     'Patrimônio Total',
 LUCRO_REALIZADO:      'Lucro Realizado',
 LUCRO_NAO_REALIZADO:  'Lucro Não Realizado',
 TOTAL_COMPRAS:        'Total Compras',
 TOTAL_VENDAS:         'Total Vendas',
 TOTAL_DESPESAS:       'Total Despesas',
 DATA_ATUALIZACAO:     'Data Atualização'
 },

 RESUMO_CAPITAL_LUCRO: {
 NEGOCIO:              'Negócio',
 CAPITAL_APORTADO:     'Capital Aportado',
 CAPITAL_RESGATADO:    'Capital Resgatado',
 CAPITAL_LIQUIDO:      'Capital Líquido',
 CUSTO_TOTAL_COMPRAS:  'Custo Total Compras',
 RECEITA_TOTAL_VENDAS: 'Receita Total Vendas',
 LUCRO_BRUTO:          'Lucro Bruto',
 DESPESAS_TOTAIS:      'Despesas Totais',
 LUCRO_LIQUIDO:        'Lucro Líquido',
 DATA_ATUALIZACAO:     'Data Atualização'
 },

 MAPA_SALDOS: {
 NEGOCIO:              'Negócio',
 PRODUTO:              'Produto',
 QTD_DISPONIVEL:       'Quantidade Disponível',
 QTD_HOLD:             'Quantidade em Hold',
 CUSTO_TOTAL:          'Custo Total',
 VLR_MERCADO_TOTAL:    'Valor Mercado Total',
 GANHO_PERDA:          'Ganho/Perda Não Realizada',
 DATA_ATUALIZACAO:     'Data Atualização'
 },

 EXEMPLOS_TESTE: {
 ID_EXEMPLO:           'ID Exemplo',
 DESCRICAO:            'Descrição',
 TIPO:                 'Tipo',
 NEGOCIO:              'Negócio',
 VALOR_REFERENCIA:     'Valor Referência',
 STATUS:               'Status',
 OBSERVACAO:           'Observação',
 DATA_CRIACAO:         'Data Criação',
 USUARIO_CRIACAO:      'Usuário Criação'
 },

 // ============================================================
 // MÓDULO SOCIETÁRIO (novo em v1.6.0)
 // ============================================================

 SOCIOS: {
 ID_SOCIO:             'ID Sócio',
 NOME:                 'Nome',
 EMAIL:                'Email',
 ATIVO:                'Ativo?',
 TOTAL_APORTADO:       'Total Aportado',
 PARTICIPACAO_ATUAL:   'Participação Atual (%)',
 LUCRO_ATRIBUIDO_TOTAL:'Lucro Atribuído Total',
 LUCRO_RETIRADO_TOTAL: 'Lucro Retirado Total',
 LUCRO_DISPONIVEL:     'Lucro Disponível',
 DATA_ENTRADA:         'Data Entrada',
 DATA_ATUALIZACAO:     'Data Atualização'
 },

 APORTES_SOCIOS: {
 ID_APORTE:            'ID Aporte',
 DATA_APORTE:          'Data Aporte',
 ID_SOCIO:             'ID Sócio',
 SOCIO:                'Sócio',
 VALOR:                'Valor',
 FORMA_PAGAMENTO:      'Forma Pagamento',
 ORIGEM:                'Origem',
 OBSERVACAO:           'Observação',
 ID_CAPITAL_VINCULADO: 'ID Capital Vinculado',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 HISTORICO_PARTICIPACOES: {
 ID_HISTORICO:         'ID Histórico',
 DATA_VIGENCIA:        'Data Vigência',
 ID_SOCIO:             'ID Sócio',
 SOCIO:                'Sócio',
 TOTAL_APORTADO_SOCIO: 'Total Aportado do Sócio',
 TOTAL_APORTADO_GERAL: 'Total Aportado Geral',
 PARTICIPACAO_PCT:     'Participação (%)',
 MOTIVO:               'Motivo',
 DATA_REGISTRO:        'Data Registro'
 },

 RETIRADAS: {
 ID_RETIRADA:          'ID Retirada',
 DATA_RETIRADA:        'Data Retirada',
 ID_SOCIO:             'ID Sócio',
 SOCIO:                'Sócio',
 VALOR_SOLICITADO:     'Valor Solicitado',
 LUCRO_DISPONIVEL_NO_MOMENTO: 'Lucro Disponível no Momento',
 COTA_CAIXA_LIVRE_NO_MOMENTO: 'Cota Caixa Livre no Momento',
 VALOR_LIMITE_APLICADO:'Valor Limite Aplicado',
 VALOR_APROVADO:       'Valor Aprovado',
 FORMA_PAGAMENTO:      'Forma Pagamento',
 STATUS:               'Status',
 OBSERVACAO:           'Observação',
 DATA_REGISTRO:        'Data Registro',
 USUARIO_REGISTRO:     'Usuário Registro'
 },

 LUCRO_POR_ITEM_SOCIO: {
 ID_LUCRO_ITEM_SOCIO:  'ID Lucro Item Sócio',
 ID_VENDA:             'ID Venda',
 ID_ITEM_VENDA:        'ID Item Venda',
 DATA_VENDA:           'Data Venda',
 ID_SOCIO:             'ID Sócio',
 SOCIO:                'Sócio',
 PARTICIPACAO_PCT_APLICADA: 'Participação (%) Aplicada',
 LUCRO_BRUTO_ITEM:     'Lucro Bruto do Item',
 LUCRO_ATRIBUIDO_SOCIO:'Lucro Atribuído ao Sócio',
 DATA_REGISTRO:        'Data Registro'
 },

 RESUMO_SOCIOS: {
 SOCIO:                'Sócio',
 PARTICIPACAO_ATUAL:   'Participação Atual (%)',
 TOTAL_APORTADO:       'Total Aportado',
 LUCRO_ATRIBUIDO_TOTAL:'Lucro Atribuído Total',
 LUCRO_RETIRADO_TOTAL: 'Lucro Retirado Total',
 LUCRO_DISPONIVEL:     'Lucro Disponível',
 COTA_CAIXA_LIVRE:     'Cota Caixa Livre',
 RETIRADA_MAXIMA_ATUAL:'Retirada Máxima Atual',
 DATA_ATUALIZACAO:     'Data Atualização'
 }
 },

 // ============================================================
 // PARÂMETROS DO SISTEMA (lidos de Config_App em runtime)
 // Estes são os defaults caso Config_App não esteja acessível.
 // ============================================================
 PARAMS_DEFAULT: {
 TIMEZONE:                   'America/Sao_Paulo',
 AMBIENTE:                   'HML',
 VERSAO_APP:                 'v1.6.0',
 LOG_NIVEL:                  'INFO',
 PRECO_DIAS_ATUALIZADO:      30,
 PRECO_DIAS_ATENCAO:         60,
 BACKUP_AUTOMATICO_ATIVO:    'Não',
 RESERVA_MINIMA_CAIXA:       0,
 TETO_ANUAL_MEI:             81000
 },

 // ============================================================
 // PREFIXOS DE IDs
 // ============================================================
 ID_PREFIXOS: {
 COMPRA:       'CMP',
 ITEM_COMPRA:  'ITC',
 VENDA:        'VND',
 ITEM_VENDA:   'ITV',
 LOTE:         'LOT',
 MOVIMENTO:    'MOV',
 ABERTURA:     'ABR',
 APORTE:       'CAP',
 DESPESA:      'DSP',
 REFERENCIA:   'REF',
 PRODUTO:      'PRD',
 LOG:          'LOG',
 ERRO:         'ERR',
 TESTE:        'TST',

 // --- Módulo Societário (novo em v1.6.0) ---
 SOCIO:            'SOC',
 APORTE_SOCIO:     'APS',
 HISTORICO_PART:   'HPT',
 RETIRADA:         'RET',
 LUCRO_ITEM_SOCIO: 'LIS'
 },

 // ============================================================
 // LISTAS DE VALORES VÁLIDOS
 // ============================================================
 LISTAS: {
 NEGOCIOS:           ['Pokémon TCG'],
 SIM_NAO:            ['Sim', 'Não'],
 STATUS_LOTE:        ['Disponível', 'Parcial', 'Hold', 'Encerrado'],
 STATUS_VENDA:       ['Rascunho', 'Concluída', 'Cancelada', 'Bloqueada'],
 STATUS_COMPRA:      ['Rascunho', 'Concluída', 'Cancelada', 'Erro'],
 TIPOS_MOVIMENTO:    ['Compra', 'Venda', 'Entrada Hold', 'Saída Hold',
 'Abertura Origem', 'Abertura Destino', 'Ajuste'],
 SEVERIDADES_LOG:    ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
 FONTES_PRECO:       ['LigaPokemon', 'Marketplace', 'Manual', 'Outro'],
 CATEGORIAS_DESPESA: ['Taxa Plataforma', 'Frete', 'Embalagem', 'Operacional', 'Outro'],
 TIPOS_CAPITAL:      ['Aporte', 'Resgate'],
 STATUS_TESTE:       ['Pendente', 'Aprovado', 'Reprovado', 'Bloqueado', 'Reteste'],
 STATUS_RESOLUCAO:   ['Aberto', 'Em Análise', 'Resolvido', 'Ignorado'],

 // --- Módulo Societário (novo em v1.6.0) ---
 FORMAS_PAGAMENTO_SOCIO: ['Pix', 'Transferência', 'Dinheiro', 'Despesa Convertida', 'Outro'],
 STATUS_RETIRADA:        ['Aprovada', 'Aprovada Parcial', 'Bloqueada'],
 NATUREZA_DESPESA:       ['Fixa', 'Variável']
 },

 // ============================================================
 // ABAS QUE DEVEM SER PROTEGIDAS (somente leitura para usuário)
 // ============================================================
 ABAS_PROTEGIDAS: [
 'Dashboard',
 'Resumo_Capital_Lucro',
 'Mapa_Saldos_Patrimonio',
 'Lotes_Estoque',
 'Movimentos_Estoque',
 'Configuracoes',
 'Logs_Sistema',
 'Config_App',
 'Execucoes_Testes',
 'Erros_Sistema',
 'Historico_Participacoes',
 'Lucro_Por_Item_Socio',
 'Resumo_Socios'
 ],

 // ============================================================
 // ABAS AUXILIARES (devem permanecer ocultas)
 // ============================================================
 ABAS_AUXILIARES: [
 'Logs_Sistema',
 'Config_App',
 'Execucoes_Testes',
 'Erros_Sistema'
 ],

 // ============================================================
 // PARÂMETROS MÍNIMOS OBRIGATÓRIOS EM Config_App
 // ============================================================
 PARAMS_OBRIGATORIOS: [
 'TIMEZONE',
 'AMBIENTE',
 'VERSAO_APP',
 'LOG_NIVEL',
 'PRECO_DIAS_ATUALIZADO',
 'PRECO_DIAS_ATENCAO',
 'BACKUP_AUTOMATICO_ATIVO',
 'RESERVA_MINIMA_CAIXA',
 'TETO_ANUAL_MEI'
 ],

 // ============================================================
 // GRUPOS DE LISTAS OBRIGATÓRIOS EM Configuracoes
 // ============================================================
 GRUPOS_CONFIGURACOES_OBRIGATORIOS: [
 'Negócios',
 'Sim/Não',
 'Status Lote',
 'Status Venda',
 'Status Compra',
 'Tipos Movimento',
 'Severidades Log',
 'Fontes Preço',
 'Categorias Despesa',
 'Tipos Capital',
 'Formas Pagamento Sócio',
 'Status Retirada',
 'Natureza Despesa'
 ]

 }; // fim CONFIG

 /**
 * Retorna o objeto CONFIG completo.
 * Útil para depuração e inspeção via console.
 */
 function getConfig() {
 return CONFIG;
 }

 /**
 * Retorna o nome de uma aba pelo alias definido em CONFIG.ABAS.
 * @param {string} alias - Chave do alias (ex: 'COMPRAS')
 * @returns {string} Nome real da aba
 */
 function getAbaNome(alias) {
 var nome = CONFIG.ABAS[alias];
 if (!nome) throw new Error('Alias de aba não encontrado: ' + alias);
 return nome;
 }

