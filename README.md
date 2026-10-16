# Zubler CRM · Customer Success

MVP de um app de Customer Success para acompanhar a saúde da carteira de clientes: pipes em kanban por funil, health score, MRR, status personalizados, agrupamentos, cancelamento (lost) e abas de cliente.

## Rodando

```bash
npm install
npm run dev
```

## Estrutura

- `src/CustomerSuccessApp.jsx` — o app inteiro (componente React autocontido, estilos inline, dados de exemplo)
- `src/main.jsx` — ponto de entrada do Vite

## Funcionalidades

- **Sidebar**: Dashboard, Pipe, Agenda, Atividades, Jornadas, NPS, Indicadores, Configurações, alternância claro/escuro
- **Dashboard**: clientes ativos, MRR, health score médio, clientes em risco, carteira por responsável, cancelamentos
- **Pipe**: funis Onboarding (Kick-off → Check-out) e Ongoing (Ativação → Sucesso)
  - Bifurcação vertical/horizontal (┃/━), com rolagem independente por funil
  - Arrastar e soltar entre etapas, inclusive em etapas vazias e entre funis
  - Agrupar por Responsável (qualquer modo) ou Status/Plano (com um único funil), com grupos recolhíveis
  - Filtros: ordenação (Nome, Health, MRR, Novo, Início), status, responsáveis (multiselect; com 2+ responsáveis, um funil por vez)
  - Contador da etapa com tooltip do MRR e botão "+" para automações
- **Cliente**: abas no topbar, como num navegador (várias abertas ao mesmo tempo), tela cheia com Dados, Timeline, Neural Score, Atividades, Tickets, Financeiro
- **Lost**: motivo, data, multa, boletos pendentes, valor em aberto e observações; o cliente sai da pipe e aparece no Dashboard

Agenda, Atividades, Jornadas, NPS, Indicadores e Configurações ainda são telas de placeholder.
