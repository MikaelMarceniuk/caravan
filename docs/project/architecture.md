# Caravan — Arquitetura

> Documento técnico de referência. O produto, o escopo e o roadmap estão em [`planner.md`](./planner.md); as telas, em [`design/`](../design).
> Última revisão: 2026-10-24. Vocabulário do domínio: [`CONTEXT.md`](../../CONTEXT.md).

---

## 0. Decisões alinhadas

| # | Decisão | Motivo |
|---|---|---|
| D1 | **Servidor autoritativo com ops versionadas** (não CRDT) | O problema de consistência fica visível e testável no backend |
| D2 | Hierarquia **Trip → Stop → Day → Activity** | O design organiza a viagem em stops (Overview) |
| D3 | **Dias não são entidades livres**: são os índices de um stop (`0..noites-1`) | Vêm das datas do stop; sem `day.create/delete/reorder` (revisada em D12) |
| D4 | **Atividades ordenadas por horário**; posição fracionária só desempata | Roteiro é cronológico; o design sempre mostra em ordem de hora |
| D5 | Um único **`packages/core`** decide as ops no cliente e no servidor | As regras não divergem; a lógica fica 100% testável sem I/O |
| D6 | ~~Conflitos detectados no servidor e guardados por usuário~~ | **Substituída pela D22** (lock de edição): sem edição offline, não há conflito para guardar |
| D7 | **Documentos/anexos ficam para a v2** | Corte de escopo; offline no MVP = ver o plano, não os arquivos |
| D8 | **Android fica para depois**, mas tudo fora de `apps/web` é agnóstico de plataforma | O app mobile tem de ser "só UI" quando chegar |
| D9 | Better Auth: **e-mail+senha** na v1, mais uma sessão anônima para o "Try the demo"; Google e Apple depois; **sem magic link** | Adapter Drizzle; plugins `anonymous` e Expo. O magic link não mostra nada da arquitetura, e senha + convite já cobrem a entrada |
| D10 | Lugares via **Photon** (OSM) com proxy na API | A política do Nominatim proíbe autocomplete |
| D11 | **Tudo numa VPS ARM** (web + API + Postgres + Redis), mesma origem, Caddy + Cloudflare | Latência do lock, custo e um compose que reproduz a prod. Detalhes em [`deploy.md`](./deploy.md) |
| D12 | **Atividade ancorada no stop** (`stopId + dayIndex`), não numa data absoluta | Mover, esticar ou empurrar um stop é 1 op e leva as atividades junto; a data é derivada (`stop.arriveDate + dayIndex`) |
| D13 | **Dia que some não rejeita nem move atividades**: elas ficam "fora das datas" do stop | Atividade criada num dia removido ao mesmo tempo não se perde; encurtar é reversível |
| D14 | **Sobreposição de stops é invariante rígida**: o servidor rejeita e o formulário reabre com os dados do usuário | A Overview nunca mostra estado inválido; só se criam atividades num stop já confirmado, então nada depende de um stop rejeitado |
| D15 | **O servidor transmite efeitos, não só ops**: `ack`, broadcast e `welcome` levam `effects: Mutation[]`; o `confirmed` do cliente só aplica | Clientes de versões diferentes não divergem; valores do servidor chegam prontos; `decide` no cliente só serve à view otimista. Hash de estado só nos testes |
| D16 | **Toda op decidida ganha recibo** (`op_receipts`), inclusive as rejeitadas | Reenvio depois de uma queda de conexão não muda o resultado; "mesma resposta para o mesmo `opId`" vira propriedade testável |
| D17 | **`decide` síncrono em duas fases**: `requirements(op)` → prefetch na API → `decide` | `core` puro e síncrono nos dois lados; I/O por op explícito e mínimo dentro do lock |
| D18 | **Membros e exclusão da viagem são ops de sistema** no mesmo log versionado | Ordem total entre plano e permissões; membros visíveis offline; feed e broadcast de graça |
| D19 | **Sem snapshots no MVP**; `ops_log` e tombstones retidos, recibos por 7 dias | O `welcome` com estado sai da projeção; pendentes só vivem em memória (segundos), então o recibo não precisa durar mais |
| D20 | ~~A aba que cria a op grava no IndexedDB antes de avisar a líder~~ | **Substituída pela D23**: sem fila persistida, não há líder nem fila no IndexedDB |
| D21 | **`Activity` no domínio e no protocolo**; "card" é só o componente visual (`ActivityCard`, `CardSheet`) | O nome do tipo de op é contrato (P7); a Agenda e o mobile não mostram cards. Glossário em [`CONTEXT.md`](../../CONTEXT.md) |
| D22 | **Lock de edição por entidade**: só uma pessoa edita uma atividade, um stop, um título de dia ou o cabeçalho da viagem por vez | Elimina conflitos de escrita concorrente na origem; a UI mostra "Ana is editing" e bloqueia o resto |
| D23 | **Offline só leitura**: o plano fica em cache (IndexedDB + Service Worker) para consulta; editar exige conexão | Mantém o valor no aeroporto/roaming sem fila offline, rebase de longa duração nem conflitos persistidos |
| D24 | **Locks de edição no Postgres** (`edit_locks`), conferidos **dentro da transação** da op; Redis só para o efêmero | O que é promessa do produto fica no banco, o que é efêmero fica no Redis. Sem janela de corrida, e o lock continua valendo com o Redis fora do ar |
| D25 | **Ajustes de desempenho do caminho quente**: lock conferido na mesma ida ao banco do prefetch; renovação de locks em lote por instância; `edit_locks` `UNLOGGED` sem índice em `expires_at`; entrega local pelo pub/sub nativo do Bun | O lock no Postgres custa ~0,1 ms numa edição de 50–200 ms; o gargalo real é o fan-out dos cursores, atacado com o pub/sub nativo |
| D26 | **`Place` = `{ name, lat, lon, countryCode, osmId }`**, guardado inteiro em `place_json` desde a v1 | `lat/lon` é o formato de qualquer mapa open source (MapLibre, Leaflet, OpenLayers) e de qualquer fonte de tiles OSM: o mapa pode ser trocado sem migração. O Photon já devolve tudo, então não custa nada guardar antes de o mapa existir |
| D27 | **Mapa com MapLibre GL JS + tiles do OpenFreeMap**; sem Google Maps, sem fallback e sem servidor de tiles próprio | Tudo open source, grátis e sem chave; a biblioteca roda no navegador, então não há container. Trocar a fonte de tiles depois é mudar uma URL no estilo |
| D28 | **IDs em UUIDv7, coluna `uuid`**: o que nasce no cliente (stops, atividades, `opId`) usa `newId()` do `core` (lib `uuid`, `v7()`); o que o servidor cria (usuários, viagens, convites por e-mail) usa `DEFAULT uuidv7()` do Postgres. O servidor valida todo ID vindo do cliente (seção 18) | O `opId` tem de nascer no cliente para o reenvio ser idempotente (D16), e o ID da entidade, para a UI otimista não precisar trocar IDs temporários. Uma função só no navegador, no Bun e no RN; o v7 é ordenado no tempo, então os INSERTs vão para o fim do índice |
| D29 | **Validação com Zod 4 em tudo**: os schemas moram no `core` e valem para as ops e mensagens do WS, para as rotas REST do Elysia (via Standard Schema, com o Eden inferindo os tipos) e para os clientes. Sem o `t` (TypeBox) do Elysia | Uma biblioteca só, legível para quem lê o repo. O Zod não gera código com `new Function`, então roda igual no Bun, no navegador com CSP rígida e no React Native. A vantagem de velocidade do TypeBox são microssegundos antes do lock, contra milissegundos da transação. Se o microbenchmark do M2 mostrar custo nos cursores, só essa mensagem ganha uma checagem à mão. A conferir no setup da API (M1): o Eden infere os tipos e o OpenAPI sai certo com Zod; se não, o REST volta para o `t` |
| D30 | **Driver `Bun.sql`** no Drizzle, **pool de 10 conexões por instância** da API; a op espera **até 2 s** por uma conexão livre e depois recebe `busy` (transitória); **timeout de 5 s** por transação no Postgres. Depende do spike do M1; plano B: `postgres.js` | Só a API (Bun) acessa o banco, então o driver nativo não tem problema de compatibilidade e não soma dependência. Com ~1–2 ms por op, 10 conexões passam de milhares de ops/s; 2 × 10 + migrations + backup + reserva do Postgres ≈ 26 de `max_connections=50`, e pool maior só gasta memória e disputa as 2 vCPUs. O timeout impede que uma transação travada segure o lock da viagem. A API do `Bun.sql` segue a do `postgres.js` e o Drizzle esconde o driver, então trocar é barato |
| D31 | **Stack da web**: Next.js 16 (Active LTS, versão exata fixada); Tailwind 4 + shadcn/ui sobre **Radix**; `packages/tokens` em TS gera o CSS do tema; testes de componente com **`bun test` + Testing Library + happy-dom**; Node 24 (`mise.toml` local, `node:24-slim` na prod) | O Next 16 é a versão com suporte ativo (o 15 sai da manutenção em out/2026). O shadcn copia os componentes para o repo e o Radix dá a acessibilidade (teclado, foco, leitor de tela). Os `tokens` em TS são uma fonte só para a web e o RN, e o teste de contraste AA roda neles. Um executor de testes no repo inteiro, com o mesmo comando local e no GitHub Actions; o que precisa de navegador real fica no Playwright. O Node 22 sai da manutenção em abr/2027 |
| D32 | **Criptografia do Bun**: senha com **argon2id** do `Bun.password` (19 MiB, 2 iterações) plugado no Better Auth (`emailAndPassword.password.hash/verify`); ticket do WS assinado com **HMAC-SHA256** (`Bun.CryptoHasher`, segredo no `.env`, comparação em tempo constante); token de convite gerado com `crypto.getRandomValues` e guardado puro | argon2id é a primeira recomendação do OWASP, e trocar antes do primeiro usuário evita refazer hashes. O padrão do Bun (64 MiB por hash) derrubaria o container de 256 MB com 4 logins simultâneos; 19 MiB/2 é o mínimo do OWASP. O ticket assinado é conferido por qualquer instância sem consultar nada, então o WS aceita conexões com o Redis fora (como na D24); reusar o ticket dentro dos 60 s é aceitável com HTTPS. O token de convite fica puro porque o Invite mostra o link o tempo todo ("Copy link") |
| D33 | **Membros e convites só junto com o pipeline (M4)**: a fundação (M1) faz só criar e listar viagens; aceitar convite, sair e trocar papel nascem como ops de sistema (D18). Até lá, testes com vários usuários e o seed de desenvolvimento criam os membros direto no banco | Nada é escrito duas vezes, e membros nunca existem fora da ordem das versões. O M2 ("duas abas editando stops juntas") funciona com um usuário só |
| D34 | **Interface em pt-BR e en-US** desde a primeira tela, com `next-intl` na web. O servidor nunca manda texto pronto, só códigos (`reject { reason: "stop_overlap" }`), e cada cliente traduz. E-mails (convite, reset de senha) saem no idioma de quem recebe | Traduzir depois obrigaria a caçar strings em todas as telas. Com códigos no protocolo, a web e o Android traduzem do seu jeito, e a API não precisa saber o idioma de cada conexão |

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
             │ PostgreSQL — projeção + ops_log + locks  │
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
Day         (stopId, dayIndex), title                   — existe implicitamente para cada dia do stop (0..noites-1)
Activity    id, stopId, dayIndex, title, time {start, end?} | null, place | null, notes, position
            data derivada = stop.arriveDate + dayIndex (D12)
