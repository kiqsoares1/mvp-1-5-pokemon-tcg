# ARQUITETURA.md

## Padrão de código

Cada arquivo `.gs` de serviço é uma IIFE que expõe um objeto público, padrão
`NomeService = (function() { ... return { métodoPublico: fnPrivada, ... }; })();`.
Funções internas (privadas) geralmente terminam com `_`. Isso evita poluir o escopo global
do projeto Apps Script (todos os arquivos compartilham um único namespace global).

## Arquivos (em `/src`)

```
00_Config.gs               — constantes globais: nomes de abas (CONFIG.ABAS.*), grupos de
                              configuração obrigatórios, defaults de Config_App.
01_Menu.gs                  — monta o menu "MVP 1.5" na planilha (onOpen).
02_Utils.gs                  — helpers genéricos (datas, formatação, validação simples).
03_SheetService.gs          — camada de acesso a dados: ler/escrever linhas, cabeçalhos,
                              grupos de Configuracoes, cache de cabeçalhos. Interface
                              pública no final do arquivo (objeto de retorno da IIFE).
04_IdService.gs             — geração de IDs únicos (ID Compra, ID Lote, ID Venda, etc.).
05_ValidationService.gs     — validação de estrutura da planilha (abas, cabeçalhos,
                              Config_App, grupos de Configuracoes).
06_ProdutoService.gs        — CRUD e regras de produto.
07_CompraService.gs         — registro de compras, geração de lote, rateio de custo.
08_EstoqueService.gs        — controle de lote, movimentos de estoque, abertura/fracionamento.
09_VendaService.gs          — registro de venda, consumo FIFO, reconhecimento de lucro.
10_FinanceiroService.gs     — Aportes_Resgates (fluxo de caixa da empresa), despesas.
11_PrecoReferenciaService.gs — preço de referência / valor de mercado.
12_UiService.gs             — funções chamadas pelo menu (abrir Portal, health check, etc.).
13_PriceAdapterService.gs   — adaptação de fontes de preço externas.
14_LogService.gs            — logging estruturado (INFO/WARNING/ERROR/CRITICAL).
16_GovernanceService.gs     — proteção de abas, ocultar abas auxiliares.
17_InstallService.gs        — criarEstruturaBase() (idempotente, cria abas/colunas/seeds
                              faltantes sem apagar dados) e instalar() (valida e reporta,
                              não cria estrutura).
18_ProdutoMercadoService.gs — dados de mercado/preço por produto.
19_ProdutoPortalService.gs  — endpoints usados pelo Portal para telas de produto.
20_SociosService.gs         — sócios, aportes, participação, retiradas, alerta MEI.
Portal.html                  — HTML principal do Portal (telas).
BaseStyles.html              — CSS compartilhado do Portal.
BaseScripts.html             — JS compartilhado do Portal (chamadas google.script.run, etc.).
appsscript.json              — manifesto do projeto Apps Script.
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
obrigatórios estão em `CONFIG.GRUPOS_CONFIGURACOES_OBRIGATORIOS` (`00_Config.gs`).

## Sincronização com o Git (clasp)

A partir de 2026-08-18, o código é sincronizado via `clasp` entre o Apps Script e este
repositório:

```
clasp pull    # traz o que está no Apps Script para a pasta local
clasp push    # envia a pasta local para o Apps Script
```

**Sempre `clasp pull` antes de editar**, para não sobrescrever mudanças feitas direto no
editor do navegador (ex.: por mim, via automação, quando precisar).
