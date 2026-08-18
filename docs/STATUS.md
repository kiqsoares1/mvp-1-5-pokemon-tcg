# STATUS.md

Atualizar a cada sessão relevante — o que mudou, o que ficou pendente. Manter curto; para
detalhe de regra de negócio ver `REGRAS_DE_NEGOCIO.md`, para arquitetura ver
`ARQUITETURA.md`.

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

**Pendente:**
- Rodar `git init` + primeiro commit + push na pasta local do Kaique (código clonado via
  clasp + esta pasta `docs/`), consolidando tudo em `mvp-1-5-pokemon-tcg`.
- Testes funcionais completos (ver `PLANO_DE_TESTES.md`) — ainda não executados nesta
  rodada; a sessão foi interrompida para reestruturar o projeto em repositório/documentos
  antes de prosseguir.
- Repositório `gs_codex` (anterior) tinha 3 commits nunca enviados ao GitHub; foram
  empacotados num bundle Git e entregues ao Kaique separadamente, para importar se quiser
  preservar aquele histórico.
- `2. Instalar / Inicializar Sistema` estava prestes a ser rodado quando a sessão mudou de
  foco para a reorganização do repositório — falta confirmar que roda limpo depois da
  correção do `Natureza Despesa`.

## Como usar este arquivo

Cada entrada de data é um resumo de sessão: o que foi feito, o que ficou pendente. Não
precisa ser exaustivo — o objetivo é uma pessoa (ou o Claude, numa sessão nova) conseguir
entender rapidamente onde o projeto parou sem reler a conversa inteira.