Place       name, lat, lon, countryCode, osmId          — valor (não é entidade), vindo do Photon (D26)
            osmId com o tipo na frente: "N123" (nó), "W123" (via), "R123" (relação); o número sozinho é ambíguo
```

**Invariantes** (validadas em `core`):
- Stops ficam dentro das datas da viagem, `arriveDate < leaveDate`, e **não se sobrepõem** (intervalo semiaberto `[arrive, leave)`). Invariante **rígida** (D14): `stop.create`/`stop.update` que a viole é rejeitado (`stop_overlap` / `outside_trip`) e a UI reabre o formulário com os dados digitados.
- Atividade e título de dia pertencem a um stop (D12). Data sem stop = "gap" na Overview e não tem Board nem atividades. Só se criam atividades num stop **já confirmado** pelo servidor (o Board de um stop novo abre depois do `ack`).
- Ops de stop **nunca reescrevem** o `dayIndex` das atividades (D13). Atividade com `dayIndex ≥ noites do stop` fica **fora das datas**: aparece na seção "Outside the stop's dates" do Board e num aviso na Overview; esticar o stop de novo a traz de volta. Encurtar ou deslocar um stop é sempre aceito; não existe `stop_has_cards`.
- `trip.update` é sempre aceito: stop que fique fora das novas datas da viagem vira aviso na Overview, não rejeição.
- `stop.delete` faz soft-delete do stop **e das atividades dele na mesma op**; `stop.restore` restaura só as atividades apagadas por aquela op (`deletedVersion`). Se, entretanto, as datas do stop foram ocupadas, o `stop.restore` é rejeitado (`stop_overlap`) e a UI oferece restaurar com novas datas.
- Editar ou mover entidade excluída → rejeitado (`deleted`); a UI mostra o toast com *Restore with my change* a partir do rascunho em memória (seção 7).

**Ordem das atividades num dia:** `(time.start NULLS LAST, position, id)` dentro de `(stopId, dayIndex)`. Arrastar para outro dia muda `stopId`/`dayIndex`; a posição (`fractional-indexing`) só importa entre atividades sem horário ou com o mesmo horário.


---

## 4. Operações

```ts
type Op =
  | { type: "trip.update";  fields: Partial<{ name: string; dates: { start: ISODate; end: ISODate } }> }
  | { type: "stop.create";  stopId: Id; name: string; place: Place; dates: DateRange; color: StopColor; transportIn: Transport | null }
  | { type: "stop.update";  stopId: Id; fields: Partial<{ name; place; dates; color; transportIn }> }
  | { type: "stop.delete";  stopId: Id }
  | { type: "stop.restore"; stopId: Id }
  | { type: "day.update";   stopId: Id; dayIndex: number; fields: { title: string } }
  | { type: "activity.create";  activityId: Id; stopId: Id; dayIndex: number; title: string; time?: TimeRange; place?: Place; notes?: string; position: string }
  | { type: "activity.update";  activityId: Id; fields: Partial<{ title; time; place; notes }> }
  | { type: "activity.move";    activityId: Id; stopId: Id; dayIndex: number; position: string }
  | { type: "activity.delete";  activityId: Id }
  | { type: "activity.restore"; activityId: Id; fields?: Partial<{ title; time; place; notes }> };

