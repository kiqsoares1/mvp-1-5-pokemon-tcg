# STATUS.md

Atualizar a cada sessão relevante — o que mudou, o que ficou pendente. Manter curto; para
detalhe de regra de negócio ver `REGRAS_DE_NEGOCIO.md`, para arquitetura ver
`ARQUITETURA.md`.

## 2026-08-31 (sessão 6 — teste E2E do fluxo funcional)

**Alvo:** a maior lacuna do projeto — as seções 2 a 7 do `PLANO_DE_TESTES.md` nunca
executadas. Em vez de percorrer o roteiro manualmente uma vez e marcar caixinhas, virou
`99_Testes_E2E.js`: o fluxo inteiro com assert em cada passo, repetível.

`testarFluxoCompletoE2E()` roda na ordem real: produtos → despesa → compra com rateio →
abertura de box → venda → retirada. **Escreve na planilha** (só insere, nunca apaga nem
edita linha existente; tudo marcado com `E2E`).

**O que cada passo prova:**
- Despesas: Fixa e Variável entram; **despesa sem natureza é rejeitada** — é o caso que
  tem valor, os outros dois continuariam passando se a validação sumisse.
- Compra: o frete rateado chega ao **custo gravado no lote** (220 e 110 sobre bruto de
  200 e 100 com frete 30), não só à prévia. É o elo entre cálculo e estoque.
- Abertura de box: origem baixa exatamente 1; destino nasce com a quantidade gerada; o
  **custo consumido reaparece inteiro no destino** (abertura transforma custo, não cria
  valor); e nenhuma linha nova em `Vendas` — abertura não é receita.
- Venda: uma linha de lucro por sócio ativo e a **soma do atribuído fecha com o lucro
  bruto do item**. Venda acima do saldo bloqueia.
- Retirada: acima do limite não aprova mais que o limite; dentro do limite aprova
  integral e **baixa o lucro disponível pelo valor exato**.

**Por que E2E e não mais teste de unidade:** os asserts de retirada máxima e reserva
mínima do `99_Testes_Socios.js` passavam sem exercitar a regra, por falta de lucro
atribuído a alguém. Só um fluxo que gera venda de verdade coloca lucro na mesa.

**Dois bugs de nome de campo pegos antes de subir** (mesma classe do NaN da sessão 5,
agora conferidos contra a assinatura real em vez de supostos): `ProdutoService.cadastrar`
espera `produtoGeradoPadrao` e não `produtoGerado` — teria quebrado no primeiro passo; e
`registrarDespesa` devolve `id`, não `idDespesa`. Todo campo numérico do E2E passa por
`_e2eNum_`, que exige número finito.

**Achado não corrigido:** `testarRegistrarDespesa()` no `99_Testes_Financeiro.js` não
passa `natureza`, que virou obrigatória. Esse teste manual antigo sempre retorna erro.

**Primeira execução na HML (31/08, 23:29) — o E2E achou um bug de produção sério na
primeira tentativa.** Parou em `abertura` com "Produto não está marcado como fracionável",
mesmo tendo acabado de cadastrar o box com `fracionavel: "Sim"`.

Causa: `Utils.normalizar()` só faz trim, **preserva maiúscula** (`02_Utils.js`), e
`06_ProdutoService.js` comparava o resultado dela com o literal minúsculo `'sim'` em
quatro lugares. `'Sim' !== 'sim'`, sempre.

O efeito é pior do que o teste mostrou. Os dois lados da regra estavam quebrados:
- No **cadastro**, `fracionavel` virava `false` em silêncio — o produto era gravado como
  não fracionável e `Quantidade Gerada Padrão` e `Produto Gerado Padrão` eram **descartados**
  (viram string vazia). O `Portal.html` oferece exatamente `<option>Sim</option>`, então
  **todo box cadastrado pelo Portal nascia quebrado**, sem nenhum erro na tela.
- Na **validação de abertura**, o mesmo defeito lendo da planilha, que grava `'Sim'`.

Ou seja: **abertura de box não funcionava para nenhum produto** — a operação central do
negócio Pokémon. O usuário preenchia tudo, salvava com sucesso e só descobria na hora de
abrir, com uma mensagem que apontava para o lugar errado.

**Corrigido:** os quatro pontos passaram a usar `_normalizarValorProduto` (minúsculas, sem
acento), que já existia no próprio arquivo e é o que `_eAtivo` usa. Varredura em todo o
projeto confirmou que os outros serviços com comparação parecida já usavam helper que
rebaixa a caixa — o defeito estava só em `06_ProdutoService.js`.

