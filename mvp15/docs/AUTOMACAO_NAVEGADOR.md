# AUTOMACAO_NAVEGADOR.md

Aprendizados de automação de navegador (Chrome via `mcp__claude-in-chrome__*`) neste
projeto, especificamente Google Sheets e o editor do Apps Script. Ler antes de fazer
qualquer edição via navegador — evita repetir os mesmos erros.

## Regra geral: preferir código a digitação simulada

Sempre que possível, **não digite dados diretamente numa célula do Google Sheets via
automação de teclado**. Prefira escrever uma função Apps Script temporária que use
`sheet.getRange(...).setValues([...])` e rodá-la uma vez pelo editor. É mais confiável,
atômico e fácil de reverter. Só usar digitação direta na planilha para ações realmente
pontuais de UI (clicar em menu, abrir diálogo, etc.), nunca para inserir várias células de
dado estruturado.

## Bug confirmado: `\t` (tab) na ação `type` não navega células

A ação `computer` com `action: "type"` e uma string contendo `\t` **não** é interpretada
como tecla Tab dentro do Google Sheets — o caractere de tab é digitado literalmente dentro
da célula focada. Resultado: uma linha inteira pretendida para 5 colunas vira um único
texto tab-separado na coluna A, com as demais colunas vazias.

**Também falhou**: usar `key: "Tab"` como ação separada entre chamadas de `type` — o
diálogo "Pense bem!" (ver abaixo) pode interceptar as teclas no meio da sequência e
espalhar os dados nas células erradas.

**Solução que funcionou**: escrever uma função Apps Script temporária com
`setValues()` para gravar a linha inteira de uma vez, rodar via "Executar" no editor, e
depois apagar a função. Ver exemplo real (já removido do código) que resolveu o grupo
`Natureza Despesa` faltante em `Configuracoes` em 2026-08-18.

## Diálogo "Pense bem!" em abas protegidas

Editar uma aba que tem proteção aplicada (a maioria, depois do "Instalar Sistema") sempre
dispara um diálogo de confirmação "Pense bem! Você está tentando editar uma parte da
página que não deve ser alterada acidentalmente." — é preciso clicar "OK" explicitamente
(não "Cancelar") para a edição prosseguir. Esse diálogo pode reaparecer a cada
clique/edição numa sequência de vários passos, e se não for tratado a cada vez, pode
"engolir" as teclas seguintes e causar dados nas células erradas.

## Erro de rede/API do GitHub neste sandbox

Este ambiente de nuvem (onde Claude roda o `Bash`) tem uma allowlist de rede restrita:

- `gh api` e chamadas à API REST/GraphQL do GitHub (`api.github.com`) retornam 403
  "sessions are bound to their configured repositories" — não é possível criar
  repositórios nem usar a maior parte da API do GitHub por aqui, mesmo com um token
  válido.
- `git push` para qualquer repositório (mesmo um recém-criado, mesmo com token válido)
  também é bloqueado pelo proxy Git do ambiente: "access denied by the git proxy: ... is
  not in this session's authorized repository set". Ou seja, **push sempre precisa ser
  feito da máquina do usuário**, nunca deste sandbox.
- `git clone`/`git ls-remote` de repositórios (leitura) funcionam normalmente.
- `oauth2.googleapis.com` também está bloqueado — **não é possível completar
  `clasp login` de dentro deste sandbox**, mesmo usando o fluxo manual
  `--no-localhost` (a troca do código de autorização pelo token falha com
  "request blocked: no rule or allowlist entry allows host"). O login do `clasp` precisa
  ser feito na máquina do usuário.

**Conclusão prática**: peça para o usuário rodar `clasp login`, `clasp push`/`pull` e
`git push` na própria máquina. Claude pode preparar os comandos exatos, ler/editar
arquivos localmente (quando tiver acesso via device bridge) ou orientar passo a passo, mas
não deve tentar repetidamente contornar essas travas de rede — é limitação de
infraestrutura, não erro de execução.

## Checklist antes de editar o editor do Apps Script via navegador

1. Confirmar por screenshot que o cursor está de fato no editor de código (não na caixa de
   busca Ctrl+F, que pode ter perdido o foco silenciosamente).
2. Nunca fazer `Ctrl+A` seguido de `type(...)` sem antes confirmar visualmente onde o
   cursor está — um clique errado pode selecionar o arquivo inteiro e sobrescrevê-lo com o
   texto digitado (já aconteceu nesta sessão; foi revertido com `Ctrl+Z` repetido a tempo).
3. Preferir `Ctrl+End` para ir ao fim do arquivo antes de adicionar código novo, em vez de
   clicar numa coordenada aproximada da última linha.
4. Depois de editar, salvar (`Ctrl+S`) e conferir visualmente (screenshot) antes de rodar.
