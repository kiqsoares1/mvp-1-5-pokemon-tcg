# AI Factory neste projeto

Esta pasta adapta a documentação geral da AI Factory ao repositório Pokémon TCG. Os arquivos são contratos para o Manager; o AgentFlow não os importa automaticamente.

## Estado atual

- Git: limpo antes da criação destes arquivos; branch `main` alinhada a `origin/main` no commit `c30e4f1`.
- Node: `v22.16.0`, compatível com os requisitos declarados pelo AgentFlow.
- Git: `2.55.0.windows.4`.
- Codex CLI: disponível (`0.153.4`).
- clasp: disponível (`3.3.0`).
- Claude CLI: instalada (`2.1.266`) e autenticada com assinatura Claude Pro.
- Antigravity CLI (`agy`): instalada (`1.1.28`), autenticada e com smoke test direto aprovado.
- AgentFlow: `1.3.3`, ativo em `http://127.0.0.1:3100`, MCP conectado ao Claude neste projeto.
- AgentFlow seguro para a POC: uma tarefa concorrente, permissões automáticas desligadas, aprovação manual, retries nativos desligados e raiz apontada para este repositório.
- Perfis criados: `pokemon-manager`, `pokemon-developer` e `pokemon-qa`.
- Codex: login ChatGPT ativo e smoke test direto em sandbox somente leitura aprovado.

## Arquivos

- `../PROJECT.md`: contexto curto e regras do projeto.
- `project.json`: cadastro local deste projeto.
- `economy.json`: limites da POC.
- `poc-task.json`: tarefa candidata, ainda em rascunho.
- `handoff-template.json`: contrato de saída.

## Ordem prática

1. Executar planejamento curto → Codex em worktree.
2. Revisar o diff concreto no gate de sincronização.
3. Após autorização, sincronizar homologação → Antigravity no navegador.
4. Revisar evidências e decidir sobre merge/push.

Nenhuma alteração de produto, sincronização com Apps Script, planilha ou repositório remoto foi feita ao criar esta configuração. As instalações das CLIs e configurações do AgentFlow são locais à máquina/usuário; o MCP do Claude foi cadastrado com escopo local deste projeto.
