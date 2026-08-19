# MVP 1.5 — Pokémon TCG + Módulo Societário

Sistema de gestão em Google Sheets + Google Apps Script para os sócios. Ver a pasta `docs/` para todo o contexto do projeto:

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

O código-fonte real do Apps Script fica em `/src`, sincronizado via `clasp`:

```
clasp pull   # trazer o que está no Apps Script para cá
clasp push   # enviar esta pasta para o Apps Script
```
