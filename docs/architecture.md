# Caravan — Arquitetura

> Documento técnico de referência. O produto, o escopo e o cronograma estão em [`planner.md`](./planner.md); as telas, em [`design/`](./design).
> Última revisão: 2026-10-16.

---

## 0. Decisões alinhadas

| # | Decisão | Motivo |
|---|---|---|
| D1 | **Servidor autoritativo com ops versionadas** (não CRDT) | O problema de consistência fica visível e testável no backend |
| D2 | Hierarquia **Trip → Stop → Day (data) → Card** | O design organiza a viagem em stops (Overview) |
| D3 | **Dias são datas**, não entidades livres | Vêm de `trip.startDate..endDate`; sem `day.create/delete/reorder` |
| D4 | **Cards ordenados por horário**; posição fracionária só desempata | Roteiro é cronológico; o design sempre mostra em ordem de hora |
| D5 | Um único **`packages/core`** decide as ops no cliente e no servidor | As regras não divergem; a lógica fica 100% testável sem I/O |
| D6 | Conflitos detectados **no servidor** e guardados **por usuário** | Base do painel "What changed" (Use mine / Keep Leo's / Restore) |
| D7 | **Documentos/anexos ficam para a v2** | Corte de escopo; offline no MVP = o plano, não os arquivos |
| D8 | **Android fica para depois**, mas tudo fora de `apps/web` é agnóstico de plataforma | O app mobile tem de ser "só UI" quando chegar |
| D9 | Better Auth (e-mail+senha, Google, magic link) | Cobre todas as telas de auth; adapter Drizzle; plugin Expo para depois |
| D10 | Lugares via **Photon** (OSM) com proxy na API | A política do Nominatim proíbe autocomplete |
| D11 | **Tudo numa VPS ARM** (web + API + Postgres + Redis), mesma origem, Caddy + Cloudflare | Latência do lock, custo e um compose que reproduz a prod. Detalhes em [`deploy.md`](./deploy.md) |

---

## 1. Visão geral

```
        ┌──────────────────────┐        (v2) ┌──────────────┐
        │ apps/web (Next.js)   │             │ apps/mobile  │
        │ UI + Service Worker  │             │ Expo         │
        └─────────┬────────────┘             └──────┬───────┘
                  │ packages/sync + packages/core   │
                  │      REST (Eden) + WebSocket    │
                  ▼                                 ▼
             ┌──────────────────────────────────────────┐
             │      Caddy (TLS, LB, WS) · mesma origem  │
             └──────────┬─────────────────────┬─────────┘
                        ▼                     ▼
                 ┌────────────┐        ┌────────────┐
                 │ api #1     │        │ api #2     │   Bun + Elysia
                 └──┬─────┬───┘        └──┬─────┬───┘
                    │     └──── pub/sub ──┘     │
                    │        Redis (presença,   │
                    │        broadcast, cache)  │
                    ▼                           ▼
             ┌──────────────────────────────────────────┐
             │ PostgreSQL — projeção + ops_log          │
             └──────────────────────────────────────────┘
```

---

## 2. Monorepo

Bun workspaces + Turborepo. Biome para lint/format.

```
apps/
  api/          Elysia: REST + WebSocket gateway + pipeline de ops
  web/          Next.js (App Router)
  mobile/       (v2) Expo
packages/
  core/         domínio puro: tipos, schemas Zod, decide(), mutations, invariantes, ordenação, protocolo WS
  sync/         motor de sync do cliente: estado confirmado + pendentes, rebase, transporte, status
                exporta também `sync/react` (hooks via useSyncExternalStore; serve web e RN)
  tokens/       design tokens (cores dos stops, espaçamentos, tipografia)
infra/
  compose*.yml, caddy/, scripts/, provision/, k6/   (ver deploy.md)
```

**Regra de dependência:** `core` não depende de nada; `sync` depende só de `core`; os apps dependem dos dois. Nenhum pacote pode usar DOM, Node, Bun ou APIs de React Native.

---

## 3. Modelo de domínio

```
Trip        id, name, startDate, endDate, ownerId
Member      tripId, userId, role (owner|editor), color, lastSeenAt
Stop        id, name, place, countryCode, arriveDate, leaveDate, color, transportIn (train|flight|ferry|bus|car|null)
Day         (tripId, date), title                       — existe implicitamente para cada data da viagem
Card        id, date, title, time {start, end?} | null, place | null, notes, position
```

**Invariantes** (validadas em `core`):
- Stops ficam dentro das datas da viagem, `arriveDate < leaveDate`, e **não se sobrepõem** (intervalo semiaberto `[arrive, leave)`).
- O stop de um dia é derivado: o stop em que `arrive ≤ date < leave`. Dia sem stop = "gap" na Overview.
- `trip.update` que deixe um stop ou card fora das datas → rejeitado.
- Encurtar um stop com cards nos dias removidos → rejeitado (`stop_has_cards`); o usuário move os cards antes.
- `stop.delete` faz soft-delete do stop **e dos cards dele na mesma op**; `stop.restore` restaura só os cards apagados por aquela op (`deletedVersion`).
- Editar ou mover entidade excluída → rejeitado + registro de conflito (seção 7).

**Ordem dos cards num dia:** `(time.start NULLS LAST, position, id)`. Arrastar para outro dia muda a `date`; a posição (`fractional-indexing`) só importa entre cards sem horário ou com o mesmo horário.

**Campos de conflito:** `time` (start+end) é **um** campo; `date` também é campo (move é LWW como edição). Para stops, `dates` (arrive+leave) é um campo.

---

## 4. Operações

```ts
type Op =
  | { type: "trip.update";  fields: Partial<{ name: string; dates: { start: ISODate; end: ISODate } }> }
  | { type: "stop.create";  stopId: Id; name: string; place: Place; dates: DateRange; color: StopColor; transportIn: Transport | null }
  | { type: "stop.update";  stopId: Id; fields: Partial<{ name; place; dates; color; transportIn }> }
  | { type: "stop.delete";  stopId: Id }
  | { type: "stop.restore"; stopId: Id }
  | { type: "day.update";   date: ISODate; fields: { title: string } }
  | { type: "card.create";  cardId: Id; date: ISODate; title: string; time?: TimeRange; place?: Place; notes?: string; position: string }
  | { type: "card.update";  cardId: Id; fields: Partial<{ title; time; place; notes }>; resolves?: ConflictId }
  | { type: "card.move";    cardId: Id; date: ISODate; position: string; resolves?: ConflictId }
  | { type: "card.delete";  cardId: Id }
  | { type: "card.restore"; cardId: Id; fields?: Partial<{ title; time; place; notes }>; resolves?: ConflictId };

type Envelope = { opId: Uuid; tripId: Id; baseVersion: number; op: Op; clientTs: number };
// O servidor acrescenta userId (da sessão, nunca do cliente) e version.
```

IDs gerados no cliente (UUIDv7), para a criação offline funcionar.

### Núcleo funcional: `decide` → `mutations`

```ts
interface TripReader {            // cliente: estado em memória. servidor: queries SQL na transação
  trip(): Trip; stop(id): Stop | null; stops(): Stop[]; card(id): Card | null; cardsOn(date): Card[];
  fieldMeta(entity, id): FieldMeta;   // { [field]: { v: number; by: UserId } }
}

decide(reader, envelope, userId): { ok: true; mutations: Mutation[]; conflicts: ConflictDraft[] }
                                | { ok: false; reason: RejectReason; conflict?: ConflictDraft }
```

- **Cliente:** `applyMutations(state, mutations)` em memória (ignora `conflicts`).
- **Servidor:** `persistMutations(tx, mutations)` vira os `UPDATE`/`INSERT` na projeção.

O mesmo código decide nos dois lados ("functional core, imperative shell"). É a parte mais testada do projeto.

---

## 5. Protocolo WebSocket

| Dir. | Mensagem | Conteúdo |
|---|---|---|
| C→S | `hello` | `tripId`, `lastVersion \| null`, `ticket` |
| S→C | `welcome` | `currentVersion`, `mode: "ops" \| "state"`, `ops[]` ou `state`, `presence[]`, `conflicts[]` (pendentes do usuário) |
| C→S | `op` | `Envelope` |
| S→C | `ack` | `opId`, `version` |
| S→C | `reject` | `opId`, `reason`, `conflictId?` |
| S→C | `op` | `{ version, opId, userId, op }` (de outros clientes) |
| C→S | `resync` | `fromVersion` (detecção de buraco) |
| S→C | `conflict` | registro novo para este usuário |
| C→S | `presence` | estado efêmero (seção 8) |
| S→C | `presence` / `presence.leave` | estado dos outros |
| C↔S | `ping` / `pong` | `pong` traz `currentVersion` |

- **Autenticação do WS:** o cliente pega um *ticket* curto (60 s, assinado) em `POST /ws-ticket` usando a sessão (cookie na web, bearer no mobile) e manda no `hello`. Assim o token não vai na query string.
- O servidor processa as mensagens de cada conexão **em série**, o que preserva a ordem das ops de um mesmo cliente.

---

## 6. Pipeline de uma op no servidor

```
recebe op
 ├─ valida schema (Zod) e papel do membro
 ├─ BEGIN
 │   SELECT current_version FROM trips WHERE id = $1 FOR UPDATE      -- serializa por viagem, entre instâncias
 │   SELECT 1 FROM ops_log WHERE op_id = $2  → se existe: ack com a versão já gravada (idempotência)
 │   decide(sqlReader, envelope, userId)
 │     rejeitado → grava conflict (se houver), COMMIT, envia reject
 │   version = current + 1
 │   persistMutations(tx) + atualiza field_meta { v: version, by: userId }
 │   INSERT ops_log; INSERT conflicts; UPDATE trips SET current_version = version
 ├─ COMMIT
 ├─ ack → autor
 ├─ PUBLISH trip:{id}  { version, opId, userId, op }
 └─ PUBLISH user:{loserId} { conflict }   (se gerou conflito)
```

O lock é por linha de `trips`: viagens diferentes não disputam lock entre si.

---

## 7. Conflitos

O servidor continua LWW por campo, na ordem de chegada. A diferença é que **quem perdeu não perde o dado**: o valor substituído fica guardado num registro de conflito.

**Detecção em `decide`**:

| Situação | Condição | Registro para |
|---|---|---|
| Escrita concorrente no mesmo campo | `fieldMeta[f].v > baseVersion` **e** `fieldMeta[f].by ≠ autor` | o autor anterior (`kind: field_overwritten`, `mine` = valor antigo, `theirs` = novo) |
| Editar/mover card excluído | card com `deletedAt` | o próprio autor; op **rejeitada** (`kind: edit_on_deleted`, `mine` = campos tentados) |
| Excluir card editado concorrentemente | algum `fieldMeta[f].v > baseVersion` de outro usuário | esse usuário (`kind: deleted_after_edit`) |

**Detalhe importante:** a `baseVersion` de uma op feita offline **não muda no rebase**. Ela representa o que o autor sabia quando editou. Atualizá-la esconderia a concorrência.

**Resolução:**
- *Use mine* → `card.update { fields: mine, resolves }`.
- *Keep theirs* / *Let it go* → `POST /conflicts/:id/dismiss`.
- *Restore with my change* → `card.restore { fields: mine, resolves }`.

Conflitos são **estado privado do usuário**: não entram no `ops_log` nem consomem versão. O `ops_log` é o estado compartilhado e alimenta a aba "All activity".

**Conflito durante a edição** (ConflictField): se chega uma op remota mudando o campo que o usuário está editando com rascunho local, a UI mostra o aviso inline antes de enviar. Isso é só cliente.

---

## 8. Presença

Dois níveis, ambos só em Redis:

| Tipo | Exemplos | Armazenamento |
|---|---|---|
| **Estável** | online, `editing: { entity, id, field }` | hash `presence:{tripId}`, campo `{userId}:{connId}` com TTL por campo (`HEXPIRE`, Redis ≥ 7.4), renovado no heartbeat |
| **Volátil** | cursor, drag em andamento, resize de stop | só `PUBLISH`, throttle de 50 ms, nada gravado |

- **Coordenadas do documento**, não da tela: `{ anchor: { kind: "day", date } | { kind: "card", id }, dx, dy }` em frações do elemento. Telas de tamanhos diferentes veem o cursor no mesmo lugar.
- Várias abas do mesmo usuário = várias `connId`. A UI agrupa por usuário.
- `trip_members.last_seen_at` é gravado no disconnect ("Last seen 2 days ago").
- A lista de viagens ("Ana and Leo are here") lê os hashes com pipeline no `GET /trips`.

---

## 9. Broadcast entre instâncias e ordem

- Cada instância assina `trip:{id}` quando a 1ª conexão local entra na viagem e cancela quando a última sai. Também assina `user:{id}` para os usuários conectados.
- **A ordem não é garantida:** a instância A comita a v5, a B comita a v6, e a B pode publicar primeiro. Além disso, o pub/sub do Redis é *at-most-once*.
- **O cliente é responsável:** mantém um buffer das ops com `version > confirmed + 1`. Se o buraco durar mais de ~500 ms, manda `resync { fromVersion }`. O `pong` traz `currentVersion`, então mensagem perdida (Redis caiu, instância morreu) também é detectada.

---

## 10. Cliente: `packages/sync`

```
confirmed: { version, state }          ← só muda com ops confirmadas, em ordem
pending:   Envelope[]                  ← ops locais ainda sem ack
view = pending.reduce(apply, confirmed.state)   (memoizado; é o que a UI renderiza)
```

| Evento | Efeito |
|---|---|
| ação local | `decide` local; se ok, entra em `pending`, é enviada e a view é recalculada |
| `ack {opId, v}` | aplica a própria op em `confirmed` na versão `v` (respeitando o buffer de ordem) e tira de `pending` |
| `op` remota `v` | aplica em `confirmed` e recalcula a view (**rebase** das pendentes) |
| `reject` | tira de `pending`, recalcula, emite evento para a UI ("Your change was undone") |
| desconexão | backoff exponencial com jitter; status `offline { pending, retryInMs }`; "Retry now" força |
| reconexão | `hello { lastVersion }` → aplica `welcome` → reenvia `pending` na ordem (duplicatas o servidor ignora pelo `opId`) |

**Portas injetadas** (é o que deixa o pacote pronto para o mobile):

```ts
interface Transport { connect(url): Socket }            // web: WebSocket nativo. RN: idem
interface Storage   { load(tripId); save(tripId, { confirmed, pending }) }   // web: IndexedDB. RN: expo-sqlite
interface Clock     { now(); setTimeout(...) }          // fake nos testes
```

**Status exposto para a UI:** `synced { version }` · `syncing { sent, total, incoming }` · `offline { pending, retryInMs }`. Ele alimenta o pill do topo, o banner e o popover "Your changes / From others while you were away".

**React:** `sync/react` exporta `useTrip(selector)` sobre `useSyncExternalStore`. Não precisa de Zustand para o estado sincronizado; estado de UI (modais, seleção) fica local.

---

## 11. Persistência

```sql
-- Better Auth gerencia: user, session, account, verification
trips          (id, name, start_date, end_date, owner_id, current_version, created_at, deleted_at)
trip_members   (trip_id, user_id, role, color, joined_at, last_seen_at)              PK (trip_id, user_id)
invite_links   (token PK, trip_id, role, created_by, expires_at, revoked_at)
invite_emails  (id, trip_id, email, role, invited_by, created_at, accepted_at, declined_at)
stops          (id, trip_id, name, place_json, country_code, arrive_date, leave_date, color, transport_in,
                field_meta jsonb, deleted_at, deleted_by, deleted_version)
days           (trip_id, date, title, field_meta jsonb)                               PK (trip_id, date)
cards          (id, trip_id, date, title, time_start, time_end, place_json, notes, position, created_by,
                field_meta jsonb, deleted_at, deleted_by, deleted_version)
ops_log        (trip_id, version, op_id UNIQUE, user_id, op_json, created_at)         PK (trip_id, version)
conflicts      (id, trip_id, user_id, kind, entity_type, entity_id, field, mine_json, theirs_json,
                other_user_id, version, created_at, resolved_at, resolution)
snapshots      (trip_id, version, state_json, created_at)                             PK (trip_id, version)
```

- As tabelas de entidades são a **projeção** (leitura rápida). O `ops_log` é o histórico e a base da reconexão.
- **Estado completo no `welcome`:** projeção lida numa transação `REPEATABLE READ` junto com `current_version`, o que dá uma foto consistente sem lock.
- **`snapshots`:** gravado a cada 200 ops, de forma assíncrona e idempotente (PK). Serve para compactar o `ops_log` e para o histórico/undo da v2. Se `current - lastVersion > 500`, o servidor manda o estado em vez das ops.

---

## 12. Web (Next.js)

- **Rotas públicas** (landing, sign in/up, join) com SSR. **App** (`/trips`, `/t/:id/...`) como client components sobre o `sync`.
- **Offline:** Service Worker com **Serwist** (precache do shell + rotas do app). Estado e fila em IndexedDB. Este é o maior risco técnico da web: validar cedo (semana 2) com uma página "hello offline".
- **Toda regra de negócio passa pela API.** Nada de Server Actions/route handlers com lógica de domínio, senão o mobile não reaproveita.
- **REST** com cliente **Eden** (tipos inferidos do Elysia) + TanStack Query para lista de viagens, convites e membros.
- Drag & drop: dnd-kit. Busca ⌘K: índice em memória sobre o estado local (funciona offline). "New places from the map need a connection."
- Agenda (agora/próximo/feitos): derivada do estado + relógio, só cliente.

---

## 13. API (Elysia)

```
apps/api/src/
  auth/        Better Auth montado em /api/auth/*, /ws-ticket
  trips/       CRUD de viagem (criação gera trip + owner + v0), membros, papéis
  invites/     links (criar, resetar, aceitar), e-mails (enviar, reenviar, aceitar, recusar)
  conflicts/   listar, dispensar
  places/      proxy Photon + cache Redis 24h + rate limit por usuário
  realtime/    gateway WS, pipeline de ops, presença, pub/sub, sqlReader (TripReader)
  db/          Drizzle schema + migrations (drizzle-kit)
```

- **Papéis:** editor edita o plano e convida; só o owner muda papéis e exclui a viagem.
- **Convites:** link com token curto (`eR7k-2Qx9`), papel e expiração de 7 dias; "Reset link" revoga e cria outro. Convite por e-mail aparece como banner Join/Decline em `/trips` quando o e-mail verificado do usuário bate.
- E-mail transacional (magic link, convite, reset de senha): Resend.

---

## 14. Testes

| Nível | O quê | Ferramenta |
|---|---|---|
| Unit | `decide` de cada op, invariantes, detecção de conflito, ordenação | bun test |
| Propriedade | N clientes simulados, ops aleatórias, entrega em ordem aleatória, desconexões → **todos convergem** para o estado do servidor; nenhuma op perdida ou duplicada | bun test + fast-check |
| Integração | API real + Postgres + Redis; N clientes WS concorrentes em 2 instâncias | bun test + compose |
| Chaos | derrubar instância, Redis e rede (latência, corte) no meio de edições → zero perda | toxiproxy |
| E2E | fluxos web (criar viagem, convidar, editar em 2 abas, offline/online) | Playwright |
| Carga | conexões simultâneas, p95 do broadcast | k6 |

---

## 15. Infra e deploy

Ver [`deploy.md`](./deploy.md). Em resumo: uma VPS ARM da Hetzner com Docker Compose (Caddy + api ×2 + web ×2 + Postgres + Redis), Cloudflare na frente e tudo na mesma origem (`/`, `/api/*`, `/ws`). O deploy é rolling: cada instância fecha os WS com o código 1012 e os clientes reconectam na outra.

---

## 16. Preparado para o Android (v2)

Checklist para não fechar portas agora:
- [ ] `core` e `sync` sem DOM/Node; portas `Transport`/`Storage`/`Clock` injetadas.
- [ ] Hooks em `sync/react` (React puro, sem `react-dom`).
- [ ] Auth funcionando com **bearer** além de cookie; WS via ticket.
- [ ] Toda a lógica na API (nada só no Next).
- [ ] Presença com coordenadas do documento; cursor opcional (mobile só mostra avatares e "editing").
- [ ] `tokens` em TS puro (sem CSS-only), consumíveis pelo Tailwind e pelo RN.
- [ ] Dependências de `core`/`sync` compatíveis com Hermes (sem `crypto.subtle` obrigatório, com polyfill de UUID).

---

## 17. Fora do MVP (impacto no design)

- **Documentos/anexos** (CardSheet → Documents, "Today's documents", offline por stop/viagem, Wi-Fi only, "S3 presigned uploads"). Na v2: R2 (prod)/MinIO (local), presign → PUT → op `attachment.add`.
- **Android** ("Get it on Android" na landing).
- Telas a ajustar no MVP: remover a seção Documents do CardSheet; os botões "Save X offline", OfflineStop e TripOffline saem; o indicador de offline na lista de viagens sai (o plano é sempre offline); a landing troca "Web + Android" e os chips "S3 presigned uploads" e "Docker · nginx" (agora Caddy); "2 API instances behind nginx" vira "behind Caddy".

---

## 18. Decisões complementares

**Tempo e fuso horário**
- Horários dos cards = **hora local de parede** (`"09:40"`) + `date`. Nada de UTC no card.
- Cada stop guarda `timezone` (IANA), calculado de `lat/lon` com `tz-lookup` (offline, no `core`).
- "Agora", "in 12 min" e "feitos" da Agenda: relógio do aparelho convertido para o fuso do stop do dia.
- `time.end < time.start` = atravessa a meia-noite (termina no dia seguinte).
- Deslocamentos entre fusos (voo Lisboa → Praga): fica para quando o transporte virar entidade. No MVP, o card usa o fuso do stop do dia.

**Granularidade das edições**
- Campos de texto geram op no *blur* ou depois de ~800 ms sem digitar. Campos discretos (horário, lugar, mover) geram op na hora.
- Na fila de pendentes, `card.update` do mesmo card e campo ainda **não enviados** são mesclados (com o `baseVersion` da primeira). Assim, 50 edições offline viram 1 op.

**Abas, contas e armazenamento**
- Uma aba por viagem é a **líder** (Web Locks API `caravan:sync:{userId}:{tripId}`): ela tem o WS e grava a fila. As outras falam com a líder por `BroadcastChannel`. Se a líder fecha, outra assume o lock.
- IndexedDB separado por `userId`; logout com pendentes pede confirmação antes de apagar.
- `navigator.storage.persist()` no primeiro uso offline.
- No login, sincroniza **todas** as viagens do usuário (o plano está sempre offline).

**Membros e permissões em tempo real**
- Membro removido online: o servidor fecha o WS dele (código 4403) e o cliente apaga a viagem local.
- Membro removido offline: as ops pendentes voltam como `reject { reason: "forbidden" }`, a fila daquela viagem é descartada e a pessoa vê um aviso.
- Mudança de papel: a API publica em `user:{id}`, e o gateway atualiza o papel na conexão.
- O owner só sai da viagem depois de transferir a posse. A exclusão da viagem é soft-delete (só o owner) e derruba todos os conectados.

**Limites**

| Item | Limite |
|---|---|
| Título | 120 caracteres |
| Notas | 5.000 caracteres |
| Cards por viagem | 2.000 |
| Stops por viagem | 100 |
| Duração da viagem | 366 dias |
| Membros por viagem | 20 |
| Mensagem WS | 64 KB |
| Ops por conexão | 20/s (burst 50), token bucket |
| Presença | 30/s |
| Auth | rate limit do Better Auth |

- Token de convite: 10 caracteres base32 (≈ 50 bits), com rate limit em `/join`.

**Segurança e privacidade**
- Upgrade do WS valida o `Origin` (Cross-Site WebSocket Hijacking) além do ticket.
- Textos do usuário são renderizados sempre como texto puro; CSP restritiva no Next.
- Cookies `HttpOnly; Secure; SameSite=Lax`; mesma origem, sem CORS.
- Exclusão de conta: remove os dados pessoais e troca o `user_id` no `ops_log`/`conflicts` por um usuário "Deleted user"; as viagens das quais ele é owner passam para o membro mais antigo ou são excluídas se ele estiver sozinho.
- Páginas de Termos e Privacidade; analytics sem cookie (Umami self-hosted), sem banner.

**Acessibilidade**
- Drag & drop por teclado (dnd-kit), com anúncios.
- Mudanças remotas relevantes anunciadas via `aria-live="polite"`, com throttle.
- Contraste AA do texto sobre as cores dos stops (validado nos `tokens`).
- Respeitar `prefers-reduced-motion` nas animações de cards remotos.

**Interface**
- Interface em inglês; datas e horas formatadas pelo locale (`Intl`).
- Só tema escuro no MVP; os `tokens` já nascem com estrutura para o claro.
- Avatar: foto do Google quando houver; senão, iniciais com a cor do membro.
- **Responsiva completa** (celular e desktop), com drag por toque. Os componentes são pensados mobile-first, o que também adianta o Android.

---

## 19. Em aberto

| Questão | Prazo | Contexto |
|---|---|---|
| Adicionar ou esticar um stop num período ocupado: empurra os seguintes, só preenche buracos ou pergunta? | **Antes da semana 3** (ops de stop no `core`) | O AddStop diz "adds 2 days", o que sugere empurrar. Até decidir, o `core` rejeita a sobreposição |
| Telas de celular no design | **Antes da semana 5** | O design atual é só desktop (1440 px) |
| Transporte como entidade (horário de partida e chegada, fuso de origem e destino) | v2 | Hoje é só o ícone em `stop.transportIn` |
