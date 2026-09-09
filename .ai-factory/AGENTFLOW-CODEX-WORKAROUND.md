# Workaround local — escrita segura do Codex no AgentFlow 1.3.3

## Problema observado

Com `cli_skip_permissions=false`, o AgentFlow 1.3.3 chama `codex exec` sem escolher um modo de sandbox. No Codex CLI 0.153.4 instalado nesta máquina, isso resultou em worktree somente leitura e a tarefa não conseguiu aplicar o patch.

Com `cli_skip_permissions=true`, a distribuição original acrescenta `--dangerously-bypass-approvals-and-sandbox`, removendo sandbox e aprovações. Esse modo não foi aceito para a POC.

## Correção local aplicada

No runtime do AgentFlow mantido pelo cache do `npx`, o argumento Codex usado quando a configuração está ativa foi trocado por:

```text
--approve-for-me
```

O próprio help do Codex descreve essa opção como revisão automática de pedidos dentro do sandbox `workspace-write`. Assim, a tarefa consegue escrever na worktree sem receber acesso irrestrito ao computador.

Depois da alteração, `cli_skip_permissions` pode ficar `true` apenas durante a tarefa Codex. Ele deve voltar a `false` antes de executar Claude, Antigravity ou qualquer outro provedor, porque os argumentos desses provedores não foram alterados.

## Limitação

O arquivo corrigido fica em cache e pode ser recriado por uma atualização, limpeza do npm ou outro caminho de cache. Antes de nova execução, conferir o comando efetivo. A solução durável é o AgentFlow oferecer uma opção por provedor/tarefa para `codex exec --approve-for-me` ou `--sandbox workspace-write`.

Esta mudança não altera o repositório do produto nem o pacote publicado. Ela precisa ser reavaliada ao atualizar AgentFlow ou Codex.
