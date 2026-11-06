// Regras de exibição dos cupons no CRM: texto do benefício, situação e a
// prévia de quanto o cliente paga em cada plano. Quem decide de verdade se o
// cupom vale na contratação é o app (src/lib/cupons/regras.ts no ideia14kaio);
// aqui é só para a equipe enxergar o efeito antes de salvar.

import { fmtData, fmtMoeda } from "./ui.jsx";

export const TIPOS = [
  { valor: "percentual", label: "Porcentagem", icone: "%", dica: "Ex.: 20% na mensalidade. 100% = uso bonificado." },
  { valor: "valor", label: "Valor fixo", icone: "R$", dica: "Ex.: R$ 50 a menos por mês. Nunca fica negativo." },
  { valor: "teste_gratis", label: "Teste grátis", icone: "⏱", dica: "Dias sem cobrança antes da primeira mensalidade." },
  { valor: "recurso_adicional", label: "Recurso grátis", icone: "＋", dica: "Franquia ou licença extra por mês, sem custo." },
];

export const RECURSOS = {
  copiloto: { label: "Consultas de Copiloto", unidade: "consultas de Copiloto", tier: "copiloto" },
  whatsapp: { label: "Conversas de WhatsApp", unidade: "conversas de WhatsApp", tier: "whatsapp" },
  video: { label: "Minutos de vídeo", unidade: "min de vídeo", tier: "video" },
  medicos: { label: "Médicos adicionais", unidade: "médico(s)" },
  secretarias: { label: "Usuários de gestão", unidade: "usuário(s) de gestão" },
  copiloto_ativo: { label: "Copiloto ativo (Enterprise)", unidade: "Copiloto ativo" },
};

export const fmtNum = (n) => Number(n).toLocaleString("pt-BR");
const dinheiro = (v) => Math.round(v * 100) / 100;
export const hojeIso = () => new Date().toISOString().slice(0, 10);

export const normalizarCodigo = (c) => (c ?? "").trim().toUpperCase();
export const CODIGO_VALIDO = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

/** "20% de desconto", "+5.000 conversas de WhatsApp/mês"... */
export function textoBeneficio(c) {
  const v = Number(c.valor);
  if (c.tipo === "percentual") return v >= 100 ? "100% de desconto (bonificação)" : `${fmtNum(v)}% de desconto`;
  if (c.tipo === "valor") return `${fmtMoeda(v)} de desconto/mês`;
  if (c.tipo === "teste_gratis") return `${fmtNum(v)} dias grátis`;
  if (c.recurso === "copiloto_ativo") return "Copiloto ativo grátis";
  const r = RECURSOS[c.recurso];
  return r ? `+${fmtNum(v)} ${r.unidade}/mês` : "Recurso adicional";
}

export function textoPlanos(c, planos) {
  if (!c.planos?.length) return "qualquer plano";
  const nomes = c.planos.map((id) => planos?.find((p) => p.id === id)?.nome ?? id);
  return `plano ${nomes.join(" ou ")}`;
}

export function textoDuracao(c) {
  if (c.tipo === "teste_gratis") return "na contratação";
  if (!c.duracao_meses) return "vitalício";
  return c.duracao_meses === 1 ? "na 1ª mensalidade" : `por ${c.duracao_meses} meses`;
}

/** Frase completa: "20% de desconto no plano Pro por 3 meses (pagamento anual)". */
export function resumoCupom(c, planos) {
  const ciclo = c.ciclo ? ` · pagamento ${c.ciclo}` : "";
  return `${textoBeneficio(c)} no ${textoPlanos(c, planos)}, ${textoDuracao(c)}${ciclo}`;
}

export function textoValidade(c) {
  if (!c.valido_de && !c.valido_ate) return "Sem prazo";
  if (c.valido_de && c.valido_ate) return `${fmtData(c.valido_de)} a ${fmtData(c.valido_ate)}`;
  return c.valido_ate ? `Até ${fmtData(c.valido_ate)}` : `A partir de ${fmtData(c.valido_de)}`;
}

