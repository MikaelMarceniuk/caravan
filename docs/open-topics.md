# Caravan — Pendências

> Lista única do que falta decidir, conferir ou arrumar.
> As decisões já tomadas estão em [`architecture.md`](./architecture.md) §0 e em [`deploy.md`](./deploy.md) §0; o vocabulário, em [`CONTEXT.md`](../CONTEXT.md).
> Não há cronograma: cada item diz **o que ele bloqueia**. Quando um item for decidido, ele sai daqui e vira uma linha no §0 do documento certo. Os números são fixos: o de um item decidido não é reaproveitado.
> Última revisão: 2026-10-23.

---

## Resumo

| # | Assunto | Bloqueia | Peso |
|---|---|---|---|
| **A. Antes do primeiro código** ||||
| 1 | Roadmap de features (v1, v2, v3…) no lugar do cronograma | Tudo | 🔴 |
| 2 | Datas da viagem × datas dos stops | Schema de `trips`, NewTrip | 🔴 |
| 3 | Validação: Zod ou TypeBox (`t`) do Elysia | `packages/core` | 🔴 |
| 4 | Driver do Postgres e pool de conexões | Setup do Drizzle | 🔴 |
| 6 | Membros e convites: REST antes do pipeline de ops | REST de membros/convites | 🟠 |
| 7 | Stack da web (UI, versões, testes) | `apps/web` | 🟠 |
| 22 | Criptografia do Bun: escopo | Setup do auth e do WS | 🟡 |
| **B. Modelo de domínio** ||||
| 8 | Mapa: em que versão entra e como fazer a rota | Roadmap (item 1) | 🟢 |
| 9 | Fuso horário do stop | Tabela `stops`, Agenda | 🟡 |
| 10 | Entidades do lock de edição e id do dia | Tabela `edit_locks`, protocolo | 🟡 |
| 11 | Lista completa de `RejectReason` | `decide`, protocolo | 🟡 |
| **C. Produto e UX** ||||
| 12 | Padrões do lock de edição | Lock de edição | 🟠 |
| 13 | Sensação do lock com internet ruim | UI do CardSheet/Board | 🟠 |
| 14 | Telas que mudaram e telas de celular | UI | 🟠 |
| 15 | Empurrar ou só preencher ao adicionar stop | UI da Overview | 🟡 |
| 16 | Onde mora o feed "All activity" | UI do status | 🟡 |
| 17 | Papel *viewer* (só leitura) | Nada (backlog) | 🟢 |
| **D. Validação técnica** ||||
| 18 | Spike do Service Worker: critério de sucesso | Offline só leitura | 🔴 |
| 19 | Mensagens fora de ordem: tempos e plano de teste | `packages/sync` | 🟠 |
| 20 | Disciplina de versões (P7) na prática | 1º deploy | 🟡 |
| 21 | Limites novos (lock e cursores) | Presença e lock | 🟢 |
| **E. Correções nos docs** | | Nada (mecânico) | 🟢 |
| **F. Preparação prática** | | Auth, CI, deploy | 🟡 |

---

## A. Antes do primeiro código

### 1. Roadmap de features 🔴

**Por que importa:** o `planner.md` §8 tem um cronograma de 11 semanas. Como vamos codar juntos, prazo por semana não faz sentido; o que importa é a **ordem** e o que entra em cada versão. Isso também resolve a antiga pauta "o que cortar se apertar": em vez de cortar, a feature muda de versão.

**O que decidir:**
- O que é a v1 (o que precisa estar no ar para o projeto servir de vitrine).
- A ordem dos marcos dentro da v1 (cada um entregando algo que roda).
- O que vai para a v1.x, v2 e v3.

**Proposta para começar:**

