/*
 * Leads: every inquiry, searchable and filterable. Filters live in the URL so
 * a filtered view can be bookmarked or shared (e.g. /leads?view=followup).
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCRM } from "../data/CRMContext.jsx";
import { allLeadViews } from "../data/selectors.js";
import { BeltTag, DueChip, Select, Empty, StageOptions } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { SOURCES, SOURCE, PROGRAMS, PROGRAM, CLOSED_STAGES, STAGE_ORDER, STAGE, LOST_REASON } from "../lib/constants.js";
import { fmtDate, fmtDateTime, addDays } from "../lib/dates.js";
import { fmtAge } from "../lib/format.js";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "followup", label: "Needs follow-up" },
  { value: "all", label: "All" },
];
const PERIODS = [
  { value: "", label: "Any inquiry date" },
  { value: "30", label: "Inquired in the last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

export function useMedia(q) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}

const SORTS = {
  name: (v) => v.name.toLowerCase(),
  stage: (v) => STAGE_ORDER.indexOf(v.lead.stage),
  inquiry: (v) => v.lead.inquiry_date,
  follow: (v) => v.lead.next_follow_up || "9999",
  touches: (v) => v.touches,
  source: (v) => SOURCE[v.lead.source]?.label || "",
};

export default function Leads({ onOpen, onAdd, activeId }) {
  const { state, today } = useCRM();
  const [params, setParams] = useSearchParams();
  const get = (k, d = "") => params.get(k) ?? d;
  const set = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  const q = get("q"), stage = get("stage"), source = get("source"), program = get("program"), owner = get("owner"), period = get("period");
  const view = get("view", stage ? "all" : "open");
  const [sort, setSort] = useState({ key: "follow", dir: 1 });
  const narrow = useMedia("(max-width: 760px)");

  const all = allLeadViews(state, today);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const since = period ? addDays(today, -Number(period)) : "";
    let r = all.filter((v) => {
      if (view === "open" && CLOSED_STAGES.includes(v.lead.stage)) return false;
      if (view === "followup" && !["overdue", "today"].includes(v.followUp.key)) return false;
      if (stage && v.lead.stage !== stage) return false;
      if (source && v.lead.source !== source) return false;
      if (program && v.lead.program_interest !== program) return false;
      if (owner && v.lead.owner_id !== owner) return false;
      if (since && v.lead.inquiry_date < since) return false;
      if (needle) {
        const hay = [v.name, v.parentName, v.family?.name, v.primary?.phone, v.primary?.email, v.family?.town].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const f = SORTS[sort.key];
    r = r.slice().sort((a, b) => {
      const x = f(a), y = f(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || (a.lead.inquiry_date < b.lead.inquiry_date ? 1 : -1);
    });
    return r;
  }, [all, q, view, stage, source, program, owner, period, sort, today]);

  const overdueCount = all.filter((v) => v.followUp.key === "overdue").length;
  const th = (key, label, cls = "") => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button className="sort" onClick={() => setSort({ key, dir: sort.key === key ? -sort.dir : 1 })}>{label}{sort.key === key ? (sort.dir > 0 ? " ▲" : " ▼") : ""}</button>
    </th>
  );
  const anyFilter = q || stage || source || program || owner || period;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="sub">{all.filter((v) => !CLOSED_STAGES.includes(v.lead.stage)).length} open, {overdueCount} overdue for a follow-up.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => exportCSV(rows, state)}>Export CSV</button>
          <button className="btn primary" onClick={onAdd}><Icon name="plus" size={16} />New inquiry</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Which leads">
          {VIEWS.map((o) => <button key={o.value} aria-pressed={view === o.value} onClick={() => set("view", o.value === "open" ? "" : o.value)}>{o.label}</button>)}
        </div>
        <div className="search">
          <Icon name="search" size={16} />
          <input className="input" type="search" placeholder="Search name, parent, phone, email" value={q} onChange={(e) => set("q", e.target.value)} aria-label="Search leads" />
        </div>
      </div>
      <div className="toolbar">
        <select className="select" value={stage} onChange={(e) => { const p = new URLSearchParams(params); if (e.target.value) { p.set("stage", e.target.value); p.set("view", "all"); } else p.delete("stage"); setParams(p, { replace: true }); }} aria-label="Stage">
          <option value="">Any stage</option><StageOptions />
        </select>
        <Select value={source} onChange={(v) => set("source", v)} placeholder="Any source" options={SOURCES} aria-label="Source" />
        <Select value={program} onChange={(v) => set("program", v)} placeholder="Any program" options={PROGRAMS} aria-label="Program" />
        <Select value={owner} onChange={(v) => set("owner", v)} placeholder="Anyone" options={state.staff.map((s) => ({ value: s.id, label: s.name }))} aria-label="Owner" />
        <Select value={period} onChange={(v) => set("period", v)} options={PERIODS} aria-label="Inquiry date" />
        {anyFilter && <button className="btn ghost sm" onClick={() => setParams(new URLSearchParams(view !== "open" ? { view } : {}), { replace: true })}>Clear filters</button>}
        <span className="result-count">{rows.length} {rows.length === 1 ? "lead" : "leads"}</span>
      </div>

      {!rows.length ? (
        <div className="panel"><Empty title="No leads match" action={<button className="btn" onClick={() => setParams({}, { replace: true })}>Show all open leads</button>}>Try a different search or clear the filters.</Empty></div>
      ) : narrow ? (
        <div className="stack" style={{ gap: 8 }}>
          {rows.slice(0, 200).map((v) => (
            <button key={v.lead.id} className={`card ${v.followUp.key === "overdue" ? "overdue" : ""}`} style={{ cursor: "pointer" }} onClick={() => onOpen(v.lead.id)}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="name">{v.name}</span>
                <BeltTag stage={v.lead.stage} short />
              </div>
              <span className="meta">{[v.age != null && `Age ${fmtAge(v.age)}`, PROGRAM[v.lead.program_interest]?.label, v.parentName].filter(Boolean).join(", ")}</span>
              <div className="foot">
                <span className="tag">{SOURCE[v.lead.source]?.label}</span>
                <DueChip followUp={v.followUp} date={v.lead.next_follow_up} today={today} />
                {v.nextTrial && <span className="tag info">Trial {fmtDate(v.nextTrial.scheduled_at, { today })}</span>}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="panel flush">
          <div className="tbl-wrap" style={{ maxHeight: "calc(100vh - 290px)", minHeight: 300 }}>
            <table>
              <thead>
                <tr>
                  {th("name", "Student")}
                  <th>Program</th>
                  {th("stage", "Stage")}
                  {th("source", "Source")}
                  {th("inquiry", "Inquired")}
                  <th>Last contact</th>
                  {th("touches", "Touches", "r")}
                  <th>Trial</th>
                  {th("follow", "Next follow-up")}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.lead.id} className={`click ${activeId === v.lead.id ? "sel" : ""}`} onClick={() => onOpen(v.lead.id)}
                    tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(v.lead.id)}>
                    <td>
                      <div className="cell-main">{v.name}{v.siblings.length > 0 && <span className="muted" style={{ fontWeight: 400 }}> +{v.siblings.length} sibling{v.siblings.length > 1 ? "s" : ""}</span>}</div>
                      <div className="cell-sub">{v.parentName}{v.age != null ? `, age ${fmtAge(v.age)}` : ""}</div>
                    </td>
                    <td className="nowrap">{PROGRAM[v.lead.program_interest]?.label}</td>
                    <td>
                      <BeltTag stage={v.lead.stage} />
                      {v.lead.stage === "lost" && v.lead.lost_reason && <div className="cell-sub">{LOST_REASON[v.lead.lost_reason]?.label}</div>}
                    </td>
                    <td className="nowrap">{SOURCE[v.lead.source]?.label}</td>
                    <td className="nowrap">{fmtDate(v.lead.inquiry_date, { today })}</td>
                    <td className="nowrap">{v.lastContact ? fmtDate(v.lastContact.at, { today }) : <span className="muted">Not yet</span>}</td>
                    <td className="r">{v.touches}</td>
                    <td className="nowrap">{v.nextTrial ? fmtDateTime(v.nextTrial.scheduled_at, { today }) : v.attended ? <span className="muted">Attended {fmtDate(v.attended.scheduled_at, { today })}</span> : <span className="muted">—</span>}</td>
                    <td><DueChip followUp={v.followUp} date={v.lead.next_follow_up} today={today} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

function exportCSV(rows, state) {
  const head = ["Inquiry date", "Student", "Age", "Program", "Parent", "Phone", "Email", "Stage", "Source", "Source detail", "Touches", "Trial", "Next follow-up", "Next step", "Lost reason", "Owner"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(",")];
  for (const v of rows) {
    lines.push([v.lead.inquiry_date, v.name, v.age ?? "", PROGRAM[v.lead.program_interest]?.label, v.parentName, v.primary?.phone, v.primary?.email,
      STAGE[v.lead.stage].label, SOURCE[v.lead.source]?.label, v.lead.source_detail, v.touches, v.nextTrial?.scheduled_at || v.attended?.scheduled_at || "",
      v.lead.next_follow_up || "", v.lead.next_step, LOST_REASON[v.lead.lost_reason]?.label || "",
      state.staff.find((s) => s.id === v.lead.owner_id)?.name || ""].map(esc).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mptkd-leads.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