/** Situação do cupom hoje, na mesma ordem em que o app recusa. */
export function situacao(c, hoje = hojeIso()) {
  if (!c.ativo) return { chave: "inativo", label: "Inativo", cor: "cinza" };
  if (c.valido_ate && hoje > c.valido_ate) return { chave: "expirado", label: "Expirado", cor: "vermelho" };
  if (c.limite_usos != null && (c.usos ?? 0) >= c.limite_usos) return { chave: "esgotado", label: "Esgotado", cor: "vermelho" };
  if (c.valido_de && hoje < c.valido_de) return { chave: "agendado", label: "Agendado", cor: "amarelo" };
  return { chave: "ativo", label: "Ativo", cor: "verde" };
}

export function valeNoPlano(c, planoId) {
  return !c.planos?.length || c.planos.includes(planoId);
}

/**
 * Prévia por plano: preço da mensalidade de pacote (com o desconto anual se o
 * cupom for só do anual), quanto fica com o cupom e o que muda.
 */
export function previaNoPlano(c, plano, catalogo) {
  const anual = c.ciclo === "anual";
  const preco = dinheiro(plano.precoMensal * (anual ? 1 - (catalogo?.desconto_anual ?? 0) : 1));
  const v = Number(c.valor) || 0;
  const base = { preco, anual, final: preco, desconto: 0, extra: null, economia: null, bonificado: false };

  if (c.tipo === "percentual" || c.tipo === "valor") {
    const desconto = dinheiro(c.tipo === "percentual" ? (preco * Math.min(v, 100)) / 100 : Math.min(v, preco));
    const final = dinheiro(preco - desconto);
    return {
      ...base,
      desconto,
      final,
      bonificado: v > 0 && final === 0,
      economia: c.duracao_meses ? dinheiro(desconto * c.duracao_meses) : null,
    };
  }
  if (c.tipo === "teste_gratis") {
    return { ...base, extra: `${fmtNum(v)} dias sem cobrança, depois ${fmtMoeda(preco)}/mês`, economia: dinheiro((preco / 30) * v) };
  }
  // recurso adicional
  const r = RECURSOS[c.recurso];
  if (!r) return { ...base, extra: "Escolha o recurso" };
  if (c.recurso === "copiloto_ativo") {
    if (plano.copilotoAtivo === "incluido") return { ...base, extra: "Já incluído neste plano", invalido: true };
    if (plano.copilotoAtivo === "indisponivel") return { ...base, extra: "Não existe neste plano", invalido: true };
    const valorAtivo = dinheiro(plano.copiloto * (catalogo?.adicionais?.copiloto_ativo_por_consulta ?? 0) - 0.1);
    return { ...base, extra: `Modo ativo liberado (vale ${fmtMoeda(valorAtivo)}/mês)` };
  }
  if (c.recurso === "medicos" || c.recurso === "secretarias") {
    const unit = c.recurso === "medicos" ? catalogo?.adicionais?.medico : catalogo?.adicionais?.secretaria;
    const atual = plano[c.recurso];
    return { ...base, extra: `${atual} → ${atual + v} ${r.unidade} (vale ${fmtMoeda((unit ?? 0) * v)}/mês)` };
  }
  const atual = plano[r.tier] ?? 0;
  return { ...base, extra: `Franquia ${fmtNum(atual)} → ${fmtNum(atual + v)} ${r.unidade}/mês` };
}

/** Modelos rápidos no editor. */
export const MODELOS = [
  { label: "20% no Pro por 3 meses", dados: { codigo: "PRO20", tipo: "percentual", valor: "20", planos: ["pro"], vitalicio: false, duracao_meses: "3" } },
  { label: "+5.000 WhatsApp em qualquer plano", dados: { codigo: "WHATS5000", tipo: "recurso_adicional", recurso: "whatsapp", valor: "5000", planos: [], vitalicio: true } },
  { label: "30 dias grátis", dados: { codigo: "TESTE30", tipo: "teste_gratis", valor: "30", planos: [], vitalicio: true } },
  { label: "Bonificação 100% vitalícia", dados: { codigo: "PARCEIRO100", tipo: "percentual", valor: "100", planos: [], vitalicio: true } },
];
