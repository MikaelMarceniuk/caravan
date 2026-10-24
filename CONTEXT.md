# Caravan — Glossário

Vocabulário do domínio. Código, protocolo, docs e UI usam estes termos. Decisões: [`docs/project/architecture.md`](docs/project/architecture.md) §0.

## Plano

- **Trip** (viagem): o plano compartilhado. Tem nome, datas e membros, e é a unidade de versão, de lock e de sincronização.
- **Stop**: uma cidade ou lugar da viagem com `arriveDate`/`leaveDate` (semiaberto). Stops não se sobrepõem (D14).
- **Gap**: datas da viagem sem stop. Não têm Board nem atividades.
- **Day** (dia): um índice `0..noites-1` dentro de um stop (`stopId + dayIndex`). Não é uma entidade livre. A data do dia é derivada (`arriveDate + dayIndex`).
- **Activity** (atividade): um item do roteiro, ancorado em `stopId + dayIndex` (D12). Na UI, é desenhada como *card* (`ActivityCard`, `CardSheet`). **Não usar "card" no domínio nem no protocolo** (D21).
- **Fora das datas** (*outside the stop's dates*): atividade cujo `dayIndex` não existe mais porque o stop foi encurtado. Continua no stop e volta sozinha se o stop for esticado (D13).

## Sincronização

- **Op**: a intenção de uma mudança, enviada pelo cliente dentro de um **Envelope** (`opId`). Conjunto fechado de tipos, que só cresce (P7).
- **Op de sistema**: op gerada só pela API a partir de um endpoint REST (`member.*`, `trip.delete`). Um cliente nunca a envia (D18).
- **Efeito** (*effect*, `Mutation`): a mudança de estado resultante de uma op decidida pelo servidor. É o que o cliente aplica no `confirmed` (D15).
- **Versão**: contador por viagem. Cada op aceita consome exatamente uma.
- **Recibo** (*receipt*): registro do resultado de uma op (aceita ou rejeitada). Garante a mesma resposta para o mesmo `opId` (D16).
- **Confirmed / pending / view**: estado aceito pelo servidor / ops locais sem resposta (só em memória, milissegundos) / o que a UI mostra (`pending` aplicado sobre `confirmed`).
- **Reject final / transitório**: final tem recibo e nunca muda. Transitório (rate limit, schema, `server_behind`) é reenviado.

## Edição

- **Lock de edição**: direito exclusivo, por tempo limitado (tabela `edit_locks` no Postgres, renovada a cada ~5 s), de uma **aba** editar uma entidade (atividade, stop, título de dia ou cabeçalho da viagem). Quem não tem o lock vê "Ana is editing" e não escreve (D22, D24). Não confundir com o `FOR UPDATE` na linha da viagem, que serializa as ops.
- **Aba** (`tabId`): identidade estável de uma aba do navegador entre reconexões; é a dona dos locks de edição.
- **Não existe "conflito"** no domínio: a concorrência é evitada pelo lock de edição. Uma op rejeitada (`deleted`, `locked`, `stop_overlap`) vira toast, e o conteúdo ainda está em memória.

## Cliente

- **Só leitura offline**: sem conexão, o plano abre a partir do cache (IndexedDB), mas não pode ser editado (D23).
