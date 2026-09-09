# ARQUITETURA.md

> Repositório: https://github.com/kiqsoares1/mvp-1-5-pokemon-tcg — índice dos documentos
> em [`README.md`](../README.md); visão geral e links da planilha/Apps Script em
> [`CONTEXTO.md`](CONTEXTO.md).

## Padrão de código

Cada arquivo `.js` de serviço é uma IIFE que expõe um objeto público, padrão
`NomeService = (function() { ... return { métodoPublico: fnPrivada, ... }; })();`.
Funções internas (privadas) geralmente terminam com `_`. Isso evita poluir o escopo global
do projeto Apps Script (todos os arquivos compartilham um único namespace global).

## Arquivos (na raiz do repositório)

Não existe pasta `src/`: o `.clasp.json` usa `"rootDir": ""`, então **todo `.js` na raiz
vai para o Apps Script**. O prefixo numérico define a ordem de carga no projeto Apps
Script (arquivos de um mesmo projeto compartilham um único escopo global).

```
00_Config.js                 — constantes globais: nomes de abas (CONFIG.ABAS.*), grupos de
                               configuração obrigatórios, defaults de Config_App.
01_Menu.js                   — monta o menu "MVP 1.5" na planilha (onOpen).
02_Utils.js                  — helpers genéricos (datas, formatação, validação simples).
                               `paraData(valor)` é o parser de data oficial: aceita Date,
                               dd/mm/aaaa e dd/mm/aaaa hh:mm:ss (usar sempre que ler data
                               de célula; `parsarData` só aceita a string).
03_SheetService.js           — camada de acesso a dados: ler/escrever linhas, cabeçalhos,
                               grupos de Configuracoes, cache de cabeçalhos. Interface
                               pública no final do arquivo (objeto de retorno da IIFE).
04_IdService.js              — geração de IDs únicos (ID Compra, ID Lote, ID Venda, etc.).
05_ValidationService.js      — validação de estrutura da planilha (abas, cabeçalhos,
                               Config_App, grupos de Configuracoes).
06_ProdutoService.js         — CRUD e regras de produto.
07_CompraService.js          — registro de compras, geração de lote, rateio de custo.
08_EstoqueService.js         — controle de lote, movimentos de estoque, abertura/fracionamento.
09_VendaService.js           — registro de venda, consumo FIFO, reconhecimento de lucro.
10_FinanceiroService.js      — Aportes_Resgates (fluxo de caixa da empresa), despesas.
11_PrecoReferenciaService.js — preço de referência / valor de mercado.
12_UiService.js              — funções chamadas pelo menu (abrir Portal, health check, etc.).
13_PriceAdapterService.js    — adaptação de fontes de preço externas.
14_LogService.js             — logging estruturado (INFO/WARNING/ERROR/CRITICAL).
                               (não há 15_ — número apenas pulado)
16_GovernanceService.js      — proteção de abas, ocultar abas auxiliares.
17_InstallService.js         — criarEstruturaBase() (idempotente, cria abas/colunas/seeds
                               faltantes sem apagar dados) e instalar() (valida e reporta,
                               não cria estrutura).
18_ProdutoMercadoService.js  — dados de mercado/preço por produto.
19_ProdutoPortalService.js   — endpoints usados pelo Portal para telas de produto.
20_SociosService.js          — sócios, aportes, participação (Historico_Participacoes),
                               retiradas de lucro, alerta MEI.
Portal.html                  — HTML principal do Portal (telas).
BaseStyles.html              — CSS compartilhado do Portal.
BaseScripts.html             — JS compartilhado do Portal (chamadas google.script.run, etc.).
appsscript.json              — manifesto do projeto Apps Script.
.clasp.json                  — vínculo com o projeto Apps Script (Script ID).
docs/                        — documentação de contexto (não sobe para o Apps Script).
```

## Testes (`99_Testes_*.js`)

Sobem junto com o resto e são rodados pelo editor do Apps Script (ou pelo menu, quando há
item). Roteiro manual complementar em [`PLANO_DE_TESTES.md`](PLANO_DE_TESTES.md).

```
99_Testes_E2E.js             — testarFluxoCompletoE2E(): fluxo real ponta a ponta
                               (produtos → despesa → compra com rateio → abertura de box →
                               venda → retirada), com assert em cada passo. Escreve na
                               planilha: só insere, nunca apaga/edita, tudo marcado `E2E`.
99_Testes_Compra.js          — compra e rateio de frete.
99_Testes_Venda.js           — venda, FIFO, lucro.
99_Testes_Financeiro.js      — aportes/resgates e despesas.
99_Testes_Socios.js          — testarModuloSocietarioCompleto(): participação, retirada
                               máxima, reserva mínima.
99_Testes_PrecoReferencia.js — preço de referência.
99_Testes_PriceAdapter.js    — adaptadores de preço externo.
99_Testes_ProdutoMercado.js  — dados de mercado por produto.
99_Testes_DadosDemo.js       — massa de dados de demonstração.
```

## Fluxo de instalação (menu "MVP 1.5")

1. **Instalação & Setup → "1. Criar Estrutura Base (planilha nova)"** —
   `InstallService.criarEstruturaBase()`: idempotente, cria abas/cabeçalhos faltantes e
   chama `_sincronizarColunasFaltantes` para adicionar colunas novas em abas já existentes
   (sem tocar em dados). **Não** semeia valores de listas em `Configuracoes` se a aba já
   tiver linhas — só semeia automaticamente quando a aba está totalmente vazia.
2. **Instalação & Setup → "2. Instalar / Inicializar Sistema"** —
   `InstallService.instalar()`: roda `ValidationService.validarSilencioso()` (só
   reporta problemas, não corrige), aplica proteções de abas, oculta abas auxiliares.
3. **Validação → "Validar Estrutura Completa"** — roda a validação completa e mostra um
   diálogo com checklist (abas, cabeçalhos, Config_App, grupos de Configuracoes).

## `Configuracoes` (lista de valores válidos)

Tabela chave-valor: colunas `Parâmetro | Valor | Tipo | Descrição | Ativo?`. Cada linha é
um valor válido para um grupo nomeado (ex.: grupo `Natureza Despesa`, valores `Fixa` e
`Variável`, uma linha por valor). Lida por
`SheetService.lerGrupoConfiguracoes(nomeGrupo)`, que filtra por
`String(linha[0]) === nomeGrupo && linha[1]` — **comparação estrita**: a coluna A precisa
bater exatamente com o nome do grupo, e a coluna B não pode estar vazia. Os grupos
obrigatórios estão em `CONFIG.GRUPOS_CONFIGURACOES_OBRIGATORIOS` (`00_Config.js`).

## Sincronização com o Git (clasp)

A partir de 2026-08-18, o código é sincronizado via `clasp` entre o Apps Script e este
repositório:

```
clasp pull    # traz o que está no Apps Script para a pasta local
clasp push    # envia a pasta local para o Apps Script
```

**Sempre `clasp pull` antes de editar**, para não sobrescrever mudanças feitas direto no
editor do navegador (ex.: por mim, via automação, quando precisar).
