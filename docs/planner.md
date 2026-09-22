# Planejador de Viagem Colaborativo — Plano do Projeto

> Nome provisório: **[a definir]**
> Objetivo: projeto de portfólio para freelas e vagas remotas no exterior (pagamento em euro/dólar).
> Plataformas: **Web (Next.js)** + **Android (React Native / Expo)**, com o mesmo backend e o mesmo motor de sincronização.

---

## 1. Pitch

Um grupo monta o roteiro de uma viagem junto, em tempo real. Cada **dia** é uma coluna e cada **atividade** é um card. Todos veem quem está online, quem está editando o quê e as mudanças dos outros na hora, sem flicker. O app funciona offline (aeroporto, estrada, roaming) e sincroniza sozinho quando a conexão volta. Nenhum dado se perde, mesmo se o servidor cair.

O produto é simples de propósito. A complexidade está no que ele demonstra tecnicamente.

---

## 2. O que o projeto precisa demonstrar

| Capacidade | Onde aparece |
|---|---|
| Tempo real / WebSocket | Operações e presença ao vivo |
| Consistência e concorrência | Servidor autoritativo, operações versionadas, rebase |
| Resiliência | Log de operações, snapshots, reconexão, fila offline |
| Escala horizontal | 2+ instâncias da API com Redis pub/sub |
| Redis | Presença efêmera (TTL) + pub/sub |
| Mensageria | Pub/sub entre instâncias (opcional: fila para jobs como snapshots) |
| Integração externa | Busca de lugares (Nominatim/OSM, Mapbox ou Google Places) |
| Testes | Unitários (sync engine) + integração (múltiplos clientes WS concorrentes) + chaos test |
| Performance | Load test com k6 (conexões simultâneas, latência p95 do broadcast) |
| Fullstack + mobile | Next.js, Expo/React Native, código de sync compartilhado |
| DevOps | Docker Compose, nginx, CI, deploy, publicação na Play Store |

---

## 3. Escopo do MVP

### Dentro
- Auth (e-mail/senha ou magic link; OAuth Google opcional)
- Criar viagem (nome, datas → gera as colunas/dias)
- Convite por link (papéis: owner, editor)
- Board do roteiro:
  - Criar, editar e excluir cards (título, horário, local, notas)
  - Mover cards entre dias e reordenar dentro do dia
  - Criar, renomear e reordenar dias
- Presença:
  - Avatares de quem está online no board
  - Indicador "fulano está editando este card"
  - **Web:** cursores ao vivo
  - **Android:** só avatares e indicador de edição
- Offline: editar sem conexão; operações ficam na fila e sincronizam na reconexão
- Busca de lugares para preencher o local do card

### Fora (v2+)
- Chat do grupo
- Votação em atividades
- Divisão de gastos
- Mapa com rota do dia
- Anexos e fotos
- iOS

---

## 4. Arquitetura

```
                ┌─────────────┐      ┌──────────────┐
                │  Next.js    │      │ Expo (RN)    │
                │  apps/web   │      │ apps/mobile  │
                └──────┬──────┘      └──────┬───────┘
                       │ packages/sync (compartilhado)
                       │   REST + WebSocket │
                       ▼                    ▼
                   ┌────────────────────────────┐
                   │        nginx (LB)          │
                   └──────┬──────────────┬──────┘
                          ▼              ▼
                   ┌────────────┐  ┌────────────┐
                   │ api #1     │  │ api #2     │   Elysia/Bun
                   └─────┬──────┘  └─────┬──────┘
                         │   pub/sub     │
                         ├──────►Redis◄──┤   presença (TTL) + broadcast entre instâncias
                         ▼               ▼
                   ┌────────────────────────────┐
                   │ PostgreSQL                 │   fonte da verdade
                   │ (ops log + snapshots)      │
                   └────────────────────────────┘
```

### Monorepo (Bun workspaces ou Turborepo)

```
apps/
  api/        Elysia + Bun — REST (auth, viagens, convites) + WebSocket (ops, presença)
  web/        Next.js
  mobile/     Expo (React Native)
packages/
  sync/       motor de sync: fila de ops, aplicação otimista, rebase, reconexão
  shared/     tipos e schemas (Zod/TypeBox) das operações e entidades
  ui-tokens/  (opcional) cores e espaçamentos compartilhados
infra/
  docker-compose.yml, nginx.conf, k6/
```

**Peça central: `packages/sync`.** Ele é agnóstico de plataforma (sem DOM, sem React Native). Web e mobile são "só UI" em cima dele. É o código para mostrar em entrevista e o mais testado do projeto.

