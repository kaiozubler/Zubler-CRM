// Modelo financeiro do CRM: normaliza cobranças, estornos e cancelamentos que
// chegam do app (status em português ou códigos do Asaas) e as ações de
// estornar / cancelar / reativar / sincronizar. Contrato: docs/contrato-financeiro.md

import { useState } from "react";
import { api } from "./api.js";
import { Botao, Modal, Pilula, fmtData, fmtMoeda } from "./ui.jsx";

// ── Status ───────────────────────────────────────────────────────────────────
const DO_ASAAS = {
  PENDING: "pendente", AWAITING_RISK_ANALYSIS: "pendente", OVERDUE: "vencido", CONFIRMED: "confirmado",
  RECEIVED: "recebido", RECEIVED_IN_CASH: "recebido", REFUND_REQUESTED: "estorno_solicitado",
  REFUND_IN_PROGRESS: "estorno_solicitado", REFUNDED: "estornado", DELETED: "cancelado",
  CHARGEBACK_REQUESTED: "estorno_solicitado", CHARGEBACK_DISPUTE: "estorno_solicitado",
};
export const STATUS = {
  pendente: { label: "Pendente", grupo: "aberto", cor: "amarelo", hex: "#D97706" },
  vencido: { label: "Vencido", grupo: "aberto", cor: "vermelho", hex: "#DC2626" },
  confirmado: { label: "Confirmado", grupo: "pago", cor: "verde", hex: "#16A34A" },
  recebido: { label: "Recebido", grupo: "pago", cor: "verde", hex: "#16A34A" },
  estorno_solicitado: { label: "Estorno solicitado", grupo: "estorno", cor: "amarelo", hex: "#D97706" },
  estorno_parcial: { label: "Estorno parcial", grupo: "pago", cor: "azul", hex: "#2563EB" },
  estornado: { label: "Estornado", grupo: "estorno", cor: "cinza", hex: "#6B7280" },
  cancelado: { label: "Cancelado", grupo: "cancelado", cor: "cinza", hex: "#9CA3AF" },
};
export function normalizarStatus(s) {
  if (!s) return "pendente";
  const v = DO_ASAAS[s] ?? String(s).toLowerCase().replace(/ /g, "_");
  if (v === "estorno_pedido") return "estorno_solicitado";
  if (v === "cancelada") return "cancelado";
  return STATUS[v] ? v : "pendente";
}

const METODOS = {
  pix: "Pix", PIX: "Pix", boleto: "Boleto", BOLETO: "Boleto", cartao: "Cartão", CREDIT_CARD: "Cartão",
  DEBIT_CARD: "Débito", transferencia: "Transferência", TRANSFER: "Transferência", outro: "Outro", UNDEFINED: "—",
};
export const metodoLabel = (m) => METODOS[m] ?? m ?? "—";

// ── Cobranças ────────────────────────────────────────────────────────────────
export function normalizarCobranca(p) {
  const status = normalizarStatus(p.status);
  const valor = Number(p.valor) || 0;
  const estornos = (p.estornos ?? []).map((e) => ({ ...e, valor: Number(e.valor) || 0 }));
  const estornadoInformado = p.valor_estornado != null ? Number(p.valor_estornado) : null;
  const estornado = estornadoInformado ?? (status === "estornado" ? valor : estornos.filter((e) => e.status !== "falhou").reduce((s, e) => s + e.valor, 0));
  const pago = STATUS[status].grupo === "pago" || status === "estornado" || status === "estorno_solicitado";
  return {
    ...p,
    status,
    valor,
    liquido: p.valor_liquido != null ? Number(p.valor_liquido) : null,
    estornado,
    estornavel: pago && status !== "estornado" && status !== "estorno_solicitado" ? Math.max(0, valor - estornado) : 0,
    pagoEm: pago ? p.data ?? null : null,
    vencimento: p.vencimento ?? (pago ? null : p.data) ?? null,
    estornos,
  };
}

