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
