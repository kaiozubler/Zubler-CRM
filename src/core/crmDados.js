// Dados que só existem no CRM (cadastro manual do lead e timeline), guardados
// no Supabase do próprio CRM — não passam pela ponte nem vão para o app.
// Tabelas: supabase/migrations/20261111180000_crm_lead_dados_e_timeline.sql

import { supabase } from "./api.js";

function erroAmigavel(error) {
  // Tabela ainda não criada (migração não aplicada).
  if (error?.code === "42P01" || error?.code === "PGRST205" || /does not exist|schema cache/i.test(error?.message ?? "")) {
    return new Error("As tabelas do CRM ainda não foram criadas. Aplique a migração crm_lead_dados_e_timeline no Supabase.");
  }
  return new Error(error?.message ?? "Erro ao falar com o banco do CRM.");
}

async function emailDaSessao() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

export async function carregarLead(chave) {
  const { data, error } = await supabase.from("crm_lead_dados").select("*").eq("chave", chave).maybeSingle();
  if (error) throw erroAmigavel(error);
  return data;
}

/** Salva o cadastro manual e registra a edição na timeline. */
export async function salvarLead(chave, dados, camposAlterados) {
  const email = await emailDaSessao();
  const { data, error } = await supabase
    .from("crm_lead_dados")
    .upsert({ chave, dados, atualizado_por: email, atualizado_em: new Date().toISOString() })
    .select()
    .single();
  if (error) throw erroAmigavel(error);
  if (camposAlterados?.length) {
    await novoEvento(chave, { tipo: "edicao", titulo: "Cadastro atualizado", descricao: camposAlterados.join(", ") }).catch(() => {});
  }
  return data;
}

export async function listarTimeline(chave) {
  const { data, error } = await supabase.from("crm_timeline").select("*").eq("chave", chave).order("data", { ascending: false });
  if (error) throw erroAmigavel(error);
  return data;
}

export async function novoEvento(chave, { tipo, titulo, descricao, data }) {
  const email = await emailDaSessao();
  const { data: linha, error } = await supabase
    .from("crm_timeline")
    .insert({ chave, tipo, titulo, descricao: descricao || null, data: data || new Date().toISOString(), autor_email: email })
    .select()
    .single();
  if (error) throw erroAmigavel(error);
  return linha;
}

export async function apagarEvento(id) {
  const { error } = await supabase.from("crm_timeline").delete().eq("id", id);
  if (error) throw erroAmigavel(error);
}
