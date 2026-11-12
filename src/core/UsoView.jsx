// Uso do app: acessos, telas e movimentação das clínicas, sempre comparados
// com o período anterior, a média histórica da clínica e a média dos demais
// parceiros, com alertas de risco de churn, queda de uso e upgrade.
// Dados: GET uso e GET clinicas/:id/uso (MediCopilot, via crm-ponte).

import { useMemo, useState } from "react";
import { api } from "./api.js";
import { Estado, Pilula, Secao, Tabela, fmtData, fmtMoeda, useCarregar } from "./ui.jsx";

export const TELAS = {
  atendimentos: "Atendimentos", patients: "Pacientes", "patient-detail": "Prontuário", consulta: "Consulta",
  conversas: "Conversas", agenda: "Agenda", receitas: "Receitas e atestados", protocolos: "Protocolos",
  questionarios: "Questionários", faturamento: "Faturamento", indicadores: "Indicadores", secretaria: "Secretária digital",
  anamnese: "Gerador de anamnese", copiloto: "Copiloto", "base-conhecimento": "Base de conhecimento",
  configuracoes: "Configurações", equipe: "Minha equipe", clinica: "Minha clínica", "meu-plano": "Meu plano",
  "whatsapp-pacientes": "WhatsApp dos pacientes", "agendamento-online": "Agendamento online", "mapa-familiar": "Mapa familiar",
};
const METRICAS = [
  ["dias_ativos", "Dias com acesso"],
  ["acessos", "Acessos (logins)"],
  ["usuarios_ativos", "Usuários ativos"],
  ["telas", "Telas abertas"],
  ["consultas", "Consultas"],
  ["agendamentos", "Agendamentos criados"],
  ["atendimentos_agendados", "Atendimentos agendados"],
  ["pacientes", "Pacientes novos"],
  ["documentos", "Documentos"],
];
const RECURSOS = { copiloto: "Copiloto", whatsapp: "WhatsApp", video: "Vídeo" };
const PERIODOS = [7, 14, 30, 60, 90];
const RISCO = { alto: ["vermelho", "Risco alto"], medio: ["amarelo", "Risco médio"], baixo: ["verde", "Risco baixo"] };
const GRAVIDADE = { alta: "vermelho", media: "amarelo", baixa: "cinza" };
const TIPO = { churn: ["Churn", "vermelho"], queda: ["Queda de uso", "amarelo"], upgrade: ["Upgrade", "azul"] };
const AVALIACAO = { acima: ["Acima da média", "verde"], na_media: ["Na média", "cinza"], abaixo: ["Abaixo da média", "vermelho"], sem_base: ["Sem base", "cinza"] };

const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

export function Variacao({ v, inverso = false }) {
  if (v == null) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const bom = inverso ? v < 0 : v > 0;
  const cor = Math.abs(v) < 0.05 ? "#6B7280" : bom ? "#16A34A" : "#DC2626";
  return <span style={{ color: cor, fontWeight: 700 }}>{v > 0 ? "▲" : v < 0 ? "▼" : "•"} {Math.round(Math.abs(v) * 100)}%</span>;
}

function SeletorPeriodo({ T, dias, onDias }) {
  return (
    <div style={{ display: "flex", gap: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 2 }}>
      {PERIODOS.map((d) => (
        <button key={d} onClick={() => onDias(d)} style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
          background: d === dias ? T.accentBg : "transparent", color: d === dias ? T.accentText : T.textMuted,
        }}>{d} dias</button>
      ))}
    </div>
  );
}

function Kpi({ T, label, valor, anterior, variacao, detalhe, cor }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: cor ?? T.text }}>{valor}</span>
        {variacao !== undefined && <span style={{ fontSize: 11 }}><Variacao v={variacao} /></span>}
      </div>
      {(anterior !== undefined || detalhe) && (
        <div style={{ fontSize: 10.5, color: T.textMuted }}>{anterior !== undefined ? `${fmtNum(anterior)} no período anterior` : detalhe}</div>
      )}
    </div>
  );
}