- **v1 — vitrine.** Em marcos, nesta ordem:
  1. *Fundação:* monorepo, CI, compose, auth (e-mail/senha + magic link), criar e listar viagens.
  2. *Plano sincronizado:* `core` (`decide` + efeitos), pipeline de ops, WS, `packages/sync`; Overview (lista de stops) + Board + CardSheet funcionando em tempo real entre duas abas.
  3. *Colaboração:* convites, membros (ops de sistema), presença (avatares e "editing"), lock de edição.
  4. *Resiliência e escala:* 2 instâncias + Redis pub/sub, reconexão, offline só leitura, chaos test.
  5. *Uso real:* Agenda, responsivo com drag por toque, acessibilidade, toasts de rejeição.
  6. *Lançamento:* deploy na VPS, k6, README, vídeo.
- **v1.x — o que pode sair da v1 sem prejudicar a vitrine:** Google OAuth, busca ⌘K, cursor e drag ao vivo, timeline por mês na Overview, feed "All activity".
- **v2:** Android (Expo), mapa (item 8), documentos/anexos, histórico/desfazer, transporte como entidade, papel *viewer*.
- **v3+:** chat, votação, divisão de gastos, iOS.

Depois de fechado, o roadmap substitui o §8 do `planner.md`, e os prazos "semana X" dos docs viram marcos.

### 2. Datas da viagem × datas dos stops 🔴

**Por que importa:** encurtar a viagem e deixar stops de fora é aceito (vira aviso), mas criar um stop fora da viagem é rejeitado. Além disso, o `planner.md` diz "datas → gera os dias", só que agora os dias pertencem aos stops (D12): uma viagem sem stops não tem Board. Define as colunas de `trips` e o fluxo do NewTrip.

**Opções:**
- **A) As datas da viagem são derivadas dos stops** (do primeiro `arrive` ao último `leave`). O NewTrip pede o primeiro stop em vez de datas soltas.
- **B) Manter as datas próprias da viagem** e aceitar a assimetria (cada op valida só o que muda).

**Recomendação para começar:** A, se o fluxo do NewTrip e o EmptyTrip aguentarem a mudança. Some uma regra e um tipo de aviso.

### 3. Validação: Zod ou TypeBox (`t`) do Elysia 🔴

**Por que importa:** é a primeira coisa escrita no `core`. O Elysia é mais rápido com o próprio `t` (TypeBox, compilado), e é com ele que o Eden infere os tipos do REST. Toda mensagem de WS passa pela validação.

**Opções:**
- **A) Zod 4 em tudo** (o Elysia aceita via Standard Schema). Uma fonte da verdade, e o custo por mensagem é baixo.
- **B) TypeBox no `core`.** Mais rápido no servidor, mas o cliente carrega o TypeBox.
- **C) Zod no `core` para ops e o `t` do Elysia só nas rotas REST.**

**Recomendação para começar:** C. As ops, que são domínio, ficam em Zod no `core`. O REST, que é borda da API, fica com `t` e Eden. O custo por mensagem de WS é medido no microbenchmark do pipeline.

### 4. Driver do Postgres e pool de conexões 🔴

**Por que importa:** é a configuração do Drizzle no primeiro dia. Cada op segura uma conexão enquanto tem o lock da viagem; com `max_connections=50`, 2 instâncias, migrations e backup, o tamanho do pool define o teto de ops simultâneas.

**O que decidir:**
- Driver: `Bun.sql` (nativo) ou `postgres.js`. Os dois funcionam com o Drizzle.
- Pool por instância (por exemplo, 15 cada) e o que acontece quando ele esgota: rejeição transitória "servidor ocupado" (já prevista no §6).

**Recomendação para começar:** `Bun.sql`, se o Drizzle suportar bem as transações com `FOR UPDATE`. Se não, `postgres.js`. Validar com um teste de transação logo no setup.

### 6. Membros e convites: REST antes do pipeline de ops 🟠

**Por que importa:** a fundação prevê "REST: viagens, membros, convites", mas, pela D18, entrar, sair e trocar de papel são **ops de sistema** que passam pelo pipeline, que só existe depois.

**Opções:**
- **A)** A fundação faz só criar/listar viagens e criar convites; aceitar convite (`member.join`) e gerenciar membros entram junto com o pipeline.
- **B)** Escrever direto nas tabelas agora e reescrever depois.
- **C)** Adiantar um pipeline mínimo.