**Ajuste no E2E:** `e2ePrepararProdutos` agora valida o box com `validarParaAbertura`
antes de usar e só reaproveita um box de rodada anterior se ele realmente servir. O box
criado na execução falha ficou gravado como não fracionável e sem quantidade gerada; como
a planilha é protegida, não dá para consertar o registro velho pelo código, então o teste
cadastra um novo com nome próprio. Também falha no passo de produtos, e não três passos
adiante, se o box não servir.

**Segundo achado, não corrigido:** a aba `Compras` não tem as colunas `Observação` nem
`ID Requisição` (aviso do `SheetService` na execução). A guarda de duplicidade de compra
cai no fallback por `Logs_Sistema`, então ainda funciona, mas degradada. Corrigir exige
mexer na estrutura da aba — commit próprio.

**Segunda execução (23:33) — o E2E achou o segundo bug, e este era um bloqueio total.**
Abertura passou (custo consumido 110, custo unitário destino 18,3333 = 110/6, preservado).
Parou na venda com "Esta venda já foi processada anteriormente", **na primeira tentativa**.

Causa: `salvarVenda` grava `LogService.info('Iniciando venda. Req: ' + idRequisicao)` com
`Referência ID = idRequisicao` **antes** de verificar duplicidade — e a verificação
secundária procurava justamente qualquer log com essa Referência ID. Toda venda encontrava
o próprio log de início e se bloqueava. **Nenhuma venda conseguia ser salva.** O log de
erro de validação tinha o mesmo efeito, envenenando o `idRequisicao` de uma tentativa que
nunca gravou nada.

`CompraService` não sofria do mesmo porque verifica antes de logar — foi por isso que a
compra do E2E passou e a venda não.

**Corrigido:** a verificação por log agora só conta o log que marca a operação
**efetivamente gravada** (`Venda registrada:` / `Compra registrada:`, extraídos para as
constantes `MARCA_LOG_VENDA_REGISTRADA` e `MARCA_LOG_COMPRA_REGISTRADA`, usadas tanto ao
gravar quanto ao verificar, para não se separarem). A guarda passa a significar "já foi
registrada" em vez de "já apareceu num log".

O mesmo defeito, mais estreito, foi corrigido em `07_CompraService.js`: um log de erro
técnico com aquela Referência ID recusaria a retentativa de uma compra que nunca entrou.

**Nota:** os 19 vendas que já existiam na HML são anteriores a essa verificação por log —
por isso o problema não tinha aparecido antes. Era um bloqueio novo, ainda não exercitado.

**Terceiro achado, não corrigido:** colunas faltando em três abas, reportadas pelo
`SheetService` durante a execução — `Compras` (Observação, ID Requisição),
`Pokemon_Abertura_Box` (Observação) e `Movimentos_Estoque` (Subtipo Movimento, Status
Destino, Custo Unitário Movimento). O código grava esses campos e eles são descartados em
silêncio. Em `Compras` isso derruba a verificação primária de duplicidade para o fallback
por log. Corrigir exige mexer na estrutura das abas — commit próprio.

**Pendente:**
- Rodar `testarFluxoCompletoE2E()` pela terceira vez — venda e retirada seguem sem execução.
- Alinhar as colunas de `Compras`, `Pokemon_Abertura_Box` e `Movimentos_Estoque` com o que
  o código grava.
- Depois dele, rodar `testarModuloSocietarioCompleto()` de novo: com lucro atribuído, os
  asserts de retirada máxima e reserva mínima finalmente exercitam a regra.
- Seções 6 e 7 (Dashboard/gráficos e regressão pós-deploy) continuam manuais — dependem
  de olhar o Portal.
- Corrigir `testarRegistrarDespesa()` para passar `natureza`.

## 2026-08-31 (sessão 5 — asserts do rateio e do módulo societário)

**Contexto:** a maior lacuna aberta do projeto era cobertura de teste com assert real —
fora dos dois testes de venda, os cálculos que decidem dinheiro não tinham nenhum. Um bug
em rateio ou em participação passava despercebido porque o resultado ia só para um log
que ninguém é obrigado a ler.

**Feito — dois arquivos novos, ambos sem efeito colateral na planilha:**

- `99_Testes_Compra.js`: asserts do rateio via `CompraService.calcularPrevia` (que só
  calcula, não grava). Três cenários — rateio proporcional ao valor bruto de cada item
  (frete 30 sobre 200/100 tem que sair 20/10); divisão não exata (10 entre 3 itens iguais
  → 3,33/3,33/3,34, o último absorve o centavo); e desconto maior que frete+taxas, onde o
  adicional líquido fica negativo e tem que virar crédito, não débito. O invariante
  central é que **nenhum centavo evapora nem aparece do nada**: a soma do rateado tem que
  dar exatamente Frete + Taxas − Desconto.
