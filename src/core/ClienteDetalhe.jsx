// Abas Dados, Financeiro e Timeline da tela do cliente.
// Dados do app chegam pela ponte (client.raw e api.clinica); o cadastro manual
// do lead e os registros da timeline ficam no banco do CRM (crmDados.js).

import { useMemo, useState } from "react";
import { api } from "./api.js";
import { apagarEvento, listarTimeline, novoEvento, salvarLead } from "./crmDados.js";
import { colunasPagamentos, NovoPagamentoModal } from "./FinanceiroView.jsx";
import {
  Botao, Estado, METODOS_ASAAS, Modal, ModalForm, Pilula, STATUS_ASAAS, Secao, Tabela, fmtData, fmtMoeda, useCarregar,
} from "./ui.jsx";

const PLANOS = { free: "Free", basic: "Basic", pro: "Pro", enterprise: "Enterprise" };
const ASSINATURA = {
  ativa: { label: "Ativa", cor: "verde" },
  inadimplente: { label: "Inadimplente", cor: "vermelho" },
  cancelada: { label: "Cancelada", cor: "cinza" },
};
const CONTRATACAO_LABEL = { em_andamento: "Em andamento", aguardando_confirmacao: "Aguardando confirmação do pagamento", confirmada: "Confirmada" };
const COR_PILULA = { red: "vermelho", green: "verde", amber: "amarelo", blue: "azul" };