**Recomendação para começar:** A. Nada é escrito duas vezes.

### 7. Stack da web 🟠

**Por que importa:** nenhum doc define a camada de UI, e o shadcn já está nas skills do repo (`.agents/skills/shadcn`).

**O que decidir:**
- Tailwind + shadcn/ui (e como os `tokens` alimentam o tema).
- Versão do Next.js.
- Testes de componentes React: `bun test` + Testing Library ou Vitest.
- Fixar o Node no `mise.toml` (a web roda em Node 22 na produção; hoje só o Bun está fixado).

### 22. Criptografia do Bun: escopo 🟡

**Por que importa:** a ideia é usar a criptografia do Bun. Falta dizer onde.

**Candidatos:**
- Hash de senha com `Bun.password` (argon2id) no lugar do padrão do Better Auth.
- Assinatura do ticket do WS (HMAC com `Bun.CryptoHasher`).
- Token de convite (10 caracteres base32 aleatórios).

**A conferir:** se o Better Auth aceita trocar o hash de senha na versão que usarmos.

---

## B. Modelo de domínio

### 8. Mapa: em que versão entra e como fazer a rota 🟢

**Já decidido:** a forma do `Place` (D26) e a stack do mapa, MapLibre GL JS + OpenFreeMap (D27).

**O que decidir:**
- Em que versão o mapa entra (hoje está na v2, "Mapa com rota do dia"; depende do item 1).
- A rota do dia: OSRM, Valhalla ou GraphHopper. Todos precisam ser self-hosted (os servidores públicos de demonstração não servem para produção) e são pesados para a VPS de 8 GB.
- Atribuição do OpenStreetMap obrigatória na tela.

### 9. Fuso horário do stop 🟡

**Por que importa:** o §18 diz que cada stop guarda `timezone` (IANA) calculado de `lat/lon`, mas o campo não está no modelo (§3) nem na tabela `stops` (§11). A Agenda ("agora", "in 12 min") depende dele.

**A conversar:** se o fuso é guardado ou derivado, onde é calculado e como a Agenda lida com voos entre fusos.

### 10. Entidades do lock de edição e id do dia 🟡

**Por que importa:** a tabela `edit_locks` tem `entity` e `entity_id`, mas o enum de entidades e o formato do id não estão definidos.

**A conversar:** a lista (`activity | stop | day | trip`?) e o id de um dia, que não tem UUID próprio (`stopId:dayIndex`?).

### 11. Lista completa de `RejectReason` 🟡

**Por que importa:** hoje as rejeições finais são `forbidden`, `locked`, `deleted`, `stop_overlap` e `outside_trip`. Faltam casos.

**A conversar:**
- Limite estourado (2.000 atividades, 100 stops, 20 membros): qual motivo e se é final ou transitório.
- `activity.create` com `dayIndex` fora das datas do stop: aceito como "fora das datas" (D13) ou rejeitado?
- Os novos casos da D28: `*.create` com ID que já existe e `opId` de outro usuário.
- A lista fechada final, incluindo as transitórias (`rate_limited`, `invalid`, `busy`, `upgrade_required`, `server_behind`).

---

## C. Produto e UX

### 12. Padrões do lock de edição 🟠

Escolhidos sem conversa (`architecture.md` §7). Confirmar ou trocar:

| Padrão | Valor atual | Alternativa |
|---|---|---|
| Granularidade | Entidade inteira (atividade, stop, título de dia, cabeçalho da viagem) | Por campo (duas pessoas no mesmo card, em campos diferentes) |
| Excluir um stop com atividade travada por outra pessoa | Negado | Permitido (quem estava editando recebe o toast *Restore*) |
| Duas abas do mesmo usuário | Disputam o lock como duas pessoas ("Open in another tab") | A segunda aba "rouba" o lock da primeira |
| Validade sem renovação | 15 s | 10–30 s |
| Inatividade com o card aberto | 2 min → "Editing paused" | 5 min, ou nunca |

