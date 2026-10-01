/*
 * Dashboard: today's work first (trials, new inquiries, follow-ups), then
 * the pipeline at a glance and this month's numbers.
 */
import { Link } from "react-router-dom";
import { useCRM } from "../data/CRMContext.jsx";
import { allLeadViews, billingMembers } from "../data/selectors.js";
import { funnel, monthRange, pipelineNow, trialStats, velocity } from "../lib/metrics.js";
import { summarize } from "../lib/billing.js";
import { StageTrack, BeltTag, Stat, Empty } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { PROGRAM, SOURCE } from "../lib/constants.js";
import { fmtTime, fmtDate, MONTHS, pd, addDays, relDay, DOW, DAY_NAMES } from "../lib/dates.js";
import { money, pct, plural } from "../lib/format.js";

/** Merge siblings that share a family and a bucket into one row. */
function byFamily(views) {
  const m = new Map();
  for (const v of views) {
    const k = v.lead.family_id;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(v);
  }
  return [...m.values()];
}
function names(group) {
  const last = group[0].student?.last_name;
  const firsts = group.map((v) => v.student?.first_name);
  return (firsts.length > 1 ? firsts.slice(0, -1).join(", ") + " & " + firsts.at(-1) : firsts[0]) + " " + (last || "");
}

function WorkRow({ when, group, what, onOpen, tone }) {
  return (
    <li>
      <button onClick={() => onOpen(group[0].lead.id)}>
        <span className="when" style={tone ? { color: `var(--${tone})` } : undefined}>{when}</span>
        <span style={{ minWidth: 0 }}>
          <span className="who">{names(group)}</span>
          <span className="what" style={{ display: "block" }}>{what}</span>
        </span>
        <BeltTag stage={group[0].lead.stage} short />
      </button>
    </li>
  );
}

