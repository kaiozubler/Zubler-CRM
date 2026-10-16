// Clínicas do app: lista, detalhe, edição cadastral e bloqueio de acesso.

import { useState } from "react";
import { api } from "./api.js";
import {
  Botao, Campo, Estado, ModalAcesso, ModalForm, Pilula, PilulaAcesso, Secao, Tabela, corStatus, fmtData, fmtMoeda,
  PAPEIS, useBuscaAtrasada, useCarregar,
} from "./ui.jsx";
import { NovoPagamentoModal, colunasPagamentos } from "./FinanceiroView.jsx";

export default function ClinicasView({ T }) {
  const [busca, setBusca] = useState("");
  const termo = useBuscaAtrasada(busca);
  const [aberta, setAberta] = useState(null);
  const lista = useCarregar(() => api.clinicas(termo), [termo]);

  if (aberta)
    return <ClinicaDetalhe T={T} id={aberta} onVoltar={() => { setAberta(null); lista.recarregar(); }} />;

  const clinicas = lista.dados?.clinicas ?? [];
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 380 }}>
          <Campo T={T} placeholder="Buscar por nome, e-mail, cidade ou CNPJ…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {lista.dados && <span style={{ fontSize: 12, color: T.textMuted }}>{clinicas.length} clínica(s)</span>}
      </div>
      <Estado T={T} carregando={lista.carregando && !lista.dados} erro={lista.erro} onTentar={lista.recarregar} />
      {lista.dados && (
        <Tabela
          T={T}
          onLinha={(c) => setAberta(c.id)}
          linhas={clinicas}
          vazio="Nenhuma clínica encontrada."
          colunas={[
            { chave: "nome", titulo: "Clínica", render: (c) => <div><div style={{ fontWeight: 700 }}>{c.nome ?? "Sem nome"}</div><div style={{ fontSize: 11, color: T.textMuted }}>{c.email ?? ""}</div></div> },
            { chave: "cidade", titulo: "Cidade", render: (c) => [c.cidade, c.uf].filter(Boolean).join(" / ") || "—" },
            { chave: "plano", titulo: "Plano", render: (c) => <span style={{ textTransform: "capitalize" }}>{c.plano}</span> },
            { chave: "status_assinatura", titulo: "Assinatura", render: (c) => (c.status_assinatura ? <Pilula cor={corStatus(c.status_assinatura)}>{c.status_assinatura}</Pilula> : "—") },
            { chave: "preco_mensal", titulo: "Mensalidade", alinhar: "right", render: (c) => fmtMoeda(c.preco_mensal) },
            { chave: "proxima_cobranca", titulo: "Próx. cobrança", render: (c) => fmtData(c.proxima_cobranca) },
            { chave: "membros", titulo: "Equipe", alinhar: "right" },
            { chave: "acesso_bloqueado", titulo: "Acesso", render: (c) => <PilulaAcesso bloqueado={c.acesso_bloqueado} /> },
          ]}
        />
      )}
    </div>
  );
}

const CAMPOS_CLINICA = [
  { nome: "fantasia", label: "Nome fantasia" },
  { nome: "razao_social", label: "Razão social" },
  { nome: "cnpj_cpf", label: "CNPJ / CPF" },
  { nome: "email", label: "E-mail", tipo: "email" },
  { nome: "telefone", label: "Telefone" },
  { nome: "cidade", label: "Cidade" },
  { nome: "uf", label: "UF", placeholder: "SP" },
];

