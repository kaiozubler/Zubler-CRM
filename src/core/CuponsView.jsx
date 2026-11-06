// Cupons de desconto da contratação do MediCopilot. Os planos e preços vêm
// do próprio app (GET cupons devolve o catálogo junto), então a tela sempre
// mostra os planos atuais sem copiar números para cá.

import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { Botao, Campo, Estado, Modal, Pilula, Secao, Tabela, fmtMoeda } from "./ui.jsx";
import {
  CODIGO_VALIDO, MODELOS, RECURSOS, TIPOS, fmtNum, normalizarCodigo, previaNoPlano, resumoCupom,
  situacao, textoBeneficio, textoDuracao, textoPlanos, textoValidade, valeNoPlano,
} from "./cupons.js";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "ativo", label: "Ativos" },
  { id: "agendado", label: "Agendados" },
  { id: "encerrado", label: "Expirados/esgotados" },
  { id: "inativo", label: "Inativos" },
];

const CORES_PLANO = { basic: "#0EA5E9", pro: "#4F6BED", enterprise: "#7C3AED" };

export default function CuponsView({ T }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [editor, setEditor] = useState(null); // { cupom?: existente, inicial?: parcial }
  const [alternando, setAlternando] = useState(null);

  const carregar = () => {
    setCarregando(true);
    setErro(null);
    api.cupons()
      .then((r) => setDados(r))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, []);

  const planos = dados?.catalogo?.planos ?? [];
  const cupons = dados?.cupons ?? [];

  const visiveis = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return cupons.filter((c) => {
      const s = situacao(c).chave;
      const passaFiltro =
        filtro === "todos" || s === filtro || (filtro === "encerrado" && (s === "expirado" || s === "esgotado"));
      const passaBusca = !b || c.codigo.includes(b) || (c.descricao ?? "").toUpperCase().includes(b);
      return passaFiltro && passaBusca;
    });
  }, [cupons, filtro, busca]);

  const ativos = cupons.filter((c) => situacao(c).chave === "ativo");
  const usosTotais = cupons.reduce((s, c) => s + (c.usos ?? 0), 0);
  const bonificacoes = ativos.filter((c) => (c.tipo === "percentual" && c.valor >= 100)).length;

  const salvo = (cupom, novo) => {
    setDados((d) => ({
      ...d,
      cupons: novo ? [cupom, ...d.cupons] : d.cupons.map((c) => (c.id === cupom.id ? cupom : c)),
    }));
  };

  const alternar = async (c) => {
    setAlternando(c.id);
    try {
      const r = await api.editarCupom(c.id, { ativo: !c.ativo });
      salvo(r.cupom, false);
    } catch (e) {
      alert(e.message);
    } finally {
      setAlternando(null);
    }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 22 }}>
      <Estado T={T} carregando={carregando && !dados} erro={erro} onTentar={carregar} />
      {dados && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Kpi T={T} titulo="Cupons valendo hoje" valor={ativos.length} />
            <Kpi T={T} titulo="Contratações com cupom" valor={usosTotais} />
            <Kpi T={T} titulo="Bonificações 100% ativas" valor={bonificacoes} />
            <Kpi T={T} titulo="Cadastrados" valor={cupons.length} />
          </div>

          <Secao T={T} titulo="Planos do MediCopilot">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {planos.map((p) => (
                <CartaoPlano
                  key={p.id}
                  T={T}
                  plano={p}
                  catalogo={dados.catalogo}
                  cuponsAtivos={ativos.filter((c) => valeNoPlano(c, p.id))}
                  onCriar={() => setEditor({ inicial: { planos: [p.id] } })}
                />
              ))}
            </div>
            <Adicionais T={T} catalogo={dados.catalogo} />
          </Secao>

          <Secao
            T={T}
            titulo={`Cupons (${cupons.length})`}
            acao={<Botao T={T} variante="primario" onClick={() => setEditor({})}>+ Novo cupom</Botao>}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {FILTROS.map((f) => (
                <Chip key={f.id} T={T} ativo={filtro === f.id} onClick={() => setFiltro(f.id)}>
                  {f.label}
                </Chip>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{ width: 220 }}>
                <Campo T={T} placeholder="Buscar pelo nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <Tabela
              T={T}
              linhas={visiveis}
              vazio={cupons.length ? "Nenhum cupom neste filtro." : "Nenhum cupom ainda. Crie o primeiro em “+ Novo cupom”."}
              onLinha={(c) => setEditor({ cupom: c })}
              colunas={[
                {
                  chave: "codigo",
                  titulo: "Cupom",
                  render: (c) => (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontWeight: 800, letterSpacing: 0.5 }}>{c.codigo}</span>
                      {c.descricao && <span style={{ fontSize: 11, color: T.textMuted }}>{c.descricao}</span>}
                    </div>
                  ),
                },
                { chave: "beneficio", titulo: "Benefício", render: (c) => <span style={{ fontWeight: 600 }}>{textoBeneficio(c)}</span> },
                {
                  chave: "planos",
                  titulo: "Planos",
                  render: (c) =>
                    c.planos?.length ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        {c.planos.map((id) => <TagPlano key={id} id={id} planos={planos} />)}
                      </div>
                    ) : (
                      <span style={{ color: T.textSub }}>Qualquer plano</span>
                    ),
                },
                {
                  chave: "duracao",
                  titulo: "Duração",
                  render: (c) => {
                    const t = `${textoDuracao(c)}${c.ciclo ? ` · só ${c.ciclo}` : ""}`;
                    return t[0].toUpperCase() + t.slice(1);
                  },
                },
                { chave: "validade", titulo: "Validade", render: textoValidade },
                {
                  chave: "usos",
                  titulo: "Usos",
                  alinhar: "right",
                  render: (c) => (
                    <span style={{ whiteSpace: "nowrap" }}>
                      {fmtNum(c.usos ?? 0)}{c.limite_usos ? ` / ${fmtNum(c.limite_usos)}` : ""}
                    </span>
                  ),
                },
                { chave: "situacao", titulo: "Situação", render: (c) => { const s = situacao(c); return <Pilula cor={s.cor}>{s.label}</Pilula>; } },
                {
                  chave: "acoes",
                  titulo: "",
                  alinhar: "right",
                  render: (c) => (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Botao T={T} variante={c.ativo ? "perigo" : "normal"} disabled={alternando === c.id} onClick={() => alternar(c)}>
                        {c.ativo ? "Desativar" : "Reativar"}
                      </Botao>
                    </span>
                  ),
                },
              ]}
            />
          </Secao>
        </>
      )}

      {editor && (
        <EditorCupom
          T={T}
          catalogo={dados.catalogo}
          existente={editor.cupom}
          inicial={editor.inicial}
          nomesEmUso={cupons.filter((c) => c.id !== editor.cupom?.id).map((c) => c.codigo)}
          onSalvo={salvo}
          onFechar={() => setEditor(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Planos
// ─────────────────────────────────────────────────────────────────────────────

function Kpi({ T, titulo, valor }) {
  return (
    <div style={{ flex: "1 1 150px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 4 }}>{fmtNum(valor)}</div>
    </div>
  );
}

function TagPlano({ id, planos }) {
  const cor = CORES_PLANO[id] ?? "#6B7280";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: cor, background: `${cor}18`, border: `1px solid ${cor}40` }}>
      {planos.find((p) => p.id === id)?.nome ?? id}
    </span>
  );
}

const TEXTO_ATIVO = { incluido: "Incluído", opcional: "Adicional opcional", indisponivel: "Só modo reativo" };

function CartaoPlano({ T, plano: p, catalogo, cuponsAtivos, onCriar }) {
  const cor = CORES_PLANO[p.id] ?? T.borderHi;
  const anual = p.precoMensal * (1 - (catalogo.desconto_anual ?? 0));
  const linhas = [
    ["Médicos", fmtNum(p.medicos)],
    ["Usuários de gestão", fmtNum(p.secretarias)],
    ["Copiloto", `${fmtNum(p.copiloto)} consultas/mês`],
    ["WhatsApp", `${fmtNum(p.whatsapp)} conversas/mês`],
    ["Vídeo", p.video ? `${fmtNum(p.video)} min/mês` : "Não incluído"],
    ["Transcrição", p.transcricao === "avancada" ? "Avançada" : "Padrão"],
    ["Copiloto ativo", TEXTO_ATIVO[p.copilotoAtivo] ?? "—"],
  ];
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderTop: `3px solid ${cor}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10, boxShadow: T.shadowCard }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: cor }}>{p.nome}</span>
        {p.destaque && <Pilula cor="azul">Mais escolhido</Pilula>}
        {p.personalizavel && <Pilula cor="cinza">Personalizável</Pilula>}
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: -6 }}>{p.descricao}</div>
      <div>
        <span style={{ fontSize: 22, fontWeight: 800, color: T.text }}>{fmtMoeda(p.precoMensal)}</span>
        <span style={{ fontSize: 11, color: T.textMuted }}>{p.personalizavel ? " /mês, a partir de" : " /mês"}</span>
        <div style={{ fontSize: 11, color: T.textSub }}>
          No anual: {fmtMoeda(anual)}/mês (−{Math.round((catalogo.desconto_anual ?? 0) * 100)}%)
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        {linhas.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
            <span style={{ color: T.textSub }}>{k}</span>
            <span style={{ color: T.text, fontWeight: 600, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>
          {cuponsAtivos.length ? `${cuponsAtivos.length} cupom(ns) valendo neste plano` : "Nenhum cupom valendo neste plano"}
        </div>
        {cuponsAtivos.slice(0, 3).map((c) => (
          <div key={c.id} style={{ fontSize: 11, color: T.textSub, display: "flex", gap: 6 }}>
            <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontWeight: 700, color: T.text }}>{c.codigo}</span>
            <span>{textoBeneficio(c)}</span>
          </div>
        ))}
        <Botao T={T} onClick={onCriar} style={{ alignSelf: "flex-start", marginTop: 2 }}>+ Cupom para o {p.nome}</Botao>
      </div>
    </div>
  );
}

function Adicionais({ T, catalogo }) {
  const a = catalogo.adicionais ?? {};
  const t = catalogo.tiers ?? {};
  const degraus = (tiers, un) =>
    (tiers ?? []).filter((x) => x.quantidade > 0).map((x) => `${fmtNum(x.quantidade)} ${un} ${x.preco ? `+${fmtMoeda(x.preco)}` : "(base)"}`).join(" · ");
  const itens = [
    ["Médico adicional", `${fmtMoeda(a.medico)}/mês (até ${a.max_medicos})`],
    ["Usuário de gestão adicional", `${fmtMoeda(a.secretaria)}/mês (até ${a.max_secretarias})`],
    ["Copiloto ativo (Enterprise)", `${fmtMoeda(a.copiloto_ativo_por_consulta)} por consulta da franquia`],
    ["Franquias de Copiloto", degraus(t.copiloto, "consultas")],
    ["Franquias de WhatsApp", degraus(t.whatsapp, "conversas")],
    ["Franquias de vídeo", degraus(t.video, "min")],
  ];
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "6px 20px" }}>
      {itens.map(([k, v]) => (
        <div key={k} style={{ fontSize: 11, display: "flex", gap: 8 }}>
          <span style={{ color: T.textMuted, fontWeight: 700, whiteSpace: "nowrap" }}>{k}</span>
          <span style={{ color: T.textSub }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ T, ativo, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      style={{
        padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        border: `1px solid ${ativo ? T.borderHi : T.border}`, background: ativo ? T.accentBg : T.card, color: ativo ? T.accentText : T.textSub,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

function Rotulo({ T, children, dica }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, display: "flex", gap: 6, alignItems: "baseline" }}>
      {children}
      {dica && <span style={{ fontWeight: 500, color: T.textMuted }}>{dica}</span>}
    </div>
  );
}

function deCupom(c) {
  return {
    codigo: c.codigo,
    descricao: c.descricao ?? "",
    tipo: c.tipo,
    valor: String(c.valor),
    recurso: c.recurso ?? "",
    planos: c.planos ?? [],
    ciclo: c.ciclo ?? "",
    vitalicio: c.duracao_meses == null,
    duracao_meses: c.duracao_meses ? String(c.duracao_meses) : "3",
    valido_de: c.valido_de ?? "",
    valido_ate: c.valido_ate ?? "",
    limite_usos: c.limite_usos ? String(c.limite_usos) : "",
    ativo: c.ativo,
  };
}

const VAZIO = {
  codigo: "", descricao: "", tipo: "percentual", valor: "", recurso: "", planos: [], ciclo: "",
  vitalicio: true, duracao_meses: "3", valido_de: "", valido_ate: "", limite_usos: "", ativo: true,
};

/** Formulário → corpo da ponte (números de verdade e null onde não se aplica). */
function paraEnvio(f, novo) {
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const recursoAdicional = f.tipo === "recurso_adicional";
  const corpo = {
    descricao: f.descricao.trim() || null,
    tipo: f.tipo,
    valor: recursoAdicional && f.recurso === "copiloto_ativo" ? 1 : num(f.valor),
    recurso: recursoAdicional ? f.recurso || null : null,
    planos: f.planos,
    ciclo: f.ciclo || null,
    duracao_meses: f.tipo === "teste_gratis" || f.vitalicio ? null : num(f.duracao_meses),
    valido_de: f.valido_de || null,
    valido_ate: f.valido_ate || null,
    limite_usos: num(f.limite_usos),
    ativo: f.ativo,
  };
  return novo ? { codigo: normalizarCodigo(f.codigo), ...corpo } : corpo;
}

function EditorCupom({ T, catalogo, existente, inicial, nomesEmUso, onSalvo, onFechar }) {
  const novo = !existente;
  const [f, setF] = useState(() => (existente ? deCupom(existente) : { ...VAZIO, ...inicial }));
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));
  const planos = catalogo.planos;

  const codigo = normalizarCodigo(f.codigo);
  const nomeRepetido = novo && nomesEmUso.includes(codigo);
  const nomeInvalido = novo && codigo.length > 0 && !CODIGO_VALIDO.test(codigo);
  const recursoAtivo = f.tipo === "recurso_adicional" && f.recurso === "copiloto_ativo";
  const envio = paraEnvio(f, novo);
  const elegiveis = planos.filter((p) => valeNoPlano(envio, p.id));

  const alternarPlano = (id) =>
    set("planos", f.planos.includes(id) ? f.planos.filter((x) => x !== id) : [...f.planos, id]);

  const trocarRecurso = (r) => {
    // Copiloto ativo só existe como adicional no Enterprise.
    setF((x) => ({ ...x, recurso: r, ...(r === "copiloto_ativo" ? { planos: ["enterprise"], valor: "1" } : {}) }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (nomeRepetido) return setErro(`Já existe um cupom com o nome ${codigo}.`);
    setEnviando(true);
    setErro(null);
    try {
      const r = novo ? await api.novoCupom(envio) : await api.editarCupom(existente.id, envio);
      onSalvo(r.cupom, novo);
      onFechar();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  };

  const tipoAtual = TIPOS.find((t) => t.valor === f.tipo);
  const sufixo = { percentual: "%", valor: "R$ por mês", teste_gratis: "dias", recurso_adicional: "por mês" }[f.tipo];
  const sugestoes =
    f.tipo === "recurso_adicional" && RECURSOS[f.recurso]?.tier
      ? (catalogo.tiers?.[RECURSOS[f.recurso].tier] ?? []).map((t) => t.quantidade).filter((q) => q > 0)
      : f.tipo === "recurso_adicional" && (f.recurso === "medicos" || f.recurso === "secretarias")
        ? [1, 2, 3]
        : f.tipo === "percentual"
          ? [10, 20, 50, 100]
          : f.tipo === "teste_gratis"
            ? [7, 14, 30, 60]
            : [];

  return (
    <Modal T={T} largura={900} titulo={novo ? "Novo cupom" : `Editar cupom ${existente.codigo}`} onFechar={onFechar}>
      <form onSubmit={salvar} style={{ display: "flex", gap: 20, flexWrap: "wrap", maxHeight: "78vh", overflow: "auto" }}>
        {/* Coluna do formulário */}
        <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {novo && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.textMuted }}>Começar de um modelo:</span>
              {MODELOS.map((m) => (
                <Chip key={m.label} T={T} onClick={() => setF({ ...VAZIO, ...m.dados })}>{m.label}</Chip>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 200px" }}>
              <Campo
                T={T}
                label="Nome do cupom (o cliente digita)"
                value={novo ? f.codigo.toUpperCase() : existente.codigo}
                disabled={!novo}
                required
                autoFocus={novo}
                placeholder="Ex.: PRO20"
                onChange={(e) => set("codigo", e.target.value.replace(/\s/g, ""))}
                style={{ fontFamily: "ui-monospace,Menlo,monospace", fontWeight: 700, letterSpacing: 0.5, ...(nomeRepetido || nomeInvalido ? { borderColor: "#DC2626" } : {}) }}
              />
              {nomeRepetido && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>Já existe um cupom com esse nome.</div>}
              {nomeInvalido && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>De 3 a 40 letras, números, - ou _.</div>}
              {!novo && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>O nome não muda depois de criado.</div>}
            </div>
            <div style={{ flex: 1 }}>
              <Campo T={T} label="Descrição interna (opcional)" value={f.descricao} placeholder="Ex.: Campanha congresso de cardiologia" onChange={(e) => set("descricao", e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Rotulo T={T}>Tipo de benefício</Rotulo>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {TIPOS.map((t) => {
                const ativo = f.tipo === t.valor;
                return (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setF((x) => ({ ...x, tipo: t.valor, valor: "", recurso: t.valor === "recurso_adicional" ? x.recurso : "" }))}
                    style={{ padding: "10px 8px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1.5px solid ${ativo ? T.borderHi : T.border}`, background: ativo ? T.accentBg : T.card, color: ativo ? T.accentText : T.text }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{t.icone}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{t.label}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{tipoAtual?.dica}</div>
          </div>

          {f.tipo === "recurso_adicional" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: T.textSub }}>
              Recurso grátis
              <select
                value={f.recurso}
                required
                onChange={(e) => trocarRecurso(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="">Selecione…</option>
                {Object.entries(RECURSOS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
            </label>
          )}

          {!recursoAtivo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 160 }}>
                  <Campo
                    T={T}
                    label={f.tipo === "recurso_adicional" ? "Quantidade extra" : f.tipo === "teste_gratis" ? "Dias grátis" : "Desconto"}
                    type="number"
                    min="0"
                    step={f.tipo === "valor" ? "0.01" : "1"}
                    max={f.tipo === "percentual" ? 100 : undefined}
                    required
                    value={f.valor}
                    onChange={(e) => set("valor", e.target.value)}
                  />
                </div>
                <span style={{ fontSize: 12, color: T.textMuted, marginTop: 16 }}>{sufixo}</span>
              </div>
              {sugestoes.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sugestoes.map((s) => (
                    <Chip key={s} T={T} ativo={Number(f.valor) === s} onClick={() => set("valor", String(s))}>
                      {f.tipo === "percentual" ? `${s}%` : fmtNum(s)}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Rotulo T={T} dica={recursoAtivo ? "Copiloto ativo só é adicional no Enterprise" : "nenhum marcado = qualquer plano"}>Vale para</Rotulo>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip T={T} ativo={f.planos.length === 0} disabled={recursoAtivo} onClick={() => set("planos", [])}>Qualquer plano</Chip>
              {planos.map((p) => (
                <Chip key={p.id} T={T} ativo={f.planos.includes(p.id)} disabled={recursoAtivo} onClick={() => alternarPlano(p.id)}>
                  {p.nome} · {fmtMoeda(p.precoMensal)}
                </Chip>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Rotulo T={T}>Pagamento</Rotulo>
              <div style={{ display: "flex", gap: 6 }}>
                {[["", "Mensal ou anual"], ["mensal", "Só mensal"], ["anual", "Só anual"]].map(([v, l]) => (
                  <Chip key={v} T={T} ativo={f.ciclo === v} onClick={() => set("ciclo", v)}>{l}</Chip>
                ))}
              </div>
            </div>

            {f.tipo !== "teste_gratis" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Rotulo T={T}>Duração do benefício</Rotulo>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Chip T={T} ativo={f.vitalicio} onClick={() => set("vitalicio", true)}>Vitalício</Chip>
                  <Chip T={T} ativo={!f.vitalicio} onClick={() => set("vitalicio", false)}>Por tempo determinado</Chip>
                  {!f.vitalicio && (
                    <>
                      <div style={{ width: 70 }}>
                        <Campo T={T} type="number" min="1" max="120" required value={f.duracao_meses} onChange={(e) => set("duracao_meses", e.target.value)} />
                      </div>
                      <span style={{ fontSize: 12, color: T.textMuted }}>meses</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Rotulo T={T} dica="quando o cupom pode ser usado na contratação">Validade e limite</Rotulo>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ width: 150 }}><Campo T={T} label="De" type="date" value={f.valido_de} onChange={(e) => set("valido_de", e.target.value)} /></div>
              <div style={{ width: 150 }}><Campo T={T} label="Até" type="date" min={f.valido_de || undefined} value={f.valido_ate} onChange={(e) => set("valido_ate", e.target.value)} /></div>
              <div style={{ width: 150 }}><Campo T={T} label="Limite de usos" type="number" min="1" placeholder="Sem limite" value={f.limite_usos} onChange={(e) => set("limite_usos", e.target.value)} /></div>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.text, cursor: "pointer" }}>
            <input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} />
            Cupom ativo (desmarcado, ninguém consegue usar)
          </label>
        </div>

        {/* Coluna da prévia */}
        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div style={{ background: T.accentBg, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.accentText, textTransform: "uppercase", letterSpacing: 0.4 }}>Resumo</div>
            <div style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 16, fontWeight: 800, color: T.text, marginTop: 6 }}>{(novo ? codigo : existente.codigo) || "NOME"}</div>
            <div style={{ fontSize: 13, color: T.text, marginTop: 4, lineHeight: 1.45 }}>
              {f.valor || recursoAtivo ? resumoCupom(envio, planos) : "Preencha o benefício para ver o resumo."}
            </div>
            <div style={{ fontSize: 11, color: T.textSub, marginTop: 6 }}>
              {textoValidade(envio)}{envio.limite_usos ? ` · até ${fmtNum(envio.limite_usos)} usos` : " · sem limite de usos"}
            </div>
          </div>

          <Rotulo T={T}>Como fica para o cliente</Rotulo>
          {elegiveis.map((p) => {
            const r = previaNoPlano(envio, p, catalogo);
            const cor = CORES_PLANO[p.id];
            return (
              <div key={p.id} style={{ border: `1px solid ${T.border}`, borderLeft: `3px solid ${cor}`, borderRadius: 9, padding: "10px 12px", background: T.card, opacity: r.invalido ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: cor }}>{p.nome}</span>
                  {r.bonificado && <Pilula cor="verde">Bonificação total</Pilula>}
                </div>
                {r.desconto > 0 || f.tipo === "percentual" || f.tipo === "valor" ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: T.textMuted, textDecoration: r.desconto ? "line-through" : "none" }}>{fmtMoeda(r.preco)}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: r.bonificado ? "#16A34A" : T.text }}>{fmtMoeda(r.final)}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>/mês{r.anual ? " no anual" : ""}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: T.text, marginTop: 4 }}>{r.extra}</div>
                )}
                {(r.desconto > 0 || r.economia != null) && (
                  <div style={{ fontSize: 11, color: T.textSub, marginTop: 3 }}>
                    {r.desconto > 0 && `−${fmtMoeda(r.desconto)}/mês ${envio.duracao_meses ? `por ${envio.duracao_meses} ${envio.duracao_meses === 1 ? "mês" : "meses"}` : "para sempre"}`}
                    {r.economia != null && ` · economia de ${fmtMoeda(r.economia)}${f.tipo === "teste_gratis" ? " no teste" : " no total"}`}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.4 }}>
            Prévia sobre o preço de pacote de cada plano ({textoPlanos(envio, planos)}). Se o cliente personalizar o plano, o desconto vale sobre a mensalidade montada.
          </div>
        </div>

        <div style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          {erro && <div style={{ fontSize: 12, color: "#DC2626", flex: 1 }}>{erro}</div>}
          <div style={{ flex: erro ? 0 : 1 }} />
          <Botao T={T} type="button" onClick={onFechar}>Cancelar</Botao>
          <Botao T={T} type="submit" variante="primario" disabled={enviando || nomeRepetido || nomeInvalido}>
            {enviando ? "Salvando…" : novo ? "Criar cupom" : "Salvar alterações"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
