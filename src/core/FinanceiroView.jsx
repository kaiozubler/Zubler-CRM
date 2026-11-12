// Financeiro do app: resumo do mês, cobranças (Asaas + manuais), estornos,
// cancelamentos, inadimplentes e contratações pagas sem assinatura.

import { useMemo, useState } from "react";
import { api } from "./api.js";
import { EstornoModal, STATUS, colunasCobrancas, colunasEstornos, estornosDe, normalizarCobranca } from "./financeiro.jsx";
import {
  Botao, Estado, METODOS_ASAAS, ModalForm, Pilula, STATUS_ASAAS, Secao, Tabela, corStatus, fmtData, fmtMoeda, useCarregar,
} from "./ui.jsx";

const METODOS = [
  { valor: "pix", label: "Pix" },
  { valor: "boleto", label: "Boleto" },
  { valor: "cartao", label: "Cartão" },
  { valor: "transferencia", label: "Transferência" },
  { valor: "outro", label: "Outro" },
];

const hoje = () => new Date().toISOString().slice(0, 10);

export function colunasPagamentos(T, { comClinica = false, onEstornar } = {}) {
  return [
    { chave: "data", titulo: "Data", render: (p) => fmtData(p.data) },
    ...(comClinica ? [{ chave: "clinica_nome", titulo: "Clínica" }] : []),
    { chave: "valor", titulo: "Valor", alinhar: "right", render: (p) => fmtMoeda(p.valor) },
    { chave: "metodo", titulo: "Método", render: (p) => METODOS.find((m) => m.valor === p.metodo)?.label ?? METODOS_ASAAS[p.metodo] ?? p.metodo ?? "—" },
    { chave: "origem", titulo: "Origem", render: (p) => <Pilula cor={p.origem === "manual" ? "azul" : "cinza"}>{p.origem === "manual" ? "Manual" : "Asaas"}</Pilula> },
    { chave: "status", titulo: "Status", render: (p) => {
      const status = STATUS_ASAAS[p.status] ?? p.status;
      return <Pilula cor={corStatus(status)}>{status ?? "—"}</Pilula>;
    } },
    { chave: "referencia", titulo: "Referência", render: (p) => <span title={p.observacao ?? ""}>{p.referencia ?? "—"}</span> },
    ...(onEstornar
      ? [{
          chave: "acoes",
          titulo: "",
          alinhar: "right",
          render: (p) =>
            p.origem === "manual" && p.status === "confirmado" ? (
              <Botao T={T} variante="perigo" onClick={() => onEstornar(p)}>Estornar</Botao>
            ) : null,
        }]
      : []),
  ];
}

export function NovoPagamentoModal({ T, clinicaId, clinicas, onSalvo, onFechar }) {
  return (
    <ModalForm
      T={T}
      titulo="Registrar pagamento manual"
      textoBotao="Registrar como confirmado"
      inicial={{ data: hoje(), metodo: "pix", clinica_id: clinicaId ?? "" }}
      campos={[
        ...(clinicaId ? [] : [{
          nome: "clinica_id",
          label: "Clínica",
          obrigatorio: true,
          opcoes: (clinicas ?? []).map((c) => ({ valor: c.id, label: c.nome ?? c.email ?? c.id })),
        }]),
        { nome: "valor", label: "Valor (R$)", tipo: "number", obrigatorio: true },
        { nome: "metodo", label: "Método", obrigatorio: true, opcoes: METODOS },
        { nome: "data", label: "Data do pagamento", tipo: "date", obrigatorio: true },
        { nome: "referencia", label: "Referência", placeholder: "Ex.: Mensalidade out/2026" },
        { nome: "observacao", label: "Observação" },
      ]}
      onEnviar={(v) =>
        api
          .novoPagamento({
            clinica_id: v.clinica_id,
            valor: Number(v.valor),
            metodo: v.metodo,
            data: v.data,
            referencia: v.referencia?.trim() || null,
            observacao: v.observacao?.trim() || null,
          })
          .then(onSalvo)
      }
      onFechar={onFechar}
    />
  );
}

const mesAtual = () => new Date().toISOString().slice(0, 7);
const noMes = (d) => d && String(d).slice(0, 7) === mesAtual();

function Kpi({ T, label, valor, detalhe, cor }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: cor ?? T.text }}>{valor}</div>
      {detalhe && <div style={{ fontSize: 10.5, color: T.textMuted }}>{detalhe}</div>}
    </div>
  );
}

const FILTROS_STATUS = [
  ["todos", "Todas"], ["aberto", "Em aberto"], ["vencido", "Vencidas"], ["pago", "Pagas"], ["estorno", "Estornadas"], ["cancelado", "Canceladas"],
];