type Envelope = { opId: Uuid; tripId: Id; op: Op; clientTs: number };
// O servidor acrescenta userId (da sessão, nunca do cliente) e version.

// Ops de sistema (D18): geradas só pela API, a partir dos endpoints REST; vindas de um cliente → rejeitadas.
type SystemOp =
  | { type: "member.join";   userId: Id; role: Role; color: MemberColor }
  | { type: "member.remove"; userId: Id }
  | { type: "member.role";   userId: Id; role: Role }        // inclui transferência de posse (2 mutations)
  | { type: "trip.delete" };
```

IDs gerados no cliente com `newId()` do `core` (UUIDv7, D28), para a UI otimista referenciar a entidade antes do `ack`. O cliente só propõe o ID; as regras de validação estão na seção 18.

### Núcleo funcional: `decide` → `mutations`

```ts
requirements(envelope): ReadSet   // o que decide vai ler: ids de stops/atividades, "todos os stops"

interface TripReader {            // SÍNCRONO. cliente: estado em memória. servidor: rows do ReadSet buscadas na tx (D17)
  trip(): Trip; stop(id): Stop | null; stops(): Stop[]; activity(id): Activity | null; activitiesOn(stopId, dayIndex): Activity[];
}

decide(reader, envelope, userId): { ok: true; mutations: Mutation[] }
                                | { ok: false; reason: RejectReason }
