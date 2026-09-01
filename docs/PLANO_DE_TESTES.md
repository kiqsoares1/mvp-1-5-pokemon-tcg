# PLANO_DE_TESTES.md

Roteiro segmentado por área, para rodar depois de qualquer mudança relevante. Marcar
resultado (✅/❌/⚠️) e data a cada rodada, num `STATUS.md` ou direto neste arquivo.

## 1. Instalação / estrutura

- [ ] "Criar Estrutura Base (planilha nova)" roda sem erro e é idempotente (rodar 2x
      seguidas, segunda vez não deve alterar nada).
- [ ] "Instalar / Inicializar Sistema" aplica proteções sem travar em abas já protegidas.
- [ ] "Validar Estrutura Completa" retorna todos os itens ✅ (abas, cabeçalhos,
      Config_App, grupos de Configuracoes).

## 2. Sócios

- [ ] Cadastrar os 3 sócios padrão (Kaique, Samuel, Lucas), participação inicial 0%.
- [ ] Lançar aporte de um sócio → participação de todos recalcula proporcionalmente ao
      total aportado.
- [ ] Tentar retirada acima do lucro disponível do sócio → deve bloquear.
- [ ] Tentar retirada dentro do lucro disponível, mas acima da cota do caixa livre da
      empresa → deve bloquear (usar o menor dos dois limites).
- [ ] Retirada válida (dentro dos dois limites) → aprova e gera linha em
      `Aportes_Resgates` como resgate.
- [ ] Confirmar que o formulário de despesa não oferece nenhuma opção de "pago do bolso"
      por sócio, e que `Despesa Convertida` não aparece mais como forma de pagamento de
      aporte.

## 3. Despesas (Fixa/Variável)

- [ ] Registrar uma despesa com natureza `Fixa` — confirmar que salva corretamente e
      aparece no resumo financeiro segmentado por natureza.
- [ ] Registrar uma despesa com natureza `Variável` — mesma verificação.
- [ ] Confirmar no menu Validação → "Validar Configuracoes" que o grupo `Natureza Despesa`
      não aparece mais como ausente.

## 4. Compras / Estoque / Abertura

- [ ] Compra com múltiplos itens + frete/desconto → conferir rateio proporcional e
      arredondamento no último item.
- [ ] Abertura de um produto Pokémon (box) → conferir que baixa o lote origem, cria lote
      destino, custo unitário calculado corretamente, e que isso não aparece como
      lucro/receita em nenhum lugar.
- [ ] Tentar operação com produto inativo → deve bloquear.

## 5. Vendas

- [ ] Venda simples consumindo 1 lote via FIFO → status `Concluída`, lucro reconhecido por
      sócio na participação vigente na data.
- [ ] Venda tentando consumir mais que o saldo disponível → deve bloquear.
- [ ] Venda tentando consumir lote em Hold → deve bloquear.
- [ ] Conferir `Lucro_Por_Item_Socio`: a % gravada é a vigente na data da venda, mesmo que
      a participação mude depois (não deve retroagir).

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
