# Escritório visual da AI Factory

## O que foi instalado

O Pixtuoid `0.18.0` está instalado globalmente e conectado às fontes `claude-code`, `codex` e `antigravity`. Ele observa as sessões dessas CLIs, inclusive quando iniciadas pelo AgentFlow. Não há adaptador nativo para representar pipelines do AgentFlow como uma fonte própria.

## Como acessar

- Painel operacional: `http://127.0.0.1:3100`
- Escritório visual: janela flutuante do Pixtuoid.
- Reabrir o escritório: `.ai-factory/scripts/start-office.ps1`
- Diagnóstico: `pixtuoid doctor --graphics off`

Os atalhos `AI Factory - AgentFlow` e `AI Factory - Escritorio` foram instalados na pasta de inicialização do Windows.

## Relação entre as telas

- AgentFlow mostra pipelines, tarefas, agentes, logs e consumo.
- Pixtuoid mostra visualmente a atividade das sessões de Claude, Codex e Antigravity.
- O Claude Manager coordena; Codex implementa; Antigravity executa QA com o Playwright MCP quando o perfil do navegador estiver autenticado.

## Limitação atual

O perfil persistente do Playwright é separado do navegador normal. Na primeira execução de QA que exigir a conta Google, será necessário autenticar essa janela uma vez. Depois, os cookies ficam no perfil local ignorado pelo Git.
