# Contrato da ponte · Financeiro (v2)

O CRM não fala com o Asaas. Quem fala é o **MediCopilot**, que já recebe os
webhooks do Asaas e guarda cobranças e assinaturas. O CRM lê e pede ações pela
ponte (`/api/public/crm/...`, com o `CRM_BRIDGE_TOKEN` e o cabeçalho
`X-CRM-Actor` com o e-mail de quem fez a ação).

Tudo aqui é **aditivo**: campos e rotas antigos continuam iguais. Enquanto o app
não tiver um campo, o CRM mostra "—"; enquanto não tiver uma rota, o CRM avisa
que a função ainda não existe no app.

## Status normalizados

O app devolve sempre em português (o CRM ainda entende os códigos do Asaas):

| status | quando | código Asaas |
|---|---|---|
| `pendente` | aguardando pagamento | `PENDING` |
| `vencido` | passou do vencimento | `OVERDUE` |
| `confirmado` | pago, aguardando compensação | `CONFIRMED` |
| `recebido` | pago e compensado | `RECEIVED`, `RECEIVED_IN_CASH` |
| `estorno_solicitado` | estorno pedido, ainda não concluído | `REFUND_REQUESTED`, `REFUND_IN_PROGRESS` |
| `estornado` | devolvido por inteiro | `REFUNDED` |
| `estorno_parcial` | parte devolvida | (`REFUNDED` com valor menor) |
| `cancelado` | cobrança apagada sem pagamento | `DELETED` |

## Leitura

### `GET clinicas/:id` — campos novos

```jsonc
{
  "assinatura": {
    "id": "uuid",                       // id no app
    "plano": "pro", "ciclo": "mensal", "status": "ativa | inadimplente | cancelada",
    "preco_mensal": 389,
    "inicio": "2026-06-05",
    "proxima_cobranca": "2026-11-15",
    "cancelamento_agendado_para": null,  // data, quando o cancelamento é no fim do ciclo
    "cancelada_em": null,                // quando foi cancelada de fato
    "cancelamento_motivo": null,
    "cancelado_por": null,               // e-mail (X-CRM-Actor) ou "cliente" / "asaas"
    "asaas_customer_id": "cus_000005219613",
    "asaas_subscription_id": "sub_VXJBYgP2u0eO",
    "asaas_sincronizado_em": "2026-11-11T18:00:00Z"
  },
  "pagamentos": [
    {
      "id": "uuid",
      "origem": "asaas | manual",
      "status": "recebido",              // tabela acima
      "valor": 389,                       // valor cobrado
      "valor_liquido": 380.71,            // depois da taxa do Asaas (null para manual)
      "valor_estornado": 0,
      "vencimento": "2026-10-15",
      "data": "2026-10-15",               // data do pagamento (null se não pago)
      "metodo": "pix | boleto | cartao | transferencia | outro",
      "referencia": "Mensalidade 10/2026",
      "observacao": null,
      "asaas_payment_id": "pay_080225913252",
      "fatura_url": "https://www.asaas.com/i/080225913252",  // invoiceUrl do Asaas
      "estornos": [
        { "id": "uuid", "valor": 389, "data": "2026-10-20", "motivo": "Cobrança em duplicidade",
          "status": "concluido | solicitado | falhou", "autor": "kaio@zubler.com" }
      ]
    }
  ]
}
```

### `GET pagamentos` — campos novos

Além de `pagamentos`, `inadimplentes` e `contratacoes_pendentes`:

```jsonc
{
  "pagamentos": [ /* mesmo formato acima, com clinica_id e clinica_nome */ ],
  "estornos": [ { "id": "uuid", "pagamento_id": "uuid", "clinica_id": "uuid", "clinica_nome": "…",
                  "valor": 389, "data": "2026-10-20", "motivo": "…", "status": "concluido", "autor": "…" } ],
  "cancelamentos": [ { "assinatura_id": "uuid", "clinica_id": "uuid", "clinica_nome": "…", "plano": "pro",
                       "preco_mensal": 389, "agendado_para": null, "cancelada_em": "2026-11-01",
                       "motivo": "…", "cancelado_por": "…" } ],   // últimos 90 dias + agendados
  "resumo": { "recebido_mes": 0, "a_receber_mes": 0, "vencido": 0, "estornado_mes": 0, "mrr": 0 }
}
```

Se `estornos`, `cancelamentos` ou `resumo` não vierem, o CRM calcula o que der
a partir de `pagamentos`.

## Ações

Todas respondem `200` com o objeto atualizado, ou `4xx` com `{ "error": "mensagem para a equipe" }`
(ex.: o erro que o Asaas devolveu). Registrar quem fez pelo `X-CRM-Actor`.

### `POST pagamentos/:id/estorno`

```json
{ "valor": 100.0, "motivo": "Cobrança em duplicidade" }
```
- `valor` ausente = estorno total. Não pode passar de `valor - valor_estornado`.
- Origem `asaas`: o app chama `POST /v3/payments/{asaas_payment_id}/refund` com
  `{ value, description: motivo }` e grava o estorno como `solicitado`; o webhook
  `PAYMENT_REFUNDED` muda para `concluido` e o pagamento para `estornado` / `estorno_parcial`.
- Origem `manual`: o app só grava o estorno como `concluido` (o dinheiro é devolvido fora do sistema).
- A rota antiga `POST pagamentos/:id/status` continua funcionando.

### `POST assinaturas/:id/cancelar`

```json
{ "quando": "fim_do_ciclo | agora", "motivo": "Preço", "observacao": "…", "cancelar_pendentes": true }
```
- `fim_do_ciclo`: grava `cancelamento_agendado_para = proxima_cobranca` e, no Asaas,
  `PUT /v3/subscriptions/{id}` com `endDate` nessa data. O acesso continua até lá.
- `agora`: `DELETE /v3/subscriptions/{id}` no Asaas, status `cancelada`, `cancelada_em = hoje`.
  Com `cancelar_pendentes`, apaga também as cobranças `pendente` / `vencido` (`DELETE /v3/payments/{id}`).

### `POST assinaturas/:id/reativar`

Desfaz um cancelamento **agendado** (limpa `cancelamento_agendado_para` e o `endDate` no Asaas).
Assinatura já cancelada não volta: precisa de nova contratação.

### `POST clinicas/:id/asaas/sincronizar`

O app busca no Asaas a assinatura e as cobranças do cliente e atualiza o banco
(útil quando um webhook se perdeu). Responde o mesmo que `GET clinicas/:id`.

## Pedido pronto para o Lovable do MediCopilot

> Implemente o contrato `docs/contrato-financeiro.md` do repositório Zubler-CRM nas rotas
> `/api/public/crm/...` (mesma autenticação por `CRM_BRIDGE_TOKEN` das rotas atuais, registrando
> `X-CRM-Actor` como autor). Guarde `asaas_customer_id` e `asaas_subscription_id` na assinatura,
> `asaas_payment_id`, `fatura_url` (invoiceUrl), `vencimento` (dueDate), `valor_liquido` (netValue)
> e `valor_estornado` em cada pagamento, crie a tabela de estornos e trate o webhook
> `PAYMENT_REFUNDED`. Adicione as rotas de estorno, cancelar/reativar assinatura e sincronizar com o
> Asaas, e os blocos `estornos`, `cancelamentos` e `resumo` em `GET pagamentos`. Tudo aditivo: não
> mude o formato dos campos que já existem.
