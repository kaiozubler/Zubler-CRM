// Peças de interface das telas ligadas ao app (Clínicas, Usuários,
// Financeiro), no mesmo estilo inline do CustomerSuccessApp.

import { useCallback, useEffect, useState } from "react";

export const fmtMoeda = (v) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtData = (v) => {
  if (!v) return "—";
  const d = new Date(String(v).length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR");
};

/** Carrega dados assíncronos com estado de carregando/erro e um recarregar(). */
export function useCarregar(fn, deps) {
  const [estado, setEstado] = useState({ dados: null, erro: null, carregando: true });
  const recarregar = useCallback(() => {
    setEstado((e) => ({ ...e, carregando: true, erro: null }));
    fn()
      .then((dados) => setEstado({ dados, erro: null, carregando: false }))
      .catch((err) => setEstado({ dados: null, erro: err.message, carregando: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(recarregar, [recarregar]);
  return { ...estado, recarregar };
}

export function Botao({ T, children, variante = "normal", style, ...props }) {
  const cores = {
    normal: { background: T.card, color: T.text, border: `1px solid ${T.border}` },
    primario: { background: "#4F6BED", color: "#fff", border: "1px solid #4F6BED" },
    perigo: { background: "transparent", color: "#DC2626", border: "1px solid #FCA5A5" },
  }[variante];
  return (
    <button
      {...props}
      style={{
        ...cores,
        padding: "6px 12px",
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 600,
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Campo({ T, label, style, ...props }) {
  const input = (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "7px 10px",
        borderRadius: 7,
        border: `1px solid ${T.border}`,
        background: T.bg,
        color: T.text,
        fontSize: 12,
        fontFamily: "inherit",
        ...style,
      }}
    />
  );
  if (!label) return input;
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: T.textSub }}>
      {label}
      {input}
    </label>
  );
}

export function Pilula({ cor, children }) {
  const cores = {
    verde: ["#F0FDF4", "#16A34A"],
    amarelo: ["#FFFBEB", "#B45309"],
    vermelho: ["#FEF2F2", "#DC2626"],
    cinza: ["#F3F4F6", "#4B5563"],
    azul: ["#EEF1FD", "#3B55D4"],
  }[cor] ?? ["#F3F4F6", "#4B5563"];
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: cores[0], color: cores[1], whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// Papéis do app e status/métodos que o Asaas devolve em inglês.
export const PAPEIS = { medico: "Médico(a)", secretaria: "Secretária", enfermeiro: "Enfermagem" };
export const STATUS_ASAAS = {
  PENDING: "pendente", RECEIVED: "recebido", CONFIRMED: "confirmado", OVERDUE: "vencido",
  REFUNDED: "estornado", RECEIVED_IN_CASH: "recebido", REFUND_REQUESTED: "estorno pedido",
};
export const METODOS_ASAAS = { PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão", UNDEFINED: "—" };

export const corStatus = (s) =>
  ({ ativa: "verde", confirmado: "verde", recebido: "verde", vencido: "vermelho", inadimplente: "vermelho", estornado: "vermelho", cancelada: "cinza", pendente: "amarelo" })[s] ??
  "cinza";

export function Tabela({ T, colunas, linhas, vazio = "Nada por aqui.", onLinha }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 10, background: T.card }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th
                key={c.chave}
                style={{ textAlign: c.alinhar ?? "left", padding: "9px 12px", fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={colunas.length} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                {vazio}
              </td>
            </tr>
          )}
          {linhas.map((l, i) => (
            <tr
              key={l.id ?? i}
              onClick={onLinha ? () => onLinha(l) : undefined}
              style={{ cursor: onLinha ? "pointer" : "default", borderTop: i ? `1px solid ${T.border}` : "none" }}
              onMouseEnter={(e) => onLinha && (e.currentTarget.style.background = T.cardHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {colunas.map((c) => (
                <td key={c.chave} style={{ padding: "9px 12px", color: T.text, textAlign: c.alinhar ?? "left", verticalAlign: "middle" }}>
                  {c.render ? c.render(l) : (l[c.chave] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ T, titulo, onFechar, children }) {
  return (
    <div
      onClick={onFechar}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: T.surface, color: T.text, borderRadius: 12, padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 20px 50px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * Formulário em modal: campos simples, envia `onEnviar(valores)` e mostra o
 * erro da ponte sem fechar.
 */
export function ModalForm({ T, titulo, campos, inicial = {}, textoBotao = "Salvar", variante = "primario", onEnviar, onFechar }) {
  const [valores, setValores] = useState(inicial);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await onEnviar(valores);
      onFechar();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  };
  return (
    <Modal T={T} titulo={titulo} onFechar={onFechar}>
      <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {campos.map((c, i) =>
          c.opcoes ? (
            <label key={c.nome} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: T.textSub }}>
              {c.label}
              <select
                value={valores[c.nome] ?? ""}
                required={c.obrigatorio}
                onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
                style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="">Selecione…</option>
                {c.opcoes.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Campo
              key={c.nome}
              T={T}
              label={c.label}
              type={c.tipo ?? "text"}
              step={c.tipo === "number" ? "0.01" : undefined}
              required={c.obrigatorio}
              autoFocus={i === 0}
              placeholder={c.placeholder}
              value={valores[c.nome] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
            />
          ),
        )}
        {erro && <div style={{ fontSize: 12, color: "#DC2626" }}>{erro}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Botao T={T} type="button" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao T={T} type="submit" variante={variante} disabled={enviando}>
            {enviando ? "Aguarde…" : textoBotao}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

export function Estado({ T, carregando, erro, onTentar }) {
  if (carregando) return <div style={{ padding: 24, fontSize: 12, color: T.textMuted }}>Carregando…</div>;
  if (erro)
    return (
      <div style={{ padding: 16, borderRadius: 10, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontSize: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <span>{erro}</span>
        {onTentar && (
          <Botao T={T} onClick={onTentar}>
            Tentar de novo
          </Botao>
        )}
      </div>
    );
  return null;
}

export function Secao({ T, titulo, acao, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.text }}>{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function useBuscaAtrasada(valor, ms = 300) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

export function PilulaAcesso({ bloqueado }) {
  return bloqueado ? <Pilula cor="vermelho">Bloqueado</Pilula> : <Pilula cor="verde">Liberado</Pilula>;
}

export function ModalAcesso({ T, nome, bloqueado, onEnviar, onFechar }) {
  return bloqueado ? (
    <ModalForm
      T={T}
      titulo={`Liberar acesso de ${nome}`}
      campos={[]}
      textoBotao="Liberar acesso"
      onEnviar={() => onEnviar(false, null)}
      onFechar={onFechar}
    />
  ) : (
    <ModalForm
      T={T}
      titulo={`Bloquear acesso de ${nome}`}
      campos={[{ nome: "motivo", label: "Motivo (aparece só no CRM)", obrigatorio: true, placeholder: "Ex.: inadimplência desde 05/10" }]}
      textoBotao="Bloquear acesso"
      variante="perigo"
      onEnviar={(v) => onEnviar(true, v.motivo)}
      onFechar={onFechar}
    />
  );
}