```

- **Cliente:** `applyMutations(view, mutations)` em memória, **só para a view otimista das pendentes**. O `confirmed` nunca re-decide: aplica os `effects` que o servidor manda (D15).
- **Servidor:** `persistMutations(tx, mutations)` vira os `UPDATE`/`INSERT` na projeção.
- **Fronteira (D17):** `core` declara o que precisa (`requirements`) e decide; `apps/api` busca e grava. No servidor, o reader de prefetch **lança erro** ao acessar uma chave fora do `ReadSet`, e os testes de propriedade rodam com ele para pegar `requirements` incompletos.

O mesmo código decide nos dois lados ("functional core, imperative shell"). É a parte mais testada do projeto.

**Efeitos são o contrato do protocolo (D15).** As `Mutation`s são declarativas e trazem os valores que só o servidor conhece (`deletedAt`, `deletedVersion`, `deletedBy`). Cascatas usam mutations agregadas (`softDeleteActivitiesOfStop { stopId, version }`) para caber no limite de mensagem. O schema das mutations só muda de forma aditiva.

---

## 5. Protocolo WebSocket

| Dir. | Mensagem | Conteúdo |
|---|---|---|
| C→S | `hello` | `tripId`, `lastVersion \| null`, `ticket`, `protocolVersion` |
| S→C | `welcome` | `currentVersion`, `mode: "ops" \| "state"`, `ops[]` (com `effects`) ou `state`, `presence[]`, `locks[]` |
| C→S | `op` | `Envelope` |
| S→C | `ack` | `opId`, `version`, `effects` |
| S→C | `reject` | `opId`, `reason` |
| S→C | `op` | `{ version, opId, userId, op, effects }` (de outros clientes; `op` serve ao feed, `effects` ao estado) |
| C→S | `resync` | `fromVersion` (detecção de buraco) |
| C→S | `lock.acquire` / `lock.release` | `{ entity, id }` (seção 7) |
| S→C | `lock.granted` / `lock.denied` | `{ entity, id }` / `{ entity, id, holder: userId }` |
| S→C | `lock` / `lock.free` | lock pego ou solto por outra pessoa (vira o "Ana is editing") |
| C→S | `presence` | estado efêmero (seção 8) |
| S→C | `presence` / `presence.leave` | estado dos outros |
| C↔S | `ping` / `pong` | `pong` traz `currentVersion`; o `ping` renova os locks da conexão |

- **Versão do protocolo:** o servidor aceita a atual e a anterior; mais velho → `upgrade_required`, mais novo → `server_behind` (o cliente fica em só leitura e tenta de novo). Tipos novos de op/efeito são lidos um release antes de serem emitidos (`deploy.md` P7).
- **Autenticação do WS:** o cliente pega um *ticket* curto (`userId` + expiração de 60 s, assinado com HMAC-SHA256, D32) em `POST /ws-ticket` usando a sessão (cookie na web, bearer no mobile) e manda no `hello`. Assim o token não vai na query string.
- O servidor processa as mensagens de cada conexão **em série**, o que preserva a ordem das ops de um mesmo cliente.

---

## 6. Pipeline de uma op no servidor

```
recebe op
 ├─ rate limit, tamanho e schema (Zod)        → reject transitório, sem recibo (o cliente reenvia)
 ├─ BEGIN
 │   SELECT current_version FROM trips WHERE id = $1 FOR UPDATE      -- serializa por viagem, entre instâncias
 │   SELECT * FROM op_receipts WHERE op_id = $2  → se existe: repete a MESMA resposta (D16); se for de outro usuário, rejeita (D28)
 │       aceita: ack { version, effects do ops_log } · rejeitada: reject { reason }
 │   papel do membro (dentro da tx: enxerga remoção/troca de papel já comitada)
 │   prefetch(requirements(envelope)) → reader síncrono (1–2 queries; a mesma ida ao banco traz os locks das entidades lidas)
 │   lock de edição (D24): update/move/delete → a entidade não pode ter lock válido de outra aba
 │   decide(prefetchReader, envelope, userId)
 │     rejeitado → op_receipts(rejected), COMMIT, envia reject
 │   version = current + 1
 │   persistMutations(tx)
 │   INSERT ops_log; INSERT op_receipts(accepted, version); UPDATE trips SET current_version = version
 ├─ COMMIT
 ├─ ack → autor
 └─ PUBLISH trip:{id}  { version, opId, userId, op, effects }
