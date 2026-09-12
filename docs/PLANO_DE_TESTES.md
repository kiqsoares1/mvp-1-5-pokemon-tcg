# PLANO_DE_TESTES.md

> Repositório: https://github.com/kiqsoares1/mvp-1-5-pokemon-tcg — índice dos documentos em [`README.md`](../README.md); visão geral e links da planilha/Apps Script em [`CONTEXTO.md`](CONTEXTO.md).

Roteiro segmentado por área, para rodar depois de qualquer mudança relevante. Marcar
resultado (✅/❌/⚠️) e data a cada rodada, num `STATUS.md` ou direto neste arquivo.

## 1. Instalação / estrutura

- [ ] "Criar Estrutura Base (planilha nova)" roda sem erro e é idempotente (rodar 2x
      seguidas, segunda vez não deve alterar nada).
- [ ] "Instalar / Inicializar Sistema" aplica proteções sem travar em abas já protegidas.
- [ ] "Validar Estrutura Completa" retorna todos os itens ✅ (abas, cabeçalhos,
      Config_App, grupos de Configuracoes).

## 1b. Asserts automatizados (rodar no editor do Apps Script)

Estes rodam sozinhos e **estouram exceção** quando a regra quebra — não dependem de
alguém ler o log. Rodar depois de qualquer mexida em cálculo:

- [ ] `testarModuloSocietarioCompleto()` — participação proporcional ao aportado, soma
      fechando em 100%, retirada máxima limitada pelos dois tetos e reserva mínima de
      caixa intacta mesmo se todos sacarem o máximo junto. **Somente leitura.**
- [ ] `testarRateioCompraCompleto()` — rateio de frete/taxas/desconto proporcional ao
      valor de cada item, sem perder centavo no arredondamento, e desconto maior que o
      frete gerando crédito. Usa `calcularPrevia`, **não grava nada**.

## 1c. Fluxo completo automatizado (E2E)

`testarFluxoCompletoE2E()` cobre, com assert em cada passo e na ordem em que as coisas
acontecem de verdade, boa parte das seções 2 a 5 abaixo: despesa → compra com rateio →
abertura de box → venda → retirada.

**⚠️ Este teste escreve na planilha.** Só insere (nunca apaga nem edita linha existente)
e marca tudo com `E2E` no nome/descrição. Rodar em HML.

- [ ] `testarFluxoCompletoE2E()` — verde significa: despesa exige natureza; o frete
      rateado chega ao custo do lote; abertura de box preserva o custo e não vira
      receita; venda distribui o lucro inteiro entre os sócios; venda acima do saldo
      bloqueia; retirada acima do limite não aprova mais que o limite e retirada dentro
      do limite baixa o lucro disponível.

Os itens marcados **(E2E)** nas seções abaixo já são cobertos por ele. Os demais
continuam sendo verificação manual pelo Portal.

## 2. Sócios

- [ ] Cadastrar os 3 sócios padrão (Kaique, Samuel, Lucas), participação inicial 0%.
- [ ] Lançar aporte de um sócio → participação de todos recalcula proporcionalmente ao
      total aportado.
- [ ] **(E2E)** Tentar retirada acima do lucro disponível do sócio → deve bloquear.
- [ ] Tentar retirada dentro do lucro disponível, mas acima da cota do caixa livre da
      empresa → deve bloquear (usar o menor dos dois limites).
- [ ] Retirada válida (dentro dos dois limites) → aprova e gera linha em
      `Aportes_Resgates` como resgate.
- [ ] Confirmar que o formulário de despesa não oferece nenhuma opção de "pago do bolso"
      por sócio, e que `Despesa Convertida` não aparece mais como forma de pagamento de
      aporte.

## 3. Despesas (Fixa/Variável)

- [ ] **(E2E)** Registrar uma despesa com natureza `Fixa` — confirmar que salva corretamente e
      aparece no resumo financeiro segmentado por natureza.
- [ ] **(E2E)** Registrar uma despesa com natureza `Variável` — mesma verificação.
- [ ] Confirmar no menu Validação → "Validar Configuracoes" que o grupo `Natureza Despesa`
      não aparece mais como ausente.

