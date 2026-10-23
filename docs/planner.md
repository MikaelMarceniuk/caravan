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

## 3. Escopo do MVP

### Dentro
- Auth: e-mail/senha, Google, magic link, esqueci a senha (Better Auth)
- Lista de viagens (próximas/passadas, quem está online, convites pendentes)
- Criar viagem (nome, datas → gera os dias; primeiro stop e convites opcionais)
- Convites: link (papel, expira em 7 dias, reset) e por e-mail (reenviar, aceitar/recusar); papéis owner e editor
- **Overview:** timeline de stops por mês, adicionar/editar/remover stop (cidade, datas, transporte, cor), aviso de gaps
- **Board** por stop: dias como colunas (título editável), cards ordenados por horário
  - Criar, editar e excluir cards (título, horário, local, notas) no CardSheet
  - Mover cards entre dias (drag & drop)
- **Agenda:** linha do tempo do dia, "agora" e "up next"
- Presença: avatares, "fulano está editando" (card e campo), cursores ao vivo, drag ao vivo
- Offline **só leitura**: o plano fica sempre consultável (plano, Agenda, ⌘K); editar exige conexão; status Synced/Syncing/Offline + banner "viewing only"
- Edição exclusiva: lock por entidade ("Ana is editing"), toasts com *Restore* quando uma edição é rejeitada, feed de atividade
- Busca ⌘K na viagem (offline) + busca de lugares (online)
- **Web responsiva completa** (celular e desktop), com drag por toque
- Sem demo interativa: a vitrine é o GIF/vídeo

### Fora (v2+)
- **Documentos/anexos** e offline de arquivos
- **Android** (Expo)
- Chat do grupo
- Votação em atividades
- Divisão de gastos
- Mapa com rota do dia
- iOS

---

## 4–7. Arquitetura, consistência, persistência e stack

Movidos para [`architecture.md`](./architecture.md), que é a fonte da verdade técnica. Resumo:

- **Monorepo** (Bun + Turborepo): `apps/api` (Elysia), `apps/web` (Next.js), `packages/core` (domínio + `decide()` compartilhado entre cliente e servidor), `packages/sync` (motor de sync do cliente), `packages/tokens`.
- **Consistência:** servidor autoritativo, ops versionadas por viagem, lock `FOR UPDATE` na linha da viagem, recibo por op. **Lock de edição por entidade** (no Postgres, conferido na transação da op) impede duas pessoas de editarem a mesma coisa; não há conflitos para resolver.
- **Tempo real:** WebSocket + Redis pub/sub entre 2 instâncias atrás do Caddy. O cliente detecta buracos de versão e pede `resync`.
- **Presença:** só Redis (hash com TTL por campo + pub/sub para cursor e drag).
- **Persistência:** Postgres (projeção + `ops_log` + `op_receipts`, retidos para sempre); no cliente, IndexedDB + Service Worker (Serwist).
- **Stack:** Bun, Elysia, Drizzle, Zod, Better Auth, Resend, Next.js, dnd-kit, TanStack Query, Photon (lugares), fast-check, Playwright, k6, toxiproxy, Docker Compose, GitHub Actions, Caddy, Cloudflare, VPS ARM da Hetzner para tudo ([`deploy.md`](./deploy.md)).

---

## 8. Cronograma — 11 semanas (10–20h/semana)

### Semanas 1–2 — Fundação
- [ ] Monorepo (Bun + Turborepo), Biome, CI básico
- [ ] Comprar o domínio (Cloudflare Registrar)
- [ ] Docker Compose (Postgres, Redis)
- [ ] Auth com Better Auth (e-mail/senha, Google, magic link) + Resend
- [ ] Schema do banco + migrations (Drizzle)
- [ ] REST: viagens, membros, convites (link e e-mail)
- [ ] `packages/core`: tipos e schemas das ops
- [ ] **Spike de risco:** página Next.js abrindo offline com Serwist
- [ ] **Decidido:** sobreposição de stops é rígida (D14); falta só a UX de empurrar/preencher (`architecture.md` §19, até a semana 5)
- [ ] **Design:** telas de celular (até o fim da semana 4)

