Quero planejar a seguinte feature:

**Feature:** [descreva a funcionalidade que quero implementar]

Antes de propor uma solução, consulte as instruções aplicáveis do repositório, incluindo `AGENTS.md`, `docs/project/development.md`, `docs/project/planner.md` e a documentação arquitetural relevante. Consulte também a skill TDD quando aplicável.

## Objetivo

Transforme minha ideia em um plano de implementação claro, coerente com a arquitetura existente e dividido em etapas pequenas e verificáveis.

## Processo obrigatório

1. **Investigue o estado atual**
   - Examine a estrutura e o código relevante do projeto.
   - Identifique funcionalidades existentes, dependências, convenções e restrições que afetam a feature.
   - Reutilize soluções existentes quando apropriado.
   - Diferencie fatos confirmados no código de hipóteses e informações ainda desconhecidas.

2. **Esclareça os requisitos**
   - Identifique o comportamento esperado, os casos de uso, os casos-limite e os critérios de aceitação.
   - Identifique requisitos não funcionais relevantes, como segurança, desempenho, acessibilidade, compatibilidade e observabilidade, quando aplicáveis.
   - Se faltar uma informação que possa alterar significativamente a solução, faça perguntas objetivas e aguarde minhas respostas antes de fechar o plano.
   - Não invente requisitos apenas para preencher lacunas.

3. **Avalie a arquitetura**
   - Identifique os módulos, interfaces, dados e fluxos que provavelmente serão afetados.
   - Avalie como a feature se encaixa na arquitetura existente.
   - Não introduza camadas, interfaces, abstrações ou dependências sem necessidade justificada.
   - Se houver uma decisão arquitetural relevante sem orientação documentada, apresente as alternativas, seus trade-offs e uma recomendação fundamentada. Aguarde minha decisão antes de assumir uma alternativa.

4. **Planeje a implementação**
   - Divida o trabalho em fatias verticais pequenas, ordenadas por dependência.
   - Para cada fatia, descreva o comportamento entregue, os componentes envolvidos, os testes necessários e os critérios de conclusão.
   - Defina a estratégia de testes seguindo `docs/project/development.md` e a skill TDD: RED → GREEN → REFACTOR para mudanças de comportamento.
   - Identifique testes unitários, de integração, de componentes ou end-to-end quando forem relevantes.
   - Identifique dependências, migrações, configurações, riscos e verificações necessárias.
   - Considere a infraestrutura de testes e CI realmente existente. Não presuma que ferramentas estejam configuradas se ainda não estiverem.

5. **Avalie os riscos e as alternativas**
   - Aponte riscos técnicos, impactos em funcionalidades existentes e possíveis problemas de compatibilidade.
   - Identifique quais decisões podem ser adiadas e quais precisam ser resolvidas antes da implementação.
   - Evite ampliar o escopo com melhorias não necessárias à feature.

## Formato da resposta

Apresente o plano nesta estrutura:

1. **Resumo da feature:** problema, objetivo e resultado esperado.
2. **Estado atual:** arquivos, módulos e comportamentos relevantes encontrados no projeto.
3. **Requisitos e critérios de aceitação:** comportamentos observáveis e verificáveis.
4. **Proposta arquitetural:** abordagem recomendada, alternativas relevantes e justificativas.
5. **Plano por fatias verticais:** ordem de implementação, resultado de cada etapa, testes e critérios de conclusão.
6. **Estratégia de testes e validação:** o que pode ser executado hoje, o que depende de infraestrutura futura e como validar cada etapa.
7. **Riscos e dependências:** problemas possíveis e medidas de mitigação.
8. **Decisões pendentes:** perguntas que precisam da minha resposta antes de avançar.
9. **Escopo explícito:** o que está incluído e o que não será feito nesta feature.

## Restrições

- Esta etapa é exclusivamente de planejamento.
- Não altere arquivos do projeto, não escreva a implementação e não crie testes.
- Não instale dependências nem execute migrações.
- Não crie commits, faça push, abra PRs, aprove PRs ou faça merges.
- Não trate suposições como fatos.
- Não considere o plano aprovado automaticamente.

Ao terminar, apresente o plano para minha revisão. Aguarde minha aprovação explícita e incorpore as correções solicitadas antes de considerar o planejamento concluído.
