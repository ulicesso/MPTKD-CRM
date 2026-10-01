import { useState } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import { useCRM } from "./data/CRMContext.jsx";
import { allLeadViews } from "./data/selectors.js";
import { useLeadParam } from "./useLeadParam.js";
import Icon from "./components/Icon.jsx";
import LeadDrawer from "./components/lead/LeadDrawer.jsx";
import { NewLeadForm } from "./components/lead/forms.jsx";
import { Modal } from "./components/ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Leads from "./pages/Leads.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Analytics from "./pages/Analytics.jsx";
import Families from "./pages/Families.jsx";
import { STAFF_ROLES } from "./lib/constants.js";

const NAV = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/leads", label: "Leads", icon: "leads" },
  { to: "/pipeline", label: "Pipeline", icon: "pipeline" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
  { to: "/families", label: "Families", icon: "families" },
];

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1d2f57" />
      <rect x="4" y="13" width="24" height="6" rx="1.5" fill="#f2b91f" />
      <rect x="14" y="10" width="4" height="14" rx="1" fill="#f2b91f" />
    </svg>
  );
}

export default function App() {
  const { state, today, staffId, setStaffId, reset, toastMsg, setToastMsg } = useCRM();
  const { leadId, open, close } = useLeadParam();
  const [confirmReset, setConfirmReset] = useState(false);
  const [adding, setAdding] = useState(false);
  const overdue = allLeadViews(state, today).filter((v) => v.followUp.key === "overdue").length;

  const staffPicker = (
    <select value={staffId || ""} onChange={(e) => setStaffId(e.target.value)} aria-label="Working as">
      {state.staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} ({STAFF_ROLES[s.role]})</option>)}
    </select>
  );

  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <Link to="/" className="brand">
          <BrandMark />
          <span><b>MPTKD CRM</b><span>Master P's World Class TKD</span></span>
        </Link>
        <div className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <Icon name={n.icon} />{n.label}
              {n.to === "/leads" && overdue > 0 && <span className="count" title={`${overdue} overdue follow-ups`}>{overdue}</span>}
            </NavLink>
          ))}
        </div>
        <div className="side-foot">
          <label>Working as{staffPicker}</label>
          {state.meta?.demo && (
            <div className="demo-note">Demo data. Every family here is made up, so try anything.</div>
          )}
          {state.meta?.demo && <button onClick={() => setConfirmReset(true)}>Reset demo data</button>}
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <BrandMark />
          <b>MPTKD CRM</b>
          <span className="spacer" />
          {staffPicker}
        </header>
        <Routes>
          <Route path="/" element={<Dashboard onOpen={open} onAdd={() => setAdding(true)} />} />
          <Route path="/leads" element={<Leads onOpen={open} onAdd={() => setAdding(true)} activeId={leadId} />} />
          <Route path="/pipeline" element={<Pipeline onOpen={open} onAdd={() => setAdding(true)} />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/families" element={<Families onOpen={open} />} />
          <Route path="/families/:id" element={<Families onOpen={open} />} />
          <Route path="*" element={<div className="page"><h1>Page not found</h1><Link to="/">Go to the dashboard</Link></div>} />
        </Routes>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            <Icon name={n.icon} size={20} />{n.label}
            {n.to === "/leads" && overdue > 0 && <span className="dot" aria-label={`${overdue} overdue`} />}
          </NavLink>
        ))}
      </nav>

      {leadId && <LeadDrawer leadId={leadId} onClose={close} onOpenLead={open} />}
      {adding && <NewLeadForm onClose={() => setAdding(false)} onCreated={open} />}
      {confirmReset && (
        <Modal title="Reset demo data?" lede="This throws away every change made in this browser and rebuilds the sample families around today's date." onClose={() => setConfirmReset(false)}
          actions={<><button className="btn" onClick={() => setConfirmReset(false)}>Keep my changes</button><button className="btn danger" onClick={() => { reset(); setConfirmReset(false); close(); }}>Reset demo data</button></>} />
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}<button onClick={() => setToastMsg(null)} aria-label="Dismiss">OK</button></div>}
    </div>
  );
}