export default function FinanceiroView({ T }) {
  const fin = useCarregar(() => api.pagamentos(), []);
  const [modal, setModal] = useState(null);
  const [clinicas, setClinicas] = useState(null);
  const [aba, setAba] = useState("cobrancas");
  const [filtro, setFiltro] = useState({ status: "todos", origem: "todas", busca: "" });
  const d = fin.dados;

  const cobrancas = useMemo(
    () => (d?.pagamentos ?? []).map(normalizarCobranca).sort((x, y) => String(y.vencimento ?? y.pagoEm ?? "").localeCompare(String(x.vencimento ?? x.pagoEm ?? ""))),
    [d],
  );
  const estornos = useMemo(() => {
    if (!d?.estornos) return estornosDe(cobrancas);
    const porId = Object.fromEntries(cobrancas.map((c) => [c.id, c]));
    return d.estornos.map((e) => ({ ...e, valor: Number(e.valor) || 0, pagamento: porId[e.pagamento_id] }));
  }, [d, cobrancas]);
  const cancelamentos = d?.cancelamentos ?? null;

  const resumo = useMemo(() => {
    if (d?.resumo) return d.resumo;
    const r = { recebido_mes: 0, a_receber_mes: 0, vencido: 0, estornado_mes: 0, mrr: null };
    for (const c of cobrancas) {
      if (c.pagoEm && noMes(c.pagoEm)) r.recebido_mes += c.valor;
      if (c.status === "pendente" && noMes(c.vencimento)) r.a_receber_mes += c.valor;
      if (c.status === "vencido") r.vencido += c.valor;
    }
    for (const e of estornos) if (noMes(e.data) && e.status !== "falhou") r.estornado_mes += e.valor;
    return r;
  }, [d, cobrancas, estornos]);

  const filtradas = cobrancas.filter((c) => {
    if (filtro.status === "vencido" ? c.status !== "vencido" : filtro.status === "aberto" ? c.status !== "pendente" : filtro.status !== "todos" && STATUS[c.status].grupo !== filtro.status) return false;
    if (filtro.origem !== "todas" && (c.origem ?? "asaas") !== filtro.origem) return false;
    const b = filtro.busca.trim().toLowerCase();
    return !b || [c.clinica_nome, c.referencia, c.asaas_payment_id].some((x) => x?.toLowerCase().includes(b));
  });

  const abrirNovo = async () => {
    setModal({ tipo: "novo" });
    if (!clinicas) api.clinicas().then((r) => setClinicas(r.clinicas)).catch(() => setClinicas([]));
  };

  const abas = d ? [
    ["cobrancas", `Cobranças (${cobrancas.length})`],
    ["estornos", `Estornos (${estornos.length})`],
    ["cancelamentos", `Cancelamentos${cancelamentos ? ` (${cancelamentos.length})` : ""}`],
    ["inadimplentes", `Inadimplentes (${d.inadimplentes.length})`],
    ["contratacoes", `Pagas sem assinatura (${d.contratacoes_pendentes.length})`],
  ] : [];
  const pill = (ativo) => ({
    padding: "5px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
    background: ativo ? T.accentBg : "transparent", color: ativo ? T.accentText : T.textMuted, whiteSpace: "nowrap",
  });
  const input = { padding: "6px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12, fontFamily: "inherit" };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      <Estado T={T} carregando={fin.carregando && !d} erro={fin.erro} onTentar={fin.recarregar} />
      {d && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Kpi T={T} label="Recebido no mês" valor={fmtMoeda(resumo.recebido_mes)} cor="#16A34A" />
            <Kpi T={T} label="A receber no mês" valor={fmtMoeda(resumo.a_receber_mes)} cor="#D97706" />
            <Kpi T={T} label="Vencido" valor={fmtMoeda(resumo.vencido)} detalhe={`${d.inadimplentes.length} clínica(s) inadimplente(s)`} cor={resumo.vencido ? "#DC2626" : null} />
            <Kpi T={T} label="Estornado no mês" valor={fmtMoeda(resumo.estornado_mes)} />
            {resumo.mrr != null && <Kpi T={T} label="MRR" valor={fmtMoeda(resumo.mrr)} cor={T.accentText} />}
          </div>

          <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, overflowX: "auto" }}>
            {abas.map(([id, l]) => <button key={id} onClick={() => setAba(id)} style={pill(aba === id)}>{l}</button>)}
          </div>

          {aba === "cobrancas" && (
            <Secao T={T} titulo={`${filtradas.length} cobrança(s)`} acao={<Botao T={T} variante="primario" onClick={abrirNovo}>Registrar pagamento manual</Botao>}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {FILTROS_STATUS.map(([id, l]) => <button key={id} onClick={() => setFiltro((f) => ({ ...f, status: id }))} style={pill(filtro.status === id)}>{l}</button>)}
                </div>
                <span style={{ flex: 1 }} />
                <select value={filtro.origem} onChange={(e) => setFiltro((f) => ({ ...f, origem: e.target.value }))} style={input}>
                  <option value="todas">Asaas e manual</option><option value="asaas">Só Asaas</option><option value="manual">Só manual</option>
                </select>
                <input placeholder="Buscar clínica, referência ou pay_…" value={filtro.busca} onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))} style={{ ...input, minWidth: 220 }} />
              </div>
              <Tabela T={T} linhas={filtradas} vazio="Nenhuma cobrança com esses filtros."
                colunas={colunasCobrancas(T, { comClinica: true, onEstornar: (c) => setModal({ tipo: "estornar", item: c }) })} />
            </Secao>
          )}

          {aba === "estornos" && (
            <Secao T={T} titulo={`Estornos · ${fmtMoeda(estornos.reduce((s, e) => s + (e.status === "falhou" ? 0 : e.valor), 0))}`}>
              <Tabela T={T} linhas={estornos} vazio="Nenhum estorno." colunas={colunasEstornos(T, { comClinica: true })} />
            </Secao>
          )}

          {aba === "cancelamentos" && (
            <Secao T={T} titulo="Cancelamentos (últimos 90 dias e agendados)">
              {cancelamentos ? (
                <Tabela T={T} linhas={cancelamentos.map((c) => ({ ...c, id: c.assinatura_id }))} vazio="Nenhum cancelamento."
                  colunas={[
                    { chave: "clinica_nome", titulo: "Clínica" },
                    { chave: "plano", titulo: "Plano", render: (c) => <span style={{ textTransform: "capitalize" }}>{c.plano}</span> },
                    { chave: "preco_mensal", titulo: "Mensalidade", alinhar: "right", render: (c) => fmtMoeda(c.preco_mensal) },
                    { chave: "quando", titulo: "Situação", render: (c) => c.cancelada_em
                      ? <Pilula cor="vermelho">Cancelada em {fmtData(c.cancelada_em)}</Pilula>
                      : <Pilula cor="amarelo">Agendado p/ {fmtData(c.agendado_para)}</Pilula> },
                    { chave: "motivo", titulo: "Motivo", render: (c) => c.motivo ?? "—" },
                    { chave: "cancelado_por", titulo: "Por", render: (c) => c.cancelado_por ?? "—" },
                  ]} />
              ) : (
                <div style={{ padding: 16, borderRadius: 10, border: `1px dashed ${T.border}`, fontSize: 12, color: T.textMuted }}>
                  O app ainda não envia a lista de cancelamentos. Veja docs/contrato-financeiro.md.
                </div>
              )}
            </Secao>
          )}

          {aba === "inadimplentes" && (
            <Tabela
              T={T}
              linhas={d.inadimplentes.map((i) => ({ ...i, id: i.clinica_id }))}
              vazio="Nenhuma clínica inadimplente."
              colunas={[
                { chave: "nome", titulo: "Clínica" },
                { chave: "plano", titulo: "Plano", render: (i) => <span style={{ textTransform: "capitalize" }}>{i.plano}</span> },
                { chave: "preco_mensal", titulo: "Mensalidade", alinhar: "right", render: (i) => fmtMoeda(i.preco_mensal) },
                { chave: "desde", titulo: "Desde", render: (i) => fmtData(i.desde) },
              ]}
            />
          )}

          {aba === "contratacoes" && (
            <Tabela
              T={T}
              linhas={d.contratacoes_pendentes}
              vazio="Nenhuma contratação aguardando ativação."
              colunas={[
                { chave: "nome_clinica", titulo: "Clínica" },
                { chave: "responsavel_email", titulo: "Responsável" },
                { chave: "plano", titulo: "Plano", render: (c) => <span style={{ textTransform: "capitalize" }}>{c.plano}</span> },
                { chave: "preco_mensal_calculado", titulo: "Mensalidade", alinhar: "right", render: (c) => fmtMoeda(c.preco_mensal_calculado) },
                { chave: "pagamento_confirmado_em", titulo: "Pago em", render: (c) => fmtData(c.pagamento_confirmado_em) },
                { chave: "acoes", titulo: "", alinhar: "right", render: (c) => <Botao T={T} variante="primario" onClick={() => setModal({ tipo: "ativar", item: c })}>Ativar</Botao> },
              ]}
            />
          )}
        </>
      )}

      {modal?.tipo === "novo" && (
        <NovoPagamentoModal T={T} clinicas={clinicas} onSalvo={fin.recarregar} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === "estornar" && <EstornoModal T={T} cobranca={modal.item} onFeito={fin.recarregar} onFechar={() => setModal(null)} />}
      {modal?.tipo === "ativar" && (
        <ModalForm
          T={T}
          titulo={`Ativar ${modal.item.nome_clinica ?? "contratação"}`}
          campos={[{ nome: "medico_email", label: "E-mail da conta do médico no app", tipo: "email", obrigatorio: true }]}
          inicial={{ medico_email: modal.item.responsavel_email ?? "" }}
          textoBotao="Criar assinatura"
          onEnviar={(v) => api.ativarContratacao(modal.item.id, v.medico_email.trim()).then(fin.recarregar)}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
