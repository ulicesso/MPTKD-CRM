/*
 * Lead detail panel: everything about one prospective student, plus the
 * actions that move them through the pipeline.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCRM } from "../../data/CRMContext.jsx";
import { leadView, familyView } from "../../data/selectors.js";
import * as A from "../../data/actions.js";
import Icon from "../Icon.jsx";
import { Drawer, BeltTag, DueChip, Select, Field } from "../ui.jsx";
import { LogContactForm, ScheduleTrialForm, NurtureForm, LostForm, EnrollForm } from "./forms.jsx";
import {
  SOURCES, SOURCE, PROGRAMS, PROGRAM, TRIAL_OFFER, TRIAL_STATUS, LOST_REASON, CONTACT_METHOD, CONTACT_OUTCOME, GOALS,
  MAX_UNANSWERED_TOUCHES, STAGE,
} from "../../lib/constants.js";
import { fmtDate, fmtDateTime, relDay, addDays } from "../../lib/dates.js";
import { fmtAge, money2, telHref, smsHref, plural } from "../../lib/format.js";

export default function LeadDrawer({ leadId, onClose, onOpenLead }) {
  const { state, today } = useCRM();
  const view = leadView(state, leadId, today);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState(null);
  useEffect(() => { setTab("overview"); }, [leadId]);
  if (!view) return null;
  const { lead, student, primary } = view;

  const head = (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ fontSize: "1.6rem" }}>{view.name}</h2>
            <BeltTag stage={lead.stage} />
          </div>
          <p className="ink2" style={{ marginTop: 3 }}>
            {[view.age != null && `Age ${fmtAge(view.age)}`, PROGRAM[student?.program || lead.program_interest]?.label, view.family && `${view.family.name} family`].filter(Boolean).join(", ")}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      {primary && (
        <div className="contact-line" style={{ marginTop: 8 }}>
          <span className="muted">{primary.relationship === "Self" ? "Contact" : primary.relationship}: <b style={{ color: "var(--ink)" }}>{view.parentName}</b></span>
          {primary.phone && <a href={telHref(primary.phone)}>{primary.phone}</a>}
          {primary.phone && <a href={smsHref(primary.phone)}>Text</a>}
          {primary.email && <a href={`mailto:${primary.email}`}>{primary.email}</a>}
        </div>
      )}
      <div className="tabs" role="tablist">
        {[["overview", "Overview"], ["history", `Contact history (${view.touches})`], ["trials", `Trials (${view.trials.length})`], ["family", "Family"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
    </>
  );

  return (
    <Drawer onClose={onClose} head={head} label={`Lead: ${view.name}`}>
      <Actions view={view} setForm={setForm} />
      {tab === "overview" && <Overview view={view} />}
      {tab === "history" && <History view={view} setForm={setForm} />}
      {tab === "trials" && <Trials view={view} setForm={setForm} />}
      {tab === "family" && <FamilyTab view={view} onOpenLead={onOpenLead} />}
      {form === "contact" && <LogContactForm view={view} onClose={() => setForm(null)} />}
      {form === "trial" && <ScheduleTrialForm view={view} onClose={() => setForm(null)} />}
      {form === "nurture" && <NurtureForm view={view} onClose={() => setForm(null)} />}
      {form === "lost" && <LostForm view={view} onClose={() => setForm(null)} />}
      {form === "enroll" && <EnrollForm view={view} onClose={() => setForm(null)} />}
    </Drawer>
  );
}

/* ---------- next actions, by stage ---------- */
function Actions({ view, setForm }) {
  const { run, toast, today } = useCRM();
  const { lead, nextTrial, followUp } = view;
  const s = lead.stage;
  const recordTrial = (status) => { run(A.recordTrial, nextTrial.id, status); toast(status === "attended" ? "Trial marked attended" : "No-show recorded"); };
  const trialPast = nextTrial && nextTrial.scheduled_at.slice(0, 10) <= today;
  return (
    <section className="panel" aria-label="Next step">
      {followUp.key === "overdue" && <div className="callout crit" style={{ marginBottom: 10 }}><Icon name="alert" /> Follow-up was due {fmtDate(lead.next_follow_up, { today })} ({-followUp.days} days ago).</div>}
      {view.needsDecision && <div className="callout warn" style={{ marginBottom: 10 }}><Icon name="alert" /> {view.unanswered} touches with no reply. Past {MAX_UNANSWERED_TOUCHES}, move them to Nurture or mark them lost.</div>}
      {nextTrial && (
        <div className="callout info" style={{ marginBottom: 10 }}>
          <Icon name="calendar" />
          <span>Trial {relDay(nextTrial.scheduled_at, today)}: <b>{fmtDateTime(nextTrial.scheduled_at, { today })}</b>, {TRIAL_OFFER[nextTrial.offer]?.label.toLowerCase()}</span>
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div className="muted" style={{ fontSize: ".84rem" }}>Next step</div>
          <div style={{ fontWeight: 600 }}>{lead.next_step || STAGE[s].hint}</div>
        </div>
        <DueChip followUp={followUp} date={lead.next_follow_up} today={today} />
      </div>
      <div className="action-row">
        {s === "trial_scheduled" && nextTrial && trialPast && <>
          <button className="btn primary" onClick={() => recordTrial("attended")}><Icon name="check" size={16} />Attended</button>
          <button className="btn" onClick={() => recordTrial("no_show")}>No-show</button>
        </>}
        {["trial_completed", "decision"].includes(s) && <button className="btn primary" onClick={() => setForm("enroll")}>Enroll</button>}
        {!["enrolled", "lost"].includes(s) && <button className={`btn ${["new", "contacted", "nurture"].includes(s) ? "primary" : ""}`} onClick={() => setForm("contact")}><Icon name="call" size={16} />Log contact</button>}
        {["new", "contacted", "nurture"].includes(s) && <button className="btn" onClick={() => setForm("trial")}><Icon name="calendar" size={16} />Book trial</button>}
        {s === "trial_scheduled" && <button className="btn" onClick={() => setForm("trial")}>Rebook</button>}
        {s === "trial_scheduled" && nextTrial && !trialPast && <button className="btn" onClick={() => recordTrial("attended")}>Mark attended</button>}
        {s === "trial_completed" && <button className="btn" onClick={() => { run(A.moveStage, lead.id, "decision", { next_follow_up: addDays(today, 2) }); toast("Moved to Decision pending"); }}>Deciding</button>}
        {["new", "contacted", "trial_scheduled", "trial_completed", "decision"].includes(s) && <button className="btn" onClick={() => setForm("nurture")}>Nurture</button>}
        {!["enrolled", "lost"].includes(s) && <button className="btn ghost danger" onClick={() => setForm("lost")}>Lost</button>}
        {["lost", "nurture"].includes(s) && <button className="btn" onClick={() => { run(A.reopen, lead.id); toast("Reopened"); }}>Reopen</button>}
        {s === "enrolled" && view.membership && <span className="tag ok">Enrolled {fmtDate(lead.enrolled_on, { today })}: {view.membership.membership}</span>}
        {s === "lost" && <span className="tag crit">{LOST_REASON[lead.lost_reason]?.label || "Lost"}</span>}
      </div>
    </section>
  );
}

/* ---------- overview: editable details ---------- */
function Overview({ view }) {
  const { state, run, today } = useCRM();
  const { lead, student } = view;
  const save = (patch) => run(A.updateLead, lead.id, patch);
  const owners = state.staff.filter((s) => s.active);
  return (
    <>
      <section className="panel">
        <div className="panel-head"><h3>Follow-up</h3></div>
        <div className="form-grid">
          <Field label="Next follow-up"><input type="date" className="input" value={lead.next_follow_up || ""} onChange={(e) => save({ next_follow_up: e.target.value || null })} /></Field>
          <Field label="Owner"><Select value={lead.owner_id || ""} onChange={(v) => save({ owner_id: v || null })} placeholder="Unassigned" options={owners.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Next step" className="full"><BlurInput value={lead.next_step || ""} onSave={(v) => save({ next_step: v })} placeholder="What should happen next?" /></Field>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Student</h3></div>
        <div className="form-grid">
          <Field label="First name"><BlurInput value={student.first_name} onSave={(v) => v && run(A.updateStudent, student.id, { first_name: v })} /></Field>
          <Field label="Last name"><BlurInput value={student.last_name} onSave={(v) => v && run(A.updateStudent, student.id, { last_name: v })} /></Field>
          <Field label="Age"><BlurInput type="number" value={student.age_at_inquiry ?? ""} onSave={(v) => run(A.updateStudent, student.id, { age_at_inquiry: v === "" ? null : Number(v) })} /></Field>
          <Field label="Program">
            <Select value={lead.program_interest || ""} onChange={(v) => { save({ program_interest: v }); run(A.updateStudent, student.id, { program: v }); }} options={PROGRAMS.map((p) => ({ value: p.key, label: `${p.label} (${p.ages})` }))} />
          </Field>
          <Field label="Previous experience" className="full"><BlurInput value={lead.experience || ""} onSave={(v) => save({ experience: v })} placeholder="None" /></Field>
          <div className="field full">
            <span>Goals</span>
            <div className="chips">
              {GOALS.map((g) => { const on = (lead.goals || []).includes(g); return <button key={g} type="button" className="chip-toggle" aria-pressed={on} onClick={() => save({ goals: on ? lead.goals.filter((x) => x !== g) : [...(lead.goals || []), g] })}>{g}</button>; })}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Inquiry</h3></div>
        <div className="form-grid">
          <Field label="Source"><Select value={lead.source} onChange={(v) => save({ source: v })} options={SOURCES} /></Field>
          <Field label="Inquiry date"><input type="date" className="input" value={lead.inquiry_date} onChange={(e) => e.target.value && save({ inquiry_date: e.target.value })} /></Field>
          <Field label="Source detail"><BlurInput value={lead.source_detail || ""} onSave={(v) => save({ source_detail: v })} placeholder="Campaign or event" /></Field>
          <Field label="Qualified?" help="(in our area, right age, reachable)">
            <Select value={lead.qualified == null ? "" : lead.qualified ? "yes" : "no"} onChange={(v) => save({ qualified: v === "" ? null : v === "yes" })}
              options={[{ value: "", label: "Not judged yet" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          </Field>
          {view.referredBy && <div className="field full"><span>Referred by</span><span>{view.referredBy.first_name} {view.referredBy.last_name} (current student). Remember their referral reward.</span></div>}
          <Field label="What they told us" className="full"><BlurInput textarea value={lead.background || ""} onSave={(v) => save({ background: v })} /></Field>
          <Field label="Internal notes" className="full"><BlurInput textarea value={lead.notes || ""} onSave={(v) => save({ notes: v })} placeholder="Anything the team should know" /></Field>
        </div>
        <p className="muted" style={{ fontSize: ".82rem", marginTop: 10 }}>
          Inquired {fmtDate(lead.inquiry_date, { today, year: true })} via {SOURCE[lead.source]?.label}. In {STAGE[lead.stage].label} since {fmtDate(lead.stage_changed_at, { today })}. {plural(view.touches, "touch", "touches")} so far.
        </p>
      </section>
    </>
  );
}

function BlurInput({ value, onSave, textarea, ...rest }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (String(v) !== String(value)) onSave(v); };
  return textarea
    ? <textarea className="textarea" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} {...rest} />
    : <input className="input" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} {...rest} />;
}

/* ---------- contact history ---------- */
function History({ view, setForm }) {
  const { state, run, today } = useCRM();
  const [note, setNote] = useState("");
  const staff = (id) => state.staff.find((s) => s.id === id);
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Contact history</h3><p>Every call, text and note, newest first.</p></div>
        {!["enrolled", "lost"].includes(view.lead.stage) && <button className="btn sm" onClick={() => setForm("contact")}>Log contact</button>}
      </div>
      <form className="row" style={{ marginBottom: 10 }} onSubmit={(e) => { e.preventDefault(); run(A.addNote, view.lead.id, note); setNote(""); }}>
        <input className="input" style={{ flex: 1 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a quick note" aria-label="Add a note" />
        <button className="btn sm" disabled={!note.trim()}>Add note</button>
      </form>
      <ul className="timeline">
        {view.activities.map((a) => {
          const icon = a.kind === "contact" ? a.method : a.kind;
          const good = a.outcome === "reached" || a.outcome === "replied";
          const s = staff(a.staff_id);
          return (
            <li key={a.id}>
              <span className={`ic ${good ? "good" : ""}`}><Icon name={icon} size={14} /></span>
              <div>
                <div>
                  {a.kind === "contact" && <b>{CONTACT_METHOD[a.method]?.label}{a.outcome ? `, ${CONTACT_OUTCOME[a.outcome]?.label.toLowerCase()}` : ""}. </b>}
                  {a.body}
                </div>
                <div className="meta">{fmtDateTime(a.at, { today })}{s ? `, ${s.name}` : ""}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- trials ---------- */
function Trials({ view, setForm }) {
  const { state, run, today, toast } = useCRM();
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h3>Trials</h3><p>Free week, extended trials and seasonal specials.</p></div>
        {!["enrolled", "lost"].includes(view.lead.stage) && <button className="btn sm" onClick={() => setForm("trial")}>{view.nextTrial ? "Rebook" : "Book trial"}</button>}
      </div>
      {!view.trials.length && <p className="muted">No trial booked yet.</p>}
      <div className="stack" style={{ gap: 8 }}>
        {view.trials.map((t) => (
          <div key={t.id} className="mini-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>{fmtDateTime(t.scheduled_at, { today, year: "auto" })}</b>
              <span className={`tag ${t.status === "attended" ? "ok" : t.status === "no_show" ? "crit" : t.status === "scheduled" ? "info" : ""}`}>{TRIAL_STATUS[t.status]?.label}</span>
            </div>
            <span className="ink2" style={{ fontSize: ".88rem" }}>
              {TRIAL_OFFER[t.offer]?.label}{TRIAL_OFFER[t.offer]?.price ? ` ($${TRIAL_OFFER[t.offer].price})` : ""}
              {t.instructor_id ? `, with ${state.staff.find((s) => s.id === t.instructor_id)?.name}` : ""}
            </span>
            {t.notes && <span style={{ fontSize: ".88rem" }}>{t.notes}</span>}
            {t.status === "scheduled" && (
              <div className="action-row" style={{ marginTop: 4 }}>
                <button className="btn sm" onClick={() => { run(A.recordTrial, t.id, "attended"); toast("Trial marked attended"); }}>Attended</button>
                <button className="btn sm" onClick={() => { run(A.recordTrial, t.id, "no_show"); toast("No-show recorded"); }}>No-show</button>
                <button className="btn sm ghost" onClick={() => { run(A.recordTrial, t.id, "cancelled"); toast("Trial cancelled"); }}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- family ---------- */
function FamilyTab({ view, onOpenLead }) {
  const { state, today, canSeeBilling } = useCRM();
  const fam = familyView(state, view.lead.family_id, today);
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div><h3>{fam.family.name} family</h3><p>{fam.family.town || "Town not recorded"}</p></div>
          <Link className="btn sm" to={`/families/${fam.family.id}`}>Open family</Link>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {fam.guardians.map((g) => (
            <div key={g.id} className="contact-line">
              <b>{g.first_name} {g.last_name}</b><span className="muted">{g.relationship}{g.is_primary ? ", primary" : ""}</span>
              {g.phone && <a href={telHref(g.phone)}>{g.phone}</a>}
              {g.email && <a href={`mailto:${g.email}`}>{g.email}</a>}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h3>Students in this family</h3></div>
        <div className="stack" style={{ gap: 8 }}>
          {fam.students.map((s) => {
            const l = s.leads[s.leads.length - 1];
            const m = s.memberships[0];
            const isThis = s.id === view.student.id;
            const content = (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>{s.first_name} {s.last_name}{isThis ? " (this lead)" : ""}</b>
                  {s.status === "active" ? <span className="tag ok">Training</span> : l ? <BeltTag stage={l.stage} short /> : <span className="tag">{s.status}</span>}
                </div>
                <span className="ink2" style={{ fontSize: ".86rem" }}>
                  {PROGRAM[s.program]?.label}
                  {m && canSeeBilling ? `, ${m.membership}${m.payment_type === "PIF" ? " (paid in full)" : m.monthly_amount ? `, ${money2(m.monthly_amount)}/mo` : ""}` : ""}
                  {s.rank ? `, ${s.rank} belt` : ""}
                </span>
              </>
            );
            return l && !isThis
              ? <button key={s.id} className="mini-card" onClick={() => onOpenLead?.(l.id)}>{content}</button>
              : <div key={s.id} className="mini-card">{content}</div>;
          })}
        </div>
      </section>
    </>
  );
}
