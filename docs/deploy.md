# Caravan — Deploy

> Infraestrutura de produção e desenvolvimento. A arquitetura da aplicação está em [`architecture.md`](./architecture.md).
> Última revisão: 2026-10-16.

---

## 0. Decisões

| # | Decisão | Motivo |
|---|---|---|
| P1 | **Tudo numa VPS ARM da Hetzner** (CAX21: 4 vCPU, 8 GB), com Docker Compose | Custo ~€7/mês; Postgres e Redis na mesma máquina da API (seção 1); a prod é reproduzível com um compose |
| P2 | **Web na mesma VPS e na mesma origem** que a API (sem Vercel) | Sem CORS/preflight nem cookie entre subdomínios; um pipeline só; o CDN vem do Cloudflare |
| P3 | **Caddy** como proxy/LB | TLS, LB com health check ativo e WS em poucas linhas; binário único |
| P4 | **Cloudflare** (DNS + proxy + Registrar) | DDoS, cache dos assets estáticos, certificado de origem grátis |
| P5 | **ARM ponta a ponta** | Máquina de dev aarch64, runner ARM grátis no GitHub, Hetzner ARM mais barata; sem emulação |
| P6 | **Sem staging** | O compose local é idêntico ao de produção; a CI roda a integração contra ele |

**Alternativa considerada:** Oracle Cloud Always Free (A1: 2 OCPU / 12 GB, €0). Descartada pelos riscos de recolhimento de instância ociosa, falta de capacidade na região e encerramento de conta. A Hetzner custa ~€7/mês e é previsível. O provisionamento em código (seção 6) mantém a migração barata nos dois sentidos.

---

## 1. Por que VPS e não PaaS ou banco gerenciado

Cada op segura o lock da viagem (`FOR UPDATE`) durante ~5–6 queries.

| Postgres | RTT por query | Lock por op | Teto por viagem |
|---|---|---|---|
| Mesmo host | ~0,1 ms | ~1–2 ms | centenas a milhares de ops/s |
| Gerenciado (Neon, Supabase) | 2–20 ms | 30–100 ms | dezenas de ops/s |

- **Redis gerenciado** (Upstash) cobra por comando, e cursor via pub/sub a cada 50 ms é o pior caso.
- **Fly, Railway e Render** custam 3–5× mais e escondem o "2 instâncias atrás de um LB" que a landing mostra.

---

## 2. Topologia

```
Browser ──HTTPS/WSS──► Cloudflare (proxy, cache de /_next/static/*)
                            │  Full (strict) · certificado de origem
                            ▼
      Hetzner Cloud Firewall: 443 só dos IPs do Cloudflare · 22 só por chave
                            ▼
      ┌──────────────── VPS CAX21 · Docker Compose ─────────────────┐
      │ caddy :443                                                   │
      │   /api/*, /ws  → api-1, api-2   (least_conn, /ready a cada 5s)│
      │   /*           → web-1, web-2   (round_robin, /healthz)      │
      │ api-1, api-2   Bun · binário compilado                       │
      │ web-1, web-2   Next.js standalone (Node 22)                  │
      │ postgres 18    volume local                                  │
      │ redis 8        sem persistência                              │
      │ backup         cron: pg_dump → Cloudflare R2                 │
      └──────────────────────────────────────────────────────────────┘
```

**Rotas (mesma origem `caravan.x`):**

| Caminho | Destino |
|---|---|
| `/api/auth/*` | Better Auth (na API) |
| `/api/*` | REST |
| `/ws` | WebSocket gateway |
| `/*` | Next.js |

Só o Caddy está na rede `edge`. Postgres e Redis ficam na rede interna, **sem porta publicada**. O Docker passa por cima do ufw, então o firewall de host não protege portas publicadas; o controle fica no Hetzner Cloud Firewall.

---

## 3. Serviços

| Serviço | Imagem | Memória (limite) | Notas |
|---|---|---|---|
| caddy | `caddy:2` | 64 MB | Certificado de origem do Cloudflare em arquivo (15 anos, sem ACME) |
| api-1/2 | `ghcr.io/<user>/caravan-api:<sha>` | 256 MB cada | `bun build --compile` sobre `distroless/base-nossl`; graceful shutdown (seção 5) |
| web-1/2 | `ghcr.io/<user>/caravan-web:<sha>` | 256 MB cada | `output: "standalone"` sobre `node:22-slim` |
| postgres | `postgres:18` | 2 GB | `shared_buffers=1GB`, `effective_cache_size=4GB`, `max_connections=50` |
| redis | `redis:8` | 300 MB | `maxmemory 256mb`, `save ""`, `appendonly no` (presença, pub/sub, cache e rate limit são efêmeros) |
| backup | imagem pequena com `pg_dump` + `rclone` | 128 MB | Diário, retenção de 7 dias no R2 |

**Health checks:**
- `api`: `/healthz` (processo vivo) e `/ready` (Postgres e Redis respondendo; vira 503 durante o shutdown).
- `web`: `/healthz`.

---

## 4. Cache e Cloudflare

- `/_next/static/*` → `Cache-Control: public, max-age=31536000, immutable`. O Cloudflare guarda em cache sem regra extra.
- **`/sw.js` e `/manifest.webmanifest` → `no-cache`.** Se o Service Worker ficar em cache, os clientes nunca recebem atualização.
- `/api/*` e `/ws` → nunca em cache (`Cache-Control: no-store`).
- WebSocket pelo proxy do Cloudflare: o timeout de inatividade é de 100 s; o ping do cliente vai a cada 25 s.
- IP real do cliente: `CF-Connecting-IP`, confiável só porque a origem aceita apenas IPs do Cloudflare.

