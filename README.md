# Zubler CRM · Customer Success

MVP de um app de Customer Success para acompanhar a saúde da carteira de clientes: pipes em kanban por funil, health score, MRR, status personalizados, agrupamentos, cancelamento (lost) e abas de cliente.

## Rodando

```bash
npm install
npm run dev
```

## Conexão com o app (Clínicas, Usuários, Financeiro, Cupons)

As telas Pipe, Dashboard, Clínicas, Usuários, Financeiro e Cupons usam dados reais do app pela Edge Function
`supabase/functions/crm-ponte`. O navegador nunca vê o `CRM_BRIDGE_TOKEN`: ele manda o
login do Supabase, a função confere se o e-mail é da equipe e repassa a chamada para
`CORE_API_URL/api/public/crm/...`.

Secrets do projeto no Lovable (Cloud → Secrets):

| Nome | Valor |
|---|---|
| `CRM_BRIDGE_TOKEN` | o mesmo token configurado no app |
| `CORE_API_URL` | endereço do app, ex.: `https://seu-dominio.com.br` |
| `CRM_ADMIN_EMAILS` | e-mails que podem usar o CRM, separados por vírgula |

As contas de login da equipe são criadas no Lovable em Cloud → Users. O front lê
`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, que o Lovable Cloud preenche.

## Estrutura

- `src/CustomerSuccessApp.jsx` — o app inteiro (componente React autocontido, estilos inline, dados de exemplo)
- `src/main.jsx` — ponto de entrada do Vite (exige login antes de abrir o app)
- `src/core/` — login, acesso à ponte (`api.js`) e as telas Clínicas, Usuários, Financeiro e Cupons
- `supabase/functions/crm-ponte/` — Edge Function que guarda o token e repassa as chamadas ao app

## Funcionalidades

- **Sidebar**: Dashboard, Pipe, - **Cupons**: planos atuais do MediCopilot (lidos do app) e cupons de desconto da contratação —
  porcentagem, valor fixo, dias de teste grátis ou recurso adicional grátis; por plano ou para
  qualquer plano; vitalício ou por N meses; com validade e limite de usos. O nome do cupom é o
  código que o cliente digita e não se repete. Os cupons ficam no banco do app (tabela `cupons`).

Agenda, Atividades, Jornadas, NPS, Indicadores, Configurações, alternância claro/escuro
- **Dashboard**: clientes ativos, MRR, health score médio, clientes em risco, carteira por responsável, cancelamentos
- **Pipe**: clientes reais do app (rota `pipe` da ponte), em três funis:
  Leads (Conta criada → Contratando → Aguardando pgto → Pago · ativar), Onboarding
  (Kick-off → Check-out) e Ongoing (Ativação → Sucesso)
  - Cada card é uma clínica (conta do médico) ou uma contratação sem conta. Sem posição
    salva, o card cai sozinho: sem assinatura → Leads; assinatura com menos de 30 dias →
    Kick-off; mais antiga → Customer Success; inadimplente → Risco. Assinatura cancelada
    no app vira lost automático
  - Lead só anda no funil de Leads e cliente com assinatura só em Onboarding/Ongoing;
    quando o lead assina, ele sai dos Leads sozinho
  - Posição, responsável da equipe e lost ficam na tabela `crm_pipe` do app
  - Health score pelo último login da clínica (médico + equipe), inadimplência, cobranças
    vencidas e bloqueio; selo de pagamento no card (Em dia, Inadimplente, vencidas,
    Aguardando pgto, Pago sem ativar)
  - Bifurcação vertical/horizontal (┃/━), com rolagem independente por funil
  - Arrastar e soltar entre etapas, inclusive em etapas vazias e entre funis
  - Agrupar por Responsável (qualquer modo) ou Status/Plano (com um único funil), com grupos recolhíveis
  - Filtros: ordenação (Nome, Health, MRR, Novo, Início), status, responsáveis (multiselect; com 2+ responsáveis, um funil por vez)
  - Contador da etapa com tooltip do MRR e botão "+" para automações
- **Cliente**: abas no topbar, como num navegador (várias abertas ao mesmo tempo), tela cheia com
  - Dados: cadastro do app + preenchimento manual ("Editar dados") do que o app não tem
    (telefone, documento, cidade…) e qualificação do lead (origem, plano de interesse,
    mensalidade potencial, decisor, próximo passo, observações). Campo que vem do app fica travado
  - Financeiro: cartão do plano (status, mensalidade, ciclo, próxima cobrança, equipe), vínculo com
    o Asaas (ids de cliente e assinatura, sincronizar), cancelamento (agendar no fim do ciclo ou
    cancelar agora, desfazer agendamento), jornada da contratação para leads, totais (recebido,
    líquido, em aberto, vencido, estornado), mapa dos últimos 12 meses, cobranças com fatura e
    estorno total/parcial, e lista de estornos
  - Uso (clínicas com conta): risco de churn, alertas, comparação de cada métrica com o período
    anterior, a média histórica da clínica e a média dos parceiros, gráfico diário, consumo da
    franquia do mês e licenças, usuários (último acesso, dias com acesso, acessos) e telas acessadas
  - Timeline: eventos do app (conta criada, pagamentos, virou cliente, último acesso, próximas
    cobranças) + registros da equipe (nota, ligação, reunião, e-mail, WhatsApp, proposta),
    com filtro Tudo/Equipe/App; cada um apaga só o que registrou
  - Neural Score, Atividades, Tickets

  O cadastro manual e a timeline ficam no banco do próprio CRM (tabelas `crm_lead_dados` e
  `crm_timeline`, em `supabase/migrations/`), não no app.
- **Lost**: motivo, data, multa, boletos pendentes, valor em aberto e observações; o cliente sai da pipe e aparece no Dashboard.
  Com assinatura ativa, boletos e valor em aberto vêm das cobranças e dá para cancelar a assinatura no app/Asaas junto
- **Financeiro**: resumo do mês (recebido, a receber, vencido, estornado), cobranças com filtros (situação, Asaas/manual,
  busca), estornos, cancelamentos, inadimplentes e contratações pagas sem assinatura

O Asaas é integrado no MediCopilot; o CRM lê e pede ações pela ponte. As rotas e campos novos que o app
precisa ter estão em [`docs/contrato-financeiro.md`](docs/contrato-financeiro.md). Enquanto o app não tiver
uma rota, o CRM avisa que a função ainda não existe; estorno total de pagamento manual usa a rota antiga.

- **Uso e risco**: uso do app pela carteira em 7, 14, 30, 60 ou 90 dias, sempre contra o período anterior:
  clínicas que usaram, acessos, consultas, agendamentos, gráfico diário, ranking de telas e alertas de
  churn (sem acesso, nunca acessou, cancelamento agendado, inadimplência), queda de uso (contra o período
  anterior, a média histórica da clínica e a média dos demais parceiros assinantes) e upgrade (franquia
  perto do limite ou ultrapassada, adicionais comprados, licenças esgotadas, uso bem acima dos parceiros).
  O app registra cada acesso e troca de tela (`uso_eventos`) e calcula tudo em `GET uso` e
  `GET clinicas/:id/uso` (branch `claude/crm-uso` do MediCopilot).

- **Cupons**: planos atuais do MediCopilot (lidos do app) e cupons de desconto da contratação —
  porcentagem, valor fixo, dias de teste grátis ou recurso adicional grátis; por plano ou para
  qualquer plano; vitalício ou por N meses; com validade e limite de usos. O nome do cupom é o
  código que o cliente digita e não se repete. Os cupons ficam no banco do app (tabela `cupons`).

Agenda, Atividades, Jornadas, NPS, Indicadores e Configurações ainda são telas de placeholder.