---

## 5. Modelo de consistência

**Escolha: servidor autoritativo com operações versionadas.**
(Alternativa considerada: CRDT com Yjs/Automerge. Resolveria merge automaticamente, mas deixaria o backend como relay e esconderia o problema que o projeto quer demonstrar. Isso deve ficar documentado no README como trade-off.)

### Fluxo de uma operação
1. O cliente gera a op com `opId` (UUID, idempotência) e `baseVersion` (última versão conhecida do board).
2. O cliente **aplica otimisticamente** no estado local, sem flicker, e põe a op na fila de pendentes.
3. O servidor recebe, valida (permissão, schema, existência da entidade) e resolve conflitos.
4. O servidor grava no log com `version = última + 1` (transação, lock por board).
5. O servidor responde `ack { opId, version }` ao autor e faz broadcast `op { ..., version }` para os outros (via Redis pub/sub para as demais instâncias).
6. Se rejeitar, manda `reject { opId, reason }`. O cliente desfaz a op e reaplica as pendentes sobre o estado confirmado (rebase).

### Regras de conflito (simples e explícitas)
- **Mover card:** last-writer-wins pela ordem de chegada no servidor.
- **Editar campo:** LWW por campo (editar título não sobrescreve notas).
- **Editar card excluído:** rejeitado.
- **Ordenação:** *fractional indexing* (posição string, ex.: `"a0"`, `"a0V"`, `"a1"`). Mover um card altera só a posição dele. Se dois clientes gerarem a mesma posição, o desempate é por `cardId`.

### Tipos de operação (v1)
```ts
type Op =
  | { type: "day.create";   dayId; title; position }
  | { type: "day.update";   dayId; fields: Partial<{ title; position }> }
  | { type: "day.delete";   dayId }
  | { type: "card.create";  cardId; dayId; position; title }
  | { type: "card.update";  cardId; fields: Partial<{ title; time; place; notes }> }
  | { type: "card.move";    cardId; toDayId; position }
  | { type: "card.delete";  cardId };

type Envelope = { opId: string; boardId: string; baseVersion: number; op: Op; clientTs: number };
```

### Mensagens WebSocket
| Direção | Mensagem | Conteúdo |
|---|---|---|
| C→S | `hello` | `boardId`, `lastVersion`, token |
| S→C | `sync` | ops desde `lastVersion` **ou** snapshot + ops seguintes |
| C→S | `op` | Envelope |
| S→C | `ack` / `reject` | `opId`, `version` / `reason` |
| S→C | `op` | op confirmada de outro cliente |
| C→S | `presence` | cursor `{x,y}` (throttle ~30–50ms), `editingCardId` |
| S→C | `presence` | estado de presença dos outros |
| ↔ | `ping`/`pong` | heartbeat |

---

## 6. Persistência e recuperação

### Tabelas principais (PostgreSQL)
```
users        (id, name, email, avatar_url, created_at)
trips        (id, name, start_date, end_date, owner_id, current_version, created_at)
trip_members (trip_id, user_id, role)            -- owner | editor
invites      (token, trip_id, role, expires_at)
days         (id, trip_id, title, position, deleted_at)
cards        (id, trip_id, day_id, title, time, place_json, notes, position, deleted_at, updated_version)
ops_log      (trip_id, version, op_id UNIQUE, user_id, op_json, created_at)   PK (trip_id, version)
snapshots    (trip_id, version, state_json, created_at)
```
- `days` e `cards` são a projeção materializada, para leitura rápida. `ops_log` é o histórico e a base para a reconexão.
- `op_id UNIQUE` garante idempotência no reenvio após a reconexão.
- Snapshot a cada N ops (ex.: 200) ou por job periódico.

### Reconexão
- O cliente guarda `lastVersion` (IndexedDB na web, SQLite/MMKV no mobile).
- No `hello`, se `current - lastVersion` for menor que o limite, o servidor envia as ops faltantes. Senão, envia o snapshot mais recente e as ops seguintes.
- A fila de pendentes é reenviada na ordem. Duplicatas são ignoradas pelo `op_id`.
- Backoff exponencial com jitter.

### Presença (Redis, nunca no Postgres)
- `presence:{tripId}` → hash `userId → {name, color, cursor, editingCardId, instance}` com TTL renovado por heartbeat.
- Canal `trip:{tripId}` para broadcast de ops e presença entre instâncias.

---

## 7. Stack

