# DESIGN_GUIA.md

Convenções visuais do Portal (`Portal.html` + `BaseStyles.html` + `BaseScripts.html`).
Consultar antes de adicionar/alterar telas, para manter consistência.

## Princípios

- **Baixo atrito**: o usuário nunca digita em `ui.prompt` nem edita a planilha
  diretamente. Toda interação é tela + botão dentro do Portal.
- **Campos com sugestão, não obrigatórios**: onde faz sentido (País/Região, Idioma,
  Coleção/Jogo, etc.), usar `<datalist>` para sugerir valores já usados, mas sempre
  permitir digitar um valor novo.
- **Poucas abas visíveis**: abas técnicas/auxiliares ficam ocultas por padrão
  (`GovernanceService`); o usuário só vê o que precisa operar no dia a dia.
- **Alertas não bloqueantes**: como o de faturamento MEI — avisa, não impede a operação.

## Estrutura de arquivos de estilo

- `BaseStyles.html`: CSS compartilhado — cores, tipografia, componentes reutilizáveis
  (cards, botões, tabelas, formulários). Alterações de paleta/tema entram aqui.
- `BaseScripts.html`: JS compartilhado — wrappers de `google.script.run`, tratamento de
  erro/loading, utilidades de formatação usadas em várias telas.
- `Portal.html`: marcação das telas em si; inclui os dois arquivos acima via
  `<?!= include('BaseStyles') ?>` / `<?!= include('BaseScripts') ?>` (padrão HTMLService).

## Ao adicionar uma tela nova

1. Verificar se algum componente de `BaseStyles.html` já serve (card, tabela, formulário)
   antes de criar CSS novo.
2. Reaproveitar os helpers de `BaseScripts.html` para chamar o backend
   (`google.script.run.withSuccessHandler(...).withFailureHandler(...)`).
3. Cards de alerta (como o de MEI) devem seguir o mesmo padrão visual dos já existentes —
   não bloqueiam a tela, aparecem como card informativo.
4. Testar em desktop (a planilha normalmente é usada em navegador, não celular) — não é
   prioridade responsividade mobile agressiva, mas evitar quebra óbvia de layout.

## Pendências de design (não bloqueantes)

- Nenhuma pendência crítica registrada nesta versão do documento. Atualizar aqui sempre
  que uma limitação visual for identificada e adiada de propósito.