- `99_Testes_Socios.js`: asserts do módulo societário, **somente leitura**. Participação
  de cada sócio = aportado dele / aportado geral e soma fechando em 100%; retirada máxima
  = menor entre lucro disponível e cota sobre o caixa livre, nunca negativa e nunca acima
  de nenhum dos dois tetos; caixa livre descontando a reserva mínima. O assert que mais
  importa é o último: **se todos os sócios sacarem o máximo no mesmo dia, o total não
  pode invadir a reserva mínima de caixa.**

Sem aportes registrados, participação zerada é tratada como estado correto, não como
falha — sociedade que ainda não começou não é bug.

**Validação:** o `_calcularRateio` real foi extraído de `07_CompraService.js` e executado
no Node contra os três cenários, para confirmar que os números esperados nos asserts são
os que o código realmente produz (incluindo o 3,33/3,33/3,34). Todos bateram. Sintaxe dos
dois arquivos validada e conferido que não há colisão de nome de função global — em Apps
Script todos os arquivos compartilham o mesmo escopo.

**Nota de escopo:** os testes não foram ligados ao menu de propósito. Rodam pelo seletor
de função do editor do Apps Script, como os demais `99_Testes_*`.

**Resultado da execução na HML (31/08, 22:56):** `testarModuloSocietarioCompleto` passou,
mas só a participação foi exercitada de verdade — 60/20/20 sobre R$ 100.000, esperado e
planilha batendo nos três. Os outros dois passaram trivialmente: com `lucroDisponivel: 0`
em todos, o `min()` da retirada máxima escolheu sempre essa perna e o teto da cota sobre o
caixa livre nunca foi testado; e com `RESERVA_MINIMA_CAIXA: 0` o caixa livre é igual ao
caixa teórico, então o assert do pior caso passou sem esforço.

**Achado durante a execução — corrigido:** caixa teórico de R$ 114.520 contra R$ 100.000
aportados, mas lucro atribuído zero para os três e `Lucro_Por_Item_Socio` vazia. Causa: o
reconhecimento de lucro roda no momento da venda e as 19 vendas da HML foram gravadas
antes dos sócios existirem. **Decidido não fazer backfill** — Kaique confirmou que esse
histórico é massa de teste, e atribuir lucro fictício sobre participação real seria pior
que deixar como está.

O defeito de verdade não estava nos dados: `reconhecerLucroDaVenda` retornava
`{sucesso: true, linhas: 0}` **em silêncio** quando não havia sócio ativo. Em PROD isso é
dinheiro sumindo sem rastro — a venda entra, o caixa cresce, o lucro não fica pertencendo
a ninguém, e só se descobre quando alguém for sacar. Duas correções:

- `20_SociosService.js`: o retorno silencioso virou `LogService.warning`. Continua não
  quebrando a venda de propósito (venda válida não pode falhar por cadastro de sócio),
  mas agora deixa rastro em `Logs_Sistema`.
- `20_SociosService.js` + `17_InstallService.js`: nova
  `contarVendasSemLucroReconhecido()` (lê cada aba uma vez, ignora vendas canceladas) e
  linha nova no Health Check. Em HML o número é alto por causa da massa de teste e **não**
  reprova o health check; em PROD, qualquer valor acima de zero reprova. É o detector que
  teria pego isso sozinho.
- `99_Testes_Socios.js`: `testarVendasSemLucroAtribuido()` expõe o mesmo número no
  conjunto de testes.

**Correção do registro de dívida técnica:** a lista de arquivos achatados anotada na
sessão 4 estava errada. Medido linha a linha, os realmente danificados são
`00_Config.js`, `10_FinanceiroService.js`, `12_UiService.js` e `17_InstallService.js`
(recuo de 1 espaço em tudo) e `Portal.html` (recuo zero, tudo na coluna 0).
`BaseScripts.html` e `BaseStyles.html` estão corretos — foram listados por engano.

**Decisão do Kaique (31/08):** manter a retirada como está. `RESERVA_MINIMA_CAIXA` fica
em 0 — o limite de retirada continua sendo só `min(lucro disponível, participação ×
caixa livre)`, sem piso de caixa reservado. Fica registrado que, com reserva zerada,
quando houver lucro atribuído todo o caixa é sacável, inclusive o que seria reposição de
estoque. **Não reabrir esta pendência**; se um dia fizer sentido travar um piso, basta
preencher o parâmetro em `Config_App` — o cálculo em `calcularCaixaLivre()` já o respeita,
e `testarReservaMinimaDeCaixa()` já cobre o desconto.

