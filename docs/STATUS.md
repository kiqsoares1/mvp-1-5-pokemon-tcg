# STATUS.md

Atualizar a cada sessão relevante — o que mudou, o que ficou pendente. Manter curto; para
detalhe de regra de negócio ver `REGRAS_DE_NEGOCIO.md`, para arquitetura ver
`ARQUITETURA.md`.

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
usar heredoc com delimitador entre aspas simples.

**Pendente:**
- `git push` — a `main` local está 1 commit atrás do `origin/main` (commit `fee53fa`
  "Update README.md", feito direto no GitHub). Precisa de `git pull --rebase` antes.
- Rodar **"Criar Estrutura Base"** e conferir o grupo `Formas Pagamento Sócio` na aba
  `Configuracoes`: a lista encolheu de 5 para 4 valores e é preciso confirmar se a
  instalação remove o valor obsoleto `Despesa Convertida` ou apenas reescreve os
  presentes (pode sobrar linha para apagar à mão).
- Verificar se algum aporte já lançado na HML usa `Despesa Convertida` como forma de
  pagamento — se usar, decidir se corrige o registro ou mantém como histórico.
- Abrir o Portal na HML e confirmar que a tela de Aporte carrega sem erro depois do push.

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
