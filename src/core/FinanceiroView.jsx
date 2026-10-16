// Financeiro do app: pagamentos (manuais + Asaas), inadimplentes e
// contratações pagas que ainda não viraram assinatura.

import { useState } from "react";
import { api } from "./api.js";
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

export default function FinanceiroView({ T }) {
  const fin = useCarregar(() => api.pagamentos(), []);
  const [modal, setModal] = useState(null);
  const [clinicas, setClinicas] = useState(null);
  const d = fin.dados;

  const abrirNovo = async () => {
    setModal({ tipo: "novo" });
    if (!clinicas) api.clinicas().then((r) => setClinicas(r.clinicas)).catch(() => setClinicas([]));
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 22 }}>
      <Estado T={T} carregando={fin.carregando && !d} erro={fin.erro} onTentar={fin.recarregar} />
      {d && (
        <>
          <Secao T={T} titulo={`Inadimplentes (${d.inadimplentes.length})`}>
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
          </Secao>

          <Secao T={T} titulo={`Contratações pagas sem assinatura (${d.contratacoes_pendentes.length})`}>
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
          </Secao>

          <Secao T={T} titulo="Pagamentos (últimos 200)" acao={<Botao T={T} variante="primario" onClick={abrirNovo}>Registrar pagamento</Botao>}>
            <Tabela
              T={T}
              linhas={d.pagamentos}
              vazio="Nenhum pagamento registrado."
              colunas={colunasPagamentos(T, { comClinica: true, onEstornar: (p) => setModal({ tipo: "estornar", item: p }) })}
            />
          </Secao>
        </>
      )}

      {modal?.tipo === "novo" && (
        <NovoPagamentoModal T={T} clinicas={clinicas} onSalvo={fin.recarregar} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === "estornar" && (
        <ModalForm
          T={T}
          titulo={`Estornar ${fmtMoeda(modal.item.valor)} de ${modal.item.clinica_nome ?? "clínica"}`}
          campos={[{ nome: "motivo", label: "Motivo do estorno", obrigatorio: true }]}
          textoBotao="Estornar"
          variante="perigo"
          onEnviar={(v) => api.statusPagamento(modal.item.id, "estornado", v.motivo).then(fin.recarregar)}
          onFechar={() => setModal(null)}
        />
      )}
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