**Bug no próprio teste, pego na execução na HML (31/08, 23h):** `testarRateioCompraCompleto`
voltou verde, mas com `"somaRateado": null` nos três cenários. `JSON.stringify` transforma
`NaN` em `null` — e **`NaN` passa em qualquer comparação**: `Math.abs(NaN - 30) > 0.005` é
`false`, então nenhum assert disparava. Causa: o teste lia `custoAdicionalRateado` (nome
interno do `_calcularRateio`) em vez de `custoRateado`, que é o nome que `calcularPrevia`
realmente expõe na projeção pública (`07_CompraService.js`, ~linha 602). Campo inexistente
→ `undefined` → soma vira `NaN`. Só o assert de `custoTotal` funcionava de verdade (e esse
passou: 330, 160 e 375 corretos).

Corrigido em dois níveis: o nome do campo, e — mais importante — o buraco. Agora toda
leitura de campo numérico passa por `_testeCompraExigirNumero_` / `_testeSociosExigirNumero_`,
que **exigem número finito** e quebram alto se o campo sumir ou for renomeado. Sem isso, um
assert que não testa nada é pior que assert nenhum: dá sensação de cobertura.

Verificado no Node reproduzindo a projeção real de `calcularPrevia`: os três cenários agora
devolvem `somaRateado` 30, 10 e −25, batendo com o esperado; e um teste específico confirma
que renomear o campo de volta **quebra** o teste em vez de passar calado.

**Execução final na HML (31/08, 23h):** `testarRateioCompraCompleto` passou de verdade —
`somaRateado` 30, 10 e −25, batendo com `adicionalEsperado` nos três cenários e com o que a
simulação no Node previu. O rateio de compra está coberto por assert real: proporção por
valor, arredondamento sem perda de centavo e desconto maior que frete virando crédito.

**Pendente:**
- Retirada máxima e reserva mínima só serão testadas de verdade quando existir lucro
  atribuído a algum sócio — hoje os dois asserts passam sem exercitar a regra.
- Abrir o Portal na HML e olhar o Dashboard (pendência que vem da sessão 4).
- Testes funcionais completos (`PLANO_DE_TESTES.md`) — seções 2 a 7 seguem não executadas.

## 2026-08-31 (sessão 4 — gráficos no Dashboard do Portal)

**Pedido do Kaique:** o Dashboard não mostrava gráficos. Levantamento confirmou que **não
existia nenhum gráfico no projeto** — grep por `Chart`, `EmbeddedChart` e `SPARKLINE` não
retornava nada. O Dashboard era 8 cards de número, o card do MEI e 2 tabelas.

Decidido: quatro gráficos, no Portal, em **SVG inline gerado em JavaScript** — sem
biblioteca externa, porque o Portal roda dentro do HTMLService e um CDN bloqueado deixaria
o dashboard em branco.

**Feito:**
- `12_UiService.js`: nova `uiObterSerieMensal(meses)` (default 12, máx 36) + wrapper global
  e export. Lê `Vendas`, `Itens_Venda` e `Despesas` **uma vez cada** e agrega em memória —
  sem N+1. Devolve por mês: faturamento, lucro bruto, despesas e lucro líquido. Vendas com
  status `Cancelada` são ignoradas; o mês de um item é o mês da venda a que ele pertence;
  meses sem movimento vêm zerados em vez de sumir (um buraco no gráfico esconderia
  justamente o mês parado).
- `BaseScripts.html`: helpers de desenho — `chartCard`, `chartVazio`, `legendaHtml`,
  `moneyCurto`, `svgRosca` + `legendaRosca`, `svgBarraMei`, `svgSerieMensal`. Mais
  `loadSerieMensal()`, chamada junto com `loadDashboard()`.
- `BaseStyles.html`: `.charts-grid`, `.chart-card`, `.chart-legend`, `.chart-empty` e
  estilos de eixo, todos usando a paleta que já existia.
- `Portal.html`: seções "Evolução mensal", "Composição" e o bloco do MEI virando gráfico.
- `docs/DESIGN_GUIA.md`: seção "Gráficos" com os helpers e as três regras (sem dados é um
  estado e não um erro; cor sai da paleta; escala inclui o zero quando a série pode ser
  negativa).

**Cuidado que quase virou bug:** a primeira tentativa removia `meiCardHtml` por parecer
morta depois da troca no Dashboard — ela também é usada na tela de Sócios
(`BaseScripts.html`, render de `sociosCards`). Mantida.

**Validação:** 16 assertivas sobre o SVG gerado pelos helpers reais (barras assentam
exatamente na linha do zero; arcos da rosca somam a circunferência; casos-limite viram
mensagem; nenhuma coordenada `NaN`; teto zerado não divide por zero; barra do MEI satura
em 100%) — todas passaram. Conferido também visualmente numa página de preview montada com
o CSS e as funções reais do projeto. Sintaxe de todos os `.js` e do bloco `<script>` do
`BaseScripts.html` validada.