```

O lock é por linha de `trips`: viagens diferentes não disputam lock entre si.

**Decisão única por `opId` (D16):** toda op que chega à transação ganha um recibo, aceita ou rejeitada. Reenvios (depois de uma queda de conexão) recebem sempre a mesma resposta. Rejeições finais: `forbidden`, `locked`, `deleted`, `stop_overlap`, `outside_trip`. (`locked` é final para aquela op; o rascunho continua na tela e a pessoa tenta de novo quando o lock liberar, gerando uma op nova.) Transitórias (sem recibo, antes do BEGIN): rate limit, tamanho, schema, servidor ocupado.

---

## 7. Edição concorrente: lock de edição (D22)

Não existe conflito de escrita: **só uma pessoa edita uma coisa por vez**. A consistência entre ops continua garantida pelo Postgres (versão + `FOR UPDATE`); o lock de edição é a garantia de UX de que ninguém sobrescreve o que outra pessoa está editando.

**Granularidade: entidade.** Atividade, stop, título de dia (`stopId + dayIndex`) e cabeçalho da viagem (nome e datas). O indicador "editando o campo X" continua na presença (seção 8), mas o lock é da entidade inteira.

| Ação na UI | Lock |
|---|---|
| Abrir o CardSheet em edição, focar um campo inline | `lock.acquire` da atividade (ou do dia, do stop, da viagem) |
| Arrastar uma atividade, redimensionar um stop | lock da entidade no início do drag |
| Excluir | lock da entidade; `stop.delete` também é negado se alguma atividade do stop estiver com outra pessoa |
| Criar | não precisa (a entidade ainda não existe) |
| Fechar o sheet, blur, soltar o drag | `lock.release` |

**Mecânica (D24: no Postgres):**
- Tabela **`UNLOGGED`** `edit_locks (trip_id, entity, entity_id, user_id, tab_id, expires_at)`, PK `(trip_id, entity, entity_id)`. Todo horário vem do `now()` do Postgres (um relógio só).
  - `UNLOGGED`: não passa pelo WAL, então é mais rápida. Se o Postgres travar, a tabela volta vazia: aceitável, porque os locks venceriam em 15 s de qualquer jeito e as abas pedem de novo ao reconectar.
  - **Sem índice em `expires_at`** (nem em outra coluna que muda): a renovação vira *HOT update* (a linha é atualizada no lugar) e a tabela não incha. Índice só em `tab_id`, que não muda.
- **Pegar:** `INSERT … ON CONFLICT DO UPDATE … WHERE edit_locks.expires_at < now() OR edit_locks.tab_id = excluded.tab_id RETURNING`. Voltou linha → `lock.granted`; não voltou → `lock.denied { holder }` e a UI fica em só leitura para aquela entidade ("Ana is editing").
- **Renovar em lote, por instância:** a cada ~5 s, cada instância faz **um** `UPDATE edit_locks SET expires_at = now() + 15 s WHERE tab_id = ANY($1)` com as abas conectadas a ela que estão vivas (responderam ao `ping`). O custo é constante (≈ 2 queries a cada 5 s no total), não importa quantas pessoas estejam editando. Aba fechada, rede caída ou instância morta = o lock expira sozinho em ≤ 15 s. Linhas expiradas são apagadas de forma preguiçosa (no próprio `INSERT`) e por uma limpeza periódica.
- **Dono = aba, não conexão:** cada aba gera um `tabId` (guardado no `sessionStorage`) e o reaproveita nas reconexões. Se a conexão cai e volta em < 15 s (ou o deploy fecha o WS com 1012), a aba **retoma o próprio lock** em vez de ser bloqueada por ele.
- **Soltar:** `lock.release` faz `DELETE`. Membro removido (`member.remove`) → os locks dele são apagados na mesma transação.
- **Inatividade:** 2 min sem input com o lock aberto → o cliente solta o lock e a UI mostra "Editing paused" (evita alguém prender um card deixando a aba aberta).
- **O pipeline confere o lock dentro da transação** da op (depois do `FOR UPDATE`): update/move/delete de uma entidade com lock válido de **outra aba** → `reject { reason: "locked" }`. `stop.delete` também confere os locks das atividades do stop. Não sobra janela de corrida entre a checagem e o COMMIT.
- **Avisar os outros:** pegar e soltar publicam `lock`/`lock.free` no pub/sub do Redis (é o que acende o "Ana is editing" ao vivo). O `welcome` traz os locks válidos lidos do Postgres.
- **Redis fora do ar:** o lock **continua valendo** (está no Postgres). Só some o aviso ao vivo; quem tentar editar recebe `lock.denied { holder }` na hora e a UI mostra "Ana is editing" do mesmo jeito.

**Rejeições restantes e o que a UI faz** (o conteúdo do usuário ainda está em memória):
- `deleted` (a entidade foi excluída por cascata de `stop.delete`): toast "Leo deleted this stop · Restore with my change".
- `stop_overlap` / `outside_trip`: o formulário de stop reabre com os dados e o aviso.
- `locked`: toast "Ana is editing this"; o rascunho fica no campo até o lock liberar.
- `forbidden`: aviso e saída da viagem.

O `ops_log` continua alimentando o feed "All activity".

---

## 8. Presença

Dois níveis, ambos só em Redis:

| Tipo | Exemplos | Armazenamento |
|---|---|---|
| **Estável** | online, `editing: { entity, id, field }` | hash `presence:{tripId}`, campo `{userId}:{connId}` com TTL por campo (`HEXPIRE`, Redis ≥ 7.4), renovado no heartbeat |
| **Volátil** | cursor, drag em andamento, resize de stop | só `PUBLISH`, throttle de 50 ms, nada gravado |

- O **lock de edição** (seção 7) é separado da presença e fica no Postgres (D24): a presença diz *onde* a pessoa está (inclusive o campo) e pode sumir sem problema; o lock diz *quem pode escrever* e não pode.
- **Coordenadas do documento**, não da tela: `{ anchor: { kind: "day", stopId, dayIndex } | { kind: "activity", id }, dx, dy }` em frações do elemento. Telas de tamanhos diferentes veem o cursor no mesmo lugar.
- Várias abas do mesmo usuário = várias `connId`. A UI agrupa por usuário.
- `trip_members.last_seen_at` é gravado no disconnect ("Last seen 2 days ago").
- A lista de viagens ("Ana and Leo are here") lê os hashes com pipeline no `GET /trips`.

---

## 9. Broadcast entre instâncias e ordem

- Cada instância assina `trip:{id}` no Redis **uma vez** quando a 1ª conexão local entra na viagem e cancela quando a última sai.
- **Entrega local pelo pub/sub nativo do Bun:** cada conexão faz `ws.subscribe("trip:{id}")` no Elysia; a instância recebe do Redis e repassa com `server.publish("trip:{id}", msg)`, feito em código nativo, sem laço em JS. É o caminho mais quente do sistema (cursores: ~400 msg/s por viagem cheia × 19 destinatários), bem mais que ops e locks.
- **A ordem não é garantida:** a instância A comita a v5, a B comita a v6, e a B pode publicar primeiro. Além disso, o pub/sub do Redis é *at-most-once*.
- **O cliente é responsável:** mantém um buffer das ops com `version > confirmed + 1`. Se o buraco durar mais de ~500 ms, manda `resync { fromVersion }`. O `pong` traz `currentVersion`, então mensagem perdida (Redis caiu, instância morreu) também é detectada.

---

## 10. Cliente: `packages/sync`

```
confirmed: { version, state }          ← só muda com efeitos confirmados, em ordem
pending:   Envelope[]                  ← ops locais ainda sem ack (só em memória; vivem milissegundos)
view = pending.reduce(apply, confirmed.state)   (memoizado; é o que a UI renderiza)
```

| Evento | Efeito |
|---|---|
| ação local | exige conexão e o lock da entidade (D22); `decide` local; se ok, entra em `pending`, é enviada e a view é recalculada |
| `ack {opId, v, effects}` | aplica os `effects` em `confirmed` na versão `v` (respeitando o buffer de ordem) e tira de `pending` |
| `op` remota `v` | aplica os `effects` em `confirmed` e recalcula a view |
| `reject` | tira de `pending`, recalcula, emite evento para a UI com o conteúdo da op (toast da seção 7) |
| desconexão | **UI em só leitura** (D23); backoff exponencial com jitter; status `offline { retryInMs }`; "Retry now" força. As `pending` em voo continuam em memória |
| reconexão | `hello { lastVersion }` → aplica `welcome` → reenvia as `pending` em voo (duplicatas o servidor resolve pelo recibo) → pede de novo os locks abertos |

**Portas injetadas** (é o que deixa o pacote pronto para o mobile):

```ts
interface Transport { connect(url): Socket }            // web: WebSocket nativo. RN: idem
interface Storage   { load(tripId); save(tripId, confirmed) }   // só leitura offline. web: IndexedDB. RN: expo-sqlite
interface Clock     { now(); setTimeout(...) }          // fake nos testes
```

**Status exposto para a UI:** `synced { version }` · `syncing { incoming }` · `offline { retryInMs }` (só leitura). Ele alimenta o pill do topo e o banner "You're offline — viewing only".

**React:** `sync/react` exporta `useTrip(selector)` sobre `useSyncExternalStore`. Não precisa de Zustand para o estado sincronizado; estado de UI (modais, seleção) fica local.

---

## 11. Persistência

```sql
-- Better Auth gerencia: user, session, account, verification (IDs pelo DEFAULT uuidv7() do banco; conferir a configuração no setup)
-- Todo id é uuid (UUIDv7, D28): DEFAULT uuidv7() no que o servidor cria; o que vem do cliente chega preenchido
trips          (id, name, start_date, end_date, owner_id, current_version, created_at, deleted_at)
trip_members   (trip_id, user_id, role, color, joined_at, last_seen_at)              PK (trip_id, user_id)
invite_links   (token PK, trip_id, role, created_by, expires_at, revoked_at)
invite_emails  (id, trip_id, email, role, invited_by, created_at, accepted_at, declined_at)
stops          (id, trip_id, name, place_json, country_code, arrive_date, leave_date, color, transport_in,
                deleted_at, deleted_by, deleted_version)
