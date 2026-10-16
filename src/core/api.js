// Acesso aos dados do app (clínicas, usuários, pagamentos) pela Edge Function
// crm-ponte, que guarda o CRM_BRIDGE_TOKEN no servidor. O navegador só manda
// o login do Supabase.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = supabaseConfigurado
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

async function ponte(metodo, caminho, corpo) {
  const { data } = await supabase.auth.getSession();
  const sessao = data.session;
  if (!sessao) throw new Error("Sessão expirada. Entre de novo.");
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/crm-ponte/${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${sessao.access_token}`,
      apikey: SUPABASE_KEY,
      ...(corpo ? { "Content-Type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Erro ${resp.status} ao falar com o app.`);
  return json;
}

const q = (busca) => (busca ? `?busca=${encodeURIComponent(busca)}` : "");

export const api = {
  clinicas: (busca) => ponte("GET", `clinicas${q(busca)}`),
  clinica: (id) => ponte("GET", `clinicas/${id}`),
  editarClinica: (id, dados) => ponte("PATCH", `clinicas/${id}`, dados),
  acessoClinica: (id, bloqueado, motivo) => ponte("POST", `clinicas/${id}/acesso`, { bloqueado, motivo }),
  usuarios: (busca) => ponte("GET", `usuarios${q(busca)}`),
  editarUsuario: (id, dados) => ponte("PATCH", `usuarios/${id}`, dados),
  acessoUsuario: (id, bloqueado, motivo) => ponte("POST", `usuarios/${id}/acesso`, { bloqueado, motivo }),
  pagamentos: () => ponte("GET", "pagamentos"),
  novoPagamento: (dados) => ponte("POST", "pagamentos", dados),
  statusPagamento: (id, status, motivo) => ponte("POST", `pagamentos/${id}/status`, { status, motivo }),
  ativarContratacao: (id, medico_email) => ponte("POST", `contratacoes/${id}/ativar`, { medico_email }),
};