function ClinicaDetalhe({ T, id, onVoltar }) {
  const det = useCarregar(() => api.clinica(id), [id]);
  const [modal, setModal] = useState(null);
  const d = det.dados;

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Botao T={T} onClick={onVoltar}>← Clínicas</Botao>
        {d && (
          <>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{d.clinica.fantasia || d.clinica.razao_social || d.medico?.nome || "Clínica"}</span>
            <PilulaAcesso bloqueado={d.clinica.acesso_bloqueado} />
            <div style={{ flex: 1 }} />
            <Botao T={T} onClick={() => setModal("editar")}>Editar dados</Botao>
            <Botao T={T} variante={d.clinica.acesso_bloqueado ? "primario" : "perigo"} onClick={() => setModal("acesso")}>
              {d.clinica.acesso_bloqueado ? "Liberar clínica" : "Bloquear clínica"}
            </Botao>
          </>
        )}
      </div>
      <Estado T={T} carregando={det.carregando && !d} erro={det.erro} onTentar={det.recarregar} />

      {d && (
        <>
          {d.clinica.acesso_bloqueado && (
            <div style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: 12 }}>
              Acesso bloqueado para o médico e toda a equipe{d.clinica.bloqueio_motivo ? `: ${d.clinica.bloqueio_motivo}` : "."}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            <Cartao T={T} titulo="Dados cadastrais" itens={[
              ["Razão social", d.clinica.razao_social], ["CNPJ / CPF", d.clinica.cnpj_cpf], ["E-mail", d.clinica.email],
              ["Telefone", d.clinica.telefone], ["Cidade", [d.clinica.cidade, d.clinica.uf].filter(Boolean).join(" / ")],
            ]} />
            <Cartao T={T} titulo="Assinatura" itens={d.assinatura ? [
              ["Plano", `${d.assinatura.plano} (${d.assinatura.ciclo})`],
              ["Status", <Pilula key="s" cor={corStatus(d.assinatura.status)}>{d.assinatura.status}</Pilula>],
              ["Mensalidade", fmtMoeda(d.assinatura.preco_mensal)],
              ["Próxima cobrança", fmtData(d.assinatura.proxima_cobranca)],
              ["Licenças", `${d.assinatura.medicos} médico(s), ${d.assinatura.secretarias} da equipe`],
              ...(d.assinatura.cancelamento_agendado_para ? [["Cancela em", fmtData(d.assinatura.cancelamento_agendado_para)]] : []),
            ] : [["Plano", "Free (sem assinatura)"]]} />
          </div>

          <Secao T={T} titulo="Pessoas">
            <Tabela
              T={T}
              linhas={[d.medico, ...d.membros].filter(Boolean)}
              colunas={[
                { chave: "nome", titulo: "Nome", render: (u) => u.nome ?? "—" },
                { chave: "email", titulo: "E-mail" },
                { chave: "papel", titulo: "Papel", render: (u) => PAPEIS[u.papel] ?? u.papel },
                { chave: "ultimo_login", titulo: "Último login", render: (u) => fmtData(u.ultimo_login) },
                { chave: "acesso_bloqueado", titulo: "Acesso", render: (u) => <PilulaAcesso bloqueado={u.acesso_bloqueado} /> },
              ]}
            />
          </Secao>

          <Secao T={T} titulo="Pagamentos" acao={<Botao T={T} variante="primario" onClick={() => setModal("pagamento")}>Registrar pagamento</Botao>}>
            <Tabela T={T} linhas={d.pagamentos} colunas={colunasPagamentos(T)} vazio="Nenhum pagamento registrado." />
          </Secao>
        </>
      )}

      {modal === "editar" && d && (
        <ModalForm
          T={T}
          titulo="Editar dados da clínica"
          campos={CAMPOS_CLINICA}
          inicial={Object.fromEntries(CAMPOS_CLINICA.map((c) => [c.nome, d.clinica[c.nome] ?? ""]))}
          onEnviar={(v) => {
            // Só manda o que mudou; campo apagado vira null.
            const mudou = Object.fromEntries(
              Object.entries(v)
                .filter(([k, val]) => (val || null) !== (d.clinica[k] || null))
                .map(([k, val]) => [k, val.trim() || null]),
            );
            if (!Object.keys(mudou).length) return Promise.resolve();
            return api.editarClinica(id, mudou).then(det.recarregar);
          }}
          onFechar={() => setModal(null)}
        />
      )}
      {modal === "acesso" && d && (
        <ModalAcesso
          T={T}
          nome="a clínica (médico e equipe)"
          bloqueado={d.clinica.acesso_bloqueado}
          onEnviar={(bloq, motivo) => api.acessoClinica(id, bloq, motivo).then(det.recarregar)}
          onFechar={() => setModal(null)}
        />
      )}
      {modal === "pagamento" && (
        <NovoPagamentoModal T={T} clinicaId={id} onSalvo={det.recarregar} onFechar={() => setModal(null)} />
      )}
    </div>
  );
}

function Cartao({ T, titulo, itens }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{titulo}</div>
      {itens.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
          <span style={{ color: T.textMuted }}>{k}</span>
          <span style={{ color: T.text, fontWeight: 600, textAlign: "right", textTransform: k === "Plano" ? "capitalize" : "none" }}>{v || "—"}</span>
        </div>
      ))}
    </div>
  );
}