## 4. Compras / Estoque / Abertura

- [ ] **(E2E)** Compra com múltiplos itens + frete/desconto → conferir rateio proporcional e
      arredondamento no último item.
- [ ] **(E2E)** Abertura de um produto Pokémon (box) → conferir que baixa o lote origem, cria lote
      destino, custo unitário calculado corretamente, e que isso não aparece como
      lucro/receita em nenhum lugar.
- [ ] **(E2E)** Tentar operação com produto inativo → deve bloquear.

## 5. Vendas

- [ ] **(E2E)** Venda simples consumindo 1 lote via FIFO → status `Concluída`, lucro reconhecido por
      sócio na participação vigente na data.
- [ ] **(E2E)** Venda tentando consumir mais que o saldo disponível → deve bloquear.
- [ ] Venda tentando consumir lote em Hold → deve bloquear.
- [ ] Conferir `Lucro_Por_Item_Socio`: a % gravada é a vigente na data da venda, mesmo que
      a participação mude depois (não deve retroagir).

## 5b. Cancelamento de venda

Regras em `REGRAS_DE_NEGOCIO.md`, seção 6.1. O passo `e2eCancelamentoVenda` do
`testarFluxoCompletoE2E()` cobre os automatizáveis; os manuais são os de tela.

- [ ] **(E2E)** Cancelar uma venda devolve o estoque ao lote de origem, no valor exato, e o
      saldo volta a ser o de antes da venda.
- [ ] **(E2E)** Venda cancelada fica com status `Cancelada` e motivo em `Observação`.
- [ ] **(E2E)** O lucro atribuído a cada sócio volta ao valor anterior à venda, e a soma das
      linhas dela em `Lucro_Por_Item_Socio` zera (originais + espelho negativo).
- [ ] **(E2E)** Movimento `Cancelamento Venda` registrado, rastreável pelo ID da venda.
- [ ] **(E2E)** Recusa: sem `confirmado`, com ID de confirmação divergente, com motivo curto,
      e ao cancelar uma venda já cancelada — nenhuma delas pode mexer no estoque.
- [ ] **(E2E)** Lote cujo saldo foi alterado depois da venda bloqueia o cancelamento (não
      inventar estoque).
- [ ] **Manual (Portal)**: o botão vermelho só habilita depois de digitar o ID da venda
      correto; o painel de impacto lista lotes e sócios afetados antes de confirmar.
- [ ] **Manual (Portal)**: venda de mês anterior mostra o aviso de mês fechado / MEI e ainda
      assim permite cancelar.
- [ ] **Manual**: sócio que já retirou o lucro → cancelamento recusado nomeando o sócio.
      (Difícil de montar no E2E sem sujar a massa; conferir na mão pelo menos uma vez.)
- [ ] **Manual**: lote em `Hold` recebe a devolução e continua em `Hold`.

## 6. Dashboard / MEI

- [ ] Com faturamento anual abaixo de 80% do teto MEI → card de alerta não aparece (ou
      aparece neutro, conforme design atual).
- [ ] Simulando/forçando faturamento ≥ 80% do teto → card de alerta aparece, não bloqueia
      nenhuma operação.

- [ ] Gráfico "Evolução mensal": 12 meses no eixo, sem buraco no meio da série. Um mês
      sem movimento deve aparecer zerado, não sumir.
- [ ] Rosca "Participação dos sócios": os percentuais batem com os da tela de Sócios.
      Divergência aqui é erro de cálculo, não de desenho.
- [ ] Rosca "Onde está o dinheiro": estoque + caixa livre batem com os cards de número
      do próprio Dashboard.
- [ ] Barra "Faturamento × teto MEI": mostra o mesmo valor do card de alerta que já
      existia antes dos gráficos.
- [ ] Planilha sem movimento no período → cards mostram mensagem de "sem dados", não
      eixo vazio nem `NaN`.

## 7. Regressão rápida pós-deploy (clasp push)

- [ ] Depois de qualquer `clasp push`, abrir o Portal e confirmar que carrega sem erro no
      console.
- [ ] Rodar "Validar Estrutura Completa" de novo, mesmo sem mudança de estrutura esperada
      (garante que nada quebrou por acidente).
