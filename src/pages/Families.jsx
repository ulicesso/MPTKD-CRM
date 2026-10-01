/*
 * Families: households with their parents, students (current and prospective)
 * and memberships. This is the seed of the Students module: it already links
 * a family's leads to the student and membership records enrollment creates.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCRM } from "../data/CRMContext.jsx";
import { familySummaries, familyView } from "../data/selectors.js";
import * as A from "../data/actions.js";
import { BeltTag, DueChip, Empty, Field, Modal, Select } from "../components/ui.jsx";
import { NewLeadForm } from "../components/lead/forms.jsx";
import Icon from "../components/Icon.jsx";
import { PROGRAM } from "../lib/constants.js";
import { fmtDate } from "../lib/dates.js";
import { money2, telHref, plural } from "../lib/format.js";
import { useMedia } from "./Leads.jsx";

const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10 < 4 ? n % 10 : 0] || "th");

export default function Families({ onOpen }) {
  const { id } = useParams();
  return id ? <FamilyDetail id={id} onOpen={onOpen} /> : <FamilyList />;
}

function FamilyList() {
  const { state, today } = useCRM();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const narrow = useMedia("(max-width: 760px)");
  const fams = familySummaries(state, today);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return fams.filter((f) => {
      if (filter === "training" && !f.activeStudents.length) return false;
      if (filter === "pipeline" && !f.openLeads.length) return false;
      if (filter === "both" && !(f.activeStudents.length && f.openLeads.length)) return false;
      if (filter === "multi" && f.students.length < 2) return false;
      if (!n) return true;
      return [f.family.name, f.family.town, ...f.guardians.map((g) => `${g.first_name} ${g.last_name} ${g.phone} ${g.email}`), ...f.students.map((s) => s.first_name)].join(" ").toLowerCase().includes(n);
    }).sort((a, b) => a.family.name.localeCompare(b.family.name));
  }, [fams, q, filter]);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Families</h1>
          <p className="sub">{fams.length} households. {fams.filter((f) => f.students.length > 1).length} with more than one student.</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input className="input" type="search" placeholder="Search family, parent, student, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search families" />
        </div>
        <Select value={filter} onChange={setFilter} aria-label="Show" options={[
          { value: "all", label: "All families" }, { value: "training", label: "Training now" }, { value: "pipeline", label: "In the pipeline" },
          { value: "both", label: "Training, with a sibling in the pipeline" }, { value: "multi", label: "More than one student" },
        ]} />
        <span className="result-count">{plural(rows.length, "family", "families")}</span>
      </div>
      {!rows.length ? <div className="panel"><Empty title="No families match">Try another name or phone number.</Empty></div> : narrow ? (
        <div className="stack" style={{ gap: 8 }}>
          {rows.slice(0, 200).map((f) => (
            <Link key={f.family.id} to={`/families/${f.family.id}`} className="card" style={{ textDecoration: "none" }}>
              <span className="name">{f.family.name} family</span>
              <span className="meta">{f.students.map((s) => s.first_name).join(", ")}</span>
              <div className="foot">
                {f.activeStudents.length > 0 && <span className="tag ok">{f.activeStudents.length} training</span>}
                {f.openLeads.length > 0 && <span className="tag info">{f.openLeads.length} in pipeline</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel flush">
          <div className="tbl-wrap" style={{ maxHeight: "calc(100vh - 260px)" }}>
            <table>
              <thead><tr><th>Family</th><th>Primary contact</th><th>Students</th><th className="r">Training</th><th className="r">In pipeline</th><th>Town</th></tr></thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.family.id} className="click" tabIndex={0} onClick={() => nav(`/families/${f.family.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/families/${f.family.id}`)}>
                    <td className="cell-main">{f.family.name}</td>
                    <td>{f.primary ? <><div>{f.primary.first_name} {f.primary.last_name}</div><div className="cell-sub">{f.primary.phone}</div></> : <span className="muted">—</span>}</td>
                    <td>{f.students.map((s) => s.first_name).join(", ")}</td>
                    <td className="r">{f.activeStudents.length || "—"}</td>
                    <td className="r">{f.openLeads.length || "—"}</td>
                    <td>{f.family.town || "—"}</td>
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

function FamilyDetail({ id, onOpen }) {
  const { state, today, run, canSeeBilling, toast } = useCRM();
  const fam = familyView(state, id, today);
  const [adding, setAdding] = useState(false);
  const [addingGuardian, setAddingGuardian] = useState(false);
  if (!fam) return <main className="page"><Empty title="Family not found" action={<Link className="btn" to="/families">Back to families</Link>} /></main>;
  const monthly = fam.students.flatMap((s) => s.memberships.filter((m) => m.status !== "Ended" && m.payment_type === "Monthly")).reduce((a, m) => a + Number(m.monthly_amount || 0), 0);

  return (
    <main className="page">
      <div><Link to="/families" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="back" size={16} />Families</Link></div>
      <div className="page-head">
        <div>
          <h1>{fam.family.name} family</h1>
          <p className="sub">
            {fam.family.town || "Town not recorded"}. {plural(fam.activeStudents.length, "student")} training
            {canSeeBilling && monthly ? `, ${money2(monthly)} a month` : ""}.
          </p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} />Add a sibling inquiry</button>
      </div>

      <div className="grid-main">
        <section className="panel" aria-labelledby="st-h">
          <div className="panel-head"><div><h2 id="st-h">Students</h2><p>Everyone in the household who trains or has asked about training.</p></div></div>
          <div className="stack" style={{ gap: 10 }}>
            {fam.students.map((s) => {
              const lead = s.leads[s.leads.length - 1];
              const lv = lead && fam.leads.find((v) => v.lead.id === lead.id);
              return (
                <div key={s.id} className="mini-card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <b style={{ fontSize: "1.05rem" }}>{s.first_name} {s.last_name}</b>
                    {s.status === "active" ? <span className="tag ok">Training</span> : lead ? <BeltTag stage={lead.stage} /> : <span className="tag">{s.status}</span>}
                  </div>
                  <span className="ink2" style={{ fontSize: ".9rem" }}>
                    {[PROGRAM[s.program]?.label, s.rank && s.status === "active" && `${s.rank} belt`, s.joined_on && `joined ${fmtDate(s.joined_on, { today, year: true })}`].filter(Boolean).join(", ")}
                  </span>
                  {canSeeBilling && s.memberships.map((m) => (
                    <span key={m.id} style={{ fontSize: ".88rem" }}>
                      {m.membership}, {m.payment_type === "PIF" ? `paid in full ${money2(m.pif_amount)}` : `${money2(m.monthly_amount)}/mo by ${m.payment_method} on the ${ordinal(m.billing_day)}`}
                      {m.end_date ? `, ends ${fmtDate(m.end_date, { today, year: true })}` : ", month to month"}
                      {Number(m.family_discount) ? `, family discount ${money2(m.family_discount)}` : ""}
                      {m.status !== "Active" && <span className="tag warn" style={{ marginLeft: 6 }}>{m.status}</span>}
                    </span>
                  ))}
                  {lv && lead.stage !== "enrolled" && (
                    <div className="row">
                      <DueChip followUp={lv.followUp} date={lead.next_follow_up} today={today} />
                      <button className="btn sm" onClick={() => onOpen(lead.id)}>Open lead</button>
                    </div>
                  )}
                  {lv && lead.stage === "enrolled" && <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => onOpen(lead.id)}>See how they enrolled</button>}
                </div>
              );
            })}
          </div>
        </section>

        <div className="stack">
          <section className="panel" aria-labelledby="gu-h">
            <div className="panel-head"><h2 id="gu-h">Parents and contacts</h2><button className="btn sm" onClick={() => setAddingGuardian(true)}>Add contact</button></div>
            <div className="stack" style={{ gap: 10 }}>
              {fam.guardians.map((g) => (
                <div key={g.id}>
                  <b>{g.first_name} {g.last_name}</b> <span className="muted">{g.relationship}{g.is_primary ? ", primary" : ""}{g.preferred_contact ? `, prefers ${g.preferred_contact}` : ""}</span>
                  <div className="contact-line">
                    {g.phone && <a href={telHref(g.phone)}>{g.phone}</a>}
                    {g.email && <a href={`mailto:${g.email}`}>{g.email}</a>}
                  </div>
                </div>
              ))}
              {!fam.guardians.length && <p className="muted">No contacts yet.</p>}
            </div>
          </section>
          <section className="panel" aria-labelledby="fn-h">
            <div className="panel-head"><h2 id="fn-h">Family notes</h2></div>
            <textarea className="textarea" defaultValue={fam.family.notes || ""} aria-label="Family notes"
              onBlur={(e) => { if (e.target.value !== (fam.family.notes || "")) { run(A.updateFamily, fam.family.id, { notes: e.target.value }); toast("Notes saved"); } }}
              placeholder="Schedules, pickup arrangements, anything the front desk should know" />
          </section>
        </div>
      </div>

      {adding && <NewLeadForm familyId={fam.family.id} onClose={() => setAdding(false)} onCreated={onOpen} />}
      {addingGuardian && <GuardianForm familyId={fam.family.id} onClose={() => setAddingGuardian(false)} />}
    </main>
  );
}

function GuardianForm({ familyId, onClose }) {
  const { run, toast } = useCRM();
  const [g, setG] = useState({ first_name: "", last_name: "", relationship: "Dad", phone: "", email: "", preferred_contact: "text" });
  const set = (k, v) => setG({ ...g, [k]: v });
  return (
    <Modal title="Add a contact" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!g.first_name.trim()} onClick={() => { run(A.addGuardian, familyId, g); toast("Contact added"); onClose(); }}>Add contact</button></>}>
      <div className="form-grid">
        <Field label="First name"><input className="input" value={g.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
        <Field label="Last name"><input className="input" value={g.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
        <Field label="Relationship"><Select value={g.relationship} onChange={(v) => set("relationship", v)} options={["Mom", "Dad", "Guardian", "Grandparent", "Emergency contact"]} /></Field>
        <Field label="Prefers"><Select value={g.preferred_contact} onChange={(v) => set("preferred_contact", v)} options={[{ value: "text", label: "Text" }, { value: "call", label: "Call" }, { value: "email", label: "Email" }]} /></Field>
        <Field label="Phone"><input className="input" type="tel" value={g.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={g.email} onChange={(e) => set("email", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