/** Totais de uma lista de cobranças já normalizadas. */
export function totais(cobrancas) {
  const t = { recebido: 0, liquido: 0, aberto: 0, vencido: 0, estornado: 0, qtdAberto: 0, qtdVencido: 0 };
  for (const c of cobrancas) {
    const g = STATUS[c.status].grupo;
    if (g === "pago" || c.status === "estornado" || c.status === "estorno_solicitado") {
      t.recebido += c.valor;
      t.liquido += (c.liquido ?? c.valor) - c.estornado;
    }
    t.estornado += c.estornado;
    if (c.status === "pendente") { t.aberto += c.valor; t.qtdAberto += 1; }
    if (c.status === "vencido") { t.vencido += c.valor; t.qtdVencido += 1; }
  }
  return t;
}

/** Estornos de uma lista de cobranças, achatados e com a cobrança de origem. */
export function estornosDe(cobrancas) {
  const lista = [];
  for (const c of cobrancas) {
    if (c.estornos.length) c.estornos.forEach((e) => lista.push({ ...e, pagamento: c, clinica_nome: c.clinica_nome }));
    else if (c.estornado > 0) lista.push({ id: `${c.id}-est`, valor: c.estornado, data: c.estornado_em ?? null, motivo: c.observacao, status: c.status === "estorno_solicitado" ? "solicitado" : "concluido", pagamento: c, clinica_nome: c.clinica_nome });
  }
  return lista.sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
}

export const ESTORNO_STATUS = {
  concluido: ["verde", "Concluído"], solicitado: ["amarelo", "Solicitado"], falhou: ["vermelho", "Falhou"],
};

// ── Peças de interface ───────────────────────────────────────────────────────
export function PilulaStatus({ status }) {
  const s = STATUS[normalizarStatus(status)];
  return <Pilula cor={s.cor}>{s.label}</Pilula>;
}

/** Id do Asaas com botão de copiar. */
export function IdAsaas({ T, rotulo, valor }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{rotulo}</span>
      {valor ? (
        <button type="button" title="Copiar" onClick={() => { navigator.clipboard?.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1200); }}
          style={{ all: "unset", cursor: "pointer", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {copiado ? "copiado ✓" : valor}
        </button>
      ) : (
        <span style={{ fontSize: 11.5, color: T.textMuted }}>não vinculado</span>
      )}
    </div>
  );
}