days           (stop_id, day_index, trip_id, title)                                   PK (stop_id, day_index)
activities     (id, trip_id, stop_id, day_index, title, time_start, time_end, place_json, notes, position, created_by,
                deleted_at, deleted_by, deleted_version)
ops_log        (trip_id, version, op_id UNIQUE, user_id, op_json, effects_json, created_at)  PK (trip_id, version)
edit_locks     (trip_id, entity, entity_id, user_id, tab_id, expires_at)   UNLOGGED    PK (trip_id, entity, entity_id), índice em tab_id
op_receipts    (op_id PK, trip_id, user_id, outcome, version, reason, created_at)
```

- As tabelas de entidades são a **projeção** (leitura rápida). O `ops_log` é o histórico, o feed e a base da reconexão.
- **Estado completo no `welcome`:** projeção lida numa transação `REPEATABLE READ` junto com `current_version`, o que dá uma foto consistente sem lock. Se `current - lastVersion > 500`, o servidor manda o estado em vez das ops.
- **Retenção (D19):** `ops_log` e tombstones (`deleted_at`, usados pelo *restore*) ficam; `op_receipts` com mais de 7 dias são apagados (as pendentes só vivem em memória). Sem snapshots no MVP; histórico/undo (v2) pode ser reconstruído dos `effects_json`.

---

## 12. Web (Next.js)

- **UI:** Tailwind 4 + shadcn/ui sobre Radix (D31). Um script gera de `packages/tokens` as variáveis CSS que o tema do shadcn lê.
- **Rotas públicas** (landing, sign in/up, join) com SSR. **App** (`/trips`, `/t/:id/...`) como client components sobre o `sync`.
- **Offline só leitura (D23):** Service Worker com **Serwist** (`@serwist/turbopack`, porque o Next 16 faz o build com Turbopack; precache do shell + rotas do app) e o `confirmed` de cada viagem em cache no IndexedDB. Sem conexão, a UI abre o plano e a busca, mas desabilita a edição. Ainda é o maior risco técnico da web: validar cedo (M1) com uma página "hello offline".
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
  places/      proxy Photon + cache Redis 24h + rate limit por usuário
  realtime/    gateway WS, pipeline de ops, locks de edição (Postgres), presença, pub/sub, prefetch do ReadSet → TripReader (D17)
  db/          Drizzle schema + migrations (drizzle-kit)
```

