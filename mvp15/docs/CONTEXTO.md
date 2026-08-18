# CONTEXTO.md — Visão Geral do Projeto

## O que é

**MVP 1.5/1.6 — Gestão Pokémon TCG + Módulo Societário**

Sistema em **Google Sheets + Google Apps Script** para os 3 sócios (Kaique, Samuel, Lucas)
controlarem juntos: produtos, compras, estoque por lote (FIFO), abertura/fracionamento de
box, vendas, financeiro gerencial (aportes, resgates, despesas), preço de referência e o
módulo societário (aportes, participação proporcional, retiradas de lucro).

A interface real é o **Portal** (HTMLService: `Portal.html`, `BaseStyles.html`,
`BaseScripts.html`) — o usuário não digita nada direto na planilha nem usa `ui.prompt`.

## Links

- Planilha ativa (HML): `https://docs.google.com/spreadsheets/d/1Ooz0mwU_n3VTtyrrFlK9A4DuGPe0yMUYqeUEfnQ2bIY/edit`
  (nome: `MVP_1_5_Pokemon_Homologacao`)
- Projeto Apps Script: `https://script.google.com/u/0/home/projects/1TsopEvGWyLHPT7MmnXIHPJQV8r9dGSncHLoadk0JprztvDpnQJk1poKa/edit`
  (Script ID: `1TsopEvGWyLHPT7MmnXIHPJQV8r9dGSncHLoadk0JprztvDpnQJk1poKa`)
- Repositório GitHub (fonte de verdade a partir de 2026-08-18): `https://github.com/kiqsoares1/mvp-1-5-pokemon-tcg`
- Conta Google usada na planilha/Apps Script/clasp: `kmosoares@gmail.com`

## Histórico do repositório

Existiu um repositório anterior, `github.com/kiqsoares1/gs_codex`, criado numa sessão
anterior de trabalho com Claude. Ele tem histórico de commits real e documentos valiosos
(este `CONTEXTO.md`, `REGRAS_DE_NEGOCIO.md` e boa parte do resto desta pasta foram
adaptados de lá). A partir de 2026-08-18, o projeto passou a usar o repositório
`mvp-1-5-pokemon-tcg` como fonte de verdade. Um bundle Git com todo o histórico do
`gs_codex` (incluindo 3 commits que nunca chegaram a ser enviados ao GitHub) foi entregue
ao Kaique separadamente, caso ele queira importar esse histórico.

## Stack técnica

- **Google Sheets**: base operacional (todas as abas/tabelas).
- **Google Apps Script**: motor de regras, validações, gravações, IDs, logs, proteções.
- **HTMLService**: Portal com telas reais, já em produção.
- **clasp** (`@google/clasp`): sincroniza o código do Apps Script com este repositório Git.
  Configurado em 2026-08-18 — rodar `clasp login` (uma vez) e depois `clasp push`/`clasp pull`
  a partir da pasta local clonada.

## Estrutura deste repositório

```
/src        — código-fonte real do Apps Script (.gs e .html), sincronizado via clasp
/docs       — esta coletânea de documentos de contexto
/tests      — roteiros de teste manuais (herdados do gs_codex, quando aplicável)
```

## Papéis

- **Kaique**: dono do produto, decide regras de negócio, roda o Portal no dia a dia.
- **Claude**: mantém e evolui o código, documentação e testes, entre sessões — por isso
  esta pasta `docs/` existe: para não depender da memória de uma conversa específica.
