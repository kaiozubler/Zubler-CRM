// Ponte entre o Zubler CRM e o app (Core Relaunch).
//
// O navegador do CRM nunca vê o CRM_BRIDGE_TOKEN: ele chama esta função com
// o login do Supabase, a função confere se o e-mail está em CRM_ADMIN_EMAILS
// e repassa a chamada para CORE_API_URL/api/public/crm/... com o token.
//
// Secrets (Lovable → Cloud → Secrets):
//   CRM_BRIDGE_TOKEN   mesmo valor configurado no app
//   CORE_API_URL       endereço do app, ex.: https://seu-dominio.com.br
//   CRM_ADMIN_EMAILS   e-mails da equipe Zubler que podem usar o CRM,
//                      separados por vírgula (vazio = ninguém)

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const UUID = "[0-9a-fA-F-]{36}";
// Só as rotas do contrato da ponte passam; qualquer outro caminho é 404 aqui.
const ROTAS: [string, RegExp][] = [
  ["GET", /^clinicas$/],
  ["GET", new RegExp(`^clinicas/${UUID}$`)],
  ["PATCH", new RegExp(`^clinicas/${UUID}$`)],
  ["POST", new RegExp(`^clinicas/${UUID}/acesso$`)],
  ["GET", /^usuarios$/],
  ["PATCH", new RegExp(`^usuarios/${UUID}$`)],
  ["POST", new RegExp(`^usuarios/${UUID}/acesso$`)],
  ["GET", /^pagamentos$/],
  ["POST", /^pagamentos$/],
  ["POST", new RegExp(`^pagamentos/${UUID}/status$`)],
  ["POST", new RegExp(`^contratacoes/${UUID}/ativar$`)],
];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const token = Deno.env.get("CRM_BRIDGE_TOKEN");
  const base = Deno.env.get("CORE_API_URL")?.trim().replace(/\/+$/, "");
  if (!token || !base) {
    console.error("[crm-ponte] CRM_BRIDGE_TOKEN ou CORE_API_URL não configurado");
    return json(500, { error: "Ponte não configurada: faltam os secrets CRM_BRIDGE_TOKEN e CORE_API_URL." });
  }

  // Quem chama: o login do CRM no Supabase.
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Faça login no CRM." });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supabase.auth.getUser(jwt);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return json(401, { error: "Sessão expirada. Entre de novo." });

  const permitidos = (Deno.env.get("CRM_ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!permitidos.includes(email)) {
    return json(403, { error: `O e-mail ${email} não tem acesso ao CRM. Peça para incluí-lo em CRM_ADMIN_EMAILS.` });
  }

  const url = new URL(req.url);
  const caminho = url.pathname.replace(/^.*?\/crm-ponte\/?/, "").replace(/\/+$/, "");
  if (!ROTAS.some(([m, re]) => m === req.method && re.test(caminho))) {
    return json(404, { error: `Rota não permitida: ${req.method} ${caminho}` });
  }

  const destino = new URL(`${base}/api/public/crm/${caminho}`);
  const busca = url.searchParams.get("busca");
  if (busca) destino.searchParams.set("busca", busca);

  try {
    const resp = await fetch(destino, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-CRM-Actor": email,
        ...(req.method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      body: req.method === "GET" ? undefined : await req.text(),
    });
    const texto = await resp.text();
    if (resp.status === 401) {
      console.error("[crm-ponte] o app recusou o CRM_BRIDGE_TOKEN");
      return json(502, { error: "O app recusou o token da ponte: confira se CRM_BRIDGE_TOKEN é igual nos dois projetos." });
    }
    return new Response(texto, {
      status: resp.status,
      headers: { ...CORS, "Content-Type": resp.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[crm-ponte] falha ao chamar o app:", err);
    return json(502, { error: "Não foi possível falar com o app. Confira CORE_API_URL." });
  }
});