- **Papéis:** editor edita o plano e convida; só o owner muda papéis e exclui a viagem.
- **Convites:** link com token curto (`eR7k-2Qx9`), papel e expiração de 7 dias; "Reset link" revoga e cria outro. Convite por e-mail aparece como banner Join/Decline em `/trips` quando o e-mail verificado do usuário bate.
- E-mail transacional (convite, reset de senha): Resend.

---

## 14. Testes

| Nível | O quê | Ferramenta |
|---|---|---|
| Unit | `decide` de cada op, invariantes, ordenação | bun test |
| Componente | componentes React da web, buscando por role e label | bun test + Testing Library + happy-dom |
| Propriedade | N clientes simulados, ops aleatórias, entrega em ordem aleatória, quedas e reenvios → **todos convergem** para o estado do servidor (hash); nenhuma op perdida ou duplicada; mesma resposta para o mesmo `opId` | bun test + fast-check |
| Integração | API real + Postgres + Redis; N clientes WS concorrentes em 2 instâncias; exclusividade do lock de edição entre instâncias, inclusive com o Redis parado | bun test + compose |
| Chaos | derrubar instância, Redis e rede (latência, corte) no meio de edições → nenhuma op confirmada se perde; com o Redis fora, duas pessoas continuam sem conseguir editar a mesma coisa | toxiproxy |
| E2E | fluxos web (criar viagem, convidar, editar em 2 abas, lock "Ana is editing", abrir offline em só leitura) | Playwright |
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
- Telas a ajustar no MVP: no SignIn/SignUp, remover o "Email me a sign-in link instead" e esconder o "Continue with Google" até o OAuth entrar; remover a seção Documents do CardSheet; os botões "Save X offline", OfflineStop e TripOffline saem; o indicador de offline na lista de viagens sai (o plano é sempre consultável offline); as telas de conflito (ConflictChanges, ConflictDeleted, ConflictField) saem: viram o lock "Ana is editing" e toasts; a tela Offline vira o banner "viewing only"; a landing troca "Web + Android" e os chips "S3 presigned uploads" e "Docker · nginx" (agora Caddy); "2 API instances behind nginx" vira "behind Caddy".

---

## 18. Decisões complementares

**Tempo e fuso horário**
- Horários das atividades = **hora local de parede** (`"09:40"`) + data derivada (D12). Nada de UTC na atividade.
- Cada stop guarda `timezone` (IANA), calculado de `lat/lon` com `tz-lookup` (offline, no `core`).
- "Agora", "in 12 min" e "feitos" da Agenda: relógio do aparelho convertido para o fuso do stop do dia.
- `time.end < time.start` = atravessa a meia-noite (termina no dia seguinte).
- Deslocamentos entre fusos (voo Lisboa → Praga): fica para quando o transporte virar entidade. No MVP, a atividade usa o fuso do stop dela.

**Granularidade das edições**
- Campos de texto geram op no *blur*, depois de ~800 ms sem digitar ou no `pagehide`/`visibilitychange: hidden` (o celular mata abas em segundo plano). Campos discretos (horário, lugar, mover) geram op na hora.

**Abas, contas e armazenamento**
- Cada aba tem o próprio WS e um `tabId` estável (no `sessionStorage`). Duas abas do mesmo usuário disputam o lock de edição como duas pessoas; a UI diz "Open in another tab".
- O cache de leitura no IndexedDB é gravado por qualquer aba, **só se a versão for maior** que a gravada. Cache com formato incompatível é descartado e baixado de novo (é só cache).
- IndexedDB separado por `userId`; o logout apaga o cache.
- No login, baixa **todas** as viagens do usuário para o cache (o plano fica consultável offline).

**Membros e permissões em tempo real**
- Entrar, sair, ser removido, trocar papel, transferir posse e excluir a viagem passam **pelo mesmo pipeline** das ops (lock → `decide` → efeitos → versão), como ops de sistema (D18). Membros fazem parte do `confirmed` e do feed. Convites pendentes ficam fora (REST).
- Membro removido online: o gateway vê o efeito `member.remove`, solta os locks dele, fecha o WS (código 4403) e o cliente apaga a viagem do cache.
- Membro removido enquanto estava offline: no próximo `hello` recebe `forbidden`, o cliente apaga a viagem do cache e mostra um aviso.
- Mudança de papel: o gateway aplica o efeito `member.role` ao papel da conexão; a autorização de cada op é checada dentro da transação, na versão em que ela é decidida.
- O owner só sai da viagem depois de transferir a posse. A exclusão da viagem é soft-delete (só o owner) e derruba todos os conectados.

**Limites**

