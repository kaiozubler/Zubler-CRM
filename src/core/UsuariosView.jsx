// Logins do app (médicos e equipe): busca, edição de nome/e-mail e bloqueio individual.

import { useState } from "react";
import { api } from "./api.js";
import {
  Botao, Campo, Estado, ModalAcesso, ModalForm, PilulaAcesso, Tabela, PAPEIS, fmtData, useBuscaAtrasada, useCarregar,
} from "./ui.jsx";

export default function UsuariosView({ T }) {
  const [busca, setBusca] = useState("");
  const termo = useBuscaAtrasada(busca);
  const lista = useCarregar(() => api.usuarios(termo), [termo]);
  const [modal, setModal] = useState(null);
  const usuarios = lista.dados?.usuarios ?? [];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 380 }}>
          <Campo T={T} placeholder="Buscar por nome, e-mail ou clínica…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {lista.dados && <span style={{ fontSize: 12, color: T.textMuted }}>{usuarios.length} usuário(s)</span>}
      </div>
      <Estado T={T} carregando={lista.carregando && !lista.dados} erro={lista.erro} onTentar={lista.recarregar} />
      {lista.dados && (
        <Tabela
          T={T}
          linhas={usuarios}
          vazio="Nenhum usuário encontrado."
          colunas={[
            { chave: "nome", titulo: "Nome", render: (u) => <div><div style={{ fontWeight: 700 }}>{u.nome ?? "—"}</div><div style={{ fontSize: 11, color: T.textMuted }}>{u.email}</div></div> },
            { chave: "clinica_nome", titulo: "Clínica" },
            { chave: "papel", titulo: "Papel", render: (u) => PAPEIS[u.papel] ?? u.papel },
            { chave: "ultimo_login", titulo: "Último login", render: (u) => fmtData(u.ultimo_login) },
            { chave: "acesso_bloqueado", titulo: "Acesso", render: (u) => <span title={u.bloqueio_motivo ?? ""}><PilulaAcesso bloqueado={u.acesso_bloqueado} /></span> },
            {
              chave: "acoes",
              titulo: "",
              alinhar: "right",
              render: (u) => (
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <Botao T={T} onClick={() => setModal({ tipo: "editar", u })}>Editar</Botao>
                  <Botao T={T} variante={u.acesso_bloqueado ? "primario" : "perigo"} onClick={() => setModal({ tipo: "acesso", u })}>
                    {u.acesso_bloqueado ? "Liberar" : "Bloquear"}
                  </Botao>
                </div>
              ),
            },
          ]}
        />
      )}

      {modal?.tipo === "editar" && (
        <ModalForm
          T={T}
          titulo="Editar usuário"
          campos={[
            { nome: "nome", label: "Nome", obrigatorio: true },
            { nome: "email", label: "E-mail de login", tipo: "email", obrigatorio: true },
          ]}
          inicial={{ nome: modal.u.nome ?? "", email: modal.u.email ?? "" }}
          onEnviar={(v) => {
            const dados = {};
            if (v.nome.trim() !== (modal.u.nome ?? "")) dados.nome = v.nome.trim();
            if (v.email.trim().toLowerCase() !== (modal.u.email ?? "")) dados.email = v.email.trim();
            if (!Object.keys(dados).length) return Promise.resolve();
            return api.editarUsuario(modal.u.id, dados).then(lista.recarregar);
          }}
          onFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "acesso" && (
        <ModalAcesso
          T={T}
          nome={modal.u.nome ?? modal.u.email}
          bloqueado={modal.u.acesso_bloqueado}
          onEnviar={(bloq, motivo) => api.acessoUsuario(modal.u.id, bloq, motivo).then(lista.recarregar)}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
