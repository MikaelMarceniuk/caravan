# Caravan — Deploy

> Infraestrutura de produção e desenvolvimento. A arquitetura da aplicação está em [`architecture.md`](./architecture.md).
> Última revisão: 2026-10-23.

---

## 0. Decisões

| # | Decisão | Motivo |
|---|---|---|
| P1 | **Prod inteira numa VPS ARM da Hetzner**, com Docker Compose. Começa na CAX11 (2 vCPU, 4 GB) e sobe para a CAX21 (4 vCPU, 8 GB) antes do teste de carga ou quando a RAM apertar | Custo ~€6,49/mês (CAX21: ~€10,99); Postgres e Redis na mesma máquina da API (seção 1); a prod é reproduzível com um compose. O upgrade só de CPU/RAM mantém o disco e permite voltar |
| P2 | **Web na mesma VPS e na mesma origem** que a API (sem Vercel) | Sem CORS/preflight nem cookie entre subdomínios; um pipeline só; o CDN vem do Cloudflare |
| P3 | **Caddy** como proxy/LB | TLS, LB com health check ativo e WS em poucas linhas; binário único |
| P4 | **Cloudflare** (DNS + proxy + Registrar) | DDoS, cache dos assets estáticos, certificado de origem grátis |
| P5 | **ARM ponta a ponta** | Máquina de dev aarch64, runner ARM grátis no GitHub, Hetzner ARM mais barata; sem emulação |
| P9 | **Repositório público** no GitHub | É vitrine de portfólio, e o runner ARM e o Actions só são grátis em repo público. Segredos nunca entram no repo (seção 6) |
| P6 | **Homologação sob demanda** numa CAX11 separada, criada para uma branch e apagada sozinha depois de 1h sem uso (seção 14) | A Hetzner cobra servidor desligado, então economizar exige apagar. A homol testa o que o compose local não testa: celular real (SW exige HTTPS), Cloudflare/Caddy/WS reais e o rolling da P7 |
| P7 | **Protocolo "leitor antes de escritor"** (expand/contract também para ops e efeitos) | Rolling com instâncias mistas e rollback automático sem divergência (seção 5) |
| P8 | **Dual-stack: IPv4 + IPv6** (IPv4 a ~€0,50/mês por servidor) | IPv6-only quebra a saída para serviços sem IPv6 (GitHub/GHCR, Grafana Cloud, Photon) e o SSH vindo dos runners do GitHub, que não têm IPv6 |