| Item | Limite |
|---|---|
| Título | 120 caracteres |
| Notas | 5.000 caracteres |
| Atividades por viagem | 2.000 |
| Stops por viagem | 100 |
| Duração da viagem | 366 dias |
| Membros por viagem | 20 |
| Mensagem WS | 64 KB |
| Ops por conexão | 20/s (burst 50), token bucket |
| Presença | 30/s |
| Auth | rate limit do Better Auth |

- Token de convite: 10 caracteres base32 (≈ 50 bits) de `crypto.getRandomValues`, com rate limit em `/join` (D32).
- Senha: argon2id do `Bun.password` com 19 MiB e 2 iterações (D32), mais o rate limit do Better Auth.

**Segurança e privacidade**
- Upgrade do WS valida o `Origin` (Cross-Site WebSocket Hijacking) além do ticket.
- **IDs vindos do cliente (D28):** o cliente propõe, o servidor decide.
  - Formato UUIDv7 validado pelo Zod.
  - `*.create` com ID que já existe (em qualquer viagem) é rejeitado; a PK é única no banco inteiro.
  - Toda leitura do servidor é filtrada pelo `trip_id` da op, além da checagem de membro: saber o ID de uma entidade de outra viagem não dá acesso a ela.
  - O recibo é conferido por `op_id` **e** `user_id`: um `opId` de outro usuário é rejeitado.
  - Nada deriva tempo ou ordem do horário embutido no ID; `created_at` e a ordem vêm do servidor.
- Textos do usuário são renderizados sempre como texto puro; CSP restritiva no Next.
- Cookies `HttpOnly; Secure; SameSite=Lax`; mesma origem, sem CORS.
- Exclusão de conta: remove os dados pessoais e troca o `user_id` no `ops_log`/`op_receipts` por um usuário "Deleted user"; as viagens das quais ele é owner passam para o membro mais antigo ou são excluídas se ele estiver sozinho.
- Páginas de Termos e Privacidade; analytics sem cookie (Umami self-hosted), sem banner.

**Acessibilidade**
- Drag & drop por teclado (dnd-kit), com anúncios.
- Mudanças remotas relevantes anunciadas via `aria-live="polite"`, com throttle.
- Contraste AA do texto sobre as cores dos stops (validado nos `tokens`).
- Respeitar `prefers-reduced-motion` nas animações de cards remotos.

**Interface**
- Interface em pt-BR e en-US (D34); datas e horas formatadas pelo locale (`Intl`).
- Só tema escuro no MVP; os `tokens` já nascem com estrutura para o claro.
- Avatar: foto do Google quando houver; senão, iniciais com a cor do membro.
- **Responsiva completa** (celular e desktop), com drag por toque. Os componentes são pensados mobile-first, o que também adianta o Android.

---

## 19. Em aberto

> A lista completa do que falta decidir, com recomendações, está em [`open-topics.md`](./open-topics.md).

| Questão | Prazo | Contexto |
|---|---|---|
| Adicionar ou esticar um stop num período ocupado: empurra os seguintes, só preenche buracos ou pergunta? | **Antes do M2** (UI da Overview) | Só UX: a invariante já é rígida (D14). Empurrar seria uma op explícita (`stops.shift`), barata com a D12 |
| Telas de celular no design | **Antes do M2** | O design atual é só desktop (1440 px) |
| Transporte como entidade (horário de partida e chegada, fuso de origem e destino) | v2 | Hoje é só o ícone em `stop.transportIn` |
| Assimetria das datas da viagem: `trip.update` que deixa stops de fora é aceito (aviso), mas `stop.create` fora da viagem é rejeitado (D14). Derivar as datas da viagem dos stops? | Antes do M1 (schema de `trips`) | Hoje é aceitável: cada op valida só o que ela muda |
| Lock de edição: TTL de 15 s e inatividade de 2 min são padrões iniciais | M4 | Ajustar com o uso real; ver seção 7 |
| Papel **viewer** (só leitura) | v2 | Não muda a arquitetura: `decide` já checa papel na transação (D18) |

**Dependem de protótipo ou teste (não dá para decidir no papel):**

| Questão | Como validar | Quando |
|---|---|---|
| Next.js + Serwist abre o app offline (já previsto) | Spike "hello offline" | M1 |
| `Bun.sql` aguenta o pipeline (D30) | Spike: duas transações com `FOR UPDATE` na mesma viagem rodam em série; com o pool cheio a op espera 2 s e recebe `busy`; transação travada é cortada em 5 s e libera o lock; migrations do Drizzle e Better Auth funcionam sobre o `Bun.sql`. Falhou → `postgres.js` | M1 |
| `requirements` (D17) cobre tudo que o `decide` lê | Reader de prefetch que lança erro + fast-check com todas as ops | M2 (e a cada op nova) |
| Custo do lock por op com prefetch (alvo ≤ 2 ms p95 no mesmo host) | Microbenchmark do pipeline com 2.000 atividades | M3 |
| Tamanho dos `effects` de cascata cabe em 64 KB (`stop.delete` com 135 atividades) | Teste de integração com a viagem do design | M3 |
| Latência percebida do lock (`acquire` antes de editar) não atrapalha abrir o CardSheet e arrastar | Medir o round-trip do `lock.acquire` em 4G simulado; a UI abre otimista e só bloqueia se vier `denied` | M4 |
| `pagehide` dispara de forma confiável no Chrome Android ao matar a aba | Teste manual em aparelho real | M5 |
| Rolling e rollback com instâncias mistas (P7) | Integração com API N e N+1 lado a lado | Na homologação, antes do 1º deploy com mudança de protocolo |