const rotulo = (T) => ({ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" });
const cartao = (T) => ({ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10 });
const capitalizar = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const vazio = (v) => v == null || String(v).trim() === "";

function diasAte(v) {
  if (!v) return null;
  const alvo = new Date(String(v).length === 10 ? `${v}T12:00:00` : v);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.round((alvo - hoje) / 86400000);
}
function relativo(dias) {
  if (dias == null) return null;
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

// Status de pagamento do app (pt) ou do Asaas (en) → um dos quatro grupos.
function grupoPagamento(status) {
  const s = STATUS_ASAAS[status] ?? status;
  if (s === "recebido" || s === "confirmado") return "pago";
  if (s === "vencido") return "vencido";
  if (s === "estornado" || s === "estorno pedido") return "estornado";
  return "pendente";
}
const GRUPOS = {
  pago: { label: "Pago", cor: "#16A34A" },
  pendente: { label: "Pendente", cor: "#D97706" },
  vencido: { label: "Vencido", cor: "#DC2626" },
  estornado: { label: "Estornado", cor: "#9CA3AF" },
};

function Aviso({ cor, children }) {
  const cores = { vermelho: ["#FEF2F2", "#FCA5A5", "#991B1B"], amarelo: ["#FFFBEB", "#FCD34D", "#92400E"] }[cor];
  return (
    <div style={{ background: cores[0], border: `1px solid ${cores[1]}`, color: cores[2], borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function Kpi({ T, label, valor, detalhe, cor }) {
  return (
    <div style={{ ...cartao(T), padding: "11px 12px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={rotulo(T)}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: cor ?? T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</div>
      {detalhe && <div style={{ fontSize: 10.5, color: T.textMuted }}>{detalhe}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCEIRO: plano, jornada da contratação e pagamentos
// ─────────────────────────────────────────────────────────────────────────────

const PASSOS_CONTRATACAO = ["Cadastro", "Contratando", "Aguardando pgto", "Pago", "Assinatura ativa"];
function passoAtual(c) {
  if (c.assinatura_status === "ativa" || c.assinatura_status === "inadimplente") return 4;
  if (c.contratacao?.pago_em) return 3;
  if (c.contratacao?.status === "aguardando_confirmacao") return 2;
  if (c.contratacao) return 1;
  return 0;
}

function JornadaContratacao({ T, c }) {
  const atual = passoAtual(c);
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {PASSOS_CONTRATACAO.map((p, i) => {
        const feito = i < atual, agora = i === atual;
        const cor = feito || agora ? "#4F6BED" : T.border;
        return (
          <div key={p} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", minWidth: 0 }}>
            {i > 0 && <div style={{ position: "absolute", top: 10, right: "50%", width: "100%", height: 2, background: i <= atual ? "#4F6BED" : T.border }} />}
            <div style={{
              width: 22, height: 22, borderRadius: "50%", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, background: feito ? "#4F6BED" : T.surface, color: feito ? "#fff" : cor,
              border: `2px solid ${cor}`, boxShadow: agora ? "0 0 0 4px rgba(79,107,237,0.18)" : "none",
            }}>{feito ? "✓" : i + 1}</div>
            <div style={{ fontSize: 10.5, fontWeight: agora ? 800 : 600, color: agora ? T.text : feito ? T.textSub : T.textMuted, textAlign: "center" }}>{p}</div>
          </div>
        );
      })}
    </div>
  );
}

function UltimosMeses({ T, pagamentos }) {
  const meses = useMemo(() => {
    const porMes = {};
    const ordem = ["estornado", "pago", "pendente", "vencido"]; // o pior status do mês vence
    for (const p of pagamentos) {
      if (!p.data) continue;
      const k = String(p.data).slice(0, 7);
      const g = grupoPagamento(p.status);
      const m = (porMes[k] ??= { grupo: g, total: 0, qtd: 0 });
      m.qtd += 1;
      if (g === "pago") m.total += Number(p.valor) || 0;
      if (ordem.indexOf(g) > ordem.indexOf(m.grupo)) m.grupo = g;
    }
    const hoje = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { k, nome: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), ano: d.getFullYear(), ...porMes[k] };
    });
  }, [pagamentos]);

  return (
    <div style={{ ...cartao(T), padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={rotulo(T)}>Últimos 12 meses</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(GRUPOS).map(([k, g]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textMuted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: g.cor }} />{g.label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 4 }}>
        {meses.map((m) => {
          const g = m.grupo && GRUPOS[m.grupo];
          return (
            <div key={m.k} title={g ? `${m.nome}/${m.ano}: ${g.label}${m.total ? ` · ${fmtMoeda(m.total)}` : ""} (${m.qtd} cobrança(s))` : `${m.nome}/${m.ano}: sem cobrança`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", height: 22, borderRadius: 5, background: g ? g.cor : "transparent", border: g ? "none" : `1px dashed ${T.border}`, opacity: g ? 0.9 : 1 }} />
              <span style={{ fontSize: 9.5, color: T.textMuted }}>{m.nome}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlanoPagamentos({ client, T, det, lead, onRecarregar }) {
  const c = client.raw;
  const a = det?.dados?.assinatura;
  const pagamentos = det?.dados?.pagamentos ?? [];
  const [modal, setModal] = useState(null);
  const atualizar = () => { det?.recarregar(); onRecarregar(); };

  const ehLead = client.fase === "lead";
  const status = ASSINATURA[a?.status ?? c.assinatura_status];
  const plano = PLANOS[a?.plano] ?? client.plan;
  const potencialManual = Number(lead?.dados?.valor_potencial) || null;
  const mensalidade = client.mrr > 0 ? client.mrr : (client.mrrPotencial ?? potencialManual);
  const diasCobranca = diasAte(c.proxima_cobranca);
  const vencidas = c.pagamentos?.vencidas ?? pagamentos.filter((p) => grupoPagamento(p.status) === "vencido").length;
  const pendentes = pagamentos.filter((p) => grupoPagamento(p.status) === "pendente");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Plano */}
      <div style={{ ...cartao(T), padding: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
        <div style={{ minWidth: 180, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 20, borderRight: `1px solid ${T.border}` }}>
          <div style={rotulo(T)}>Plano</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.text, lineHeight: 1 }}>{plano}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {status ? <Pilula cor={status.cor}>Assinatura {status.label.toLowerCase()}</Pilula> : <Pilula cor="azul">{ehLead ? "Lead · sem assinatura" : "Sem assinatura"}</Pilula>}
            {client.pagamento && <Pilula cor={COR_PILULA[client.pagamento.cor]}>{client.pagamento.label}</Pilula>}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.accentText, marginTop: 4 }}>
            {mensalidade != null ? fmtMoeda(mensalidade) : "—"}
            <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted }}>
              {" "}/{c.ciclo === "anual" ? "mês (anual)" : "mês"}{client.mrr > 0 ? "" : mensalidade != null ? " · potencial" : ""}
            </span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 240, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 14, alignContent: "center" }}>
          {[
            ["Ciclo", capitalizar(c.ciclo) ?? "—"],
            ["Próxima cobrança", c.proxima_cobranca ? fmtData(c.proxima_cobranca) : "—", relativo(diasCobranca), diasCobranca != null && diasCobranca < 0 ? "#DC2626" : null],
            ["Cliente desde", fmtData(c.cliente_desde), c.cliente_desde ? relativo(diasAte(c.cliente_desde)) : null],
            ["Equipe", a ? `${a.medicos} médico(s)` : `${c.membros ?? 0} login(s)`, a ? `${a.secretarias} secretária(s)` : null],
          ].map(([l, v, sub, cor]) => (
            <div key={l}>
              <div style={{ ...rotulo(T), marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cor ?? T.text }}>{v}</div>
              {sub && <div style={{ fontSize: 10.5, color: cor ?? T.textMuted }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {(c.assinatura_status === "inadimplente" || vencidas > 0) && (
        <Aviso cor="vermelho">
          {c.assinatura_status === "inadimplente" ? "Assinatura inadimplente" : "Pagamento em atraso"}
          {vencidas > 0 && ` · ${vencidas} cobrança(s) vencida(s)`}.
        </Aviso>
      )}
      {c.cancelamento_agendado_para && (
        <Aviso cor="amarelo">Cancelamento agendado para {fmtData(c.cancelamento_agendado_para)} ({relativo(diasAte(c.cancelamento_agendado_para))}).</Aviso>
      )}

      {/* Jornada da contratação (leads) */}
      {(ehLead || c.contratacao) && (
        <Secao T={T} titulo="Contratação"
          acao={c.contratacao?.pago_em && c.assinatura_status !== "ativa" && <Botao T={T} variante="primario" onClick={() => setModal("ativar")}>Ativar assinatura</Botao>}>
          <div style={{ ...cartao(T), padding: "16px 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
            <JornadaContratacao T={T} c={c} />
            {c.contratacao && (
              <div style={{ fontSize: 11.5, color: T.textSub, textAlign: "center" }}>
                {CONTRATACAO_LABEL[c.contratacao.status] ?? c.contratacao.status}
                {c.contratacao.pago_em && ` · pago em ${fmtData(c.contratacao.pago_em)}`}
                {client.mrrPotencial != null && ` · ${fmtMoeda(client.mrrPotencial)}/mês`}
              </div>
            )}
          </div>
        </Secao>
      )}

      {/* Pagamentos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Kpi T={T} label="Total pago" valor={fmtMoeda(c.pagamentos?.total_pago ?? 0)} />
        <Kpi T={T} label="Último pagamento" valor={c.pagamentos?.ultimo_data ? fmtMoeda(c.pagamentos.ultimo_valor) : "—"}
          detalhe={c.pagamentos?.ultimo_data ? `${fmtData(c.pagamentos.ultimo_data)} · ${relativo(diasAte(c.pagamentos.ultimo_data))}` : null} />
        <Kpi T={T} label="Pendentes" valor={pendentes.length} detalhe={pendentes.length ? fmtMoeda(pendentes.reduce((s, p) => s + (Number(p.valor) || 0), 0)) : null}
          cor={pendentes.length ? "#D97706" : null} />
        <Kpi T={T} label="Vencidas" valor={vencidas} cor={vencidas ? "#DC2626" : "#16A34A"} />
      </div>

      {client.tipo === "clinica" && (
        <>
          <Estado T={T} carregando={det.carregando && !det.dados} erro={det.erro} onTentar={det.recarregar} />
          {det.dados && (
            <>
              <UltimosMeses T={T} pagamentos={pagamentos} />
              <Secao T={T} titulo={`Histórico de pagamentos (${pagamentos.length})`}
                acao={<Botao T={T} variante="primario" onClick={() => setModal("novo")}>Registrar pagamento</Botao>}>
                <Tabela T={T} linhas={[...pagamentos].sort((x, y) => String(y.data).localeCompare(String(x.data)))} vazio="Nenhum pagamento registrado." colunas={colunasPagamentos(T)} />
              </Secao>
            </>
          )}
        </>
      )}

      {modal === "novo" && <NovoPagamentoModal T={T} clinicaId={client.ref} onSalvo={atualizar} onFechar={() => setModal(null)} />}
      {modal === "ativar" && (
        <ModalForm T={T} titulo={`Ativar ${client.name}`}
          campos={[{ nome: "medico_email", label: "E-mail da conta do médico no app", tipo: "email", obrigatorio: true }]}
          inicial={{ medico_email: c.contratacao.responsavel_email ?? c.email ?? "" }}
          textoBotao="Criar assinatura"
          onEnviar={(v) => api.ativarContratacao(c.contratacao.id, v.medico_email.trim()).then(onRecarregar)}
          onFechar={() => setModal(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS: cadastro (app + manual) e qualificação do lead
// ─────────────────────────────────────────────────────────────────────────────

// `app` lê o valor que vem do app; se existir, o campo fica travado no formulário.
const CAMPOS_CADASTRO = [
  { nome: "nome", label: "Nome / razão social", app: (c) => c.razao_social || c.nome },
  { nome: "documento", label: "CNPJ / CPF", app: (c) => c.documento },
  { nome: "email", label: "E-mail", tipo: "email", app: (c) => c.email },
  { nome: "telefone", label: "Telefone / WhatsApp", tipo: "tel", app: (c) => c.telefone },
  { nome: "cidade", label: "Cidade", app: (c) => c.cidade },
  { nome: "uf", label: "UF", app: (c) => c.uf, max: 2 },
  { nome: "responsavel_nome", label: "Responsável na clínica", app: (c) => c.responsavel_nome },
  { nome: "especialidade", label: "Especialidade", app: (c) => c.especialidade },
  { nome: "como_conheceu", label: "Como conheceu", app: (c) => c.como_conheceu },
];
const ORIGENS = ["Indicação", "Instagram", "Google", "Site", "Evento", "Prospecção ativa", "Parceiro", "Outro"];
const CONTATOS = ["WhatsApp", "Ligação", "E-mail", "Presencial"];
const CAMPOS_QUALIFICACAO = [
  { nome: "origem", label: "Origem do lead", opcoes: ORIGENS },
  { nome: "plano_interesse", label: "Plano de interesse", opcoes: Object.values(PLANOS) },
  { nome: "valor_potencial", label: "Mensalidade potencial (R$)", tipo: "number" },
  { nome: "medicos", label: "Nº de médicos", tipo: "number" },
  { nome: "contato_preferido", label: "Melhor forma de contato", opcoes: CONTATOS },
  { nome: "decisor", label: "Quem decide a compra" },
  { nome: "proximo_passo", label: "Próximo passo", largo: true },
  { nome: "proximo_passo_data", label: "Data do próximo passo", tipo: "date" },
  { nome: "observacoes", label: "Observações", texto: true },
];
const TODOS_CAMPOS = [...CAMPOS_CADASTRO, ...CAMPOS_QUALIFICACAO];

function Valor({ T, label, children, origem, full }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <div style={{ ...rotulo(T), marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        {label}
        {origem === "manual" && <span title="Preenchido à mão no CRM" style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 4, background: T.accentBg, color: T.accentText, letterSpacing: 0 }}>manual</span>}
      </div>
      <div style={{ ...cartao(T), borderRadius: 8, padding: "9px 10px", fontSize: 11.5, fontWeight: 600, color: vazio(children) ? T.textMuted : T.text, minHeight: 18, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
        {vazio(children) ? "—" : children}
      </div>
    </div>
  );
}

function formatarCampo(campo, v) {
  if (vazio(v)) return null;
  if (campo.nome === "valor_potencial") return `${fmtMoeda(v)}/mês`;
  if (campo.tipo === "date") return fmtData(v);
  return v;
}

function CampoForm({ T, campo, valor, travado, onChange }) {
  const estilo = {
    width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: travado ? T.bg : T.card, cursor: travado ? "not-allowed" : undefined,
    color: travado ? T.textMuted : T.text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box",
  };
  let input;
  if (campo.opcoes) {
    input = (
      <select value={valor ?? ""} disabled={travado} onChange={(e) => onChange(e.target.value)} style={estilo}>
        <option value="">—</option>
        {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (campo.texto) {
    input = <textarea rows={3} value={valor ?? ""} disabled={travado} onChange={(e) => onChange(e.target.value)} style={{ ...estilo, resize: "vertical" }} />;
  } else {
    input = (
      <input type={campo.tipo ?? "text"} step={campo.tipo === "number" ? "any" : undefined} maxLength={campo.max}
        value={valor ?? ""} disabled={travado} onChange={(e) => onChange(campo.max ? e.target.value.toUpperCase() : e.target.value)} style={estilo} />
    );
  }
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: T.textSub, gridColumn: campo.texto || campo.largo ? "1 / -1" : undefined }}>
      <span>{campo.label}{travado && <span style={{ fontWeight: 500, color: T.textMuted }}> · vem do app</span>}</span>
      {input}
    </label>
  );
}

function EditarLeadModal({ T, client, lead, onSalvo, onFechar }) {
  const c = client.raw;
  const salvo = lead?.dados ?? {};
  const [valores, setValores] = useState(salvo);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (nome) => (v) => setValores((x) => ({ ...x, [nome]: v }));

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true); setErro(null);
    const dados = {};
    for (const campo of TODOS_CAMPOS) {
      const v = valores[campo.nome];
      if (!vazio(v) && !(campo.app && !vazio(campo.app(c)))) dados[campo.nome] = String(v).trim();
    }
    const alterados = TODOS_CAMPOS.filter((k) => (dados[k.nome] ?? "") !== (salvo[k.nome] ?? "")).map((k) => k.label);
    try {
      await salvarLead(client.id, dados, alterados);
      onSalvo();
      onFechar();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  };

  const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 };
  return (
    <Modal T={T} titulo={`Dados de ${client.name}`} onFechar={onFechar} largura={620}>
      <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
        <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.5 }}>
          O que vem do app não pode ser mudado aqui. Os campos livres ficam salvos só no CRM.
        </div>
        <div style={rotulo(T)}>Cadastro</div>
        <div style={grade}>
          {CAMPOS_CADASTRO.map((campo) => {
            const doApp = campo.app(c);
            return <CampoForm key={campo.nome} T={T} campo={campo} travado={!vazio(doApp)} valor={vazio(doApp) ? valores[campo.nome] : doApp} onChange={set(campo.nome)} />;
          })}
        </div>
        <div style={rotulo(T)}>Qualificação</div>
        <div style={grade}>
          {CAMPOS_QUALIFICACAO.map((campo) => <CampoForm key={campo.nome} T={T} campo={campo} valor={valores[campo.nome]} onChange={set(campo.nome)} />)}
        </div>
        {erro && <div style={{ fontSize: 12, color: "#DC2626" }}>{erro}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, position: "sticky", bottom: 0, background: T.surface, paddingTop: 8 }}>
          <Botao T={T} type="button" onClick={onFechar}>Cancelar</Botao>
          <Botao T={T} type="submit" variante="primario" disabled={enviando}>{enviando ? "Salvando…" : "Salvar dados"}</Botao>
        </div>
      </form>
    </Modal>
  );
}

const ASSINATURA_LABEL = { ativa: "Ativa", inadimplente: "Inadimplente", cancelada: "Cancelada" };

export function DadosCliente({ client, T, lead, engajamento, responsavel }) {
  const c = client.raw;
  const manual = lead.dados?.dados ?? {};
  const [editando, setEditando] = useState(false);
  const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, alignContent: "start" };

  const cadastro = (campo) => {
    const doApp = campo.app(c);
    if (!vazio(doApp)) return { valor: doApp, origem: "app" };
    return { valor: manual[campo.nome], origem: vazio(manual[campo.nome]) ? null : "manual" };
  };
  const preenchidos =
    CAMPOS_CADASTRO.filter((k) => !vazio(cadastro(k).valor)).length + CAMPOS_QUALIFICACAO.filter((k) => !vazio(manual[k.nome])).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Secao T={T} titulo="Cadastro"
        acao={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10.5, color: T.textMuted }}>{preenchidos}/{TODOS_CAMPOS.length} campos preenchidos</span>
            <Botao T={T} variante="primario" onClick={() => setEditando(true)} disabled={lead.carregando}>✎ Editar dados</Botao>
          </div>
        }>
        <Estado T={T} carregando={false} erro={lead.erro} onTentar={lead.recarregar} />
        <div style={grade}>
          {CAMPOS_CADASTRO.filter((k) => k.nome !== "cidade" && k.nome !== "uf").map((k) => {
            const { valor, origem } = cadastro(k);
            return <Valor key={k.nome} T={T} label={k.label} origem={origem}>{valor}</Valor>;
          })}
          {(() => {
            const cid = cadastro(CAMPOS_CADASTRO.find((k) => k.nome === "cidade"));
            const uf = cadastro(CAMPOS_CADASTRO.find((k) => k.nome === "uf"));
            const origem = cid.origem === "manual" || uf.origem === "manual" ? "manual" : "app";
            return <Valor T={T} label="Cidade" origem={origem}>{[cid.valor, uf.valor].filter((v) => !vazio(v)).join(" / ")}</Valor>;
          })()}
        </div>
      </Secao>

      <Secao T={T} titulo="Qualificação do lead">
        <div style={grade}>
          {CAMPOS_QUALIFICACAO.map((k) => (
            <Valor key={k.nome} T={T} label={k.label} full={k.texto}>{formatarCampo(k, manual[k.nome])}</Valor>
          ))}
        </div>
        {lead.dados?.atualizado_em && (
          <div style={{ fontSize: 10.5, color: T.textMuted }}>
            Atualizado em {new Date(lead.dados.atualizado_em).toLocaleString("pt-BR")}{lead.dados.atualizado_por ? ` por ${lead.dados.atualizado_por}` : ""}
          </div>
        )}
      </Secao>

      <Secao T={T} titulo="No app">
        <div style={grade}>
          <Valor T={T} label="Plano">{client.plan}{c.ciclo ? ` · ${c.ciclo}` : ""}</Valor>
          <Valor T={T} label="Assinatura">{c.assinatura_status ? ASSINATURA_LABEL[c.assinatura_status] ?? c.assinatura_status : "Sem assinatura"}</Valor>
          <Valor T={T} label="Engajamento">{engajamento}</Valor>
          <Valor T={T} label={client.tipo === "contratacao" ? "Contratação iniciada" : "Conta criada"}>{fmtData(c.criado_em)}</Valor>
          <Valor T={T} label="Cliente desde">{c.cliente_desde ? fmtData(c.cliente_desde) : null}</Valor>
          <Valor T={T} label="Último login">{c.ultimo_login ? new Date(c.ultimo_login).toLocaleString("pt-BR") : null}</Valor>
          <Valor T={T} label="Acesso">{c.acesso_bloqueado ? "Bloqueado" : "Liberado"}</Valor>
        </div>
      </Secao>

      <Secao T={T} titulo="Responsável na Zubler">{responsavel}</Secao>

      {editando && <EditarLeadModal T={T} client={client} lead={lead.dados} onSalvo={lead.recarregar} onFechar={() => setEditando(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE: eventos do app + registros da equipe
// ─────────────────────────────────────────────────────────────────────────────

const TIPOS = {
  nota: { label: "Nota", icone: "📝", cor: "#6B7280" },
  ligacao: { label: "Ligação", icone: "📞", cor: "#2563EB" },
  reuniao: { label: "Reunião", icone: "🤝", cor: "#7C3AED" },
  email: { label: "E-mail", icone: "✉️", cor: "#0891B2" },
  whatsapp: { label: "WhatsApp", icone: "💬", cor: "#16A34A" },
  proposta: { label: "Proposta", icone: "📄", cor: "#D97706" },
  outro: { label: "Outro", icone: "•", cor: "#6B7280" },
  edicao: { label: "Cadastro", icone: "✎", cor: "#9CA3AF" },
};
const TIPOS_MANUAIS = ["nota", "ligacao", "reuniao", "email", "whatsapp", "proposta", "outro"];

function eventosDoApp(client, pagamentos) {
  const c = client.raw;
  const ev = [];
  const add = (data, icone, cor, titulo, descricao) => data && ev.push({ id: `app-${ev.length}`, origem: "app", data, icone, cor, titulo, descricao });
  add(c.criado_em, "✨", "#4F6BED", client.tipo === "contratacao" ? "Contratação iniciada no app" : "Conta criada no app",
    [c.como_conheceu && `Como conheceu: ${c.como_conheceu}`, c.especialidade].filter(Boolean).join(" · ") || null);
  if (c.contratacao?.pago_em) add(c.contratacao.pago_em, "💳", "#16A34A", "Pagamento da contratação confirmado", client.mrrPotencial != null ? `${fmtMoeda(client.mrrPotencial)}/mês` : null);
  add(c.cliente_desde, "🎉", "#16A34A", `Virou cliente · plano ${client.plan}`, c.ciclo ? `Ciclo ${c.ciclo}` : null);
  for (const p of pagamentos) {
    const g = grupoPagamento(p.status);
    const metodo = METODOS_ASAAS[p.metodo] ?? capitalizar(p.metodo);
    add(p.data, "$", GRUPOS[g].cor, `Pagamento ${GRUPOS[g].label.toLowerCase()} · ${fmtMoeda(p.valor)}`,
      [metodo, p.origem === "manual" ? "registrado à mão" : "Asaas", p.referencia].filter(Boolean).join(" · "));
  }
  add(c.ultimo_login, "↪", "#6B7280", "Último acesso ao app", c.dias_sem_login ? `${c.dias_sem_login} dia(s) sem login` : null);
  const jaCobrada = pagamentos.some((p) => String(p.data).slice(0, 10) === String(c.proxima_cobranca).slice(0, 10));
  if (c.proxima_cobranca && diasAte(c.proxima_cobranca) >= 0 && !jaCobrada) add(c.proxima_cobranca, "🗓", "#D97706", "Próxima cobrança", null);
  add(c.cancelamento_agendado_para, "⚠", "#DC2626", "Cancelamento agendado", null);
  if (c.lost?.date) add(c.lost.date, "✕", "#DC2626", "Marcado como lost", c.lost.reason ?? null);
  return ev;
}

const agoraLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function NovoRegistro({ T, chave, onSalvo }) {
  const [tipo, setTipo] = useState("nota");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(agoraLocal);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const campo = { padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" };

  const enviar = async (e) => {
    e.preventDefault();
    if (!titulo.trim() && !descricao.trim()) return;
    setEnviando(true); setErro(null);
    try {
      await novoEvento(chave, { tipo, titulo: titulo.trim() || TIPOS[tipo].label, descricao: descricao.trim(), data: new Date(data).toISOString() });
      setTitulo(""); setDescricao(""); setData(agoraLocal());
      onSalvo();
    } catch (err) { setErro(err.message); }
    finally { setEnviando(false); }
  };

  return (
    <form onSubmit={enviar} style={{ ...cartao(T), padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TIPOS_MANUAIS.map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)} style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${tipo === t ? TIPOS[t].cor : T.border}`, background: tipo === t ? `${TIPOS[t].cor}1A` : "transparent",
            color: tipo === t ? TIPOS[t].cor : T.textSub,
          }}>{TIPOS[t].icone} {TIPOS[t].label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={`Título (ex.: ${tipo === "ligacao" ? "Ligação de follow-up" : tipo === "reuniao" ? "Demo do MediCopilot" : "Resumo"})`}
          style={{ ...campo, flex: 1, minWidth: 200 }} />
        <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} style={campo} />
      </div>
      <textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que aconteceu, combinados, próximos passos…" style={{ ...campo, resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#DC2626" }}>{erro}</span>
        <Botao T={T} type="submit" variante="primario" disabled={enviando || (!titulo.trim() && !descricao.trim())}>{enviando ? "Salvando…" : "Registrar na timeline"}</Botao>
      </div>
    </form>
  );
}

export function Timeline({ client, T, det, sessaoEmail }) {
  const manuais = useCarregar(() => listarTimeline(client.id), [client.id]);
  const [filtro, setFiltro] = useState("tudo");

  const eventos = useMemo(() => {
    const doApp = eventosDoApp(client, det?.dados?.pagamentos ?? []);
    const daEquipe = (manuais.dados ?? []).map((e) => ({
      id: e.id, origem: "equipe", data: e.data, icone: TIPOS[e.tipo]?.icone ?? "•", cor: TIPOS[e.tipo]?.cor ?? "#6B7280",
      titulo: e.titulo, descricao: e.descricao, tipo: TIPOS[e.tipo]?.label, autor: e.autor_email,
    }));
    return [...doApp, ...daEquipe]
      .filter((e) => filtro === "tudo" || e.origem === filtro)
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [client, det?.dados, manuais.dados, filtro]);

  const grupos = [];
  for (const e of eventos) {
    const d = new Date(String(e.data).length === 10 ? `${e.data}T12:00:00` : e.data);
    const chave = d > new Date() ? "Próximos" : d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (grupos.at(-1)?.chave !== chave) grupos.push({ chave, itens: [] });
    grupos.at(-1).itens.push({ ...e, d });
  }

  const apagar = async (id) => {
    if (!confirm("Apagar este registro da timeline?")) return;
    try { await apagarEvento(id); manuais.recarregar(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      <NovoRegistro T={T} chave={client.id} onSalvo={manuais.recarregar} />

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {[["tudo", "Tudo"], ["equipe", "Equipe"], ["app", "App"]].map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
            background: filtro === id ? T.accentBg : "transparent", color: filtro === id ? T.accentText : T.textMuted,
          }}>{label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: T.textMuted }}>{eventos.length} evento(s)</span>
      </div>

      <Estado T={T} carregando={manuais.carregando && !manuais.dados} erro={manuais.erro} onTentar={manuais.recarregar} />
      {client.tipo === "clinica" && det?.carregando && !det.dados && <div style={{ fontSize: 11, color: T.textMuted }}>Carregando pagamentos…</div>}
      {!eventos.length && !manuais.carregando && <div style={{ ...cartao(T), padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Nada na timeline ainda.</div>}

      {grupos.map((g) => (
        <div key={g.chave} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...rotulo(T), marginBottom: 8 }}>{capitalizar(g.chave)}</div>
          {g.itens.map((e, i) => (
            <div key={e.id} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: `${e.cor}1A`, color: e.cor, border: `1.5px solid ${e.cor}55` }}>{e.icone}</div>
                {i < g.itens.length - 1 && <div style={{ flex: 1, width: 2, background: T.border, minHeight: 12 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{e.titulo}</span>
                  {e.origem === "app" ? <Pilula cor="cinza">App</Pilula> : e.tipo && <Pilula cor="azul">{e.tipo}</Pilula>}
                  <span style={{ flex: 1 }} />
                  {e.origem === "equipe" && e.autor && e.autor.toLowerCase() === sessaoEmail && (
                    <button onClick={() => apagar(e.id)} title="Apagar registro" style={{ border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Apagar</button>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>
                  {String(e.data).length === 10 ? e.d.toLocaleDateString("pt-BR") : e.d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  {e.autor && ` · ${e.autor}`}
                </div>
                {e.descricao && <div style={{ fontSize: 12, color: T.textSub, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.descricao}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
