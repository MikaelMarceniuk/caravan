# Caravan — Padrões de desenvolvimento

> Como escrevemos código neste projeto: o que vale para toda tarefa, independente do marco.
> As decisões de arquitetura estão em [`architecture.md`](./architecture.md); o vocabulário, em [`CONTEXT.md`](../../CONTEXT.md).
> Rascunho: cada seção termina com o que ainda está em aberto.

---

## 1. Responsividade e acessibilidade

**Regra:** fazem parte do "pronto" de cada tela e componente. Não existe marco de "deixar responsivo" ou "deixar acessível" depois.

**Meta:** WCAG 2.2 nível AA, na web, em celular e desktop.

### Responsividade

- **Mobile-first:** o estilo base é o do celular; telas maiores entram por breakpoint.
- **Larguras de referência:** 360 px (celular), 768 px (tablet), 1280 px (desktop). Sem rolagem horizontal da página a partir de 320 px.
- **Toque:** alvos de toque com pelo menos 44 × 44 px.
- **Nada só no hover:** toda ação que aparece no hover também é alcançável por toque e teclado.
- **Drag & drop** tem três caminhos: ponteiro (mouse e toque), teclado e uma alternativa sem arrastar (ex.: menu "Mover para…"). A alternativa sem arrastar é exigência da WCAG 2.5.7.
- **Sheets e dialogs** viram tela cheia no celular.

### Acessibilidade

- **HTML semântico primeiro:** `button`, `a`, `label`, `nav`, `main`, headings em ordem. ARIA só quando o HTML nativo não resolve.
- **Teclado:** tudo operável sem mouse, foco sempre visível, ordem de foco lógica. Sheets e dialogs prendem o foco, fecham com `Esc` e devolvem o foco para quem os abriu.
- **Formulários:** todo campo tem `label`; erros ficam ligados ao campo (`aria-describedby`) e são anunciados. Vale também para rejeições do servidor (`stop_overlap`, `outside_trip`), quando o formulário reabre com os dados do usuário.
- **Tempo real:** mudanças remotas relevantes são anunciadas por `aria-live="polite"`, com throttle. Uma mudança remota nunca rouba o foco de quem está editando.
- **Cor:** contraste AA validado nos `tokens`, inclusive texto sobre as cores dos stops. Cor nunca é a única informação (o membro tem cor **e** iniciais ou nome).
- **Movimento:** animações respeitam `prefers-reduced-motion`.
- **Zoom:** a interface funciona com zoom de 200%.
- **Idioma:** o `lang` do `<html>` segue o idioma escolhido (`pt-BR` ou `en-US`, D34).

### Checklist de "tela pronta"

- [ ] Funciona em 360 px e em 1280 px
- [ ] Dá para usar só com teclado, com foco visível
- [ ] Passou num leitor de tela (Orca ou NVDA no desktop, TalkBack no Android)
- [ ] Sem violações no axe
- [ ] Animações respeitam `prefers-reduced-motion`

### Em aberto

- Ferramentas de verificação automática (ex.: `@axe-core/playwright` no E2E, `axe-core` nos testes de componente com happy-dom). Conferir no setup da web o que o axe consegue checar sem navegador real.
- Os breakpoints viram tokens do tema ou ficam os padrões da lib de UI?

---

## 2. TDD

**Regra:** código de produção nasce de um teste que falha. Ciclo **red → green**, uma fatia vertical por vez.

### O ciclo

1. **Red:** escrever **um** teste que descreve um comportamento e vê-lo falhar pelo motivo certo.
2. **Green:** escrever só o código necessário para ele passar. Nada de antecipar o próximo teste.
3. Repetir. Cada teste é uma *tracer bullet* que responde ao que o ciclo anterior ensinou.

- **Nada de escrever todos os testes antes** (fatia horizontal): eles acabam testando a forma imaginada do código, não o comportamento.
- **Refatoração fica fora do ciclo:** acontece na revisão, com os testes verdes como rede de proteção.
- **Bug começa com um teste** que o reproduz.

