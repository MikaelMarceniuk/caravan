# Planejador de Viagem Colaborativo — Plano do Projeto

> Nome: **Caravan**
> Objetivo: projeto de portfólio para freelas e vagas remotas no exterior (pagamento em euro/dólar).
> Plataformas: **Web (Next.js)** no MVP. **Android (Expo)** na v2, reaproveitando o mesmo backend e o mesmo motor de sincronização.
> Arquitetura detalhada: [`architecture.md`](./architecture.md).

---

## 1. Pitch

Um grupo monta o roteiro de uma viagem junto, em tempo real. A viagem é dividida em **stops** (cidades, numa timeline), cada stop tem seus **dias** (colunas) e cada **atividade** é um card. Todos veem quem está online, quem está editando o quê e as mudanças dos outros na hora, sem flicker. Só uma pessoa edita cada coisa por vez ("Ana is editing"), então ninguém sobrescreve ninguém. Sem conexão (aeroporto, estrada, roaming), o plano continua aberto para consulta. Nenhuma edição confirmada se perde, mesmo se o servidor cair.

O produto é simples de propósito. A complexidade está no que ele demonstra tecnicamente.

---

## 2. O que o projeto precisa demonstrar

| Capacidade | Onde aparece |
|---|---|
| Tempo real / WebSocket | Operações e presença ao vivo |
| Consistência e concorrência | Servidor autoritativo, operações versionadas, rebase |
| Resiliência | Log de operações, recibos de op, reconexão, cache offline só leitura |
| Escala horizontal | 2+ instâncias da API com Redis pub/sub |
| Redis | Presença efêmera (TTL) + pub/sub; o que é promessa (locks de edição) fica no Postgres |
| Mensageria | Pub/sub entre instâncias |
| Integração externa | Busca de lugares (Photon/OSM) |
| Testes | Unitários + property-based (convergência) + integração (múltiplos clientes WS) + chaos test |
| Performance | Load test com k6 (conexões simultâneas, latência p95 do broadcast) |
| Fullstack | Next.js + núcleo de sync agnóstico de plataforma (pronto para o Android na v2) |
| DevOps | Docker Compose, Caddy, Cloudflare, CI/CD com deploy sem downtime, IaC (OpenTofu) |

---

## 3. Escopo da v1

### Dentro
- Auth: e-mail/senha, esqueci a senha e "Try the demo" (sessão anônima) com Better Auth. Google e Apple ficam para depois
- Lista de viagens (próximas/passadas, quem está online, convites pendentes)
- Criar viagem (nome e datas; primeiro stop e convites opcionais). Os dias vêm dos stops (D12); se a viagem tem datas próprias é o item 2 do [`open-topics.md`](./open-topics.md)
- Convites: link (papel, expira em 7 dias, reset) e por e-mail (reenviar, aceitar/recusar); papéis owner e editor
- **Overview:** lista de stops, adicionar/editar/remover stop (cidade, datas, transporte, cor), aviso de gaps
- **Board** por stop: dias como colunas (título editável), cards ordenados por horário
  - Criar, editar e excluir cards (título, horário, local, notas) no CardSheet
  - Mover cards entre dias (drag & drop)
- Presença: avatares, "fulano está editando" (card e campo)
- Offline **só leitura**: o plano fica sempre consultável (Overview, Board e CardSheet); editar exige conexão; status Synced/Syncing/Offline + banner "viewing only"
- Edição exclusiva: lock por entidade ("Ana is editing"), toasts com *Restore* quando uma edição é rejeitada
- Busca de lugares (online)
- **Web responsiva completa** (celular e desktop), com drag por toque
- "Try the demo": sessão anônima com uma viagem pronta, além do GIF/vídeo

### Fora
- **v1.x:** Agenda, login com Google e Apple, busca ⌘K, cursores e drag ao vivo, timeline por mês na Overview, feed "All activity"
- **Documentos/anexos** e offline de arquivos
- **Android** (Expo)
- Chat do grupo
- Votação em atividades
- Divisão de gastos
- Mapa com rota do dia
- iOS

Cada item tem versão no roadmap (§8).

---

## 4–7. Arquitetura, consistência, persistência e stack

Movidos para [`architecture.md`](./architecture.md), que é a fonte da verdade técnica. Resumo:

