import { useState, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// THEME TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg: "#F0F2F7", surface: "#FFFFFF", card: "#FFFFFF", cardHover: "#F7F9FF",
    border: "#E4E8F0", borderHi: "#4F6BED", text: "#111827", textSub: "#4B5563",
    textMuted: "#9CA3AF", accentBg: "#EEF1FD", accentText: "#3B55D4", shadow: "0 1px 3px rgba(0,0,0,0.08)",
    shadowCard: "0 1px 4px rgba(0,0,0,0.06)", dropZone: "#EEF1FD", dropBorder: "#4F6BED",
  },
  dark: {
    bg: "#0E1420", surface: "#151D2E", card: "#1C2640", cardHover: "#1F2D4A",
    border: "#1E2D45", borderHi: "#4F6BED", text: "#E8EEF7", textSub: "#8BA3C4",
    textMuted: "#4A6080", accentBg: "#1A2550", accentText: "#A3B4F7", shadow: "0 1px 3px rgba(0,0,0,0.4)",
    shadowCard: "0 2px 8px rgba(0,0,0,0.3)", dropZone: "#1A2550", dropBorder: "#4F6BED",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const ONBOARDING_STAGES = [
  { id:"kickoff", name:"Kick-off" }, { id:"setup", name:"Setup" }, { id:"capacitacao", name:"Capacitação" },
  { id:"validacao", name:"Validação" }, { id:"checkout", name:"Check-out" },
];
const ONGOING_STAGES = [
  { id:"ativacao", name:"Ativação" }, { id:"customer-success", name:"Customer Success" },
  { id:"expansao", name:"Expansão" }, { id:"renovacao", name:"Renovação" },
  { id:"risco", name:"Risco" }, { id:"sucesso", name:"Sucesso" },
];
const ALL_STAGES = [...ONBOARDING_STAGES, ...ONGOING_STAGES];

const INITIAL_CLIENTS = [
  { id:1, name:"Acme Corp", razao:"Acme Comércio Ltda", hs:87, mrr:4800, status:"engaged", owner:"Ana S.", ownerInit:"AS", ownerHue:0, funnel:"ongoing", stage:"customer-success", plan:"Pro", launchDate:"2024-01-15" },
  { id:2, name:"Betasoft", razao:"Betasoft Tecnologia S.A.", hs:62, mrr:2200, status:"warm", owner:"Carlos M.", ownerInit:"CM", ownerHue:160, funnel:"ongoing", stage:"ativacao", plan:"Starter", launchDate:"2024-03-10" },
  { id:3, name:"Gamma Log.", razao:"Gamma Log. e Transp. EIRELI", hs:34, mrr:6500, status:"cold", owner:"Ana S.", ownerInit:"AS", ownerHue:0, funnel:"ongoing", stage:"risco", plan:"Enterprise", launchDate:"2023-11-20" },
  { id:4, name:"Delta RH", razao:"Delta Recursos Humanos Ltda", hs:91, mrr:3100, status:"engaged", owner:"Bruna L.", ownerInit:"BL", ownerHue:280, funnel:"ongoing", stage:"expansao", plan:"Pro", launchDate:"2024-02-08" },
  { id:5, name:"Épsilon Tech", razao:"Épsilon Tecnologia EIRELI", hs:55, mrr:1800, status:"warm", owner:"Carlos M.", ownerInit:"CM", ownerHue:160, funnel:"onboarding", stage:"capacitacao", plan:"Starter", launchDate:"2024-05-01" },
  { id:6, name:"Zeta Saúde", razao:"Zeta Saúde e Bem-Estar S.A.", hs:78, mrr:5200, status:"engaged", owner:"Bruna L.", ownerInit:"BL", ownerHue:280, funnel:"onboarding", stage:"kickoff", plan:"Pro", launchDate:"2024-04-22" },
  { id:7, name:"Eta Seguros", razao:"Eta Seguros e Previdência Ltda", hs:22, mrr:9100, status:"cold", owner:"Ana S.", ownerInit:"AS", ownerHue:0, funnel:"ongoing", stage:"risco", plan:"Enterprise", launchDate:"2023-09-05" },
  { id:8, name:"Theta Edtech", razao:"Theta Educação Digital Ltda", hs:95, mrr:2700, status:"engaged", owner:"Carlos M.", ownerInit:"CM", ownerHue:160, funnel:"ongoing", stage:"sucesso", plan:"Pro", launchDate:"2024-01-30" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const hsColor = (v) => v >= 75 ? "#16A34A" : v >= 50 ? "#D97706" : "#DC2626";
const fmtMrr = (v) => "R$\u00a0" + v.toLocaleString("pt-BR");
const statusCfg = {
  engaged: { label:"Engajado", light:{ bg:"#F0FDF4", text:"#16A34A" }, dark:{ bg:"#0D2B1F", text:"#6EE7B7" } },
  warm: { label:"Morno", light:{ bg:"#FFFBEB", text:"#D97706" }, dark:{ bg:"#2D1F00", text:"#FCD34D" } },
  cold: { label:"Frio", light:{ bg:"#EFF6FF", text:"#2563EB" }, dark:{ bg:"#0D1F3D", text:"#93C5FD" } },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ initials, hue, size = 22 }) {
  const bg = `hsl(${hue},55%,90%)`;
  const txt = `hsl(${hue},55%,28%)`;
  return <div style={{ width:size, height:size, borderRadius:"50%", background:bg, color:txt, display:"flex", alignItems:"center", justifyContent:"center", fontSize: Math.round(size * 0.37), fontWeight:700, flexShrink:0, userSelect:"none" }}>{initials}</div>;
}

function Badge({ status, isDark }) {
  const cfg = statusCfg[status];
  const col = isDark ? cfg.dark : cfg.light;
  return <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:600, background:col.bg, color:col.text }}>{cfg.label}</span>;
}

