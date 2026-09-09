# Execução do Manager — POC 001

Você é o Claude Manager do projeto `pokemon-tcg-mvp`. Coordene esta execução usando exclusivamente as ferramentas MCP do AgentFlow para operar o pipeline. Leia `PROJECT.md`, `.ai-factory/economy.json` e `.ai-factory/poc-task.json`.

Objetivo aprovado para a etapa local: adicionar ao rodapé do Portal a identificação discreta `POC AI Factory`, seguindo `docs/DESIGN_GUIA.md`, sem alterar regras de negócio, dados ou comportamento existente.

Estado conhecido:

- Repositório: `C:\Users\kaiqu\Documents\mvp-1-5-pokemon-tcg`.
- Branch base: `main`; descubra/registre o HEAD atual no contexto da tarefa.
- AgentFlow está ativo na porta 3100.
- Use o agente `pokemon-developer`, modelo `codex:gpt-5.6-luna`.
- Não crie tarefa de QA ainda: a validação visual depende de `clasp push`, que é um gate humano.
- Uma única tarefa executora, `useWorktree=true`, `autoRetry=false`, `approval=auto`, prioridade medium.

Crie um pipeline chamado `pokemon-tcg-mvp :: POC visual :: pokemon-tcg-poc-001` com o diretório absoluto do repositório. Adicione uma tarefa Codex para:

1. Ler `PROJECT.md`, `.ai-factory/poc-task.json`, `docs/DESIGN_GUIA.md`, `Portal.html` e `BaseStyles.html`; ler `BaseScripts.html` somente se necessário.
2. Implementar a identificação visual pequena, acessível e discreta no rodapé do Portal. Não introduzir dependências, não tocar em serviços `.js`, não sincronizar com Apps Script e não operar o navegador.
3. Executar `git diff --check`, inspecionar o diff e criar um commit local na branch/worktree da tarefa.
4. Entregar um handoff curto contendo worktree, branch, SHA base/final, arquivos, verificações, riscos e indicação de que `clasp push` e QA estão pendentes.

Inicie o pipeline e acompanhe até a tarefa concluir, falhar, bloquear ou pedir interação. Você pode responder somente a pedidos necessários para leitura, edição dos arquivos de UI autorizados, verificações Git e commit local. Não autorize `clasp pull`, `clasp push`, acesso à planilha, Git push, merge, deploy, exclusões ou instalação.

Não use `complete_task` para fabricar sucesso. Se a execução bloquear, preserve IDs e reporte o pedido exato. Ao final, responda em texto conciso com IDs do pipeline/tarefa, status, branch/worktree, SHAs, arquivos e verificações. Pare no gate de sincronização.