### 13. Sensação do lock com internet ruim 🟠

**Por que importa:** pedir o lock custa uma ida e volta ao servidor (20–100 ms, ou mais no 4G). Se a UI esperar a resposta, abrir o card parece travado.

**O que decidir:**
- **Abrir otimista:** o card abre e dá para digitar na hora. Se vier `lock.denied`, o que acontece com o que já foi digitado (fica como rascunho? some?).
- Os estados visuais: "pedindo", "seu", "da Ana", "pausado", "em outra aba".
- O que mostrar quando a conexão cai **enquanto** a pessoa está editando.

**Recomendação para começar:** abrir otimista. Se vier `denied`, o texto digitado vira rascunho local com o aviso "Ana is editing — your draft is kept" e um botão *Apply when free*.

### 14. Telas que mudaram e telas de celular 🟠

**Por que importa:** o design atual é só desktop (1440 px) e tem telas que não existem mais.

- **Saem:** ConflictChanges, ConflictDeleted, ConflictField, OfflineStop, TripOffline e o botão "Save X offline".
- **Mudam:** Offline (vira o banner "viewing only"), SyncStatus (sem a fila de pendentes) e CardSheet (sem Documents).
- **Faltam:** o estado "Ana is editing" no card, no stop e no título de dia; "Editing paused"; "Open in another tab"; os toasts de rejeição (`deleted`, `locked`, `stop_overlap`); a seção "Outside the stop's dates" no Board; e **todas as telas de celular**.

**O que decidir:** quem desenha, e se as telas de celular saem do design ou são derivadas dos componentes de desktop.

### 15. Empurrar ou só preencher ao adicionar stop 🟡

**Por que importa:** a sobreposição já é proibida (D14). Falta a UX: o AddStop diz "adds 2 days", o que sugere empurrar os stops seguintes.

**Opções:** só preencher gaps · empurrar os seguintes (op `stops.shift`, barata com a D12) · perguntar.

**Recomendação para começar:** só preencher gaps e oferecer "empurrar os seguintes" como ação explícita na Overview. Assim, nenhum stop muda de data sem alguém pedir.

### 16. Onde mora o feed "All activity" 🟡

**Por que importa:** o feed era uma aba do painel "What changed", que saiu. Os dados continuam no `ops_log`.

**Opções:** popover no pill de status · aba própria na viagem · fora da v1.

**Recomendação para começar:** popover no pill de status ("Leo moved *Coliseum tour* · 2 min"). Aproveita uma tela que já existe e mostra o tempo real funcionando.

### 17. Papel *viewer* (só leitura) 🟢

Não muda a arquitetura (o papel já é conferido na transação). É uma questão de produto: alguém da família só acompanha o roteiro? Fica no backlog até alguém pedir.

---

## D. Validação técnica

### 18. Spike do Service Worker: critério de sucesso 🔴

**Por que importa:** é o maior risco técnico da web e precisa de um "passou/não passou" claro antes de construir o offline em cima.

**Proposta de critério:**
- Abrir `/t/:id` sem rede depois de uma visita, com o plano vindo do IndexedDB.
- Atualizar o app (novo deploy) e o SW antigo ser trocado em até 1 recarga.
- Funcionar no Chrome Android e no Safari iOS (o iOS é só web, mas vai aparecer no vídeo).

**Planos B e C:** SPA estática servida pelo SW · sem offline na v1 (só o banner).

### 19. Mensagens fora de ordem: tempos e plano de teste 🟠

**Por que importa:** é o coração do tempo real. Um bug aqui faz alguém ver um plano diferente sem perceber.

**O que decidir:**
- Quanto tempo esperar por uma versão faltando antes de pedir `resync` (hoje ~500 ms).
- A cadência do `ping`: o §7 da arquitetura renova os locks a cada ~5 s, e o `deploy.md` §4 diz 25 s (limite do Cloudflare). Unificar em 5 s?
- Quais falhas o teste de propriedade injeta: reordenar, perder, duplicar, desconectar e trocar de instância.

