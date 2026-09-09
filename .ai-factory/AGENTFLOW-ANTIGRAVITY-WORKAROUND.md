# Workaround local — AgentFlow com Antigravity no Windows

## Problema observado

O AgentFlow inicia `agy --print` com o diretório correto, mas a Antigravity CLI `1.1.28` pode manter um projeto padrão anterior e procurar arquivos em `~/.gemini/antigravity-cli`. Em modo headless, isso resulta em negação de `read_file` e saída vazia.

## Ajuste aplicado

No cache local do AgentFlow `1.3.3`, o executor passou a adicionar o diretório da tarefa com `--add-dir` em toda execução Antigravity. O teste isolado confirmou que `PROJECT.md` passou a ser lido corretamente.

Arquivo local alterado:

`C:\Users\kaiqu\AppData\Local\npm-cache\_npx\efd73fc2e132425f\node_modules\@argustech\agentflow\dist-server\server\executor\cli-executor.js`

O ajuste é local e pode desaparecer quando o cache do `npx` ou a versão do AgentFlow mudar. Antes de atualizar, verificar se a versão nova já inclui comportamento equivalente.

## Permissões

O arquivo `~/.gemini/antigravity-cli/settings.json` permite somente navegação e interação nos domínios Google necessários ao HML. Comandos e gravações não receberam liberação automática.

## Limitação restante

A CLI executou o agente e gerou o relatório estático, porém não disponibilizou uma ferramenta de navegador conectado à sessão Google. Para QA visual automatizado, será necessário configurar um MCP de navegador compatível com a Antigravity CLI ou executar a verificação no navegador da tarefa após autenticação humana.