- **Monorepo** (Bun + Turborepo): `apps/api` (Elysia), `apps/web` (Next.js), `packages/core` (domínio + `decide()` compartilhado entre cliente e servidor), `packages/sync` (motor de sync do cliente), `packages/tokens`.
- **Consistência:** servidor autoritativo, ops versionadas por viagem, lock `FOR UPDATE` na linha da viagem, recibo por op. **Lock de edição por entidade** (no Postgres, conferido na transação da op) impede duas pessoas de editarem a mesma coisa; não há conflitos para resolver.
- **Tempo real:** WebSocket + Redis pub/sub entre 2 instâncias atrás do Caddy. O cliente detecta buracos de versão e pede `resync`.
- **Presença:** só Redis (hash com TTL por campo + pub/sub para cursor e drag).
- **Persistência:** Postgres (projeção + `ops_log` retido inteiro + `op_receipts` por 7 dias, D19); no cliente, IndexedDB + Service Worker (Serwist).
- **Stack:** Bun, Elysia, Drizzle, Zod, Better Auth, Resend, Next.js 16, Tailwind 4, shadcn/ui (Radix), dnd-kit, TanStack Query, Photon (lugares), fast-check, Playwright, k6, toxiproxy, Docker Compose, GitHub Actions, Caddy, Cloudflare, VPS ARM da Hetzner para tudo ([`deploy.md`](./deploy.md)).

---

## 8. Roadmap

Sem prazos: o que importa é a **ordem** e o que entra em cada versão. Cada marco termina com algo rodando em produção. Se algo apertar, a feature muda de versão em vez de ser cortada.

Valem para todos os marcos: responsividade e acessibilidade fazem parte de cada tela, e o código nasce com TDD ([`development.md`](./development.md)).

### v1 — vitrine

#### M1 — Fundação
- [ ] Monorepo (Bun + Turborepo), Biome, CI básico
- [ ] Comprar o domínio (Cloudflare Registrar)
- [ ] Docker Compose (Postgres, Redis)
- [ ] Schema do banco + migrations (Drizzle)
- [ ] Auth com Better Auth: e-mail e senha (sem envio de e-mail)
- [ ] REST: criar e listar viagens
- [ ] **Deploy mínimo na prod:** CAX11, Caddy, Cloudflare, CI fazendo deploy (1 instância da API)
- [ ] **Spike de risco:** página Next.js abrindo offline com Serwist
- [ ] **Spike de risco:** `Bun.sql` no pipeline (`FOR UPDATE` em série, pool cheio → `busy`, timeout de transação, migrations e Better Auth); plano B: `postgres.js` (`architecture.md` D30)

**No fim:** login e lista de viagens no ar.

#### M2 — Fatia de sync (stops)
- [ ] `core`: `requirements()` + `decide()` síncrono + mutations (efeitos) para as ops de stop, invariantes de stops, upcasters
- [ ] Servidor WebSocket: `hello`/`welcome`, `op`, `ack`, `reject`, `resync`, ticket de auth
- [ ] Pipeline de ops (lock por viagem, prefetch, `op_receipts`, `ops_log` com efeitos)
- [ ] `packages/sync`: confirmado + pendentes, rebase, buffer de ordem, portas Transport/Storage/Clock
- [ ] Overview básica (lista de stops; adicionar, editar e remover) + busca de lugares (Photon) + toast de `stop_overlap`
- [ ] **Testes:** unitários, **property-based** (N clientes, entrega aleatória → convergem) e **integração** (N clientes WS contra a API real)
- [ ] **Homologação sob demanda** (`deploy.md` §14)

**No fim:** duas abas editando stops juntas, em produção.

#### M3 — Plano completo
- [ ] `core` e pipeline para as ops de dias e atividades, ordenação por horário
- [ ] Board por stop (dias, atividades por horário) + CardSheet
- [ ] Drag & drop: mouse, toque, teclado e "Mover para…"

**No fim:** uma viagem inteira planejada no app.

#### M4 — Colaboração
- [ ] Infra de e-mail: Resend, domínio verificado, templates
- [ ] Convites: link (papel, expira em 7 dias, reset) e e-mail (reenviar, aceitar/recusar); join
- [ ] "Forgot password"
- [ ] Membros como ops de sistema (entrar, sair, trocar papel)
- [ ] Presença: avatares e "editando" (card e campo)
- [ ] Lock de edição por entidade (`lock.acquire/release`, tabela `edit_locks`, `tabId`, conferência na transação) + UI "Ana is editing" + toast de `locked` com *Restore with my change*