**Alternativa considerada:** Oracle Cloud Always Free (A1: 2 OCPU / 12 GB, €0). Descartada pelos riscos de recolhimento de instância ociosa, falta de capacidade na região e encerramento de conta. A Hetzner custa ~€6,49/mês e é previsível. O provisionamento em código (seção 6) mantém a migração barata nos dois sentidos.

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
      ┌──────────────── VPS CAX11 · Docker Compose ─────────────────┐
      │ caddy :443                                                   │
      │   /api/*, /ws  → api-1, api-2   (least_conn, /ready a cada 5s)│
      │   /*           → web-1, web-2   (round_robin, /healthz)      │
      │ api-1, api-2   Bun · binário compilado                       │
      │ web-1, web-2   Next.js standalone (Node 24)                  │
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
| web-1/2 | `ghcr.io/<user>/caravan-web:<sha>` | 256 MB cada | `output: "standalone"` sobre `node:24-slim` |
| postgres | `postgres:18` | 1 GB | `shared_buffers=256MB`, `effective_cache_size=1GB`, `max_connections=50`. Na CAX21: 2 GB, `shared_buffers=1GB`, `effective_cache_size=4GB` |
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
push na master
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

**A `master` vai direto para a prod** (só recebe merge de PR, nunca commit direto). A homologação (seção 14) é para testar uma branch antes do merge, não um degrau obrigatório.

**Cada deploy exercita a reconexão de verdade.** É um chaos test que roda sozinho.

**Compatibilidade de protocolo: leitor antes de escritor (P7).** O Service Worker pode manter uma versão velha rodando por dias, e durante o rolling (ou um rollback) há instâncias N e N+1 ao mesmo tempo.
- **Tipo novo de op ou de efeito leva dois releases:** no N+1, API, web e `core` **entendem** o tipo novo, mas ninguém o emite; no N+2, ele começa a ser emitido. Assim, instâncias mistas e o rollback de 1 release são sempre seguros. Remover um tipo segue o caminho inverso (para de emitir, depois para de entender).
- O `hello` leva `protocolVersion`, e o servidor aceita a atual e a anterior.
  - Cliente mais velho que isso → `upgrade_required`: o SW atualiza e a página recarrega. Sem fila offline, não há pendentes a preservar (as em voo são de milissegundos).
  - Cliente **mais novo** que o servidor (rollback) → `server_behind`: o cliente fica em só leitura e tenta de novo com backoff.
- **Efeitos codificados por conexão:** o gateway serializa os `effects` na versão de protocolo de cada conexão. Se um efeito não tiver representação na versão do cliente, aquela conexão recebe `upgrade_required`, porque ignorar o efeito causaria divergência.
- **Pub/sub e `ops_log` versionados:** toda mensagem em `trip:{id}` e todo `effects_json` levam `v`. O `core` exporta *upcasters* de `Mutation` (do `ops_log`) de cada versão antiga para a atual. O cache de leitura no IndexedDB não precisa de upcaster: formato incompatível é descartado e baixado de novo.
- **Teste de compat na CI:** fixtures de mensagens e `ops_log` da versão anterior; e um teste de integração com API N e N+1 lado a lado e clientes das duas versões.

**Migrations em duas fases (expand/contract):** no release N, adiciona coluna nullable e o código escreve nos dois formatos; no release N+1, remove o formato antigo.

---

## 6. Provisionamento

- `infra/provision/cloud-init.yaml`: Docker, usuário `deploy` (só chave SSH, sem root), `unattended-upgrades`, swap de 2 GB, diretório `/srv/caravan`.
- `infra/provision/tofu/` (opcional, mas recomendado para o currículo): OpenTofu com os providers `hcloud` e `cloudflare`, criando a VPS, o firewall, os registros DNS e o certificado de origem. São ~60 linhas.
- **Projetos da Hetzner:** `caravan-prod` e `caravan-homol`, cada um com o seu token de API. O token da homol não enxerga a prod.
- **IPs primários reservados** (`auto_delete: false`): o servidor pode ser recriado sem mudar o DNS.
- **Segredos:** `/srv/caravan/.env` (modo 600) criado à mão uma vez; as variáveis ficam documentadas em `.env.example`. No GitHub, só a chave SSH de deploy e o token do GHCR.

---

## 7. Desenvolvimento local

`docker compose -f compose.yml -f compose.dev.yml up` sobe:
- Postgres, Redis, Caddy (`caravan.localhost`, certificado local do próprio Caddy), api ×2 e web.
- **mailpit**: captura e-mails de convite e reset de senha.
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
| Hetzner CAX11 (prod) | ~€6,49/mês com IPv4 (CAX21: ~€10,99). Preços de outubro de 2026, depois do aumento de junho |
| Homologação (CAX11 por hora) | centavos por mês + ~€0,50/mês do IPv4 reservado |
| Domínio (Cloudflare Registrar) | ~US$10–15/ano |
| Cloudflare, R2 (10 GB), GHCR, Actions (repo público), Resend, Sentry, Grafana Cloud, UptimeRobot | grátis |

---

## 12. Estrutura

```
infra/
  compose.yml            serviços e redes base
  compose.dev.yml        portas, mailpit, toxiproxy (perfil chaos), Caddy local
  compose.prod.yml       imagens do GHCR, limites de memória, backup, certificado de origem
  compose.homol.yml      sobre o prod: sem backup, mailpit, seed
  caddy/Caddyfile
  postgres/postgresql.conf
  scripts/               deploy.sh · backup.sh · restore.sh · smoke.sh · idle-reaper.sh
  provision/             cloud-init.yaml · tofu/
  k6/                    cenários de carga
.github/workflows/
  ci.yml                 PR e master
  deploy.yml             master → build ARM → GHCR → deploy.sh
  homol.yml              branch → build ARM → GHCR → cria a homol → deploy.sh
```

---

## 13. Escalando além disso (não é para o MVP)

A arquitetura já aceita N instâncias. O caminho seria:
1. Postgres numa VPS dedicada, na rede privada da Hetzner.
2. API e web em 2+ VPS com um Load Balancer da Hetzner (~€6/mês).
3. Réplica de leitura para o `welcome` com estado completo.

Não muda nada no código.

---

## 14. Homologação

**Ciclo de vida:**

```
workflow_dispatch (escolhe a branch) ou label `homol` no PR
 ├─ build ARM → GHCR (o mesmo do deploy da prod)
 ├─ homol existe? não → OpenTofu cria a CAX11 no projeto caravan-homol, com o IP reservado
 ├─ deploy.sh <sha> com compose.prod.yml + compose.homol.yml
 └─ migrate + seed (a viagem do design)

idle-reaper (timer systemd, a cada 10 min, na própria homol)
 └─ GET /internal/idle (só localhost): sem WS aberto nem request há mais de 1h?
     └─ sim → DELETE /servers/{id} na API da Hetzner (o IP reservado fica)
```

- **Mesmas imagens e mesmo `deploy.sh` da prod:** o que passa na homol é o que vai para a prod. Ela roda api ×2 para ensaiar o rolling e a compatibilidade da P7.
- **Banco descartável:** cada criação começa do seed. Nada da homol precisa sobreviver a ela.
- **E-mails vão para o mailpit**, nunca para fora.
- **Acesso fechado:** `homol.caravan.x` atrás do Cloudflare Access (grátis até 50 usuários). Os buscadores não indexam e ninguém de fora cai nela por acaso.
- **Depois (v1.x): acordar ao acessar.** Um Cloudflare Worker em `homol.caravan.x` cria o servidor pela API da Hetzner quando ele não existe e mostra "Ligando a homol…" até o `/ready` responder (~2 min).