const campo = (T) => ({ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" });
const label = (T) => ({ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: T.textSub });

function useEnvio(onFechar) {
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (fn) => {
    setEnviando(true); setErro(null);
    try { await fn(); onFechar(); }
    catch (e) { setErro(e.message); setEnviando(false); }
  };
  return { erro, enviando, enviar };
}

const MOTIVOS_ESTORNO = ["Cobrança em duplicidade", "Cancelamento dentro da garantia", "Valor cobrado errado", "Acordo comercial", "Outro"];

export function EstornoModal({ T, cobranca, onFeito, onFechar }) {
  const [total, setTotal] = useState(true);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS_ESTORNO[0]);
  const [detalhe, setDetalhe] = useState("");
  const { erro, enviando, enviar } = useEnvio(onFechar);
  const max = cobranca.estornavel;
  const v = total ? max : Number(valor);
  const valido = v > 0 && v <= max + 0.001 && (motivo !== "Outro" || detalhe.trim());

  return (
    <Modal T={T} titulo={`Estornar cobrança de ${fmtMoeda(cobranca.valor)}`} onFechar={onFechar}>
      <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>
        {cobranca.clinica_nome ? `${cobranca.clinica_nome} · ` : ""}{cobranca.referencia ?? "Cobrança"} · paga em {fmtData(cobranca.pagoEm)} via {metodoLabel(cobranca.metodo)}
        {cobranca.estornado > 0 && ` · já estornado ${fmtMoeda(cobranca.estornado)}`}
      </div>
      <div style={{ fontSize: 11.5, padding: "8px 10px", borderRadius: 8, background: cobranca.origem === "asaas" ? "#FFFBEB" : "#EEF1FD", color: cobranca.origem === "asaas" ? "#92400E" : "#3B55D4" }}>
        {cobranca.origem === "asaas"
          ? "O estorno será pedido ao Asaas e o dinheiro volta para o cliente. Não dá para desfazer."
          : "Pagamento manual: o CRM só registra o estorno. A devolução do dinheiro é feita por fora."}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[[true, `Total (${fmtMoeda(max)})`], [false, "Parcial"]].map(([t, l]) => (
          <button key={String(t)} type="button" onClick={() => setTotal(t)} style={{
            flex: 1, padding: "7px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${total === t ? "#4F6BED" : T.border}`, background: total === t ? T.accentBg : T.card, color: total === t ? T.accentText : T.textSub,
          }}>{l}</button>
        ))}
      </div>
      {!total && (
        <label style={label(T)}>Valor a estornar (máx. {fmtMoeda(max)})
          <input type="number" step="0.01" min="0.01" max={max} value={valor} onChange={(e) => setValor(e.target.value)} style={campo(T)} autoFocus />
        </label>
      )}
      <label style={label(T)}>Motivo
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={campo(T)}>
          {MOTIVOS_ESTORNO.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label style={label(T)}>Detalhes {motivo === "Outro" ? "(obrigatório)" : "(opcional)"}
        <textarea rows={2} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} style={{ ...campo(T), resize: "vertical" }} />
      </label>
      {erro && <div style={{ fontSize: 12, color: "#DC2626" }}>{erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Botao T={T} onClick={onFechar}>Cancelar</Botao>
        <Botao T={T} variante="perigo" disabled={!valido || enviando}
          onClick={() => enviar(async () => {
            const texto = [motivo, detalhe.trim()].filter(Boolean).join(" · ");
            try {
              await api.estornarPagamento(cobranca.id, { valor: total ? undefined : Number(v.toFixed(2)), motivo: texto });
            } catch (e) {
              // App ainda sem a rota nova: estorno total de pagamento manual usa a rota antiga.
              if (!(e.semRota && total && cobranca.origem === "manual")) throw e;
              await api.statusPagamento(cobranca.id, "estornado", texto);
            }
            onFeito?.();
          })}>
          {enviando ? "Estornando…" : `Estornar ${fmtMoeda(v || 0)}`}
        </Botao>
      </div>
    </Modal>
  );
}

export const MOTIVOS_CANCELAMENTO = ["Preço", "Não usa / baixo engajamento", "Foi para concorrente", "Fechou a clínica", "Problema técnico", "Insatisfação com suporte", "Inadimplência", "Outro"];

/** Campos do cancelamento, usados no modal e dentro do Lost. */
export function CamposCancelamento({ T, valor, onChange, proximaCobranca, comMotivo = true }) {
  const set = (k) => (v) => onChange({ ...valor, [k]: v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[["fim_do_ciclo", "No fim do ciclo", proximaCobranca ? `acesso até ${fmtData(proximaCobranca)}` : "acesso até a próxima cobrança"], ["agora", "Agora", "corta o acesso hoje"]].map(([id, l, sub]) => (
          <button key={id} type="button" onClick={() => set("quando")(id)} style={{
            flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            border: `1px solid ${valor.quando === id ? "#4F6BED" : T.border}`, background: valor.quando === id ? T.accentBg : T.card,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: valor.quando === id ? T.accentText : T.text }}>{l}</div>
            <div style={{ fontSize: 10.5, color: T.textMuted }}>{sub}</div>
          </button>
        ))}
      </div>
      {comMotivo && (
        <label style={label(T)}>Motivo
          <select value={valor.motivo} onChange={(e) => set("motivo")(e.target.value)} style={campo(T)}>
            {MOTIVOS_CANCELAMENTO.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      )}
      {comMotivo && (
        <label style={label(T)}>Observação
          <textarea rows={2} value={valor.observacao} onChange={(e) => set("observacao")(e.target.value)} style={{ ...campo(T), resize: "vertical" }} />
        </label>
      )}
      {valor.quando === "agora" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.textSub, cursor: "pointer" }}>
          <input type="checkbox" checked={valor.cancelar_pendentes} onChange={(e) => set("cancelar_pendentes")(e.target.checked)} />
          Apagar também as cobranças em aberto no Asaas
        </label>
      )}
    </div>
  );
}
export const cancelamentoInicial = () => ({ quando: "fim_do_ciclo", motivo: MOTIVOS_CANCELAMENTO[0], observacao: "", cancelar_pendentes: true });