/** Barras por dia; a parte do período anterior aparece mais clara. */
export function GraficoDiario({ T, serie, inicioAtual, campos }) {
  const [hover, setHover] = useState(null);
  if (!serie?.length) return null;
  const max = Math.max(1, ...serie.map((d) => Math.max(...campos.map(([c]) => d[c]))));
  const largura = 100 / serie.length;
  const h = 120;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: T.textMuted, marginBottom: 8, flexWrap: "wrap" }}>
        {campos.map(([c, l, cor]) => (
          <span key={c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: cor }} />{l}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>
          {hover ? `${fmtData(hover.dia)}: ${campos.map(([c, l]) => `${hover[c]} ${l.toLowerCase()}`).join(" · ")}` : "Mais claro = período anterior"}
        </span>
      </div>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }} onMouseLeave={() => setHover(null)}>
        {serie.map((d, i) => {
          const anterior = d.dia < inicioAtual;
          const barra = largura / campos.length;
          return (
            <g key={d.dia} onMouseEnter={() => setHover(d)}>
              <rect x={i * largura} y={0} width={largura} height={h} fill={hover?.dia === d.dia ? T.cardHover : "transparent"} />
              {campos.map(([c, , cor], k) => {
                const alt = (d[c] / max) * (h - 4);
                return <rect key={c} x={i * largura + k * barra + barra * 0.1} y={h - alt} width={barra * 0.8} height={alt} fill={cor} opacity={anterior ? 0.35 : 1} />;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ListaAlertas({ T, alertas, onAbrir, comClinica = true }) {
  if (!alertas.length)
    return <div style={{ padding: 16, borderRadius: 10, border: `1px dashed ${T.border}`, fontSize: 12, color: T.textMuted }}>Nenhum alerta neste período.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alertas.map((a, i) => {
        const [tipo, corTipo] = TIPO[a.tipo] ?? [a.tipo, "cinza"];
        return (
          <div key={i} onClick={onAbrir ? () => onAbrir(a.clinica_id) : undefined} style={{
            display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: T.card, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${{ vermelho: "#DC2626", amarelo: "#D97706", cinza: "#9CA3AF" }[GRAVIDADE[a.gravidade]]}`,
            borderRadius: 8, cursor: onAbrir ? "pointer" : "default",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {comClinica && <span style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{a.clinica_nome ?? "Clínica sem nome"}</span>}
                <span style={{ fontSize: 12, fontWeight: comClinica ? 600 : 800, color: T.text }}>{comClinica ? `· ${a.titulo}` : a.titulo}</span>
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{a.detalhe}</div>
            </div>
            <Pilula cor={corTipo}>{tipo}</Pilula>
          </div>
        );
      })}
    </div>
  );
}

function rotuloTela(t) {
  return TELAS[t] ?? t;
}

function colunasTelas(T, { comClinicas }) {
  return [
    { chave: "tela", titulo: "Tela", render: (t) => rotuloTela(t.tela) },
    { chave: "eventos", titulo: "Aberturas", alinhar: "right", render: (t) => fmtNum(t.eventos) },
    { chave: "anterior", titulo: "Período anterior", alinhar: "right", render: (t) => fmtNum(t.anterior) },
    { chave: "variacao", titulo: "Variação", alinhar: "right", render: (t) => <Variacao v={t.variacao} /> },
    comClinicas
      ? { chave: "clinicas", titulo: "Clínicas", alinhar: "right", render: (t) => fmtNum(t.clinicas) }
      : { chave: "dias", titulo: "Dias usados", alinhar: "right", render: (t) => fmtNum(t.dias) },
  ];
}

function semRota(erro) {
  return erro && /ainda não tem essa função/.test(erro)
    ? "O app ainda não envia os dados de uso. Publique no MediCopilot a branch claude/crm-uso (migração uso_eventos e rotas /api/public/crm/uso)."
    : erro;
}

// ─────────────────────────────────────────────────────────────────────────────
// Carteira
// ─────────────────────────────────────────────────────────────────────────────

export default function UsoView({ T, onAbrirClinica }) {
  const [dias, setDias] = useState(30);
  const uso = useCarregar(() => api.uso(dias), [dias]);
  const [aba, setAba] = useState("alertas");
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const d = uso.dados;

  const assinantes = useMemo(() => (d?.clinicas ?? []).filter((c) => c.status === "ativa" || c.status === "inadimplente"), [d]);
  const soma = (m, campo) => assinantes.reduce((s, c) => s + (c.metricas[m]?.[campo] ?? 0), 0);
  const variacao = (m) => {
    const ant = soma(m, "anterior");
    return ant > 0 ? (soma(m, "atual") - ant) / ant : null;
  };
  const ativas = assinantes.filter((c) => c.metricas.dias_ativos.atual > 0).length;
  const ativasAntes = assinantes.filter((c) => c.metricas.dias_ativos.anterior > 0).length;
  const porTipo = (t) => (d?.alertas ?? []).filter((a) => a.tipo === t).length;
  const alertas = (d?.alertas ?? []).filter((a) => filtro === "todos" || a.tipo === filtro);
  const b = busca.trim().toLowerCase();
  const clinicas = assinantes
    .filter((c) => !b || c.nome?.toLowerCase().includes(b))
    .sort((x, y) => y.risco.pontos - x.risco.pontos || (y.dias_sem_acesso ?? 999) - (x.dias_sem_acesso ?? 999));

  const pill = (ativo) => ({
    padding: "5px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
    background: ativo ? T.accentBg : "transparent", color: ativo ? T.accentText : T.textMuted, whiteSpace: "nowrap",
  });
  const metricaCelula = (c, m) => (
    <span title={`Anterior: ${fmtNum(c.metricas[m].anterior)} · média parceiros: ${fmtNum(c.metricas[m].media_parceiros)}`}>
      {fmtNum(c.metricas[m].atual)} <span style={{ fontSize: 10.5 }}><Variacao v={c.metricas[m].variacao} /></span>
    </span>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", alignContent: "start", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Uso do app</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>
            {d ? `${fmtData(d.periodo.inicio)} a ${fmtData(d.periodo.fim)}, comparado com ${fmtData(d.periodo.anterior?.inicio)} a ${fmtData(d.periodo.anterior?.fim)} · média de ${d.parceiros.quantidade} parceiro(s) assinante(s)` : "Carregando período…"}
          </div>
        </div>
        <SeletorPeriodo T={T} dias={dias} onDias={setDias} />
      </div>
      <Estado T={T} carregando={uso.carregando && !d} erro={semRota(uso.erro)} onTentar={uso.recarregar} />
      {d && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Kpi T={T} label="Clínicas que usaram" valor={`${ativas} de ${assinantes.length}`} anterior={ativasAntes} variacao={ativasAntes ? (ativas - ativasAntes) / ativasAntes : null} />
            <Kpi T={T} label="Acessos" valor={fmtNum(soma("acessos", "atual"))} anterior={soma("acessos", "anterior")} variacao={variacao("acessos")} />
            <Kpi T={T} label="Consultas" valor={fmtNum(soma("consultas", "atual"))} anterior={soma("consultas", "anterior")} variacao={variacao("consultas")} />
            <Kpi T={T} label="Agendamentos" valor={fmtNum(soma("agendamentos", "atual"))} anterior={soma("agendamentos", "anterior")} variacao={variacao("agendamentos")} />
            <Kpi T={T} label="Risco de churn" valor={assinantes.filter((c) => c.risco.nivel === "alto").length} cor="#DC2626"
              detalhe={`${assinantes.filter((c) => c.risco.nivel === "medio").length} em risco médio · ${fmtMoeda(assinantes.filter((c) => c.risco.nivel === "alto").reduce((s, c) => s + (c.preco_mensal ?? 0), 0))} de MRR em risco alto`} />
            <Kpi T={T} label="Oportunidades de upgrade" valor={new Set((d.alertas ?? []).filter((a) => a.tipo === "upgrade").map((a) => a.clinica_id)).size} cor={T.accentText} detalhe={`${porTipo("upgrade")} sinal(is)`} />
          </div>

          <GraficoDiario T={T} serie={d.diario} inicioAtual={d.periodo.inicio}
            campos={[["usuarios", "Usuários", "#3B55D4"], ["consultas", "Consultas", "#16A34A"], ["agendamentos", "Agendamentos", "#D97706"]]} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
            {[["alertas", `Alertas (${d.alertas.length})`], ["clinicas", `Clínicas (${assinantes.length})`], ["telas", `Telas (${d.telas.length})`]].map(([id, l]) => (
              <button key={id} onClick={() => setAba(id)} style={pill(aba === id)}>{l}</button>
            ))}
          </div>

          {aba === "alertas" && (
            <Secao T={T} titulo="Alertas" acao={
              <div style={{ display: "flex", gap: 2 }}>
                {[["todos", "Todos"], ["churn", `Churn (${porTipo("churn")})`], ["queda", `Queda (${porTipo("queda")})`], ["upgrade", `Upgrade (${porTipo("upgrade")})`]].map(([id, l]) => (
                  <button key={id} onClick={() => setFiltro(id)} style={pill(filtro === id)}>{l}</button>
                ))}
              </div>
            }>
              <ListaAlertas T={T} alertas={alertas} onAbrir={onAbrirClinica} />
            </Secao>
          )}

          {aba === "clinicas" && (
            <Secao T={T} titulo="Clínicas assinantes, por risco" acao={
              <input placeholder="Buscar clínica" value={busca} onChange={(e) => setBusca(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12, fontFamily: "inherit" }} />
            }>
              <Tabela T={T} linhas={clinicas.map((c) => ({ ...c, id: c.clinica_id }))} vazio="Nenhuma clínica assinante."
                onLinha={onAbrirClinica ? (c) => onAbrirClinica(c.clinica_id) : undefined}
                colunas={[
                  { chave: "nome", titulo: "Clínica", render: (c) => <span style={{ fontWeight: 700 }}>{c.nome ?? "—"}</span> },
                  { chave: "risco", titulo: "Risco", render: (c) => <Pilula cor={RISCO[c.risco.nivel][0]}>{RISCO[c.risco.nivel][1]} · {c.risco.pontos}</Pilula> },
                  { chave: "ultimo", titulo: "Último acesso", render: (c) => c.ultimo_acesso ? `${fmtData(c.ultimo_acesso)}${c.dias_sem_acesso ? ` (${c.dias_sem_acesso}d)` : " (hoje)"}` : "Nunca" },
                  { chave: "dias", titulo: "Dias c/ acesso", alinhar: "right", render: (c) => metricaCelula(c, "dias_ativos") },
                  { chave: "usuarios", titulo: "Usuários", alinhar: "right", render: (c) => metricaCelula(c, "usuarios_ativos") },
                  { chave: "consultas", titulo: "Consultas", alinhar: "right", render: (c) => metricaCelula(c, "consultas") },
                  { chave: "agendamentos", titulo: "Agendamentos", alinhar: "right", render: (c) => metricaCelula(c, "agendamentos") },
                  { chave: "parceiros", titulo: "Vs. parceiros", render: (c) => { const [l, cor] = AVALIACAO[c.metricas.dias_ativos.avaliacao]; return <Pilula cor={cor}>{l}</Pilula>; } },
                  { chave: "alertas", titulo: "Alertas", alinhar: "right", render: (c) => c.alertas.length || "—" },
                ]} />
            </Secao>
          )}

          {aba === "telas" && (
            <Secao T={T} titulo="Telas mais acessadas">
              <Tabela T={T} linhas={d.telas.map((t) => ({ ...t, id: t.tela }))} vazio="Nenhuma tela registrada ainda." colunas={colunasTelas(T, { comClinicas: true })} />
            </Secao>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Uma clínica (aba Uso da ficha do cliente)
// ─────────────────────────────────────────────────────────────────────────────

function BarraConsumo({ T, r }) {
  const pct = r.uso == null ? 0 : Math.min(1, r.uso);
  const cor = r.uso >= 1 ? "#DC2626" : r.uso >= 0.8 ? "#D97706" : "#16A34A";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.text }}>
        <span style={{ fontWeight: 700 }}>{RECURSOS[r.recurso] ?? r.recurso}</span>
        <span>{r.franquia > 0 ? `${fmtNum(r.usado)} de ${fmtNum(r.franquia)} (${Math.round((r.uso ?? 0) * 100)}%)` : "Sem franquia no plano"}{r.saldo_adicional > 0 ? ` · ${fmtNum(r.saldo_adicional)} adicionais` : ""}</span>
      </div>
      <div style={{ height: 6, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: cor }} />
      </div>
    </div>
  );
}

export function UsoCliente({ T, clinicaId }) {
  const [dias, setDias] = useState(30);
  const uso = useCarregar(() => api.usoClinica(clinicaId, dias), [clinicaId, dias]);
  const d = uso.dados;
  const c = d?.clinica;
  const PAPEL = { medico: "Médico(a)", secretaria: "Secretária", enfermeiro: "Enfermagem" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, fontSize: 11, color: T.textMuted, minWidth: 180 }}>
          {d ? `${fmtData(d.periodo.inicio)} a ${fmtData(d.periodo.fim)} contra os ${dias} dias anteriores · média de ${d.parceiros.quantidade} parceiro(s)` : ""}
        </div>
        <SeletorPeriodo T={T} dias={dias} onDias={setDias} />
      </div>
      <Estado T={T} carregando={uso.carregando && !d} erro={semRota(uso.erro)} onTentar={uso.recarregar} />
      {c && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            <Kpi T={T} label="Risco de churn" valor={RISCO[c.risco.nivel][1]} cor={{ alto: "#DC2626", medio: "#D97706", baixo: "#16A34A" }[c.risco.nivel]} detalhe={`${c.risco.pontos} de 100 pontos`} />
            <Kpi T={T} label="Último acesso" valor={c.ultimo_acesso ? (c.dias_sem_acesso ? `há ${c.dias_sem_acesso}d` : "hoje") : "nunca"} detalhe={c.ultimo_acesso ? fmtData(c.ultimo_acesso) : "Nenhum acesso registrado"} />
            <Kpi T={T} label="Dias com acesso" valor={c.metricas.dias_ativos.atual} anterior={c.metricas.dias_ativos.anterior} variacao={c.metricas.dias_ativos.variacao} />
            <Kpi T={T} label="Consultas" valor={c.metricas.consultas.atual} anterior={c.metricas.consultas.anterior} variacao={c.metricas.consultas.variacao} />
            <Kpi T={T} label="Agendamentos" valor={c.metricas.agendamentos.atual} anterior={c.metricas.agendamentos.anterior} variacao={c.metricas.agendamentos.variacao} />
          </div>

          <Secao T={T} titulo="Alertas">
            <ListaAlertas T={T} alertas={c.alertas} comClinica={false} />
          </Secao>

          <Secao T={T} titulo="Comparação">
            <Tabela T={T} linhas={METRICAS.map(([m, l]) => ({ id: m, rotulo: l, ...c.metricas[m] }))}
              colunas={[
                { chave: "rotulo", titulo: "Métrica" },
                { chave: "atual", titulo: `Últimos ${dias} dias`, alinhar: "right", render: (x) => <b>{fmtNum(x.atual)}</b> },
                { chave: "anterior", titulo: "Período anterior", alinhar: "right", render: (x) => fmtNum(x.anterior) },
                { chave: "variacao", titulo: "Variação", alinhar: "right", render: (x) => <Variacao v={x.variacao} /> },
                { chave: "media_historica", titulo: "Média histórica", alinhar: "right", render: (x) => fmtNum(x.media_historica) },
                { chave: "media_parceiros", titulo: "Média parceiros", alinhar: "right", render: (x) => fmtNum(x.media_parceiros) },
                { chave: "avaliacao", titulo: "", render: (x) => { const [l, cor] = AVALIACAO[x.avaliacao]; return <Pilula cor={cor}>{l}</Pilula>; } },
              ]} />
            <div style={{ fontSize: 10.5, color: T.textMuted }}>
              Média histórica: média por período de {dias} dias nos 6 meses anteriores (só depois que a conta existia). A avaliação compara com a média dos parceiros e, sem ela, com a média histórica.
            </div>
          </Secao>

          <GraficoDiario T={T} serie={d.diario} inicioAtual={d.periodo.inicio}
            campos={[["usuarios", "Usuários", "#3B55D4"], ["consultas", "Consultas", "#16A34A"], ["agendamentos", "Agendamentos", "#D97706"]]} />

          {(c.consumo.length > 0 || c.licencas) && (
            <Secao T={T} titulo="Consumo do plano no mês">
              <div style={{ display: "flex", flexDirection: "column", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                {c.consumo.map((r) => <BarraConsumo key={r.recurso} T={T} r={r} />)}
                {c.licencas && (
                  <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: T.text, flexWrap: "wrap" }}>
                    <span>Médicos: <b>{c.licencas.medicos_em_uso} de {c.licencas.medicos}</b></span>
                    <span>Equipe: <b>{c.licencas.secretarias_em_uso} de {c.licencas.secretarias}</b></span>
                  </div>
                )}
              </div>
            </Secao>
          )}

          <Secao T={T} titulo="Usuários">
            <Tabela T={T} linhas={d.usuarios} vazio="Nenhum login nesta clínica."
              colunas={[
                { chave: "nome", titulo: "Usuário", render: (u) => <div><div style={{ fontWeight: 700 }}>{u.nome ?? u.email ?? "—"}</div><div style={{ fontSize: 10.5, color: T.textMuted }}>{u.email}</div></div> },
                { chave: "papel", titulo: "Papel", render: (u) => PAPEL[u.papel] ?? u.papel },
                { chave: "ultimo_acesso", titulo: "Último acesso", render: (u) => fmtData(u.ultimo_acesso ?? u.ultimo_login) },
                { chave: "dias_ativos", titulo: "Dias c/ acesso", alinhar: "right", render: (u) => <span>{u.dias_ativos} <span style={{ fontSize: 10.5 }}><Variacao v={u.dias_ativos_anterior ? (u.dias_ativos - u.dias_ativos_anterior) / u.dias_ativos_anterior : null} /></span></span> },
                { chave: "acessos", titulo: "Acessos", alinhar: "right" },
                { chave: "telas", titulo: "Telas abertas", alinhar: "right" },
              ]} />
          </Secao>

          <Secao T={T} titulo="Telas acessadas">
            <Tabela T={T} linhas={d.telas.map((t) => ({ ...t, id: t.tela }))} vazio="Nenhuma tela registrada no período." colunas={colunasTelas(T, { comClinicas: false })} />
          </Secao>
        </>
      )}
    </div>
  );
}