| Camada | Tecnologia |
|---|---|
| API | Bun + Elysia, WebSocket nativo, Drizzle ORM |
| Banco | PostgreSQL |
| Cache / pub/sub / presença | Redis |
| Web | Next.js (App Router), Zustand ou store própria sobre o `sync`, dnd-kit |
| Mobile | Expo (React Native), react-native-reanimated/gesture-handler para drag |
| Validação | Zod ou TypeBox (em `packages/shared`) |
| Lugares | Nominatim/OSM (grátis), com Mapbox ou Google Places como alternativa |
| Testes | bun test (unit), testes de integração com múltiplos clientes WS, Playwright (e2e web) |
| Carga | k6 (WebSocket) |
| Infra | Docker Compose, nginx, GitHub Actions |
| Deploy | VPS/Fly.io/Railway para a API, Vercel para a web, Play Store para o Android |

---

## 8. Cronograma — 10 semanas (10–20h/semana)

### Semanas 1–2 — Fundação
- [ ] Monorepo, lint, formatação, CI básico
- [ ] Docker Compose (Postgres, Redis)
- [ ] Auth
- [ ] Schema do banco + migrations
- [ ] REST: viagens, membros, convites
- [ ] `packages/shared`: tipos e schemas das ops

### Semanas 3–4 — Protocolo e motor de sync
- [ ] Servidor WebSocket: `hello`, `sync`, `op`, `ack`, `reject`
- [ ] Aplicação de ops no servidor (transação + versão por viagem)
- [ ] Fractional indexing
- [ ] `packages/sync`: estado confirmado + pendentes, aplicação otimista, rebase
- [ ] **Testes unitários** do sync (ordem, conflito, rejeição, idempotência)
- [ ] **Testes de integração**: N clientes concorrentes convergem para o mesmo estado

### Semanas 5–6 — Web + escala
- [ ] Board no Next.js (dias, cards, drag & drop, edição)
- [ ] Presença: avatares, "editando", cursores ao vivo
- [ ] Redis pub/sub + 2 instâncias da API atrás do nginx
- [ ] Teste: clientes em instâncias diferentes veem as mesmas mudanças

### Semana 7 — Resiliência
- [ ] Reconexão com `lastVersion` + backoff
- [ ] Fila offline persistida no cliente
- [ ] Snapshots
- [ ] **Chaos test**: derrubar instância / Redis / rede no meio de edições → nada se perde

### Semanas 8–9 — Android + integração
- [ ] App Expo reaproveitando `packages/sync`
- [ ] Board mobile (drag, edição, presença sem cursores)
- [ ] Persistência offline no mobile
- [ ] Busca de lugares (card com local)
- [ ] **Submeter à Play Store cedo** (teste interno/fechado; a revisão pode demorar)

### Semana 10 — Lançamento
- [ ] Deploy de produção (API, web)
- [ ] Load test com k6 → registrar números no README
- [ ] README: arquitetura, diagrama, decisões e trade-offs, como rodar local
- [ ] GIF/vídeo: 3 clientes (2 web + 1 Android) editando juntos + chaos demo
- [ ] Post no LinkedIn + projeto em destaque no perfil

---

## 9. Vitrine (o que mostrar)

- **GIF principal:** navegadores lado a lado + celular, cursores e cards se movendo.
- **Chaos demo:** matar uma instância da API ao vivo, sem perda de dados.
- **Números:** "X conexões simultâneas, p95 de broadcast em Y ms" (k6).
- **README com "Decisões de design":**
  - Servidor autoritativo vs CRDT
  - Fractional indexing vs reindexação
  - Presença em Redis vs banco
  - Log de operações + snapshots
- **Post no LinkedIn:** o problema, a decisão principal, o demo e o link.
- Links: repositório público, web ao vivo, Play Store.

---

## 10. Riscos e cortes possíveis

| Risco | Mitigação / corte |
|---|---|
| Sync engine demorar mais | É prioridade; se atrasar, cortar a busca de lugares ou os cursores no primeiro deploy |
| Drag & drop no mobile trabalhoso | Aceitar "mover para dia X" via menu no Android na v1 |
| Revisão da Play Store demorar | Submeter para teste fechado na semana 8 |
| Escopo crescer | Tudo fora da seção 3 vai para o backlog v2 |

---

## 11. Backlog v2
- Chat do grupo
- Votação em atividades
- Divisão de gastos multi-moeda
- Mapa com rota do dia
- Anexos (reservas, bilhetes)
- Histórico / "desfazer" usando o ops log
- iOS
