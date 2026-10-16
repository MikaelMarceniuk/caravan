# Planejador de Viagem Colaborativo — Plano do Projeto

> Nome: **Caravan**
> Objetivo: projeto de portfólio para freelas e vagas remotas no exterior (pagamento em euro/dólar).
> Plataformas: **Web (Next.js)** no MVP. **Android (Expo)** na v2, reaproveitando o mesmo backend e o mesmo motor de sincronização.
> Arquitetura detalhada: [`architecture.md`](./architecture.md).

---

## 1. Pitch

Um grupo monta o roteiro de uma viagem junto, em tempo real. A viagem é dividida em **stops** (cidades, numa timeline), cada stop tem seus **dias** (colunas) e cada **atividade** é um card. Todos veem quem está online, quem está editando o quê e as mudanças dos outros na hora, sem flicker. O app funciona offline (aeroporto, estrada, roaming) e sincroniza sozinho quando a conexão volta. Nenhum dado se perde, mesmo se o servidor cair.

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
- Offline: o plano fica sempre disponível; as edições vão para a fila e sincronizam na volta; status Synced/Syncing/Offline
- Conflitos: painel "What changed" (Use mine / Keep theirs / Restore), card excluído visível, feed de atividade
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
- **Consistência:** servidor autoritativo, ops versionadas por viagem, lock `FOR UPDATE` na linha da viagem, LWW por campo. **Quem perde um conflito não perde o dado**: o valor fica guardado em `conflicts` até a pessoa decidir.
- **Tempo real:** WebSocket + Redis pub/sub entre 2 instâncias atrás do Caddy. O cliente detecta buracos de versão e pede `resync`.
- **Presença:** só Redis (hash com TTL por campo + pub/sub para cursor e drag).
- **Persistência:** Postgres (projeção + `ops_log` + snapshots); no cliente, IndexedDB + Service Worker (Serwist).
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
- [ ] **Decidir:** comportamento de stops em período ocupado (`architecture.md` §19)
- [ ] **Design:** telas de celular (até o fim da semana 4)

### Semanas 3–4 — Core, protocolo e motor de sync
- [ ] `core`: `decide()` + mutations para todas as ops, invariantes de stops, ordenação por horário
- [ ] Servidor WebSocket: `hello`/`welcome`, `op`, `ack`, `reject`, `resync`, ticket de auth
- [ ] Pipeline de ops (lock por viagem, idempotência, `ops_log`, `field_meta`)
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
- [ ] Redis pub/sub + 2 instâncias da API atrás do Caddy
- [ ] Teste: clientes em instâncias diferentes convergem

### Semana 9 — Resiliência
- [ ] Persistência local (IndexedDB) + Service Worker
- [ ] Reconexão com `lastVersion`, backoff, status Synced/Syncing/Offline + banner
- [ ] Snapshots
- [ ] **Chaos test** (toxiproxy): derrubar instância, Redis e rede no meio de edições → nada se perde

### Semana 10 — Conflitos
- [ ] Detecção no servidor (`field_overwritten`, `edit_on_deleted`, `deleted_after_edit`) + tabela `conflicts`
- [ ] Painel "What changed" (Needs you / All activity), conflito inline no CardSheet, card excluído + restore, toast "Your change was undone"

### Semana 11 — Lançamento
- [ ] Deploy de produção na VPS (cloud-init/OpenTofu, pipeline rolling, backups no R2, Grafana Cloud)
- [ ] Load test com k6 → registrar números no README e na landing
- [ ] README: arquitetura, diagrama, decisões e trade-offs, como rodar local
- [ ] GIF/vídeo: 3 navegadores editando juntos + chaos demo
- [ ] Post no LinkedIn + projeto em destaque no perfil

---

## 9. Vitrine (o que mostrar)

- **GIF principal:** dois navegadores + um celular lado a lado, cursores e cards se movendo; um deles offline e voltando.
- **Chaos demo:** matar uma instância da API ao vivo, sem perda de dados.
- **Conflito demo:** dois editam o mesmo horário → "What changed" → "Use mine".
- **Números:** "X conexões simultâneas, p95 de broadcast em Y ms" (k6).
- **README com "Decisões de design":**
  - Servidor autoritativo vs CRDT
  - `core` compartilhado (functional core, imperative shell)
  - Conflitos sem perda: LWW + versões guardadas para quem perdeu
  - Ordem do broadcast entre instâncias e detecção de buracos
  - Presença em Redis vs banco
  - Log de operações + snapshots
- **Post no LinkedIn:** o problema, a decisão principal, o demo e o link.
- Links: repositório público, web ao vivo.

---

## 10. Riscos e cortes possíveis

| Risco | Mitigação / corte |
|---|---|
| Sync engine demorar mais | É prioridade; se atrasar, cortar ⌘K, drag ao vivo e Google OAuth no primeiro deploy |
| Next.js offline (Service Worker) | Spike na semana 2; plano B: rotas do app como SPA estática servida pelo SW |
| Conflitos (semana 9) apertarem | Manter detecção e tabela; a UI mínima é só o toast + "Restore" |
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