---

## 5. Pipeline de deploy (zero downtime)

```
push na main
 ├─ CI: typecheck · Biome · unit/propriedade · integração (compose) · Playwright
 ├─ build em paralelo no runner ubuntu-24.04-arm → push GHCR (tag = sha)
 │    caravan-api   caravan-web
 └─ deploy (ssh, scripts/deploy.sh <sha>)
     1. docker compose pull
     2. docker compose run --rm api migrate         ← só migrations aditivas
     3. rolling da API: para cada api-N
          SIGTERM → /ready vira 503 → Caddy tira do pool
          fecha os WS com código 1012 (Service Restart) → clientes reconectam na outra instância, sem backoff
          drena as ops em andamento (timeout de 10 s) → sai
          sobe a versão nova → espera /ready → próxima
     4. rolling da web (mesmo processo, sem a parte de WS)
     5. smoke test: GET /api/healthz + hello via WS + GET /
     6. falhou? deploy.sh <sha anterior> (as imagens antigas ficam no host)
```

**Cada deploy exercita a reconexão de verdade.** É um chaos test que roda sozinho.

**Clientes antigos:** o Service Worker pode manter uma versão velha rodando por dias.
- O `hello` leva `protocolVersion`, e o servidor aceita a atual e a anterior.
- Cliente mais velho que isso recebe `upgrade_required`: o SW atualiza e a página recarrega. As pendentes estão no IndexedDB, então nada se perde.
- O schema das ops só muda de forma aditiva.

**Migrations em duas fases (expand/contract):** no release N, adiciona coluna nullable e o código escreve nos dois formatos; no release N+1, remove o formato antigo.

---

## 6. Provisionamento

- `infra/provision/cloud-init.yaml`: Docker, usuário `deploy` (só chave SSH, sem root), `unattended-upgrades`, swap de 2 GB, diretório `/srv/caravan`.
- `infra/provision/tofu/` (opcional, mas recomendado para o currículo): OpenTofu com os providers `hcloud` e `cloudflare`, criando a VPS, o firewall, os registros DNS e o certificado de origem. São ~60 linhas.
- **Segredos:** `/srv/caravan/.env` (modo 600) criado à mão uma vez; as variáveis ficam documentadas em `.env.example`. No GitHub, só a chave SSH de deploy e o token do GHCR.

---

## 7. Desenvolvimento local

`docker compose -f compose.yml -f compose.dev.yml up` sobe:
- Postgres, Redis, Caddy (`caravan.localhost`, certificado local do próprio Caddy), api ×2 e web.
- **mailpit**: captura e-mails de magic link e convite.
- **toxiproxy**, no perfil `chaos`: entre a API e o Postgres/Redis.

No dia a dia, também dá para rodar só Postgres e Redis no compose e a API/web com `bun dev`, com hot reload.

---

## 8. Observabilidade (tudo no plano grátis)

| O quê | Ferramenta |
|---|---|
| Erros (web + API) | Sentry |
| Métricas (`/metrics`: conexões WS, ops/s, latência do pipeline, p95 do broadcast) | Grafana Alloy → Grafana Cloud |
| Logs | stdout JSON → Alloy → Loki (Grafana Cloud) |
| Uptime | UptimeRobot em `/api/healthz` e `/` |

Um dashboard público do Grafana pode ir no README.

---

## 9. Testes de carga

- O k6 roda de uma **VPS temporária** da Hetzner (cobrada por hora: cria, roda, destrói, custa centavos), nunca da própria VPS, senão os números saem distorcidos.
- Os testes batem **direto na origem**: IP do k6 liberado temporariamente no firewall e `insecureSkipTLSVerify`, porque o certificado é de origem. Pelo Cloudflare, o resultado mediria a CDN e o tráfego poderia ser bloqueado como ataque.
- Os números (conexões simultâneas, p95 do broadcast) vão para o README e para a landing.

---

## 10. Backup e recuperação

- `pg_dump -Fc` diário → R2, com retenção de 7 dias.
- `scripts/restore.sh <data>`: **testado uma vez por mês** num container descartável. Backup que nunca foi restaurado não conta.
- O Redis não tem backup, por projeto: os clientes reconstroem a presença no próximo heartbeat.

---

## 11. Custo

| Item | Custo |
|---|---|
| Hetzner CAX21 | ~€7/mês (confirmar o preço atual) |
| Domínio (Cloudflare Registrar) | ~US$10–15/ano |
| Cloudflare, R2 (10 GB), GHCR, Actions (repo público), Resend, Sentry, Grafana Cloud, UptimeRobot | grátis |

---

## 12. Estrutura

```
infra/
  compose.yml            serviços e redes base
  compose.dev.yml        portas, mailpit, toxiproxy (perfil chaos), Caddy local
  compose.prod.yml       imagens do GHCR, limites de memória, backup, certificado de origem
  caddy/Caddyfile
  postgres/postgresql.conf
  scripts/               deploy.sh · backup.sh · restore.sh · smoke.sh
  provision/             cloud-init.yaml · tofu/
  k6/                    cenários de carga
.github/workflows/
  ci.yml                 PR e main
  deploy.yml             main → build ARM → GHCR → deploy.sh
```

---

## 13. Escalando além disso (não é para o MVP)

A arquitetura já aceita N instâncias. O caminho seria:
1. Postgres numa VPS dedicada, na rede privada da Hetzner.
2. API e web em 2+ VPS com um Load Balancer da Hetzner (~€6/mês).
3. Réplica de leitura para o `welcome` com estado completo.

Não muda nada no código.