### Semanas 3–4 — Core, protocolo e motor de sync
- [ ] `core`: `requirements()` + `decide()` síncrono + mutations (efeitos) para todas as ops, invariantes de stops, ordenação por horário, upcasters
- [ ] Servidor WebSocket: `hello`/`welcome`, `op`, `ack`, `reject`, `resync`, ticket de auth
- [ ] Pipeline de ops (lock por viagem, prefetch, `op_receipts`, `ops_log` com efeitos, `field_meta`, ops de sistema de membros)
- [ ] `packages/sync`: confirmado + pendentes, rebase, buffer de ordem, portas Transport/Storage/Clock
- [ ] **Testes unitários** + **property-based** (N clientes, entrega aleatória → convergem)
- [ ] **Integração**: N clientes WS concorrentes contra a API real

### Semanas 5–7 — Web (mobile-first)
- [ ] Lista de viagens, nova viagem, convite, join
- [ ] Overview (timeline de stops, add stop, gaps) + busca de lugares (Photon)
- [ ] Board por stop (dias, cards por horário, drag entre dias) + CardSheet
- [ ] Agenda + busca ⌘K
- [ ] Layouts de celular, drag por toque, sheets em tela cheia
- [ ] Acessibilidade: drag por teclado, `aria-live`, contraste

### Semana 8 — Presença + escala
- [ ] Presença: avatares, "editando" (card e campo), cursores e drag ao vivo
- [ ] Lock de edição por entidade (`lock.acquire/release`, tabela `edit_locks`, `tabId`, conferência na transação) + UI "Ana is editing"
- [ ] Redis pub/sub + 2 instâncias da API atrás do Caddy
- [ ] Teste: clientes em instâncias diferentes convergem e o lock é exclusivo entre instâncias

### Semana 9 — Resiliência
- [ ] Cache de leitura (IndexedDB) + Service Worker: abrir o plano offline em só leitura
- [ ] Reconexão com `lastVersion`, backoff, status Synced/Syncing/Offline + banner "viewing only"
- [ ] Teste de compat de protocolo (API N e N+1 lado a lado, fixtures N−1)
- [ ] **Chaos test** (toxiproxy): derrubar instância, Redis e rede no meio de edições → nada se perde

### Semana 10 — Folga + polimento
- [ ] Toasts de rejeição (`deleted`, `locked`, `stop_overlap`) com *Restore with my change*; feed "All activity"
- [ ] Folga do cronograma (o painel de conflitos saiu do escopo)

### Semana 11 — Lançamento
- [ ] Deploy de produção na VPS (cloud-init/OpenTofu, pipeline rolling, backups no R2, Grafana Cloud)
- [ ] Load test com k6 (inclui o fan-out de cursores e a renovação de locks) → registrar números no README e na landing
- [ ] README: arquitetura, diagrama, decisões e trade-offs, como rodar local
- [ ] GIF/vídeo: 3 navegadores editando juntos + chaos demo
- [ ] Post no LinkedIn + projeto em destaque no perfil

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
| Sync engine demorar mais | É prioridade; se atrasar, cortar ⌘K, drag ao vivo e Google OAuth no primeiro deploy |
| Next.js offline (Service Worker) | Spike na semana 2; plano B: rotas do app como SPA estática servida pelo SW; plano C: sem offline no MVP (só o banner) |
| Overview (timeline) trabalhosa | Primeiro uma lista simples de stops; a timeline por mês vem depois |
| Responsivo completo atrasar | Drag por toque vira "mover para dia X" por menu no celular; o resto fica |
| Faltar design de celular | Derivar dos componentes desktop; revisar depois |
| Escopo crescer | Tudo fora da seção 3 vai para o backlog v2 |

---

## 11. Backlog v2
- **Android (Expo)**: Agenda + Board + CardSheet sobre `packages/sync`; checklist em `architecture.md` §16
- **Documentos/anexos** (R2/MinIO, presigned upload) + offline por arquivo/stop/viagem
- Histórico / "desfazer" usando o ops log
- Chat do grupo
- Votação em atividades
- Divisão de gastos multi-moeda
- Mapa com rota do dia
- iOS
