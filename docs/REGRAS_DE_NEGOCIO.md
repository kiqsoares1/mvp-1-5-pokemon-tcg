# REGRAS_DE_NEGOCIO.md

Adaptado do `AGENTS.md` original do projeto (sessão anterior), mantido como a fonte de
verdade das regras. Atualizar este arquivo sempre que uma regra de negócio mudar — é a
primeira coisa a consultar antes de alterar código.

## 1. Regras gerais

- O usuário lança eventos reais; o sistema calcula resultados.
- Consolidado é sempre cálculo automático, nunca lançamento manual.
- Campos automáticos, IDs, saldos, custos e logs não são preenchidos manualmente.
- Abas técnicas, saldos, movimentos, logs e fórmulas são protegidas.
- Baixo atrito operacional: tudo passa pelo Portal HTMLService, nunca por `ui.prompt` ou
  edição direta da planilha.

## 2. Produtos

- Produto inativo não pode operar; produto ativo deve operar.
- Cabeçalhos reais da planilha usam português com acentos (`Ativo?`, `Negócio`,
  `ID Produto`) — o código precisa ser compatível com isso, nunca assumir nomes técnicos.
- Único negócio hoje: `Pokémon TCG` (CS Skins foi removido do escopo na v1.6.0, junto com
  Trade Lock, BUFF163 e Steam como fonte de preço — não reintroduzir).
- Campos como País/Região, Idioma, Tipo/Modelo, Coleção/Jogo têm listas editáveis com
  sugestões (`<datalist>`) no Portal — usuário pode digitar valor novo.

## 3. Compras

- Toda compra válida gera lote rastreável; compra pode ter múltiplos itens.
- Frete, taxas e desconto compõem o custo final por rateio proporcional ao valor bruto de
  cada item; o último item absorve a diferença de arredondamento.
- Prevenção de duplicidade por `ID Requisição`.
- Todo lote nasce com status `Disponível`.

## 4. Estoque e lotes

- Estoque controlado por lote; lote preserva origem, produto, quantidade, custo, status.
- Toda movimentação relevante gera linha em `Movimentos_Estoque`.
- Estoque negativo é bloqueado; saldos não são corrigidos manualmente sem movimento.
- Status de lote válidos: `Disponível`, `Parcial`, `Hold`, `Encerrado`. Hold é patrimônio,
  não prejuízo.

## 5. Abertura/fracionamento (Pokémon)

- Nunca assumir sempre 36 boosters — produtos podem gerar 36, 18, 6, 3, 1 ou quantidade
  configurável.
- Abertura é transformação de estoque: não gera lucro nem receita.
- Baixa o lote origem, cria o lote destino; custo unitário gerado = custo total consumido /
  quantidade total gerada.
- Portal usa seleção de produto/box (`EstoqueService.registrarAberturaPorProduto`), sem
  pedir ID de lote manual — sistema escolhe o lote disponível mais antigo (FIFO).

## 6. Vendas

- Toda venda válida consome lote via FIFO automático; não pode vender mais que o saldo
  disponível nem consumir lote em Hold.
- Custo vendido vem do lote; lucro realizado só existe quando há venda concluída.
- `VendaService.salvarVenda` chama `SociosService.reconhecerLucroDaVenda` para atribuir o
  lucro de cada item aos sócios, na proporção vigente na data da venda (snapshot imutável,
  nunca recalculado depois). Falha nesse reconhecimento não desfaz a venda, só fica em log.

## 7. Financeiro (empresa)

- Aporte não é receita; resgate não é despesa; despesa operacional reduz lucro.
- Compra reduz caixa teórico e forma estoque; venda gera receita e lucro realizados.
- Preço de referência altera valor de mercado, nunca custo histórico.
- `Aportes_Resgates` é o fluxo de caixa da empresa como um todo (sem dono), reconciliado
  com o módulo societário: todo aporte de sócio grava também uma linha aqui, toda retirada
  aprovada de sócio grava um resgate aqui.
- **Natureza da despesa (Fixa/Variável)**: toda despesa tem uma natureza — grupo
  `Natureza Despesa` na aba `Configuracoes`, valores `Fixa` e `Variável`. Usado para
  segmentar o resumo financeiro. (Este grupo foi recriado em 2026-08-18 via função
  Apps Script temporária, depois de duas tentativas de digitação manual na planilha
  falharem — ver `AUTOMACAO_NAVEGADOR.md`.)

## 8. Módulo societário

Ver `20_SociosService.gs` no código.

- 3 sócios iniciais: Kaique, Samuel, Lucas (outros podem ser cadastrados pelo Portal →
  Sócios).
- Participação = participação nos lucros, sempre igual entre si conceitualmente (nunca
  dois números diferentes para o mesmo conceito).
- Participação é proporcional ao total aportado por cada sócio em relação ao total
  aportado por todos os sócios ativos; recalculada a cada novo aporte.
- Mudanças de participação nunca retroagem: cada venda grava a % vigente na data dela em
  `Lucro_Por_Item_Socio` (snapshot imutável). Histórico de participações fica em
  `Historico_Participacoes`, só inserido, nunca editado.
- Não existe empréstimo em nenhuma das duas direções — nem de sócio para a empresa, nem
  da empresa para sócio. Todo dinheiro que entra de um sócio é aporte de capital e sempre
  aumenta participação; todo dinheiro que sai para um sócio é retirada de lucro dele,
  limitada pela regra de retirada máxima.
- Não existe financiamento de lote por sócio específico — lucro sempre segue a
  participação societária geral vigente.
- Reserva mínima de caixa: `Config_App.RESERVA_MINIMA_CAIXA` (default 0, configurável).
- **Retirada máxima de um sócio** = MENOR valor entre: (a) lucro individual disponível
  (`lucroAtribuidoTotal - lucroRetiradoTotal`) e (b) cota do sócio sobre o caixa livre da
  empresa (`participação % × caixa livre`). Caixa livre = caixa teórico do Financeiro -
  reserva mínima. **Regra chave**: um sócio só pode sacar o que é dele — nunca o aporte
  genérico da empresa nem o lucro de outro sócio.
- **Sócio não paga despesa da empresa do próprio bolso.** Toda despesa sai do caixa da
  empresa. Não existe reembolso e não existe conversão de despesa em aporte — se um sócio
  quiser colocar dinheiro na sociedade, lança um aporte normal pelo Portal.
- **Alerta de faturamento MEI**: alerta não bloqueante quando o faturamento anual se
  aproxima do teto do MEI (`Config_App.TETO_ANUAL_MEI`, default R$81.000/ano) —
  `SociosService.verificarAlertaFaturamentoMEI()`, exibido no Portal → Sócios/Dashboard
  quando ≥ 80% do teto.

## 9. Limites do escopo (não fazer)

- Não transformar em ERP, app externo complexo, banco de dados externo, sistema fiscal,
  conciliação bancária ou integração obrigatória com terceiros.
- Não migrar o Portal para URL externa — continua dentro do Google Sheets via HTMLService.
- Não reintroduzir CS Skins, Trade Lock, BUFF163 ou Steam como fonte de preço.
