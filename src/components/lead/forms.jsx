/*
 * The forms behind every lead action. Each one is a modal that calls a
 * single domain action (src/data/actions.js) and closes.
 */
import { useMemo, useState } from "react";
import { useCRM } from "../../data/CRMContext.jsx";
import * as A from "../../data/actions.js";
import { Modal, Field, Select } from "../ui.jsx";
import {
  SOURCES, PROGRAMS, CONTACT_METHODS, CONTACT_OUTCOMES, TRIAL_OFFERS, LOST_REASONS, MEMBERSHIPS, MEMBERSHIP,
  PAYMENT_METHODS, CLASS_SLOTS, GOALS, programForAge,
} from "../../lib/constants.js";
import { addDays, pd, DOW, fmtDate } from "../../lib/dates.js";
import { quote, baseRate, nextFamilyDiscount } from "../../lib/billingAdapter.js";
import { money2 } from "../../lib/format.js";

/** Checkboxes to apply an action to siblings who are also in the pipeline. */
function SiblingPicker({ view, selected, setSelected, filter = () => true }) {
  const sibs = view.siblings.filter((l) => !["enrolled", "lost"].includes(l.stage) && filter(l));
  const { state } = useCRM();
  if (!sibs.length) return null;
  return (
    <div className="field full">
      <span>Also apply to</span>
      <div className="chips">
        {sibs.map((l) => {
          const s = state.students.find((x) => x.id === l.student_id);
          const on = selected.includes(l.id);
          return (
            <button type="button" key={l.id} className="chip-toggle" aria-pressed={on}
              onClick={() => setSelected(on ? selected.filter((x) => x !== l.id) : [...selected, l.id])}>
              {s?.first_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useSubmit(onClose) {
  const { run, toast } = useCRM();
  const [error, setError] = useState("");
  const submit = (fn, msg) => (e) => {
    e?.preventDefault();
    try { fn(run); toast(msg); onClose(); } catch (err) { setError(err.message); }
  };
  return { submit, error };
}

/* ---------- log a contact ---------- */
const QUICK_NEXT = [["Tomorrow", 1], ["In 2 days", 2], ["In 3 days", 3], ["Next week", 7]];

export function LogContactForm({ view, onClose, defaultMethod = "call" }) {
  const { today } = useCRM();
  const [method, setMethod] = useState(defaultMethod);
  const [outcome, setOutcome] = useState("no_answer");
  const [body, setBody] = useState("");
  const [next, setNext] = useState(addDays(today, 2));
  const [nextStep, setNextStep] = useState(view.lead.next_step || "");
  const [sibs, setSibs] = useState(view.siblings.filter((l) => !["enrolled", "lost"].includes(l.stage)).map((l) => l.id));
  const { submit, error } = useSubmit(onClose);
  return (
    <Modal title="Log contact" lede={`${view.name}${view.parentName ? ` · ${view.parentName}` : ""}`} onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit((run) => run(A.logContact, [view.lead.id, ...sibs], { method, outcome, body, next_follow_up: next, next_step: nextStep }), "Contact logged")}>Log contact</button></>}>
      <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
        <Field label="How">
          <Select value={method} onChange={setMethod} options={CONTACT_METHODS} />
        </Field>
        <Field label="What happened">
          <Select value={outcome} onChange={setOutcome} options={CONTACT_OUTCOMES} />
        </Field>
        <Field label="Notes" className="full">
          <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you talk about? What did they ask?" />
        </Field>
        <Field label="Next follow-up">
          <input type="date" className="input" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Next step">
          <input className="input" value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Book the trial" />
        </Field>
        <div className="chips full">
          {QUICK_NEXT.map(([l, n]) => <button type="button" key={l} className="chip-toggle" aria-pressed={next === addDays(today, n)} onClick={() => setNext(addDays(today, n))}>{l}</button>)}
        </div>
        <SiblingPicker view={view} selected={sibs} setSelected={setSibs} />
        {error && <p className="form-error full">{error}</p>}
      </form>
    </Modal>
  );
}

/* ---------- book a trial ---------- */
function upcomingSlots(program, today) {
  const slots = CLASS_SLOTS[program] || CLASS_SLOTS.kids;
  const out = [];
  for (let i = 0; i < 14 && out.length < 8; i++) {
    const d = addDays(today, i);
    const dow = DOW[pd(d).getDay()];
    for (const s of slots) if (s.startsWith(dow)) out.push({ date: d, time: s.slice(4), label: `${fmtDate(d, { today })} (${dow}) ${s.slice(4)}` });
  }
  return out.slice(0, 8);
}

export function ScheduleTrialForm({ view, onClose }) {
  const { state, today } = useCRM();
  const program = view.student?.program || view.lead.program_interest || "kids";
  const slots = useMemo(() => upcomingSlots(program, today), [program, today]);
  const [date, setDate] = useState(slots[0]?.date || today);
  const [time, setTime] = useState(slots[0]?.time || "5:10pm");
  const [offer, setOffer] = useState(view.lead.offer || "free_week");
  const instructors = state.staff.filter((s) => s.active && s.role !== "front_desk");
  const [instructor, setInstructor] = useState(instructors[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [sibs, setSibs] = useState([]);
  const { submit, error } = useSubmit(onClose);
  return (
    <Modal title={view.nextTrial ? "Rebook trial" : "Book trial"} lede={`${view.name} · ${PROGRAMS.find((p) => p.key === program)?.label}`} onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit((run) => run(A.scheduleTrial, [view.lead.id, ...sibs], { date, time, offer, instructor_id: instructor || null, notes }), "Trial booked")}>Book trial</button></>}>
      <div className="form-grid">
        <div className="field full">
          <span>Next open classes</span>
          <div className="chips">
            {slots.map((s) => <button type="button" key={s.label} className="chip-toggle" aria-pressed={date === s.date && time === s.time} onClick={() => { setDate(s.date); setTime(s.time); }}>{s.label}</button>)}
          </div>
        </div>
        <Field label="Date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><input className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="5:10pm" /></Field>
        <Field label="Offer"><Select value={offer} onChange={setOffer} options={TRIAL_OFFERS.map((o) => ({ value: o.key, label: `${o.label}${o.price ? ` ($${o.price})` : ""}` }))} /></Field>
        <Field label="Instructor"><Select value={instructor} onChange={setInstructor} placeholder="Not assigned" options={instructors.map((s) => ({ value: s.id, label: s.name }))} /></Field>
        <Field label="Notes" className="full"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private lesson first, then group class" /></Field>
        <SiblingPicker view={view} selected={sibs} setSelected={setSibs} />
        {error && <p className="form-error full">{error}</p>}
      </div>
    </Modal>
  );
}

/* ---------- nurture ---------- */
export function NurtureForm({ view, onClose }) {
  const { today } = useCRM();
  const [until, setUntil] = useState(addDays(today, 30));
  const [note, setNote] = useState("");
  const [sibs, setSibs] = useState([]);
  const { submit, error } = useSubmit(onClose);
  return (
    <Modal title="Move to Nurture" lede="Not now, but not lost. Pick a date to reconnect and it will show up as a follow-up that day." onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit((run) => run(A.nurture, [view.lead.id, ...sibs], until, note), "Moved to Nurture")}>Move to Nurture</button></>}>
      <div className="form-grid">
        <Field label="Reconnect on"><input type="date" className="input" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
        <div className="chips" style={{ alignSelf: "end" }}>
          {[["1 month", 30], ["2 months", 60], ["3 months", 90]].map(([l, n]) => <button type="button" key={l} className="chip-toggle" aria-pressed={until === addDays(today, n)} onClick={() => setUntil(addDays(today, n))}>{l}</button>)}
        </div>
        <Field label="Why" className="full"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Starting after soccer season" /></Field>
        <SiblingPicker view={view} selected={sibs} setSelected={setSibs} />
        {error && <p className="form-error full">{error}</p>}
      </div>
    </Modal>
  );
}

/* ---------- lost ---------- */
export function LostForm({ view, onClose }) {
  const [reason, setReason] = useState(view.unanswered >= 6 ? "no_response" : "");
  const [note, setNote] = useState("");
  const [sibs, setSibs] = useState([]);
  const { submit, error } = useSubmit(onClose);
  return (
    <Modal title="Mark as lost" lede="The reason feeds the lost-reasons report, so pick the closest one." onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn danger" onClick={submit((run) => run(A.markLost, [view.lead.id, ...sibs], reason, note), "Marked lost")}>Mark lost</button></>}>
      <div className="form-grid">
        <Field label="Reason" className="full"><Select value={reason} onChange={setReason} placeholder="Choose a reason" options={LOST_REASONS} /></Field>
        <Field label="Note" className="full"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <SiblingPicker view={view} selected={sibs} setSelected={setSibs} />
        {error && <p className="form-error full">{error}</p>}
      </div>
    </Modal>
  );
}

/* ---------- enroll ---------- */
export function EnrollForm({ view, onClose }) {
  const { state, today } = useCRM();
  const program = view.student?.program || view.lead.program_interest || "kids";
  const options = MEMBERSHIPS.filter((m) => baseRate(m.key, program) != null || m.pifOnly);
  const [membership, setMembership] = useState(program === "little_tigers" ? "3 Month Little Tigers" : "3 Month Yellow Belt");
  const [paymentType, setPaymentType] = useState("Monthly");
  const [method, setMethod] = useState("ACH");
  const activeInFamily = state.students.filter((s) => s.family_id === view.lead.family_id && s.status === "active").length;
  const [familyDiscount, setFamilyDiscount] = useState(nextFamilyDiscount(activeInFamily, baseRate(membership, program)));
  const [start, setStart] = useState(today);
  const q = quote({ membership, program, paymentType: MEMBERSHIP[membership]?.pifOnly ? "PIF" : paymentType, familyDiscount: Number(familyDiscount) || 0, method });
  const [monthly, setMonthly] = useState("");
  const [pif, setPif] = useState("");
  const { submit, error } = useSubmit(onClose);
  const isPif = MEMBERSHIP[membership]?.pifOnly || paymentType === "PIF";
  const amount = isPif ? (pif !== "" ? Number(pif) : q?.pifAmount) : (monthly !== "" ? Number(monthly) : q?.monthly);

  return (
    <Modal title={`Enroll ${view.student?.first_name || ""}`} lede="Creates the student's membership record with the billing fields from the roster. Amounts follow the price list; adjust if this family has a special rate."
      onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={submit((run) => run(A.enroll, view.lead.id, {
          membership, program, payment_type: isPif ? "PIF" : "Monthly", payment_method: method, start_date: start,
          monthly_amount: isPif ? null : amount, pif_amount: isPif ? amount : null, pif_discount: isPif ? q?.pifDiscount || 0 : 0,
          family_discount: isPif ? (Number(familyDiscount) || 0) * (q?.months || 0) : Number(familyDiscount) || 0, enrolled_on: today,
        }), `${view.student?.first_name} enrolled`)}>Enroll</button></>}>
      <div className="form-grid">
        <Field label="Membership" className="full">
          <Select value={membership} onChange={(v) => { setMembership(v); setMonthly(""); setPif(""); }} options={options.map((m) => ({ value: m.key, label: m.key + (m.legacy ? " (legacy)" : "") }))} />
        </Field>
        {!MEMBERSHIP[membership]?.pifOnly && (
          <Field label="Payment"><Select value={paymentType} onChange={(v) => { setPaymentType(v); setMonthly(""); setPif(""); }} options={[{ value: "Monthly", label: "Monthly draft" }, { value: "PIF", label: "Paid in full" }]} /></Field>
        )}
        {!isPif && <Field label="Payment method"><Select value={method} onChange={(v) => { setMethod(v); setMonthly(""); }} options={PAYMENT_METHODS} /></Field>}
        <Field label="Family discount" help={activeInFamily ? `(${activeInFamily} already training)` : "(first in family)"}>
          <input className="input" type="number" min="0" value={familyDiscount} onChange={(e) => { setFamilyDiscount(e.target.value); setMonthly(""); setPif(""); }} />
        </Field>
        <Field label="Start date"><input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        {isPif
          ? <Field label="Paid in full amount"><input className="input" type="number" step="0.01" value={pif !== "" ? pif : q?.pifAmount ?? ""} onChange={(e) => setPif(e.target.value)} /></Field>
          : <Field label="Monthly draft"><input className="input" type="number" step="0.01" value={monthly !== "" ? monthly : q?.monthly ?? ""} onChange={(e) => setMonthly(e.target.value)} /></Field>}
        <div className="full callout info">
          <span>
            {q ? (isPif
              ? <>Paid in full: <b>{money2(amount)}</b>{q.pifDiscount ? <> after a {money2(q.pifDiscount)} paid-in-full discount</> : null}.</>
              : <>Monthly draft: <b>{money2(amount)}</b>{method === "Card" ? " including the 3% card fee" : ""}{Number(familyDiscount) ? `, after the $${familyDiscount} family discount` : ""}.</>)
              : "This membership isn't offered for this program."}
            {MEMBERSHIP[membership]?.confirmPrice && <> The 3 month starter price isn't in the price list yet, so double-check it.</>}
          </span>
        </div>
        {error && <p className="form-error full">{error}</p>}
      </div>
    </Modal>
  );
}

/* ---------- new inquiry ---------- */
const blankChild = () => ({ first_name: "", age: "", program: "", experience: "", goals: [] });

export function NewLeadForm({ onClose, onCreated, familyId }) {
  const { state, run, today, toast } = useCRM();
  const family = familyId ? state.families.find((f) => f.id === familyId) : null;
  const [guardian, setGuardian] = useState({ first_name: "", last_name: "", relationship: "Mom", phone: "", email: "", preferred_contact: "text" });
  const [children, setChildren] = useState([blankChild()]);
  const [source, setSource] = useState(family ? "family" : "website");
  const [sourceDetail, setSourceDetail] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [town, setTown] = useState("");
  const [background, setBackground] = useState("");
  const [date, setDate] = useState(today);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState("");
  const active = state.students.filter((s) => s.status === "active").sort((a, b) => a.last_name.localeCompare(b.last_name));
  const setG = (k, v) => setGuardian({ ...guardian, [k]: v });
  const setC = (i, k, v) => setChildren(children.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  function save(e) {
    e.preventDefault();
    try {
      const kids = adult ? [{ first_name: guardian.first_name, last_name: guardian.last_name, age: children[0].age || 30, program: "teen_adult", experience: children[0].experience, goals: children[0].goals }] : children;
      if (!family && !guardian.first_name.trim()) throw new Error("Add the parent's first name");
      if (!family && !guardian.phone.trim() && !guardian.email.trim()) throw new Error("Add a phone number or email so we can reach them");
      const res = run(A.addInquiry, {
        familyId: family?.id, familyName: guardian.last_name, town,
        guardian: family ? null : { ...guardian, relationship: adult ? "Self" : guardian.relationship },
        children: kids.map((c) => ({ ...c, program: c.program || programForAge(c.age) })),
        source, source_detail: sourceDetail, referred_by_student_id: referredBy || null, background, inquiry_date: date,
      });
      toast(res.leads.length > 1 ? `${res.leads.length} inquiries added` : "Inquiry added");
      onCreated?.(res.leads[0].id);
      onClose();
    } catch (err) { setError(err.message); }
  }

  return (
    <Modal title={family ? `Add to the ${family.name} family` : "New inquiry"} lede="One entry per family. Each child gets their own place in the pipeline." onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Add inquiry</button></>}>
      <form className="stack" onSubmit={save}>
        {!family && (
          <>
            <div className="row">
              <label className="check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /> Adult signing up for themselves</label>
            </div>
            <div className="form-grid">
              <Field label={adult ? "First name" : "Parent first name"}><input className="input" value={guardian.first_name} onChange={(e) => setG("first_name", e.target.value)} autoComplete="off" /></Field>
              <Field label="Last name"><input className="input" value={guardian.last_name} onChange={(e) => setG("last_name", e.target.value)} autoComplete="off" /></Field>
              <Field label="Phone"><input className="input" type="tel" value={guardian.phone} onChange={(e) => setG("phone", e.target.value)} /></Field>
              <Field label="Email"><input className="input" type="email" value={guardian.email} onChange={(e) => setG("email", e.target.value)} /></Field>
              {!adult && <Field label="Relationship"><Select value={guardian.relationship} onChange={(v) => setG("relationship", v)} options={["Mom", "Dad", "Guardian", "Grandparent"]} /></Field>}
              <Field label="Prefers"><Select value={guardian.preferred_contact} onChange={(v) => setG("preferred_contact", v)} options={[{ value: "text", label: "Text" }, { value: "call", label: "Call" }, { value: "email", label: "Email" }]} /></Field>
              <Field label="Town"><input className="input" value={town} onChange={(e) => setTown(e.target.value)} placeholder="West Chester" /></Field>
            </div>
          </>
        )}
        {(adult ? children.slice(0, 1) : children).map((c, i) => (
          <fieldset key={i} className="panel" style={{ padding: 14 }}>
            <legend className="muted" style={{ padding: "0 4px" }}>{adult ? "Training details" : `Child ${i + 1}`}</legend>
            <div className="form-grid">
              {!adult && <Field label="First name"><input className="input" value={c.first_name} onChange={(e) => setC(i, "first_name", e.target.value)} autoComplete="off" /></Field>}
              <Field label="Age"><input className="input" type="number" step="0.5" min="3" value={c.age} onChange={(e) => setC(i, "age", e.target.value)} /></Field>
              {!adult && <Field label="Program" help={c.age && !c.program ? `(${PROGRAMS.find((p) => p.key === programForAge(c.age))?.label} by age)` : ""}>
                <Select value={c.program} onChange={(v) => setC(i, "program", v)} placeholder="Pick by age" options={PROGRAMS.map((p) => ({ value: p.key, label: `${p.label} (${p.ages})` }))} />
              </Field>}
              <Field label="Previous experience"><input className="input" value={c.experience} onChange={(e) => setC(i, "experience", e.target.value)} placeholder="None, or e.g. 6 months karate" /></Field>
              <div className="field full">
                <span>Goals</span>
                <div className="chips">
                  {GOALS.map((g) => { const on = c.goals.includes(g); return <button type="button" key={g} className="chip-toggle" aria-pressed={on} onClick={() => setC(i, "goals", on ? c.goals.filter((x) => x !== g) : [...c.goals, g])}>{g}</button>; })}
                </div>
              </div>
            </div>
            {!adult && children.length > 1 && <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setChildren(children.filter((_, j) => j !== i))}>Remove child</button>}
          </fieldset>
        ))}
        {!adult && <div><button type="button" className="btn sm" onClick={() => setChildren([...children, blankChild()])}>Add another child</button></div>}
        <div className="form-grid">
          <Field label="Lead source"><Select value={source} onChange={setSource} options={SOURCES} /></Field>
          <Field label="Inquiry date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {source === "referral"
            ? <Field label="Referred by" className="full"><Select value={referredBy} onChange={setReferredBy} placeholder="Pick a current student" options={active.map((s) => ({ value: s.id, label: `${s.last_name}, ${s.first_name}` }))} /></Field>
            : <Field label="Source detail" className="full"><input className="input" value={sourceDetail} onChange={(e) => setSourceDetail(e.target.value)} placeholder="Campaign, event or school name" /></Field>}
          <Field label="What they told us" className="full"><textarea className="textarea" value={background} onChange={(e) => setBackground(e.target.value)} placeholder="Why they're looking, what the child is like, schedule needs" /></Field>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
