// Login da equipe Zubler. O CRM mexe em clínicas, acessos e pagamentos do
// app, então só entra quem tem conta no Supabase do CRM; quem pode usar a
// ponte é decidido na Edge Function (CRM_ADMIN_EMAILS).

import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./api.js";

const caixa = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#F0F2F7", fontFamily: "Inter,system-ui,sans-serif", padding: 16,
};
const cartao = {
  width: "100%", maxWidth: 360, background: "#fff", borderRadius: 14, padding: 28,
  boxShadow: "0 10px 30px rgba(17,24,39,0.08)", display: "flex", flexDirection: "column", gap: 12,
};
const input = {
  padding: "10px 12px", borderRadius: 8, border: "1px solid #E4E8F0", fontSize: 13, fontFamily: "inherit",
};

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#EEF1FD", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B55D4", fontSize: 18 }}>♥</div>
      <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Zubler CRM</span>
    </div>
  );
}

function TelaLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    setEntrando(false);
  };

  return (
    <div style={caixa}>
      <form onSubmit={entrar} style={cartao}>
        <Logo />
        <input style={input} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <input style={input} type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <div style={{ fontSize: 12, color: "#DC2626" }}>{erro}</div>}
        <button
          type="submit"
          disabled={entrando}
          style={{ padding: 10, borderRadius: 8, border: "none", background: "#4F6BED", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
        <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5 }}>
          Acesso restrito à equipe Zubler. As contas são criadas no painel do Lovable (Cloud → Users).
        </div>
      </form>
    </div>
  );
}

export default function ExigirLogin({ children }) {
  const [sessao, setSessao] = useState(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigurado)
    return (
      <div style={caixa}>
        <div style={cartao}>
          <Logo />
          <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6 }}>
            O CRM ainda não está ligado ao Supabase. Ative o Lovable Cloud neste projeto (ele preenche
            <code> VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>) e publique de novo.
          </div>
        </div>
      </div>
    );
  if (sessao === undefined) return <div style={{ ...caixa, color: "#9CA3AF", fontSize: 13 }}>Carregando…</div>;
  if (!sessao) return <TelaLogin />;
  return children(sessao);
}