export default function Dashboard({ onOpen, onAdd }) {
  const { state, today, me, canSeeBilling } = useCRM();
  const views = allLeadViews(state, today);
  const t = pd(today);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const trialsToday = views.filter((v) => v.nextTrial?.scheduled_at.startsWith(today))
    .sort((a, b) => (a.nextTrial.scheduled_at < b.nextTrial.scheduled_at ? -1 : 1));
  const newToContact = views.filter((v) => v.lead.stage === "new");
  const trialToday = (v) => v.nextTrial?.scheduled_at.startsWith(today);
  const overdue = views.filter((v) => v.followUp.key === "overdue" && v.lead.stage !== "new" && !trialToday(v)).sort((a, b) => a.followUp.days - b.followUp.days);
  const dueToday = views.filter((v) => v.followUp.key === "today" && v.lead.stage !== "new" && !v.nextTrial?.scheduled_at.startsWith(today));
  const weekEnd = addDays(today, 7);
  const weekTrials = views.filter((v) => v.nextTrial && v.nextTrial.scheduled_at.slice(0, 10) > today && v.nextTrial.scheduled_at.slice(0, 10) <= weekEnd)
    .sort((a, b) => (a.nextTrial.scheduled_at < b.nextTrial.scheduled_at ? -1 : 1));
  const workCount = trialsToday.length + newToContact.length + overdue.length + dueToday.length;

  const monthKey = today.slice(0, 7);
  const thisMonth = { from: monthRange(monthKey).from, to: today };
  const lm = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const lastKey = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}`;
  const lastSame = { from: monthRange(lastKey).from, to: `${lastKey}-${String(Math.min(t.getDate(), new Date(lm.getFullYear(), lm.getMonth() + 1, 0).getDate())).padStart(2, "0")}` };
  const lastFull = monthRange(lastKey);
  const fNow = funnel(state, thisMonth), fPrev = funnel(state, lastSame);
  const enrollNow = state.leads.filter((l) => l.stage === "enrolled" && l.enrolled_on >= thisMonth.from && l.enrolled_on <= today).length;
  const enrollPrev = state.leads.filter((l) => l.stage === "enrolled" && l.enrolled_on >= lastSame.from && l.enrolled_on <= lastSame.to).length;
  const trialsNow = trialStats(state, thisMonth), trialsPrev = trialStats(state, lastSame);
  const last90 = { from: addDays(today, -90), to: today };
  const vel = velocity(state, last90);
  const fLast = funnel(state, lastFull);
  const counts = pipelineNow(state);

  const recentEnrolled = state.leads.filter((l) => l.stage === "enrolled" && l.enrolled_on >= addDays(today, -21))
    .sort((a, b) => (a.enrolled_on < b.enrolled_on ? 1 : -1)).slice(0, 6).map((l) => views.find((v) => v.lead.id === l.id));

  const S = canSeeBilling ? summarize(billingMembers(state), t) : null;
  const prevSnap = state.billing_snapshots.slice().sort((a, b) => (a.as_of < b.as_of ? 1 : -1))[0];

  const delta = (a, b) => {
    if (b == null) return null;
    const d = a - b;
    if (!d) return <span className="muted">Same as this point last month</span>;
    return <span className={d > 0 ? "delta-up" : "delta-down"}>{d > 0 ? "Up" : "Down"} {Math.abs(d)} vs this point last month</span>;
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{greet}{me ? `, ${me.name.split(" ")[0]}` : ""}</h1>
          <p className="sub">{DAY_NAMES[t.getDay()]}, {MONTHS[t.getMonth()]} {t.getDate()}. {workCount ? `${plural(workCount, "thing")} on today's list.` : "Nothing urgent on today's list."}</p>
        </div>
        <button className="btn primary" onClick={onAdd}><Icon name="plus" size={16} />New inquiry</button>
      </div>

      <div className="grid-main">
        <section className="panel" aria-labelledby="today-h">
          <div className="panel-head">
            <div><h2 id="today-h">Today</h2><p>Trials on the mat, new families waiting on a first reply, and follow-ups that are due.</p></div>
          </div>
          {!workCount && <Empty title="You're caught up">No trials, new inquiries or follow-ups due today. Check the week ahead on the right.</Empty>}
          {trialsToday.length > 0 && (
            <div className="work-group">
              <h3>Trials today <span className="n">{trialsToday.length}</span></h3>
              <ul className="work">
                {byFamily(trialsToday).map((g) => (
                  <WorkRow key={g[0].lead.id} group={g} onOpen={onOpen} when={fmtTime(g[0].nextTrial.scheduled_at)}
                    what={`${PROGRAM[g[0].lead.program_interest]?.label}, ${g[0].parentName || "parent"}${g[0].nextTrial.instructor_id ? `, with ${state.staff.find((s) => s.id === g[0].nextTrial.instructor_id)?.name}` : ""}`} />
                ))}
              </ul>
            </div>
          )}
          {newToContact.length > 0 && (
            <div className="work-group">
              <h3>New inquiries to contact <span className="n">{newToContact.length}</span></h3>
              <ul className="work">
                {byFamily(newToContact).map((g) => (
                  <WorkRow key={g[0].lead.id} group={g} onOpen={onOpen} tone={g[0].followUp.key === "overdue" ? "signal" : undefined}
                    when={relDay(g[0].lead.inquiry_date, today) === "today" ? "New" : `${-g[0].followUp.days || 0}d`}
                    what={`${SOURCE[g[0].lead.source]?.label}, inquired ${relDay(g[0].lead.inquiry_date, today)}. ${g[0].primary?.phone || g[0].primary?.email || ""}`} />
                ))}
              </ul>
            </div>
          )}
          {overdue.length > 0 && (
            <div className="work-group">
              <h3>Overdue follow-ups <span className="n">{overdue.length}</span></h3>
              <ul className="work">
                {byFamily(overdue).map((g) => (
                  <WorkRow key={g[0].lead.id} group={g} onOpen={onOpen} tone="signal" when={`${-g[0].followUp.days}d late`}
                    what={g[0].lead.next_step || "Follow up"} />
                ))}
              </ul>
            </div>
          )}
          {dueToday.length > 0 && (
            <div className="work-group">
              <h3>Follow-ups due today <span className="n">{dueToday.length}</span></h3>
              <ul className="work">
                {byFamily(dueToday).map((g) => (
                  <WorkRow key={g[0].lead.id} group={g} onOpen={onOpen} when="Today" what={g[0].lead.next_step || "Follow up"} />
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="stack">
          <section className="panel" aria-labelledby="week-h">
            <div className="panel-head"><div><h2 id="week-h">Trials this week</h2><p>Send a confirmation text the day before.</p></div></div>
            {!weekTrials.length ? <p className="muted">No trials booked in the next 7 days.</p> : (
              <ul className="work">
                {byFamily(weekTrials).map((g) => (
                  <WorkRow key={g[0].lead.id} group={g} onOpen={onOpen}
                    when={DOW[pd(g[0].nextTrial.scheduled_at).getDay()]}
                    what={`${fmtDate(g[0].nextTrial.scheduled_at, { today })} at ${fmtTime(g[0].nextTrial.scheduled_at)}, ${PROGRAM[g[0].lead.program_interest]?.label}`} />
                ))}
              </ul>
            )}
          </section>
          <section className="panel" aria-labelledby="enr-h">
            <div className="panel-head"><div><h2 id="enr-h">Recently enrolled</h2><p>Hand these to the new student checklist.</p></div></div>
            {!recentEnrolled.length ? <p className="muted">No enrollments in the last three weeks.</p> : (
              <ul className="work">
                {recentEnrolled.map((v) => (
                  <WorkRow key={v.lead.id} group={[v]} onOpen={onOpen} when={fmtDate(v.lead.enrolled_on, { today })}
                    what={canSeeBilling && v.membership ? `${v.membership.membership}${v.membership.payment_type === "PIF" ? ", paid in full" : ""}` : PROGRAM[v.lead.program_interest]?.label} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="panel" aria-labelledby="pipe-h">
        <div className="panel-head">
          <div><h2 id="pipe-h">Where every lead stands</h2><p>Each stage is a belt on the way to enrolling. Tap a stage to see those leads.</p></div>
          <Link className="btn sm" to="/pipeline">Open the pipeline</Link>
        </div>
        <StageTrack counts={counts} hrefFor={(k) => `/leads?stage=${k}`} />
      </section>

      <section aria-labelledby="month-h" className="stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id="month-h">{MONTHS[t.getMonth()]} so far</h2>
          <Link to="/analytics" className="muted">Full analytics</Link>
        </div>
        <div className="stats">
          <Stat label="Inquiries" value={fNow.inquiries} foot={delta(fNow.inquiries, fPrev.inquiries)} />
          <Stat label="Trials attended" value={trialsNow.attended} foot={delta(trialsNow.attended, trialsPrev.attended)} />
          <Stat label="Enrollments" value={enrollNow} foot={delta(enrollNow, enrollPrev)} />
          <Stat label={`Inquiry to sign, ${MONTHS[lm.getMonth()]}`} value={pct(fLast.inquiryToSign)} foot={`${fLast.signs} of ${fLast.inquiries} inquiries have signed`} />
          <Stat label="First reply, last 90 days" value={vel.medianFirstTouchHours == null ? "—" : vel.medianFirstTouchHours < 1 ? `${Math.round(vel.medianFirstTouchHours * 60)} min` : `${vel.medianFirstTouchHours.toFixed(1)} hrs`}
            foot={`Median. ${pct(vel.sameDayRate)} contacted the same day`} />
        </div>
      </section>

      {S && (
        <section className="panel" aria-labelledby="bill-h">
          <div className="panel-head">
            <div><h2 id="bill-h">Membership snapshot</h2><p>From the membership records enrolled leads create. The full tuition dashboard moves in next.</p></div>
          </div>
          <div className="stats">
            <Stat label="Monthly billing" value={money(S.mrr)} foot={prevSnap ? <span className={S.mrr >= prevSnap.mrr ? "delta-up" : "delta-down"}>{S.mrr >= prevSnap.mrr ? "Up" : "Down"} {money(Math.abs(S.mrr - prevSnap.mrr))} since {fmtDate(prevSnap.as_of, { today })}</span> : null} />
            <Stat label="Expected this month" value={money(S.total)} foot={`${money(S.toCome)} still to come`} />
            <Stat label="Monthly members" value={S.monthlyCount} foot={`${plural(state.students.filter((s) => s.status === "active").length, "student")} training`} />
            <Stat label="Paid in full" value={S.pifCount} foot={`${money(S.pifValue)} prepaid${S.pifRenew90.length ? `, ${S.pifRenew90.length} renew within 90 days` : ""}`} />
          </div>
        </section>
      )}
    </main>
  );
}