**No fim:** duas pessoas planejando juntas de verdade.

#### M5 — Escala e resiliência
- [ ] Redis pub/sub + 2 instâncias da API atrás do Caddy; rolling deploy
- [ ] Teste: clientes em instâncias diferentes convergem e o lock é exclusivo entre instâncias
- [ ] Reconexão com `lastVersion`, backoff, status Synced/Syncing/Offline + banner "viewing only"
- [ ] Cache de leitura (IndexedDB) + Service Worker: abrir o plano offline em só leitura
- [ ] Teste de compat de protocolo (API N e N+1 lado a lado, fixtures N−1)
- [ ] **Chaos test** (toxiproxy): derrubar instância, Redis e rede no meio de edições → nada se perde

**No fim:** a parte técnica completa.

#### M6 — Lançamento
- [ ] "Try the demo": sessão anônima com uma viagem pronta (o seed)
- [ ] Infra completa: OpenTofu, backups no R2, Grafana Cloud, Sentry, UptimeRobot
- [ ] Upgrade para CAX21 + load test com k6 (inclui a renovação de locks) → números no README e na landing
- [ ] README: arquitetura, diagrama, decisões e trade-offs, como rodar local
- [ ] GIF/vídeo: 3 navegadores editando juntos + chaos demo
- [ ] Post no LinkedIn + projeto em destaque no perfil

**No fim:** a vitrine pronta.

### v1.x
- **Agenda** (linha do tempo do dia, "agora" e "up next"), junto com o fuso horário do stop
- Login com Google e Apple
- Busca ⌘K na viagem
- Cursores e drag ao vivo
- Timeline por mês na Overview
- Feed "All activity"
- Homologação que acorda ao acessar (Cloudflare Worker)

### v2
- **Android (Expo):** Agenda + Board + CardSheet sobre `packages/sync`; checklist em `architecture.md` §16
- **Mapa** com rota do dia (MapLibre + OpenFreeMap, D27)
- **Documentos/anexos** (R2/MinIO, presigned upload) + offline por arquivo/stop/viagem
- Histórico / "desfazer" usando o ops log
- Transporte como entidade
- Papel *viewer* (só leitura)

### v3+
- Chat do grupo
- Votação em atividades
- Divisão de gastos multi-moeda
- iOS

---

## 9. Vitrine (o que mostrar)

- **GIF principal:** dois navegadores + um celular lado a lado, cursores e cards se movendo; um deles perde a conexão e continua vendo o plano.
- **Chaos demo:** matar uma instância da API ao vivo, sem perda de dados; derrubar o Redis e mostrar que o lock de edição continua valendo.
- **Edição exclusiva demo:** Ana abre um card, Leo vê "Ana is editing"; Ana fecha e Leo edita.
- **Números:** "X conexões simultâneas, p95 de broadcast em Y ms" (k6).
- **README com "Decisões de design":**
  - Servidor autoritativo vs CRDT
  - `core` compartilhado (functional core, imperative shell)
  - Lock de edição em vez de resolução de conflitos (e por que offline é só leitura)
  - Ordem do broadcast entre instâncias e detecção de buracos
  - Presença em Redis vs lock de edição no banco (efêmero × promessa)
  - Log de operações retido inteiro: por que não compactar (ainda)
- **Post no LinkedIn:** o problema, a decisão principal, o demo e o link.
- Links: repositório público, web ao vivo.

---

## 10. Riscos e cortes possíveis

| Risco | Mitigação / corte |
|---|---|
| Sync engine demorar mais | É prioridade; ⌘K, drag ao vivo e login social já estão na v1.x. Se atrasar mais, outras features mudam de versão (§8) |
| Next.js offline (Service Worker) | Spike no M1; plano B: rotas do app como SPA estática servida pelo SW; plano C: sem offline no MVP (só o banner) |
| `Bun.sql` instável no pipeline | Spike no M1; plano B: `postgres.js` (mesma API, o Drizzle esconde o driver) |
| Overview (timeline) trabalhosa | Primeiro uma lista simples de stops; a timeline por mês vem depois |
| Responsivo completo atrasar | O drag por toque pode esperar: o "Mover para…" (exigido pela WCAG) já cobre o celular |
| Faltar design de celular | Derivar dos componentes desktop; revisar depois |
| Escopo crescer | Tudo fora da seção 3 vai para uma versão seguinte do roadmap (§8) |