export function CancelarAssinaturaModal({ T, nome, assinatura, onFeito, onFechar }) {
  const [valor, setValor] = useState(cancelamentoInicial);
  const { erro, enviando, enviar } = useEnvio(onFechar);
  return (
    <Modal T={T} titulo={`Cancelar assinatura de ${nome}`} onFechar={onFechar} largura={480}>
      <div style={{ fontSize: 12, color: T.textSub }}>
        Plano {assinatura.plano} · {fmtMoeda(assinatura.preco_mensal)}/mês. O cancelamento vai para o app e para o Asaas.
      </div>
      <CamposCancelamento T={T} valor={valor} onChange={setValor} proximaCobranca={assinatura.proxima_cobranca} />
      {erro && <div style={{ fontSize: 12, color: "#DC2626" }}>{erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Botao T={T} onClick={onFechar}>Voltar</Botao>
        <Botao T={T} variante="perigo" disabled={enviando}
          onClick={() => enviar(async () => { await api.cancelarAssinatura(assinatura.id, valor); onFeito?.(); })}>
          {enviando ? "Cancelando…" : valor.quando === "agora" ? "Cancelar agora" : "Agendar cancelamento"}
        </Botao>
      </div>
    </Modal>
  );
}

// ── Colunas de tabela ────────────────────────────────────────────────────────
export function colunasCobrancas(T, { onEstornar, comClinica = false } = {}) {
  const sub = (txt) => <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{txt}</div>;
  return [
    { chave: "vencimento", titulo: "Vencimento", render: (c) => fmtData(c.vencimento ?? c.pagoEm) },
    ...(comClinica ? [{ chave: "clinica_nome", titulo: "Clínica" }] : []),
    { chave: "referencia", titulo: "Referência", render: (c) => <span title={c.observacao ?? ""}>{c.referencia ?? "—"}</span> },
    { chave: "valor", titulo: "Valor", alinhar: "right", render: (c) => (
      <div>{fmtMoeda(c.valor)}{c.liquido != null && sub(`líquido ${fmtMoeda(c.liquido)}`)}</div>
    ) },
    { chave: "status", titulo: "Status", render: (c) => (
      <div><PilulaStatus status={c.status} />{c.estornado > 0 && c.status !== "estornado" && sub(`${fmtMoeda(c.estornado)} estornado`)}</div>
    ) },
    { chave: "pagoEm", titulo: "Pago em", render: (c) => c.pagoEm ? <div>{fmtData(c.pagoEm)}{sub(metodoLabel(c.metodo))}</div> : "—" },
    { chave: "origem", titulo: "Origem", render: (c) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
        <Pilula cor={c.origem === "manual" ? "azul" : "cinza"}>{c.origem === "manual" ? "Manual" : "Asaas"}</Pilula>
        {c.asaas_payment_id && <span style={{ fontSize: 9.5, color: T.textMuted, fontFamily: "ui-monospace, Menlo, monospace" }}>{c.asaas_payment_id}</span>}
      </div>
    ) },
    { chave: "acoes", titulo: "", alinhar: "right", render: (c) => (
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        {c.fatura_url && <a href={c.fatura_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: T.accentText, textDecoration: "none", padding: "6px 4px" }}>Fatura ↗</a>}
        {onEstornar && c.estornavel > 0 && <Botao T={T} variante="perigo" onClick={() => onEstornar(c)} style={{ padding: "4px 9px", fontSize: 11 }}>Estornar</Botao>}
      </div>
    ) },
  ];
}

export function colunasEstornos(T, { comClinica = false } = {}) {
  return [
    { chave: "data", titulo: "Data", render: (e) => fmtData(e.data) },
    ...(comClinica ? [{ chave: "clinica_nome", titulo: "Clínica", render: (e) => e.clinica_nome ?? e.pagamento?.clinica_nome ?? "—" }] : []),
    { chave: "valor", titulo: "Valor", alinhar: "right", render: (e) => fmtMoeda(e.valor) },
    { chave: "cobranca", titulo: "Cobrança", render: (e) => e.pagamento ? `${e.pagamento.referencia ?? fmtData(e.pagamento.vencimento ?? e.pagamento.pagoEm)} · ${fmtMoeda(e.pagamento.valor)}` : "—" },
    { chave: "motivo", titulo: "Motivo", render: (e) => e.motivo ?? "—" },
    { chave: "status", titulo: "Status", render: (e) => { const [cor, l] = ESTORNO_STATUS[e.status] ?? ["cinza", e.status ?? "—"]; return <Pilula cor={cor}>{l}</Pilula>; } },
    { chave: "autor", titulo: "Por", render: (e) => e.autor ?? "—" },
  ];
}
