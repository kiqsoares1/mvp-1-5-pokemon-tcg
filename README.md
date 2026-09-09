# MVP 1.5 — Pokémon TCG + Módulo Societário

Sistema de gestão em **Google Sheets + Google Apps Script** para os 3 sócios (Kaique,
Samuel, Lucas): produtos, compras, estoque por lote (FIFO), abertura/fracionamento de box,
vendas, financeiro gerencial e módulo societário (aportes, participação, retirada de lucro).
A interface real é o **Portal** (HTMLService) — ninguém digita direto na planilha.

## Referências

| O quê | Onde |
| --- | --- |
| Repositório (fonte de verdade) | https://github.com/kiqsoares1/mvp-1-5-pokemon-tcg |
| Planilha ativa (HML) `MVP_1_5_Pokemon_Homologacao` | https://docs.google.com/spreadsheets/d/1Ooz0mwU_n3VTtyrrFlK9A4DuGPe0yMUYqeUEfnQ2bIY/edit |
| Projeto Apps Script | https://script.google.com/u/0/home/projects/1TsopEvGWyLHPT7MmnXIHPJQV8r9dGSncHLoadk0JprztvDpnQJk1poKa/edit |
| Script ID (em `.clasp.json`) | `1TsopEvGWyLHPT7MmnXIHPJQV8r9dGSncHLoadk0JprztvDpnQJk1poKa` |
| Conta Google da planilha / Apps Script / clasp | `kmosoares@gmail.com` |

## Documentação

Toda a documentação vive em `docs/` — comece por `CONTEXTO.md`:

- [`docs/CONTEXTO.md`](docs/CONTEXTO.md) — visão geral, links, stack.
- [`docs/REGRAS_DE_NEGOCIO.md`](docs/REGRAS_DE_NEGOCIO.md) — regras de negócio (produtos,
  compras, estoque, vendas, financeiro, sócios).
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — organização do código, padrão de
  arquivos, fluxo de instalação.
- [`docs/DESIGN_GUIA.md`](docs/DESIGN_GUIA.md) — convenções visuais do Portal.
- [`docs/AUTOMACAO_NAVEGADOR.md`](docs/AUTOMACAO_NAVEGADOR.md) — armadilhas conhecidas de
  automação de navegador neste projeto (Google Sheets / Apps Script editor).
- [`docs/PLANO_DE_TESTES.md`](docs/PLANO_DE_TESTES.md) — roteiro de testes segmentado.
- [`docs/STATUS.md`](docs/STATUS.md) — o que foi feito e o que está pendente, por sessão.

## Estrutura do repositório

O código-fonte do Apps Script fica **na raiz** do repositório (não há pasta `src/`) —
é assim que o `.clasp.json` está configurado (`"rootDir": ""`), e por isso qualquer `.js`
solto na raiz é enviado ao Apps Script:

```
00_Config.js … 20_SociosService.js   — serviços do Apps Script (ordem de carga pelo prefixo)
99_Testes_*.js                       — suítes de teste, rodadas pelo menu/editor Apps Script
Portal.html, BaseStyles.html,
BaseScripts.html                     — o Portal (HTMLService)
appsscript.json                      — manifesto do projeto Apps Script
.clasp.json                          — vínculo com o projeto Apps Script (Script ID)
docs/                                — documentação de contexto (acima)
```

Detalhe de cada arquivo em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Sincronização com o Apps Script (clasp)

```
clasp pull   # trazer o que está no Apps Script para cá
clasp push   # enviar esta pasta para o Apps Script
```

**Sempre `clasp pull` antes de editar**, para não sobrescrever mudança feita direto no
editor do navegador.