### O que é um bom teste

- **Testa comportamento por uma interface pública** (*seam*), nunca detalhes internos. Se o teste quebra num refactor que não mudou o comportamento, o teste estava errado.
- **Seams combinados antes:** antes de escrever testes de uma área, decidimos em quais interfaces públicas eles vão ficar.
- **Valor esperado vem de fonte independente** (um literal conhecido, um exemplo do design, a regra do domínio), nunca recalculado do jeito que o código calcula.
- **Nome descreve o comportamento** na linguagem do domínio ([`CONTEXT.md`](../../CONTEXT.md)): "rejects a stop that overlaps another", não "tests validateStop". Nomes de teste em inglês, como o código.

### Seams do projeto (proposta)

| Área | Seam | Como |
|---|---|---|
| `packages/core` | `decide()` e as mutations de cada op | Funções puras: entrada → saída, sem mock |
| `packages/sync` | API pública do pacote | Portas `Transport`/`Storage`/`Clock` com fakes |
| `apps/api` | WS e REST | API real + Postgres + Redis do compose |
| `apps/web` | O que o usuário vê | `bun test` + Testing Library + happy-dom, buscando por role e label (o que também cobra a acessibilidade) |
| Fluxos | Navegador | Playwright |

Os níveis (unit, propriedade, integração, chaos, E2E, carga) e as ferramentas estão em [`architecture.md`](./architecture.md) §14.

### Onde ficam os testes

- Um diretório `__tests__/` por pacote ou app, espelhando o `src/`: `packages/core/src/stops/stop.ts` → `packages/core/__tests__/stops/stop.test.ts`.

### Mocks

- **Só nas bordas do sistema:** rede externa (Photon, Resend), relógio, aleatoriedade.
- **Nunca** mockar um módulo nosso nem o banco: a integração roda contra Postgres e Redis de verdade.

### Quando não precisa de TDD

- **Spikes:** código descartável para responder uma pergunta. Se a resposta for "funciona", o código de verdade é reescrito com TDD.
- **Estilo visual puro** (espaçamento, cor): verificado no checklist de "tela pronta", não em teste.

### Em aberto

- Cobertura mínima na CI, ou só "todos os testes passam"? Decidir ao configurar os testes. O TDD é obrigatório de qualquer forma.

---

## 3. Convenções do repositório

### Commits

- **Conventional Commits, numa linha só, sem corpo:** `tipo(escopo): descrição`, em inglês. O porquê vai na descrição do PR.
- **Tipos:** `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `ci`, `chore`.
- **Escopo:** a parte do monorepo tocada (`core`, `sync`, `api`, `web`, `tokens`, `deploy`). Pode ficar vazio quando o commit pega várias.

### Branches e PRs

- **Nada de commit direto na `master`.** Todo trabalho vai numa branch curta `tipo/descricao` (ex.: `feat/stop-overlap`) e entra por PR.
- **O CI precisa passar** antes do merge, mesmo trabalhando sozinho.
- **Squash merge:** cada PR vira um commit na `master`, com o título do PR como mensagem. Por isso o título do PR segue o formato dos commits.
- O PR preenche o template (`.github/pull_request_template.md`).

### Idioma

| O quê | Idioma |
|---|---|
| Código, nomes de teste, commits, PRs | en-US |
| Docs do projeto, de features e de bugfixes | en-US |
| README (para recrutadores) | en-US (`README.md`) e pt-BR (`README.pt-BR.md`), com link entre os dois, atualizados no mesmo PR |
| Interface | pt-BR e en-US (D34) |

### Docs

```
docs/
  project/     documentação do projeto: architecture, deploy, development, planner, open-topics
  design/      telas do design
  features/    um doc por feature, com o nome da branch (feat/stop-overlap → stop-overlap.md)
  bugfix/      um doc por bugfix, com o nome da branch (fix/lock-renewal → lock-renewal.md)
CONTEXT.md     glossário do domínio
README.md      vitrine em en-US, com link para README.pt-BR.md
```
