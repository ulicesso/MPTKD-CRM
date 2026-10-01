/*
 * Pipeline: the sales process as a board, one belt-colored column per stage.
 * Drag a card to move it. Moves that need details (enroll, lost, nurture,
 * book a trial) open the matching form. Keyboard users open a card and use
 * the actions in the lead panel.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCRM } from "../data/CRMContext.jsx";
import { allLeadViews, leadView } from "../data/selectors.js";
import * as A from "../data/actions.js";
import { DueChip, Select, beltVar } from "../components/ui.jsx";
import { EnrollForm, LostForm, NurtureForm, ScheduleTrialForm } from "../components/lead/forms.jsx";
import Icon from "../components/Icon.jsx";
import { STAGES, SOURCES, SOURCE, PROGRAMS, PROGRAM, TRIAL_OFFER, LOST_REASON } from "../lib/constants.js";
import { fmtDate, fmtDateTime, addDays } from "../lib/dates.js";
import { fmtAge } from "../lib/format.js";

const CLOSED_WINDOW = 30; // Enrolled and Lost columns show the last 30 days
const COL_LIMIT = 40;

export default function Pipeline({ onOpen, onAdd }) {
  const { state, today, run, toast } = useCRM();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [program, setProgram] = useState("");
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const [pending, setPending] = useState(null); // { form, leadId }

  const all = allLeadViews(state, today);
  const cols = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const since = addDays(today, -CLOSED_WINDOW);
    const keep = (v) => (!source || v.lead.source === source) && (!program || v.lead.program_interest === program)
      && (!needle || [v.name, v.parentName, v.family?.name].join(" ").toLowerCase().includes(needle));
    const out = {};
    for (const s of STAGES) out[s.key] = [];
    for (const v of all) {
      if (!keep(v)) continue;
      if (v.lead.stage === "enrolled" && (v.lead.enrolled_on || "") < since) continue;
      if (v.lead.stage === "lost" && v.lead.stage_changed_at.slice(0, 10) < since) continue;
      out[v.lead.stage].push(v);
    }
    const rank = { overdue: 0, today: 1, upcoming: 2, none: 3 };
    for (const k in out) {
      out[k].sort((a, b) => {
        if (k === "trial_scheduled" && a.nextTrial && b.nextTrial) return a.nextTrial.scheduled_at < b.nextTrial.scheduled_at ? -1 : 1;
        if (k === "enrolled" || k === "lost") return a.lead.stage_changed_at < b.lead.stage_changed_at ? 1 : -1;
        return rank[a.followUp.key] - rank[b.followUp.key] || (a.lead.next_follow_up || "") .localeCompare(b.lead.next_follow_up || "");
      });
    }
    return out;
  }, [all, q, source, program, today]);

  function drop(stageKey, leadId = dragId) {
    const id = leadId;
    setDragId(null); setOver(null);
    if (!id) return;
    const v = all.find((x) => x.lead.id === id);
    if (!v || v.lead.stage === stageKey) return;
    if (stageKey === "enrolled") return setPending({ form: "enroll", leadId: id });
    if (stageKey === "lost") return setPending({ form: "lost", leadId: id });
    if (stageKey === "nurture") return setPending({ form: "nurture", leadId: id });
    if (stageKey === "trial_scheduled" && !v.nextTrial) return setPending({ form: "trial", leadId: id });
    if (stageKey === "trial_completed" && v.nextTrial) { run(A.recordTrial, v.nextTrial.id, "attended"); toast(`${v.student.first_name}: trial attended`); return; }
    run(A.moveStage, id, stageKey);
    toast(`${v.student.first_name} moved to ${STAGES.find((s) => s.key === stageKey).label}`);
  }

  const pv = pending && leadView(state, pending.leadId, today);
  const close = () => setPending(null);

  return (
    <main className="page" style={{ maxWidth: "none" }}>
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="sub">Drag a card, or use its Move menu, to move it along. Enrolled and Lost show the last {CLOSED_WINDOW} days.</p>
        </div>
        <button className="btn primary" onClick={onAdd}><Icon name="plus" size={16} />New inquiry</button>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input className="input" type="search" placeholder="Search name or family" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pipeline" />
        </div>
        <Select value={source} onChange={setSource} placeholder="Any source" options={SOURCES} aria-label="Source" />
        <Select value={program} onChange={setProgram} placeholder="Any program" options={PROGRAMS} aria-label="Program" />
      </div>

      <div className="board" aria-label="Pipeline board">
        {STAGES.map((s) => {
          const list = cols[s.key];
          return (
            <section key={s.key} className={`col ${over === s.key ? "over" : ""}`} aria-label={`${s.label}, ${list.length}`}
              onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); drop(s.key); }}>
              <div className="col-head" data-belt={s.belt} style={beltVar(s.belt)}>
                <div className="band" aria-hidden="true" />
                <div className="t"><h3>{s.label}</h3><span className="n">{list.length}</span></div>
                <p>{s.hint}</p>
              </div>
              <div className="col-body">
                {!list.length && <div className="col-empty">{dragId ? "Drop here" : "No leads here"}</div>}
                {list.slice(0, COL_LIMIT).map((v) => (
                  <Card key={v.lead.id} v={v} today={today} onOpen={onOpen} dragging={dragId === v.lead.id} onMove={(k) => drop(k, v.lead.id)}
                    onDragStart={() => setDragId(v.lead.id)} onDragEnd={() => { setDragId(null); setOver(null); }} />
                ))}
                {list.length > COL_LIMIT && <Link className="col-more muted" to={`/leads?stage=${s.key}`}>See all {list.length} in Leads</Link>}
              </div>
            </section>
          );
        })}
      </div>

      {pv && pending.form === "enroll" && <EnrollForm view={pv} onClose={close} />}
      {pv && pending.form === "lost" && <LostForm view={pv} onClose={close} />}
      {pv && pending.form === "nurture" && <NurtureForm view={pv} onClose={close} />}
      {pv && pending.form === "trial" && <ScheduleTrialForm view={pv} onClose={close} />}
    </main>
  );
}

function Card({ v, today, onOpen, dragging, onDragStart, onDragEnd, onMove }) {
  const { lead } = v;
  let detail = null;
  if (v.nextTrial) detail = <span className="tag info">Trial {fmtDateTime(v.nextTrial.scheduled_at, { today })}</span>;
  else if (lead.stage === "enrolled") detail = <span className="tag ok">Enrolled {fmtDate(lead.enrolled_on, { today })}</span>;
  else if (lead.stage === "lost") detail = <span className="tag">{LOST_REASON[lead.lost_reason]?.label || "Lost"}</span>;
  return (
    <div className={`card ${dragging ? "dragging" : ""} ${v.followUp.key === "overdue" ? "overdue" : ""}`} draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", lead.id); onDragStart(); }}
      onDragEnd={onDragEnd} onClick={() => onOpen(lead.id)} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(lead.id))}
      aria-label={`${v.name}, open details`}>
      <span className="name">{v.name}</span>
      <span className="meta">{[v.age != null && `Age ${fmtAge(v.age)}`, PROGRAM[lead.program_interest]?.label].filter(Boolean).join(", ")}</span>
      <span className="meta">{SOURCE[lead.source]?.label}{lead.offer && lead.offer !== "free_week" && ["trial_scheduled", "trial_completed"].includes(lead.stage) ? `, ${TRIAL_OFFER[lead.offer]?.label.toLowerCase()}` : ""}</span>
      <div className="foot">
        {detail}
        {!["enrolled", "lost"].includes(lead.stage) && <DueChip followUp={v.followUp} date={lead.next_follow_up} today={today} />}
        {v.touches > 0 && !["enrolled", "lost"].includes(lead.stage) && <span className="tag" title="Calls, texts and emails logged">{v.touches} touch{v.touches === 1 ? "" : "es"}</span>}
      </div>
      <select className="move-select" value="" aria-label={`Move ${v.name} to another stage`} title="Move to another stage"
        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => e.target.value && onMove(e.target.value)}>
        <option value="">Move</option>
        {STAGES.filter((s) => s.key !== lead.stage).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      {v.siblings.length > 0 && <span className="sib">{v.siblings.length} sibling{v.siblings.length > 1 ? "s" : ""} also in the pipeline</span>}
    </div>
  );
}