**Armadilha do `clasp` registrada:** `.clasp.json` tem `rootDir: ""` e
`scriptExtensions: ['.js', '.gs']` — **qualquer `.js` na raiz do repositório vai para o
Apps Script no próximo push**. Por isso os scripts de teste/preview em Node desta sessão
ficaram fora do repositório (só no scratchpad): um `.js` com `require()` na raiz quebraria
o projeto Apps Script. Se um dia esses testes forem versionados, precisam ir para uma
subpasta e/ou entrar em `filePushOrder`/ignore do clasp.

**Dívida técnica encontrada (não corrigida):** `10_FinanceiroService.js`, `12_UiService.js`,
`BaseScripts.html`, `BaseStyles.html` e `Portal.html` estão com a **indentação achatada** —
todas as linhas com o mesmo recuo, sem aninhamento. São exatamente os arquivos reescritos
direto no editor do Apps Script via automação de navegador na sessão de 18/08.
`20_SociosService.js` e os demais mantêm a indentação correta. O código novo desta sessão
foi escrito indentado de propósito, para não propagar o estrago. Reindentar os 5 arquivos é
um diff grande e merece commit próprio.

**Pendente:**
- ~~`clasp push`~~ feito em 31/08 às 00:10 (30 arquivos) e commit `5631fc2` empurrado
  para o GitHub. Falta **abrir o Portal na HML e olhar o Dashboard** — os gráficos ainda
  não foram vistos rodando contra dados reais, só contra dados fictícios.
- Testes funcionais completos (ver `PLANO_DE_TESTES.md`) — continuam não executados.
- Cobertura de assert real fora dos dois testes de venda: rateio de compra, participação
  societária, retirada máxima e reserva mínima de caixa.

## 2026-08-30 (sessão 3 — remoção do fluxo "despesa paga do bolso do sócio")

**Decisão do Kaique:** sócio não paga despesa da empresa com dinheiro do próprio bolso.
Toda despesa sai do caixa da empresa. Não existe empréstimo em nenhuma das duas direções,
nem reembolso, nem conversão de despesa em aporte. Isso **cancela a pendência** aberta na
sessão 2 de expor `pagoDoBolsoPorSocio` no Portal — o fluxo inteiro foi removido em vez de
ser exposto.

**Feito:**
- `10_FinanceiroService.js`: removido o bloco `pagoDoBolsoPorSocio` de `registrarDespesa`
  (a função agora só grava a despesa e retorna). Removido junto um `return resultado;`
  morto que sobrou da limpeza.
- `20_SociosService.js`: removida a função `converterDespesaEmAporte_`, sua exportação na
  interface pública e a regra correspondente no cabeçalho do arquivo (substituída pela
  regra nova).
- `00_Config.js`: `Despesa Convertida` removida de `CONFIG.LISTAS.FORMAS_PAGAMENTO_SOCIO`
  — esse valor só existia para o fluxo removido.
