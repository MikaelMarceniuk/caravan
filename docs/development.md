# Caravan — Padrões de desenvolvimento

> Como escrevemos código neste projeto: o que vale para toda tarefa, independente do marco.
> As decisões de arquitetura estão em [`architecture.md`](./architecture.md); o vocabulário, em [`CONTEXT.md`](../CONTEXT.md).
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
- **Idioma:** `lang="en"` (a interface é em inglês).

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
- **Nome descreve o comportamento** na linguagem do domínio ([`CONTEXT.md`](../CONTEXT.md)): "rejeita stop que sobrepõe outro", não "testa validateStop".

### Seams do projeto (proposta)

| Área | Seam | Como |
|---|---|---|
| `packages/core` | `decide()` e as mutations de cada op | Funções puras: entrada → saída, sem mock |
| `packages/sync` | API pública do pacote | Portas `Transport`/`Storage`/`Clock` com fakes |
| `apps/api` | WS e REST | API real + Postgres + Redis do compose |
| `apps/web` | O que o usuário vê | `bun test` + Testing Library + happy-dom, buscando por role e label (o que também cobra a acessibilidade) |
| Fluxos | Navegador | Playwright |

Os níveis (unit, propriedade, integração, chaos, E2E, carga) e as ferramentas estão em [`architecture.md`](./architecture.md) §14.

### Mocks

- **Só nas bordas do sistema:** rede externa (Photon, Resend), relógio, aleatoriedade.
- **Nunca** mockar um módulo nosso nem o banco: a integração roda contra Postgres e Redis de verdade.

### Quando não precisa de TDD

- **Spikes:** código descartável para responder uma pergunta. Se a resposta for "funciona", o código de verdade é reescrito com TDD.
- **Estilo visual puro** (espaçamento, cor): verificado no checklist de "tela pronta", não em teste.

### Em aberto

- Onde ficam os testes: ao lado do código (`*.test.ts`) ou em `tests/`?
- Nome dos testes em inglês (como o código) ou português?
- Cobertura mínima na CI, ou só "todos os testes passam"?