function HsBar({ value, isDark }) {
  const col = hsColor(value);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ flex:1, height:4, borderRadius:2, background: isDark ? "#1E2D45" : "#E4E8F0", overflow:"hidden" }}>
        <div style={{ width:`${value}%`, height:"100%", background:col, borderRadius:2 }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:col, minWidth:22, textAlign:"right" }}>{value}</span>
    </div>
  );
}

function KanbanCard({ client, isDark, T, onDragStart, onCardClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div draggable onDragStart={() => onDragStart(client.id)} onClick={() => onCardClick(client)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? T.cardHover : T.card, border:`1.5px solid ${hov ? T.borderHi : T.border}`,
        borderRadius:10, padding:"10px 12px", cursor:"grab", boxShadow: hov ? T.shadow : T.shadowCard,
        transition:"all 0.15s", userSelect:"none", width:"100%" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:6, marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:700, color:T.text, lineHeight:1.3 }}>{client.name}</span>
        <Badge status={client.status} isDark={isDark}/>
      </div>
      <HsBar value={client.hs} isDark={isDark}/>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
        <span style={{ fontSize:11, fontWeight:600, color:T.textSub }}>{fmtMrr(client.mrr)}</span>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <Avatar initials={client.ownerInit} hue={client.ownerHue} size={18}/>
          <span style={{ fontSize:10, color:T.textMuted }}>{client.owner.split(" ")[0]}</span>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, clients, isDark, T, dragOverId, onDragStart, onDragOver, onDrop, onCardClick, groupBy }) {
  const isOver = dragOverId === stage.id;
  const mrr = clients.reduce((s,c)=>s+c.mrr,0);
  const [expanded, setExpanded] = useState({});
  const [showTooltip, setShowTooltip] = useState(false);

  const groupKey = (c) => groupBy === "owner" ? c.owner : groupBy === "status" ? statusCfg[c.status].label : c.plan;
  const groupedClients = groupBy !== "none"
    ? clients.reduce((acc, c) => {
        const key = groupKey(c);
        const g = acc.find(x => x.key === key);
        if (g) g.clients.push(c);
        else acc.push({ key, ownerInit: c.ownerInit, ownerHue: c.ownerHue, status: c.status, clients: [c] });
        return acc;
      }, []).map(g => ({ ...g, expanded: expanded[g.key] !== false }))
    : [];

  return (
    <div style={{ width:188, flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ padding:"8px 12px", borderRadius:8, background: isOver ? T.accentBg : T.surface,
        border:`1.5px solid ${isOver ? T.dropBorder : T.border}`, transition:"all 0.15s", minHeight:40, display:"flex", flexDirection:"column", justifyContent:"space-between", position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
          <span style={{ fontSize:11, fontWeight:700, color:T.text, flex:1, lineHeight:1.2 }}>{stage.name}</span>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            <div style={{ position:"relative" }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}>
              <span style={{ fontSize:10, fontWeight:600, padding:"2px 6px", borderRadius:10, background:T.bg, color:T.textMuted, minWidth:24, textAlign:"center", lineHeight:1.2, cursor:"help" }}>{clients.length}</span>
              {showTooltip && (
                <div style={{
                  position:"absolute", top:"100%", left:"50%", transform:"translateX(-50%)", marginTop:6,
                  background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:"6px 8px",
                  fontSize:10, fontWeight:600, color:T.text, whiteSpace:"nowrap",
                  boxShadow:T.shadow, zIndex:10
                }}>
                  {fmtMrr(mrr)}
                  <div style={{
                    position:"absolute", bottom:"100%", left:"50%", transform:"translateX(-50%)",
                    width:0, height:0,
                    borderLeft:"4px solid transparent", borderRight:"4px solid transparent",
                    borderBottom:`4px solid ${T.card}`,
                    marginBottom:0
                  }}/>
                </div>
              )}
            </div>
            <button onClick={() => alert(`Criar automação para: ${stage.name}`)} title="Adicionar automação"
              style={{ width:24, height:24, borderRadius:4, border:`1px solid ${T.border}`, background:T.card,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:T.accentText,
                transition:"all 0.12s", fontWeight:700, padding:0, lineHeight:1, fontFamily:"inherit", flexShrink:0 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.background = T.accentBg; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}>
              +
            </button>
          </div>
        </div>
      </div>

      <div onDragOver={(e) => { e.preventDefault(); onDragOver(stage.id); }}
        onDrop={(e) => { e.preventDefault(); onDrop(stage.id); }}
        style={{ display:"flex", flexDirection:"column", gap: groupBy !== "none" ? 8 : 7,
          overflowY:"auto", maxHeight:460, minHeight:80, borderRadius:8,
          background: isOver ? T.dropZone : "transparent", border: isOver ? `2px dashed ${T.dropBorder}` : "1px solid transparent",
          paddingTop:8, paddingBottom:8, paddingLeft:0, paddingRight:0, transition:"all 0.15s" }}>
        {groupBy !== "none" ? (
          groupedClients.length === 0 ? <div style={{ padding:"20px", textAlign:"center", fontSize:10, color:T.textMuted, flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>Solte aqui</div> :
          groupedClients.map(group => (
            <div key={group.key}>
              <button onClick={() => setExpanded(p => ({ ...p, [group.key]: !group.expanded }))}
                style={{ width:"100%", padding:"6px 8px", borderRadius:6, fontSize:10, fontWeight:600, cursor:"pointer",
                  border:`1px solid ${T.border}`, background:T.bg, color:T.text, display:"flex", alignItems:"center", gap:6,
                  transition:"all 0.12s", fontFamily:"inherit" }}>
                <span style={{ fontSize:10, color:T.textMuted }}>{group.expanded ? "▼" : "▶"}</span>
                {groupBy === "owner" && <Avatar initials={group.ownerInit} hue={group.ownerHue} size={16}/>}
                {groupBy === "status"
                  ? <span style={{ flex:1, textAlign:"left" }}><Badge status={group.status} isDark={isDark}/></span>
                  : <span style={{ flex:1, textAlign:"left", fontSize:10, fontWeight:600 }}>{groupBy === "owner" ? group.key.split(" ")[0] : group.key}</span>}
                <span style={{ fontSize:9, color:T.textMuted }}>{group.clients.length}</span>
              </button>
              {group.expanded && (
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
                  {group.clients.map(c => <KanbanCard key={c.id} client={c} isDark={isDark} T={T} onDragStart={onDragStart} onCardClick={onCardClick}/>)}
                </div>
              )}
            </div>
          ))
        ) : (
          clients.length === 0 ? <div style={{ padding:"20px", textAlign:"center", fontSize:11, color:T.textMuted, flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>Solte aqui</div> :
          clients.map(c => <KanbanCard key={c.id} client={c} isDark={isDark} T={T} onDragStart={onDragStart} onCardClick={onCardClick}/>)
        )}
      </div>
    </div>
  );
}

function PipeView({ clients, setClients, isDark, T, onLost, openTabs, selectedClient, openClientTab, closeClientTab, switchTab }) {
  const [pipeMode, setPipeMode] = useState("both");
  const [sortBy, setSortBy] = useState("name");
  const [filterSt, setFilter] = useState("all");
  const [filterUsers, setFilterUsers] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [layoutMode, setLayoutMode] = useState("vertical");
  const [groupBy, setGroupBy] = useState("none");
  const [showGroup, setShowGroup] = useState(false);
  const singleFunnel = pipeMode !== "both";
  const groupOptions = [["none","Sem agrupamento"],["owner","Responsável"],["status","Status"],["plan","Plano"]];

  // Com mais de um responsável filtrado, só um funil por vez
  useEffect(() => {
    if (filterUsers.length > 1 && pipeMode === "both") setPipeMode("onboarding");
  }, [filterUsers, pipeMode]);
  // Agrupar por status/plano só está disponível com um único funil
  useEffect(() => {
    if (!singleFunnel && (groupBy === "status" || groupBy === "plan")) setGroupBy("none");
  }, [singleFunnel, groupBy]);

  const allUsers = [...new Map(clients.map(c => [c.owner, { owner: c.owner, init: c.ownerInit, hue: c.ownerHue }])).values()];
  const toggleUser = (owner) => {
    const newUsers = filterUsers.includes(owner) ? filterUsers.filter(u => u !== owner) : [...filterUsers, owner];
    setFilterUsers(newUsers);
  };

  const handleDrop = useCallback((stageId) => {
    if (dragId == null) return;
    const stage = ALL_STAGES.find(s => s.id === stageId);
    if (!stage) return;
    const funnelOfStage = ONBOARDING_STAGES.find(s=>s.id===stageId) ? "onboarding" : "ongoing";
    setClients(prev => prev.map(c => c.id === dragId ? { ...c, stage: stageId, funnel: funnelOfStage } : c));
    setDragId(null); setDragOver(null);
  }, [dragId, setClients]);

  const filtered = (() => {
    let list = filterSt === "all" ? [...clients] : clients.filter(c=>c.status===filterSt);
    if (filterUsers.length > 0) list = list.filter(c => filterUsers.includes(c.owner));
    list.sort((a,b) => {
      if(sortBy==="name") return a.name.localeCompare(b.name);
      if(sortBy==="hs") return b.hs - a.hs;
      if(sortBy==="mrr") return b.mrr - a.mrr;
      if(sortBy==="new") return new Date(b.launchDate) - new Date(a.launchDate);
      if(sortBy==="launch") return new Date(a.launchDate) - new Date(b.launchDate);
      return 0;
    });
    return list;
  })();

  const Pill = ({ val, cur, onChange, label, disabled=false }) => (
    <button onClick={()=>!disabled && onChange(val)} style={{
      padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, cursor: disabled ? "not-allowed" : "pointer",
      border:"1.5px solid", fontFamily:"inherit", transition:"all 0.12s", opacity: disabled ? 0.5 : 1,
      background: cur===val ? T.accentBg : "transparent", borderColor: cur===val ? T.borderHi : T.border,
      color: cur===val ? T.accentText : T.textSub,
    }}>{label}</button>
  );

  const colProps = { isDark, T, dragOverId:dragOver, onDragStart:setDragId, onDragOver:setDragOver, onDrop:handleDrop, onCardClick: openClientTab, groupBy };
  const ob = filtered.filter(c=>c.funnel==="onboarding");
  const og = filtered.filter(c=>c.funnel==="ongoing");

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", backgroundColor: T.surface, position:"relative" }}>
      <div style={{ padding:"8px 16px", background:T.surface, borderBottom:`1px solid ${T.border}`,
        display:"flex", alignItems:"center", gap:10, flexShrink:0, position:"relative" }}>
        <div style={{ display:"flex", gap:3, alignItems:"center" }}>
          {[["both","Todos funis"],["onboarding","Onboarding"],["ongoing","Ongoing"]].map(([v,l])=>(
            <Pill key={v} val={v} cur={pipeMode} onChange={setPipeMode} label={l} disabled={filterUsers.length > 1 && v === "both"}/>
          ))}
        </div>
        
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, position:"relative" }}>
          <button onClick={() => { setShowGroup(!showGroup); setShowFilters(false); }} title="Agrupar por" 
            style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${groupBy !== "none" ? T.borderHi : T.border}`,
              background:groupBy !== "none" ? T.accentBg : T.card, cursor:"pointer", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:16, color:groupBy !== "none" ? T.accentText : T.textSub, transition:"all 0.12s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.accentText; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor = groupBy !== "none" ? T.borderHi : T.border; e.currentTarget.style.color = groupBy !== "none" ? T.accentText : T.textSub; }}>
            👥
          </button>

          {showGroup && (
            <div style={{ position:"absolute", top:"42px", right:84, background:T.card, border:`1px solid ${T.border}`, borderRadius:10,
              padding:"10px", zIndex:300, minWidth:"200px", boxShadow:T.shadow }}>
              <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:7 }}>Agrupar por</div>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {groupOptions.map(([v,l]) => {
                  const disabled = !singleFunnel && (v === "status" || v === "plan");
                  return (
                    <button key={v} disabled={disabled} onClick={() => { setGroupBy(v); setShowGroup(false); }} style={{
                      padding:"6px 9px", borderRadius:6, fontSize:11, fontWeight:500, cursor: disabled ? "not-allowed" : "pointer", border:"none",
                      background: groupBy===v ? T.accentBg : T.bg, color: groupBy===v ? T.accentText : T.textSub, opacity: disabled ? 0.45 : 1,
                      textAlign:"left", transition:"all 0.12s", fontFamily:"inherit" }}>{l}</button>
                  );
                })}
              </div>
              {!singleFunnel && <div style={{ fontSize:10, color:T.textMuted, marginTop:8, lineHeight:1.4 }}>Status e Plano ficam disponíveis ao selecionar um único funil.</div>}
            </div>
          )}

          <button onClick={() => setLayoutMode(layoutMode==="vertical"?"horizontal":"vertical")} title={layoutMode==="vertical"?"Horizontal":"Vertical"}
            style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${layoutMode==="horizontal" ? T.borderHi : T.border}`,
              background:layoutMode==="horizontal" ? T.accentBg : T.card, cursor:"pointer", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:16, color:layoutMode==="horizontal" ? T.accentText : T.textSub, transition:"all 0.12s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.accentText; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor = layoutMode==="horizontal" ? T.borderHi : T.border; e.currentTarget.style.color = layoutMode==="horizontal" ? T.accentText : T.textSub; }}>
            {layoutMode==="vertical"?"┃":"━"}
          </button>

          <button onClick={() => { setShowFilters(!showFilters); setShowGroup(false); }} title="Filtros"
            style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${filterUsers.length > 0 || filterSt !== "all" ? T.borderHi : T.border}`,
              background:filterUsers.length > 0 || filterSt !== "all" ? T.accentBg : T.card, cursor:"pointer", display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:16, color:filterUsers.length > 0 || filterSt !== "all" ? T.accentText : T.textSub, transition:"all 0.12s", position:"relative" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.accentText; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor = filterUsers.length > 0 || filterSt !== "all" ? T.borderHi : T.border; e.currentTarget.style.color = filterUsers.length > 0 || filterSt !== "all" ? T.accentText : T.textSub; }}>
            ⚙
            {(filterUsers.length > 0 || filterSt !== "all") && (
              <span style={{ position:"absolute", top:-6, right:-6, width:18, height:18, borderRadius:"50%", background:T.borderHi, color:"#FFFFFF", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {filterUsers.length + (filterSt !== "all" ? 1 : 0)}
              </span>
            )}
          </button>

          {showFilters && (
            <div onClick={(e) => e.stopPropagation()} style={{
              position:"absolute", top:"42px", right:0, background:T.card, border:`1px solid ${T.border}`, borderRadius:10,
              padding:"12px", zIndex:300, minWidth:"240px", boxShadow:T.shadow }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:7 }}>Ordenar por</div>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  {[["name","Nome"],["hs","Health"],["mrr","MRR"],["new","Novo"],["launch","Início"]].map(([v,l])=>(
                    <button key={v} onClick={() => { setSortBy(v); setShowFilters(false); }} style={{
                      padding:"6px 9px", borderRadius:6, fontSize:11, fontWeight:500, cursor:"pointer", border:"none",
                      background: sortBy===v ? T.accentBg : T.bg, color: sortBy===v ? T.accentText : T.textSub,
                      textAlign:"left", transition:"all 0.12s", fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:7 }}>Status</div>
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  {[["all","Todos"],["engaged","Engajado"],["warm","Morno"],["cold","Frio"]].map(([v,l])=>(
                    <button key={v} onClick={() => { setFilter(v); setShowFilters(false); }} style={{
                      padding:"6px 9px", borderRadius:6, fontSize:11, fontWeight:500, cursor:"pointer", border:"none",
                      background: filterSt===v ? T.accentBg : T.bg, color: filterSt===v ? T.accentText : T.textSub,
                      textAlign:"left", transition:"all 0.12s", fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:7 }}>Responsáveis</div>
                <div style={{ display:"flex", flexDirection:"column", gap:2, maxHeight:"200px", overflowY:"auto" }}>
                  {allUsers.map(user => (
                    <label key={user.owner} style={{
                      display:"flex", alignItems:"center", gap:7, padding:"6px 8px", borderRadius:6, cursor:"pointer",
                      transition:"all 0.12s", background: filterUsers.includes(user.owner) ? T.accentBg : "transparent" }}
                      onMouseEnter={e => e.currentTarget.style.background = filterUsers.includes(user.owner) ? T.accentBg : T.bg}
                      onMouseLeave={e => e.currentTarget.style.background = filterUsers.includes(user.owner) ? T.accentBg : "transparent"}>
                      <input type="checkbox" checked={filterUsers.includes(user.owner)} onChange={() => toggleUser(user.owner)}
                        style={{ cursor:"pointer", accentColor: T.borderHi }}/>
                      <Avatar initials={user.init} hue={user.hue} size={18}/>
                      <span style={{ fontSize:11, fontWeight:500, color: filterUsers.includes(user.owner) ? T.accentText : T.textSub }}>
                        {user.owner}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
                <button onClick={() => { setShowFilters(false); onLost(); }} style={{
                  width:"100%", padding:"7px 9px", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer",
                  border:"1.5px solid #DC2626", background:"transparent", color:"#DC2626",
                  textAlign:"center", transition:"all 0.12s", fontFamily:"inherit" }}>✕ Marcar como lost</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content area with pipe + panel */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", gap:0 }}>
        {/* Pipe */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
          {layoutMode === "vertical" ? (
            <div onDragEnd={() => { setDragId(null); setDragOver(null); }}
              style={{ flex:1, overflowX:"auto", overflowY:"hidden", padding:"12px 16px", display:"flex", gap:10 }}>
              {(pipeMode==="both" || pipeMode==="onboarding") && ONBOARDING_STAGES.map(st=>(
                <KanbanColumn key={st.id} stage={st} clients={ob.filter(c=>c.stage===st.id)} {...colProps}/>
              ))}
              {pipeMode==="both" && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0, gap:0 }}>
                  <div style={{ flex:1, width:1, background:T.border }}/>
                  <span style={{ fontSize:9, fontWeight:700, color:T.textMuted, writingMode:"vertical-lr", transform:"rotate(180deg)", padding:"8px 0", letterSpacing:2, textTransform:"uppercase" }}>funis</span>
                  <div style={{ flex:1, width:1, background:T.border }}/>
                </div>
              )}
              {(pipeMode==="both" || pipeMode==="ongoing") && ONGOING_STAGES.map(st=>(
                <KanbanColumn key={st.id} stage={st} clients={og.filter(c=>c.stage===st.id)} {...colProps}/>
              ))}
            </div>
          ) : (
            <div onDragEnd={() => { setDragId(null); setDragOver(null); }}
              style={{ flex:1, display:"flex", flexDirection:"column", gap:1, overflow:"hidden" }}>
              {(pipeMode==="both" || pipeMode==="onboarding") && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", borderBottom: pipeMode==="both" ? `1px solid ${T.border}` : "none", overflow:"hidden" }}>
                  <div style={{ padding:"6px 16px", fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", background:T.bg }}>Onboarding</div>
                  <div style={{ flex:1, overflowX:"auto", overflowY:"hidden", padding:"12px 16px", display:"flex", gap:10 }}>
                    {ONBOARDING_STAGES.map(st=>(
                      <KanbanColumn key={st.id} stage={st} clients={ob.filter(c=>c.stage===st.id)} {...colProps}/>
                    ))}
                  </div>
                </div>
              )}
              {(pipeMode==="both" || pipeMode==="ongoing") && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                  <div style={{ padding:"6px 16px", fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", background:T.bg }}>Ongoing</div>
                  <div style={{ flex:1, overflowX:"auto", overflowY:"hidden", padding:"12px 16px", display:"flex", gap:10 }}>
                    {ONGOING_STAGES.map(st=>(
                      <KanbanColumn key={st.id} stage={st} clients={og.filter(c=>c.stage===st.id)} {...colProps}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT BROWSER TAB
// ─────────────────────────────────────────────────────────────────────────────
function ClientTab({ client, isDark, T, onClose, onLost }) {
  const [tab, setTab] = useState("dados");

  const TabButton = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding:"8px 12px", borderRadius:0, fontSize:11, fontWeight:600, cursor:"pointer",
      border:"none", background: tab === id ? T.surface : "transparent",
      color: tab === id ? T.text : T.textMuted,
      transition:"all 0.12s", fontFamily:"inherit", borderBottom: tab === id ? `2px solid ${T.borderHi}` : "1px solid transparent"
    }}>{label}</button>
  );

  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:T.surface
    }}>
      {/* Header */}
      <div style={{
        padding:"12px 20px", borderBottom:`1px solid ${T.border}`, display:"flex",
        alignItems:"flex-start", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800, color:T.text, marginBottom:2 }}>{client.razao}</div>
          <div style={{ fontSize:11, color:T.textMuted }}>{client.funnel==="onboarding"?"Onboarding":"Ongoing"} · {client.plan}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => onLost(client.id)} style={{
            padding:"5px 10px", borderRadius:6, fontSize:11, fontWeight:600, cursor:"pointer",
            border:"1.5px solid #DC2626", background:"transparent", color:"#DC2626", fontFamily:"inherit" }}>✕ Lost</button>
          <button onClick={() => onClose(client.id)} title="Fechar aba" style={{
            background:"transparent", border:"none", fontSize:20, color:T.textMuted,
            cursor:"pointer", padding:0, width:20, height:20 }}>✕</button>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, padding:"12px 20px",
        borderBottom:`1px solid ${T.border}`, background:T.bg, flexShrink:0 }}>
        <div>
          <div style={{ fontSize:9, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4, fontWeight:700 }}>MRR</div>
          <div style={{ fontSize:14, fontWeight:800, color:T.accentText }}>{fmtMrr(client.mrr)}</div>
        </div>
        <div>
          <div style={{ fontSize:9, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4, fontWeight:700 }}>Health</div>
          <div style={{ fontSize:14, fontWeight:800, color:hsColor(client.hs) }}>{client.hs}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display:"flex", gap:0, borderBottom:`1px solid ${T.border}`,
        overflowX:"auto", padding:"0", flexShrink:0, scrollBehavior:"smooth", background:T.surface
      }}>
        <TabButton id="dados" label="Dados"/>
        <TabButton id="timeline" label="Timeline"/>
        <TabButton id="neural" label="Neural"/>
        <TabButton id="atividades" label="Ativ."/>
        <TabButton id="tickets" label="Tickets"/>
        <TabButton id="financeiro" label="Fin."/>
      </div>

      {/* Content */}
      <div style={{ padding:"16px 20px", flex:1, overflowY:"auto" }}>
        {tab === "dados" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignContent:"start" }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Razão Social</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px", fontSize:11, fontWeight:700, color:T.text }}>{client.razao}</div>
            </div>

            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Plano</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px", fontSize:11, fontWeight:700, color:T.text }}>{client.plan}</div>
            </div>

            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Status</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px" }}>
                <Badge status={client.status} isDark={isDark}/>
              </div>
            </div>

            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Lançamento</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px", fontSize:11, fontWeight:700, color:T.text }}>{new Date(client.launchDate).toLocaleDateString('pt-BR')}</div>
            </div>

            <div style={{ gridColumn:"1 / -1" }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Responsável</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px", display:"flex", alignItems:"center", gap:12 }}>
                <Avatar initials={client.ownerInit} hue={client.ownerHue} size={32}/>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{client.owner}</div>
                  <div style={{ fontSize:10, color:T.textMuted }}>Gestor de Sucesso</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "timeline" && (
          <div style={{ textAlign:"center", padding:"40px 20px", color:T.textMuted, fontSize:13 }}>
            📅 Timeline em desenvolvimento
          </div>
        )}

        {tab === "neural" && (
          <div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Health Score</div>
              <HsBar value={client.hs} isDark={isDark}/>
            </div>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"20px", textAlign:"center", color:T.textMuted, fontSize:12 }}>
              🧠 Neural Score em desenvolvimento
            </div>
          </div>
        )}

        {tab === "atividades" && (
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"20px", textAlign:"center", color:T.textMuted, fontSize:12 }}>
            📝 Nenhuma atividade registrada
          </div>
        )}

        {tab === "tickets" && (
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"20px", textAlign:"center", color:T.textMuted, fontSize:12 }}>
            🎫 Nenhum ticket vinculado
          </div>
        )}

        {tab === "financeiro" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignContent:"start" }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>MRR</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px", fontSize:14, fontWeight:800, color:T.accentText }}>{fmtMrr(client.mrr)}</div>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>ARR</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px", fontSize:14, fontWeight:800, color:T.accentText }}>{fmtMrr(client.mrr * 12)}</div>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Ciclo de Faturamento</div>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px", fontSize:11, fontWeight:700, color:T.text }}>Mensal</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashboardView({ clients, lostClients, isDark, T, onCardClick }) {
  const mrr = clients.reduce((s,c)=>s+c.mrr,0);
  const avgHs = clients.length ? Math.round(clients.reduce((s,c)=>s+c.hs,0) / clients.length) : 0;
  const atRisk = clients.filter(c => c.hs < 50 || c.stage === "risco");
  const lostMrr = lostClients.reduce((s,c)=>s+c.mrr,0);
  const owners = [...new Map(clients.map(c => [c.owner, { owner:c.owner, init:c.ownerInit, hue:c.ownerHue }])).values()];

  const Metric = ({ label, value, color }) => (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px", boxShadow:T.shadowCard }}>
      <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:800, color: color || T.text }}>{value}</div>
    </div>
  );
  const Section = ({ title, children }) => (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px", boxShadow:T.shadowCard, minWidth:0 }}>
      <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <Metric label="Clientes ativos" value={clients.length}/>
        <Metric label="MRR total" value={fmtMrr(mrr)} color={T.accentText}/>
        <Metric label="Health score médio" value={avgHs} color={hsColor(avgHs)}/>
        <Metric label="Em risco" value={atRisk.length} color="#DC2626"/>
        <Metric label="MRR perdido (lost)" value={fmtMrr(lostMrr)} color={lostMrr ? "#DC2626" : T.textMuted}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:14 }}>
        <Section title="Saúde por cliente">
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {[...clients].sort((a,b)=>b.hs-a.hs).map(c => (
              <div key={c.id} onClick={() => onCardClick(c)} style={{ display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center", gap:10, cursor:"pointer" }}>
                <span style={{ fontSize:11, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                <HsBar value={c.hs} isDark={isDark}/>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Atenção necessária">
          {atRisk.length === 0 ? (
            <div style={{ fontSize:12, color:T.textMuted }}>Nenhum cliente em risco 🎉</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {atRisk.map(c => (
                <div key={c.id} onClick={() => onCardClick(c)} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, background:T.bg, cursor:"pointer" }}>
                  <Avatar initials={c.ownerInit} hue={c.ownerHue} size={22}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{c.name}</div>
                    <div style={{ fontSize:10, color:T.textMuted }}>{ALL_STAGES.find(s=>s.id===c.stage)?.name} · {fmtMrr(c.mrr)}</div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, color:hsColor(c.hs) }}>{c.hs}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Carteira por responsável">
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {owners.map(o => {
              const own = clients.filter(c => c.owner === o.owner);
              const oHs = Math.round(own.reduce((s,c)=>s+c.hs,0) / own.length);
              return (
                <div key={o.owner} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Avatar initials={o.init} hue={o.hue} size={24}/>
                  <span style={{ flex:1, fontSize:12, fontWeight:600, color:T.text }}>{o.owner}</span>
                  <span style={{ fontSize:11, color:T.textMuted }}>{own.length} clientes</span>
                  <span style={{ fontSize:11, fontWeight:700, color:T.textSub, minWidth:80, textAlign:"right" }}>{fmtMrr(own.reduce((s,c)=>s+c.mrr,0))}</span>
                  <span style={{ fontSize:12, fontWeight:800, color:hsColor(oHs), minWidth:24, textAlign:"right" }}>{oHs}</span>
                </div>
              );
            })}
          </div>
        </Section>

        {lostClients.length > 0 && (
          <Section title="Cancelamentos (lost)">
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {lostClients.map(c => (
                <div key={c.id} style={{ padding:"8px 10px", borderRadius:8, background:T.bg }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:T.text }}>{c.name}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:"#DC2626" }}>{fmtMrr(c.mrr)}</span>
                  </div>
                  <div style={{ fontSize:10, color:T.textMuted, marginTop:2 }}>
                    {c.lost.reason} · {new Date(c.lost.date + "T00:00").toLocaleDateString("pt-BR")}
                    {c.lost.fine > 0 && ` · multa ${fmtMrr(c.lost.fine)}`}
                    {c.lost.pendingBills > 0 && ` · ${c.lost.pendingBills} boleto(s) pendente(s)`}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOST MODAL
// ─────────────────────────────────────────────────────────────────────────────
const LOST_REASONS = ["Preço", "Falta de uso / adoção", "Migrou para concorrente", "Insatisfação com suporte", "Encerramento da empresa", "Corte de custos", "Outro"];

function LostModal({ clients, initialClientId, T, onClose, onConfirm }) {
  const [form, setForm] = useState({
    clientId: initialClientId ?? clients[0]?.id ?? "",
    reason: LOST_REASONS[0], date: new Date().toISOString().slice(0,10),
    fine: "", pendingBills: "", pendingAmount: "", notes: "",
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const field = { width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:12, fontFamily:"inherit", outline:"none" };
  const Label = ({ children }) => <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>{children}</div>;

  const submit = () => {
    if (!form.clientId) return;
    onConfirm(Number(form.clientId), {
      reason: form.reason, date: form.date, notes: form.notes,
      fine: Number(form.fine) || 0, pendingBills: Number(form.pendingBills) || 0, pendingAmount: Number(form.pendingAmount) || 0,
    });
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", backdropFilter:"blur(3px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:460, background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, boxShadow:"0 20px 50px rgba(0,0,0,0.25)", overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:14, fontWeight:800, color:"#DC2626" }}>Marcar cliente como lost</span>
          <button onClick={onClose} style={{ background:"transparent", border:"none", fontSize:16, color:T.textMuted, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:"16px 18px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ gridColumn:"1 / -1" }}>
            <Label>Cliente</Label>
            <select value={form.clientId} onChange={set("clientId")} style={field}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.razao}</option>)}
            </select>
          </div>
          <div>
            <Label>Motivo</Label>
            <select value={form.reason} onChange={set("reason")} style={field}>
              {LOST_REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <Label>Data do cancelamento</Label>
            <input type="date" value={form.date} onChange={set("date")} style={field}/>
          </div>
          <div>
            <Label>Multa (R$)</Label>
            <input type="number" min="0" placeholder="0" value={form.fine} onChange={set("fine")} style={field}/>
          </div>
          <div>
            <Label>Boletos pendentes</Label>
            <input type="number" min="0" placeholder="0" value={form.pendingBills} onChange={set("pendingBills")} style={field}/>
          </div>
          <div style={{ gridColumn:"1 / -1" }}>
            <Label>Valor em aberto (R$)</Label>
            <input type="number" min="0" placeholder="0" value={form.pendingAmount} onChange={set("pendingAmount")} style={field}/>
          </div>
          <div style={{ gridColumn:"1 / -1" }}>
            <Label>Observações</Label>
            <textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="Detalhes do cancelamento…" style={{ ...field, resize:"vertical" }}/>
          </div>
        </div>
        <div style={{ padding:"12px 18px", borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button onClick={onClose} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${T.border}`, background:"transparent", color:T.textSub, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
          <button onClick={submit} disabled={!clients.length} style={{ padding:"7px 14px", borderRadius:8, border:"none", background:"#DC2626", color:"#FFFFFF", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Confirmar lost</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER VIEWS
// ─────────────────────────────────────────────────────────────────────────────
function PlaceholderView({ icon, title, description, T }) {
  return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ textAlign:"center", maxWidth:360 }}>
        <div style={{ fontSize:34, marginBottom:10 }}>{icon}</div>
        <div style={{ fontSize:15, fontWeight:800, color:T.text, marginBottom:6 }}>{title}</div>
        <div style={{ fontSize:12, color:T.textMuted, lineHeight:1.5 }}>{description}</div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id:"dashboard", label:"Dashboard", icon:"⌂" },
  { id:"pipe", label:"Pipe", icon:"▦" },
  { id:"agenda", label:"Agenda", icon:"📅", desc:"Reuniões, follow-ups e marcos dos clientes em um calendário único." },
  { id:"atividades", label:"Atividades", icon:"✓", desc:"Tarefas e interações registradas com cada cliente da carteira." },
  { id:"jornadas", label:"Jornadas", icon:"⇢", desc:"Fluxos de etapas com gatilhos e automações personalizáveis." },
  { id:"nps", label:"NPS", icon:"★", desc:"Pesquisas de satisfação, promotores, neutros e detratores." },
  { id:"indicadores", label:"Indicadores", icon:"📈", desc:"Churn, retenção, expansão de receita e evolução do health score." },
  { id:"config", label:"Configurações", icon:"⚙", desc:"Funis, etapas, status personalizados e campos dos cards." },
];

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [lostClients, setLostClients] = useState([]);
  const [lostModal, setLostModal] = useState(null);
  const [view, setView] = useState("pipe");
  const [openTabs, setOpenTabs] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const T = THEMES[isDark ? "dark" : "light"];
  const currentNav = NAV_ITEMS.find(n => n.id === view);

  const confirmLost = (clientId, lost) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    setClients(prev => prev.filter(c => c.id !== clientId));
    setLostClients(prev => [...prev, { ...client, lost }]);
    setOpenTabs(prev => prev.filter(c => c.id !== clientId));
    if (selectedClient?.id === clientId) setSelectedClient(null);
    setLostModal(null);
  };

  const goTo = (id) => { setView(id); setSelectedClient(null); };

  const openClientTab = (client) => {
    const exists = openTabs.find(c => c.id === client.id);
    if (!exists) {
      setOpenTabs([...openTabs, client]);
    }
    setSelectedClient(client);
  };

  const closeClientTab = (clientId) => {
    const newTabs = openTabs.filter(c => c.id !== clientId);
    setOpenTabs(newTabs);
    if (selectedClient?.id === clientId) {
      setSelectedClient(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
    }
  };

  const switchTab = (client) => {
    setSelectedClient(client);
  };

  const liveSelected = selectedClient && clients.find(c => c.id === selectedClient.id);

  const clientTabs = openTabs.length > 0 && (
    <div style={{ display:"flex", alignItems:"center", gap:2, borderLeft:`1px solid ${T.border}`, paddingLeft:12, overflowX:"auto", scrollBehavior:"smooth", minWidth:0 }}>
      {openTabs.map(c => {
        const active = selectedClient?.id === c.id;
        return (
          <div key={c.id} role="button" onClick={() => switchTab(c)} style={{ padding:"4px 10px", fontSize:10, fontWeight: active ? 700 : 500, cursor:"pointer", background: active ? T.accentBg : "transparent", color: active ? T.accentText : T.textMuted, transition:"all 0.12s", display:"flex", alignItems:"center", gap:5, borderRadius:5, whiteSpace:"nowrap" }}>
            <span>{c.name}</span>
            <button onClick={(e) => { e.stopPropagation(); closeClientTab(c.id); }} title="Fechar aba" style={{ background:"transparent", border:"none", color:"inherit", cursor:"pointer", fontSize:10, padding:0, display:"flex", alignItems:"center", lineHeight:1, fontWeight:700 }}>✕</button>
          </div>
        );
      })}
    </div>
  );

  const renderView = () => {
    if (view === "pipe") return <PipeView clients={clients} setClients={setClients} isDark={isDark} T={T} onLost={() => setLostModal({ clientId: null })} openTabs={openTabs} selectedClient={selectedClient} openClientTab={openClientTab} closeClientTab={closeClientTab} switchTab={switchTab}/>;
    if (view === "dashboard") return <DashboardView clients={clients} lostClients={lostClients} isDark={isDark} T={T} onCardClick={openClientTab}/>;
    return <PlaceholderView icon={currentNav.icon} title={currentNav.label} description={`${currentNav.desc} Módulo em desenvolvimento.`} T={T}/>;
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:T.bg, fontFamily:"Inter,system-ui,sans-serif", color:T.text, overflow:"hidden" }}>
      <nav style={{ width:64, background:T.surface, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 0", gap:4, flexShrink:0, boxShadow:T.shadow }}>
        <div style={{ width:34, height:34, borderRadius:9, background:T.accentBg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8 }}>
          <span style={{ fontSize:18, color:T.accentText }}>♥</span>
        </div>
        {NAV_ITEMS.map(n => {
          const active = view === n.id && !selectedClient;
          return (
            <button key={n.id} onClick={() => goTo(n.id)} title={n.label} style={{ width:54, padding:"7px 0 5px", borderRadius:9, border:"none", background: active ? T.accentBg : "transparent", color: active ? T.accentText : T.textSub, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontFamily:"inherit", transition:"background 0.15s" }}>
              <span style={{ fontSize:15, lineHeight:1 }}>{n.icon}</span>
              <span style={{ fontSize:8.5, fontWeight: active ? 700 : 500, maxWidth:52, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.label}</span>
            </button>
          );
        })}
        <div style={{ flex:1 }}/>
        <button onClick={() => setIsDark(d=>!d)} title={isDark?"Modo claro":"Modo escuro"} style={{ width:44, height:44, borderRadius:9, border:"none", background:"transparent", color:T.textSub, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, transition:"background 0.15s" }}>
          {isDark ? "☀" : "☾"}
        </button>
      </nav>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, background:T.surface }}>
        <div style={{ height:50, background:T.surface, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 18px", gap:12, flexShrink:0 }}>
          {liveSelected ? (
            <button onClick={() => setSelectedClient(null)} style={{ padding:"4px 10px", fontSize:11, fontWeight:600, cursor:"pointer", border:"none", background:T.accentBg, color:T.accentText, transition:"all 0.12s", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, borderRadius:6, whiteSpace:"nowrap" }}>
              ← {currentNav.label}
            </button>
          ) : (
            <span style={{ fontSize:15, fontWeight:800, color:T.text, whiteSpace:"nowrap" }}>{currentNav.label}</span>
          )}
          {clientTabs}
          <div style={{ flex:1 }}/>
        </div>

        {liveSelected
          ? <ClientTab client={liveSelected} isDark={isDark} T={T} onClose={closeClientTab} onLost={(id) => setLostModal({ clientId: id })}/>
          : renderView()}
      </div>

      {lostModal && (
        <LostModal clients={clients} initialClientId={lostModal.clientId} T={T} onClose={() => setLostModal(null)} onConfirm={confirmLost}/>
      )}
    </div>
  );
}