- `Portal.html`: removida a opção `Despesa Convertida` do select de forma de pagamento do
  aporte; placeholder do campo Origem trocado (não sugere mais "despesa paga do próprio
  bolso"); texto de ajuda reescrito para afirmar a regra nova.
- `docs/REGRAS_DE_NEGOCIO.md` e `docs/PLANO_DE_TESTES.md` atualizados.
- Confirmado por inspeção que **não existe caminho de empréstimo empresa → sócio**:
  `calcularRetiradaMaxima` é `Math.max(0, Math.min(lucroDisponivel, cotaCaixaLivre))` — o
  sócio só saca lucro que já é dele e que cabe na cota dele do caixa livre.
- Todos os arquivos `.js` passaram por `node --check` — sem erros.

**Incidente desta sessão (deploy não intencional):** ao montar esta entrada do STATUS via
`node -e "..."` com aspas duplas no shell, as crases do texto markdown foram interpretadas
pelo bash como substituição de comando. Isso executou de verdade um `clasp push` (30
arquivos enviados ao Apps Script ao vivo, 23:21) e uma tentativa de `git push` (rejeitada,
non-fast-forward). Nada foi corrompido — só os 6 arquivos pretendidos estão modificados e
o `STATUS.md` ficou intacto —, mas o Apps Script ao vivo recebeu as mudanças antes da
revisão. **Lição:** nunca passar markdown com crases dentro de `node -e "..."` no bash;
usar heredoc com delimitador entre aspas simples. O `git pull --rebase` + `git push` foram
feitos depois de forma deliberada e aprovada pelo Kaique: commit `d0a59f1`, rebase limpo
em cima do `fee53fa`, deixando GitHub, pasta local e Apps Script ao vivo os três em
sincronia.

**Verificado depois (sem ação necessária):** a suspeita de sobra do valor obsoleto
`Despesa Convertida` na aba `Configuracoes` não gera problema nenhum. Apurado no código:

- Não existe `setDataValidation` em lugar nenhum do projeto — a aba `Configuracoes` é
  documentação de valores válidos, não alimenta dropdown real da planilha.
- O `<select>` de forma de pagamento do Portal é hardcoded em `Portal.html` (já
  corrigido), não lê a `Configuracoes`.
- `validarConfiguracoesSilencioso` só checa se cada grupo obrigatório existe e não está
  vazio — nunca compara os valores com `CONFIG.LISTAS`. Valor a mais não acusa erro.
- "Criar Estrutura Base" nem chega a tocar a aba: o seed da `Configuracoes` só roda
  `if (contarLinhas === 0)`, e a HML já tem dados. O valor obsoleto fica lá até alguém
  apagar a linha à mão — puramente cosmético.
- `SociosService.registrarAporte` grava `payload.formaPagamento` direto, sem validar
  contra a lista. Aporte antigo com `Despesa Convertida` continua exibindo normal.
- O gerador de massa demo usa `formaPagamento: 'Pix'` em todos os aportes, então só
  existiria registro assim se tivesse sido lançado à mão pelo Portal.

**Cuidado registrado para o futuro:** se algum dia aparecer um aporte com forma de
pagamento obsoleta, o certo é **editar o rótulo para `Outro`, nunca apagar a linha** — o
dinheiro entrou de verdade e a participação societária é proporcional ao total aportado.
Apagar o aporte deixaria `Participação Atual` inconsistente, porque a recalculação só
dispara dentro de `registrarAporte`.

**Proteção de abas — RESOLVIDO (pendência da sessão 2 fechada).** As 3 abas que apareciam
como "Sem proteção" (`Socios`, `Aportes_Socios`, `Retiradas`) **não eram bug**. Revisão do
código descartou as hipóteses: os nomes em `CONFIG.ABAS_PROTEGIDAS` batem exatamente com
`CONFIG.ABAS`, e `InstallService.instalar()` percorre a lista inteira sem desvio. O que
tinha acontecido é que a rodada que protegeu 13 abas ocorreu quando o Apps Script ao vivo
ainda tinha a lista antiga de 13 itens; o Health Check que reportou "13/16" rodou depois
do push com os 3 nomes novos.

Rodado pelo Kaique na planilha HML: "Aplicar Proteções de Abas" seguido de "Health Check
do Sistema". Resultado confirmado por screenshot:

- Estrutura: válida
- **Abas protegidas: 16/16**
- Abas auxiliares ocultas: 4/4
- Logs: INFO=248 | WARN=10 | ERR=0 | CRIT=0
- Dados na HML: Produtos_Ativos 5, Compras 6, Vendas 19, Lotes_Estoque 16

`ERR=0` e `CRIT=0` confirmam de quebra que o código enviado nesta sessão está rodando
limpo na planilha. Nenhuma mudança de código foi necessária.

**Pendente:**
- Abrir o Portal na HML e confirmar que a tela de Aporte carrega sem erro (única
  verificação que restou desta sessão).
- Testes funcionais completos (ver `PLANO_DE_TESTES.md`) — continuam não executados. É a
  maior lacuna aberta do projeto hoje.
- Cobertura de teste automatizado com assert real fora dos dois testes de venda: rateio de
  compra, participação societária, retirada máxima e reserva mínima de caixa seguem sem
  assert.

## 2026-08-18 (sessão 2 — revisão e correção de código)

**Feito:** revisão completa dos 24 arquivos `.js` do repositório (via 5 sub-revisões
paralelas) buscando bugs, eficiência e estética, seguida de correção de praticamente todos
os achados diretamente no código local (ainda **não enviado ao Apps Script via `clasp
push`** — só editado na pasta local clonada). Destaques por severidade:

- **Crítico:**
  - `08_EstoqueService.js`: `_buscarLotePorId` retornava o objeto errado
    (`{linha, dados}` em vez de `dados`), deixando `registrarAbertura`/
    `registrarAberturaPorProduto` inoperantes (a checagem "só Pokémon TCG pode ser
    aberto" falhava sempre) — corrigido.
  - Mesma função: comparação de status sem `.toLowerCase()` deixaria abrir lote em
    Hold/Encerrado depois do fix acima — corrigido.
  - Condição de corrida (TOCTOU) em `registrarAbertura` (Estoque) e `salvarVenda`
    (Venda): saldo era lido/planejado antes do `LockService`, permitindo estoque
    negativo com uso concorrente — agora a revalidação/planejamento roda dentro do
    lock.
  - `99_Testes_DadosDemo.js`: `gerarDadosDemo()`/`limparDadosDemo()` agora exigem
    `Config_App.AMBIENTE === 'HML'` + confirmação explícita na UI antes de rodar —
    antes só um comentário no cabeçalho do arquivo impedia rodar em produção por
    engano.
  - `00_Config.js`: `Socios`, `Aportes_Socios` e `Retiradas` adicionadas a
    `ABAS_PROTEGIDAS` (guardavam saldo real dos sócios sem proteção nenhuma).
- **Alto:** lock adicionado em `SheetService.setCelula/setCelulaPorCampo/setLinha`;
  dedupe de duplicidade (Financeiro/PrecoReferencia) trocado de match por texto de log
  para Módulo+Severidade; N+1 de leitura de planilha corrigido em
  `PrecoReferenciaService` (preço vigente em lote), `UiService`/`ProdutoPortalService`
  (metadados de mercado por produto) e `SociosService.reconhecerLucroDaVenda`
  (participação calculada 1x por venda, não por item×sócio);
  `converterDespesaEmAporte_` (despesa do bolso do sócio → aporte automático) agora é
  chamada de fato quando `FinanceiroService.registrarDespesa` recebe
  `pagoDoBolsoPorSocio`; `InstallService.reaplicarEstrutura()` não rebaixa mais
  proteção PROD para "somente aviso".
- **Médio:** `parsarData`/`formatarMoeda` (Utils) corrigidos para data inválida e
  valor negativo; `_normalizar` unificado entre Financeiro/PrecoReferencia/UiService
  via novo `Utils.normalizarChave`; `MAPA_ALIAS_ABA` redundante removido de
  `ValidationService`; validação de Natureza da despesa contra
  `CONFIG.LISTAS.NATUREZA_DESPESA`; `ID Requisição` adicionado a
  `CONFIG.CAMPOS.APORTES_SOCIOS`/`RETIRADAS` (próximo "Criar Estrutura Base" cria a
  coluna, ativando a proteção contra duplicidade); lock duplo aninhado removido de
  `CompraService.salvarCompra`; texto residual "trade lock" removido do resumo
  financeiro.
- **Baixo/estética:** todos os `setValue()` célula-a-célula de saldo de sócio em
  `SociosService` agora passam por `SheetService.atualizarCamposLinha` (novo helper,
  protegido por lock, grava os campos relacionados numa única seção crítica) — essas
  gravações **não tinham nenhum lock antes**; `LogService.limparLogsAntigos` agora
  agrupa blocos contíguos num único `deleteRows()`; `BaseStyles.html`: adicionada a
  classe `.hint` (usada em várias telas do Portal — cadastro, aporte, retirada, etc. —
  mas nunca definida, then rendendo como texto sem estilo).
- **Deixado como está (decisão consciente, não bug):** `obterPrecoVigente` ignora
  `Estado/Condição` ao escolher o preço mais recente por produto — mudar isso é uma
  decisão de regra de negócio nova, não um bug óbvio; não implementado sem confirmar
  com o Kaique. `GovernanceService`: não foi implementado `removeEditors()` na
  proteção PROD (comentário deixado explicando o motivo) — o comportamento exato de
  quem mantém acesso de edição por padrão em `sheet.protect()` precisa ser confirmado
  na planilha real antes de restringir editores, para não travar os sócios fora do
  Portal.
- Testes com assert real adicionados em `99_Testes_Venda.js`
  (`testarVendaBloqueiaSaldoInsuficiente` e `testarVendaFIFOComMultiplosLotes` agora
  lançam erro em vez de só logar) — os demais arquivos `99_Testes_*.js` continuam sem
  assert automático (mudança maior, não feita nesta sessão).
- Todos os arquivos editados passaram por `node --check` (validação de sintaxe) antes
  de finalizar — sem erros.

**`clasp push`/`git push` já rodados nesta sessão** (na máquina do Kaique, não no
sandbox de nuvem) — código no GitHub e no Apps Script ao vivo atualizados. Rodado ao
vivo na planilha HML via automação de navegador:
- "1. Criar Estrutura Base": ✅ criou a coluna `ID Requisição` em `Aportes_Socios` e
  `Retiradas`, sem erros.
- "2. Instalar / Inicializar Sistema": revelou um bug pré-existente —
  `GovernanceService.aplicarProtecoesSilencioso` nunca tinha sido exportada na
  interface pública da IIFE; a limpeza desta sessão (remoção do bloco de fallback
  duplicado em `InstallService.instalar()`) tirou o disfarce que escondia isso.
  Corrigido (exportada), `clasp push`/`git push` de novo, confirmado via Health Check:
  abas protegidas foi de 0 para 13/16.
- "Validar Estrutura Completa": ✅ 100% — 26 abas, cabeçalhos, Config_App,
  Configuracoes todos presentes.

**Pendente:**
- **3 abas ainda sem proteção**: `Socios`, `Aportes_Socios`, `Retiradas` (as recém
  adicionadas a `ABAS_PROTEGIDAS` nesta sessão) apareceram como "Sem proteção" no
  Health Check mesmo depois do fix. Rodar "Instalação & Setup → Aplicar Proteções de
  Abas" de novo manualmente e conferir — não foi possível confirmar o resultado dessa
  rodada específica por instabilidade da automação de navegador (Google Sheets ficou
  sem responder a `screenshot`/CDP repetidamente; as ações via árvore de acessibilidade
  continuaram funcionando).
- `Portal.html` não ganhou um checkbox/campo para acionar `pagoDoBolsoPorSocio` no
  formulário de despesa — hoje só é utilizável via chamada direta ao backend.
- Cobertura de teste automatizado (assert real) ainda baixa fora dos dois testes de
  venda corrigidos — rateio de compra, participação societária, retirada máxima e
  reserva mínima de caixa continuam sem assert.
- Testes funcionais completos (ver `PLANO_DE_TESTES.md`) — ainda não executados nesta
  rodada.

## 2026-08-18

**Feito:**
- Aplicadas 7 reescritas de arquivo diretamente no projeto Apps Script ao vivo
  (`00_Config.gs`, `10_FinanceiroService.gs`, `12_UiService.gs`, `17_InstallService.gs`,
  `BaseStyles.html`, `Portal.html`, `BaseScripts.html`).
- "Criar Estrutura Base" rodada com sucesso — adicionou a coluna
  "Natureza (Fixa/Variável)" na aba `Despesas`.
- Grupo `Natureza Despesa` (valores `Fixa`/`Variável`) recriado na aba `Configuracoes`,
  depois de duas tentativas de digitação manual via automação de navegador falharem (ver
  `AUTOMACAO_NAVEGADOR.md`). Resolvido via função Apps Script temporária com
  `setValues()`.
- "Validar Estrutura Completa" retornou 100% ✅: abas (26), cabeçalhos, Config_App,
  Configuracoes.
- Repositório `mvp-1-5-pokemon-tcg` criado no GitHub; `clasp` configurado e autenticado
  na máquina do Kaique; 29 arquivos clonados do Apps Script para uma pasta local.
- Coletânea de documentos (`docs/`) montada, reaproveitando conteúdo do `AGENTS.md` e
  `REGRAS_CRITICAS.md` do repositório anterior (`gs_codex`).
- Descoberto e documentado: este sandbox de nuvem não consegue fazer `git push` nem
  `clasp login` (rede restrita) — esses passos precisam rodar na máquina do usuário.
- Confirmado que o `git init` + commits + push já tinham sido feitos na máquina do Kaique:
  `mvp-1-5-pokemon-tcg` está com `main` sincronizado com `origin/main`, working tree limpo,
  2 commits ("Estrutura inicial..." e "Corrige estrutura: move docs/ e README.md para a
  raiz"). Item de consolidação do repositório fechado.
- Decisão do Kaique sobre o bundle do `gs_codex` (histórico antigo, 28 commits terminando
  em "Remove CS Skins do escopo e adiciona módulo societário v1.6.0"): **não importar**.
  Confirmado por inspeção que o código atual já está limpo de CS Skins (só restam menções
  em `00_Config.js` e `REGRAS_DE_NEGOCIO.md` documentando que foi removido do escopo e não
  deve ser reintroduzido). O bundle não tem nada de valor que já não esteja resumido em
  `CONTEXTO.md`/`REGRAS_DE_NEGOCIO.md`. Bundle mantido apenas no Downloads do Kaique, sem
  branch de arquivo no repositório.
- `2. Instalar / Inicializar Sistema` rodado via menu MVP 1.5 na planilha HML (automação de
  navegador, clicando no menu real — sem digitar dado estruturado). Resultado: "INSTALAÇÃO
  CONCLUÍDA COM SUCESSO" — estrutura válida, 4 abas auxiliares ocultadas, 13 abas
  protegidas. Em seguida "Validar Estrutura Completa" confirmou 100% ✅ de novo (26 abas,
  cabeçalhos, Config_App, Configuracoes todos presentes) — planilha HML pronta pra uso.

**Pendente:**
- Testes funcionais completos (ver `PLANO_DE_TESTES.md`) — ainda não executados nesta
  rodada.

## Como usar este arquivo

Cada entrada de data é um resumo de sessão: o que foi feito, o que ficou pendente. Não
precisa ser exaustivo — o objetivo é uma pessoa (ou o Claude, numa sessão nova) conseguir
entender rapidamente onde o projeto parou sem reler a conversa inteira.