### 20. Disciplina de versões (P7) na prática 🟡

**Por que importa:** "ler um release antes de escrever" é disciplina, não código, e por isso é fácil de esquecer.

**O que decidir:**
- Onde o número da versão do protocolo mora (`core`) e quem o incrementa.
- Um checklist no template de PR ("este PR emite um tipo novo de op ou efeito?").
- Quando o teste "API N e N+1 lado a lado" entra na CI: desde o início ou só antes do primeiro deploy com mudança de protocolo.

### 21. Limites novos (lock e cursores) 🟢

Faltam na tabela de limites (`architecture.md` §18):
- `lock.acquire` por conexão (proposta: 10/s).
- Locks simultâneos por aba (proposta: 3).
- Confirmar que os 30/s de presença cobrem o cursor com throttle de 50 ms (20/s).

---

## E. Correções nos docs

Mecânicas; dá para fazer num commit só.

- [ ] `planner.md` §8 (pipeline de ops): remover `field_meta`, resto da D6, que foi substituída.
- [ ] `planner.md` §4–7: `op_receipts` "retidos para sempre" contradiz a D19 (7 dias).
- [ ] `planner.md` §8 e `architecture.md` §16: a porta se chama `Storage`; no §10 ela é `Cache`.
- [ ] `planner.md` §3: "datas → gera os dias" contradiz a D12 (depende do item 2).
- [ ] `architecture.md` §0: a D23 aparece depois da D25.
- [ ] Trocar os prazos "semana X" (`planner.md` e `architecture.md` §19) pelos marcos do roadmap (depende do item 1).

---

## F. Preparação prática

- [ ] Commitar as mudanças pendentes nos docs (`architecture.md`, `deploy.md`, `planner.md`, `CONTEXT.md`, esta lista, `mise.toml`).
- [ ] Domínio: escolher o nome (hoje `caravan.x` é placeholder) e comprar no Cloudflare Registrar. Vem antes do Resend.
- [ ] Resend: só envia para qualquer e-mail depois de verificar o domínio. No local, o mailpit cobre.
- [ ] Cliente OAuth do Google (só se o Google OAuth ficar na v1; ver item 1).
- [ ] Repositório público ou privado: o `deploy.md` conta com o runner ARM e o Actions grátis de repo público.
- [ ] `LICENSE`.
- [ ] Convenções: formato de commit, estratégia de branch e template de PR (com o checklist do item 20), num `AGENTS.md`/`CLAUDE.md` curto.

---

## Critérios de aceitação do motor de sync

O que precisa passar antes de começar a UI da web:

- **Convergência (fast-check):** N clientes, ops aleatórias (inclusive ops de sistema), entrega fora de ordem, perdas, duplicatas e reconexões. Todos terminam com o mesmo estado do servidor, comparado por hash.
- **Decisão única:** reenviar o mesmo `opId` a qualquer momento devolve sempre a mesma resposta e não muda o estado.
- **Lock exclusivo:** duas abas nunca têm uma op de update/move/delete aceita na mesma entidade enquanto a outra segura o lock, inclusive com 2 instâncias e com o Redis parado.
- **Retomada do lock:** uma aba que reconecta em < 15 s mantém o próprio lock.
- **Encurtar e esticar** um stop é reversível sem perder nenhuma atividade.
- **Sobreposição:** stop que se sobrepõe é rejeitado e o cliente recebe os dados de volta para reabrir o formulário.
- **Prefetch:** o reader do servidor lança erro ao ler fora do `ReadSet`, e o teste de propriedade roda com ele sem falhas.
- **Remover um membro:** nenhuma op dele é aceita numa versão posterior à remoção, e os locks dele somem na mesma transação.
- **Desempenho:** lock da viagem < 2 ms no p95 com 2.000 atividades; checar o lock de edição soma < 0,2 ms.
- **Compatibilidade:** os fixtures da versão anterior (mensagens e `ops_log`) passam desde o primeiro release.
