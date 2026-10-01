/*
 * Analytics: the numbers the studio tracked by hand in the Offensive Stats
 * and Marketing Stats tabs, computed from CRM records. Definitions live in
 * src/lib/metrics.js.
 */
import { useMemo, useState } from "react";
import { useCRM } from "../data/CRMContext.jsx";
import * as M from "../lib/metrics.js";
import * as A from "../data/actions.js";
import { Stat, Seg, Modal } from "../components/ui.jsx";
import { GroupedBars, HBars, Funnel, SplitBar } from "../components/charts.jsx";
import { SOURCE, SOURCES, TRIAL_OFFER, PROGRAMS } from "../lib/constants.js";
import { addDays, monthLabel, pd } from "../lib/dates.js";
import { money, pct } from "../lib/format.js";

function periodRange(key, today) {
  const t = pd(today);
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  switch (key) {
    case "month": return { from: M.monthRange(ym(t)).from, to: today, label: "this month" };
    case "last": { const d = new Date(t.getFullYear(), t.getMonth() - 1, 1); return { ...M.monthRange(ym(d)), label: monthLabel(ym(d)) }; }
    case "90": return { from: addDays(today, -89), to: today, label: "the last 90 days" };
    case "ytd": return { from: `${t.getFullYear()}-01-01`, to: today, label: "this year" };
    default: return { from: addDays(today, -364), to: today, label: "the last 12 months" };
  }
}
const PERIODS = [
  { value: "month", label: "This month" }, { value: "last", label: "Last month" }, { value: "90", label: "90 days" },
  { value: "ytd", label: "Year to date" }, { value: "365", label: "12 months" },
];

export default function Analytics() {
  const { state, today, canSeeBilling } = useCRM();
  const [period, setPeriod] = useState("365");
  const [editSpend, setEditSpend] = useState(false);
  const range = periodRange(period, today);

  const f = M.funnel(state, range);
  const trials = M.trialStats(state, range);
  const vel = M.velocity(state, range);
  const sources = M.bySource(state, range);
  const lost = M.lostReasons(state, range);
  const programs = M.byProgram(state, range);
  const mix = M.enrollmentMix(state, range);
  const team = M.staffActivity(state, range);
  const months = useMemo(() => M.monthsBetween(addDays(today, -334), today), [today]);
  const monthly = M.monthlyTable(state, months);
  const totals = M.totalsRow(monthly);
  const spend = sources.reduce((a, r) => a + r.spend, 0);
  const paidSigns = sources.filter((r) => r.spend).reduce((a, r) => a + r.signs, 0);
  const openNow = M.openLeads(state).length;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="sub">Leads grouped by the date they inquired, like the monthly results in the inquiry log.</p>
        </div>
        <Seg value={period} onChange={setPeriod} options={PERIODS} label="Time period" />
      </div>

      <div className="grid-2">
        <section className="panel" aria-labelledby="fun-h">
          <div className="panel-head"><div><h2 id="fun-h">From inquiry to student</h2><p>Inquiries from {range.label}, and how far they've come.</p></div></div>
          <Funnel steps={[
            { label: "Inquiries", value: f.inquiries, conv: `${pct(f.inquiryToLead)} were qualified leads` },
            { label: "Leads", value: f.qualified, conv: `${pct(f.leadToProspect)} came in for a trial` },
            { label: "Prospects", value: f.prospects, conv: `${pct(f.prospectToSign)} signed up` },
            { label: "Signed", value: f.signs },
          ]} />
          <p className="muted" style={{ fontSize: ".84rem", marginTop: 12 }}>
            Lead: in our area, right age and reachable. Prospect: came in for a trial (or signed on the spot). {openNow} leads are still open, so recent months keep climbing.
          </p>
        </section>
        <div className="stats" style={{ alignContent: "start" }}>
          <Stat label="Inquiry to prospect" value={pct(f.inquiryToProspect)} foot={`${f.prospects} of ${f.inquiries}`} />
          <Stat label="Prospect to student" value={pct(f.prospectToSign)} foot={`${f.signs} of ${f.prospects}`} />
          <Stat label="Inquiry to student" value={pct(f.inquiryToSign)} foot="The number that pays the bills" />
          <Stat label="Trial show rate" value={pct(trials.showRate)} foot={`${trials.noShows} no-shows of ${trials.attended + trials.noShows} trials`} />
          <Stat label="Days to sign" value={vel.medianDaysToSign ?? "—"} foot={`Median, inquiry to enrollment. ${vel.avgTouchesToSign ? vel.avgTouchesToSign.toFixed(1) : "—"} touches on average`} />
          {canSeeBilling && <Stat label="Cost per signing" value={paidSigns ? money(spend / paidSigns) : "—"} foot={`${money(spend)} ad and event spend, ${paidSigns} paid-source signings`} />}
        </div>
      </div>

      <section className="panel" aria-labelledby="mon-h">
        <div className="panel-head">
          <div><h2 id="mon-h">Month by month</h2><p>The last 12 months, same columns as the Offensive Stats sheet. Active prospects and monthly signings count what happened that month, whenever the family first inquired.</p></div>
          <div className="legend"><span><i className="sw" style={{ background: "var(--s1)" }} />Inquiries</span><span><i className="sw" style={{ background: "var(--s2)" }} />Prospects</span><span><i className="sw" style={{ background: "var(--s3)" }} />Signed</span></div>
        </div>
        <GroupedBars ariaLabel="Inquiries, prospects and signings by month"
          series={[{ key: "inquiries", label: "Inquiries", color: "var(--s1)" }, { key: "prospects", label: "Prospects", color: "var(--s2)" }, { key: "signs", label: "Signed", color: "var(--s3)" }]}
          rows={monthly.map((r) => ({ label: monthLabel(r.key, true).slice(0, 3), full: monthLabel(r.key), ...r }))} />
        <div className="tbl-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr>
              <th>Month</th><th className="r">Inquiries</th><th className="r">Prospects</th><th className="r">Signed</th>
              <th className="r">Inquiry to prospect</th><th className="r">Prospect to student</th>
              <th className="r">Active prospects</th><th className="r">Monthly signings</th><th className="r">Signing rate</th><th>Top source</th>
            </tr></thead>
            <tbody>
              {monthly.map((r) => (
                <tr key={r.key}>
                  <td className="nowrap">{monthLabel(r.key)}</td><td className="r">{r.inquiries}</td><td className="r">{r.prospects}</td><td className="r">{r.signs}</td>
                  <td className="r">{pct(r.inquiryToProspect)}</td><td className="r">{pct(r.prospectToSign)}</td>
                  <td className="r">{r.activeProspects}</td><td className="r">{r.signings}</td><td className="r">{pct(r.signingRate)}</td>
                  <td className="nowrap">{SOURCE[r.topSource]?.label || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Average</td><td className="r">{(totals.inquiries / monthly.length).toFixed(1)}</td><td className="r">{(totals.prospects / monthly.length).toFixed(1)}</td><td className="r">{(totals.signs / monthly.length).toFixed(1)}</td>
                <td className="r">{pct(avg(monthly.map((r) => r.inquiryToProspect)))}</td><td className="r">{pct(avg(monthly.map((r) => r.prospectToSign)))}</td>
                <td className="r">{(totals.activeProspects / monthly.length).toFixed(1)}</td><td className="r">{(totals.signings / monthly.length).toFixed(1)}</td><td className="r">{pct(avg(monthly.map((r) => r.signingRate)))}</td><td />
              </tr>
              <tr>
                <td>Total</td><td className="r">{totals.inquiries}</td><td className="r">{totals.prospects}</td><td className="r">{totals.signs}</td>
                <td className="r">{pct(totals.inquiryToProspect)}</td><td className="r">{pct(totals.prospectToSign)}</td>
                <td className="r">{totals.activeProspects}</td><td className="r">{totals.signings}</td><td className="r">{pct(totals.signingRate)}</td><td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="src-h">
        <div className="panel-head">
          <div><h2 id="src-h">Lead sources</h2><p>Which sources bring families who actually sign, for {range.label}. Cost per signing matters more than cost per lead.</p></div>
          {canSeeBilling && <button className="btn sm" onClick={() => setEditSpend(true)}>Edit ad spend</button>}
        </div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ marginBottom: 10 }}>Inquiries</h3>
            <HBars rows={sources.slice().sort((a, b) => b.inquiries - a.inquiries).map((r) => ({ label: r.label, value: r.inquiries }))} />
          </div>
          <div>
            <h3 style={{ marginBottom: 10 }}>Signed</h3>
            <HBars color="var(--s3)" rows={sources.slice().sort((a, b) => b.signs - a.signs).filter((r) => r.signs).map((r) => ({ label: r.label, value: r.signs }))} empty="No signings in this period yet." />
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>Source</th><th className="r">Inquiries</th><th className="r">Leads</th><th className="r">Prospects</th><th className="r">Signed</th>
              <th className="r">Inquiry to lead</th><th className="r">Lead to prospect</th><th className="r">Prospect to student</th>
              {canSeeBilling && <><th className="r">Spend</th><th className="r">Per lead</th><th className="r">Per signing</th></>}
            </tr></thead>
            <tbody>
              {sources.slice().sort((a, b) => b.inquiries - a.inquiries).map((r) => (
                <tr key={r.source}>
                  <td className="nowrap">{r.label}</td><td className="r">{r.inquiries}</td><td className="r">{r.qualified}</td><td className="r">{r.prospects}</td><td className="r">{r.signs}</td>
                  <td className="r">{pct(r.inquiryToLead)}</td><td className="r">{pct(r.leadToProspect)}</td><td className="r">{pct(r.prospectToSign)}</td>
                  {canSeeBilling && <><td className="r">{r.spend ? money(r.spend) : "—"}</td><td className="r">{r.costPerLead ? money(r.costPerLead) : "—"}</td>
                    <td className="r">{r.costPerSign == null ? "—" : r.costPerSign === Infinity ? <span className="tag crit">No signings</span> : <b>{money(r.costPerSign)}</b>}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel" aria-labelledby="tr-h">
          <div className="panel-head"><div><h2 id="tr-h">Trials</h2><p>Trials held in {range.label} and how many of those families signed.</p></div></div>
          <div className="stats" style={{ marginBottom: 14 }}>
            <Stat label="Booked" value={trials.booked} foot={`${trials.upcoming} still upcoming`} />
            <Stat label="Attended" value={trials.attended} foot={`${pct(trials.showRate)} show rate`} />
            <Stat label="Signed after trial" value={pct(trials.trialToSign)} />
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Offer</th><th className="r">Attended</th><th className="r">Signed</th><th className="r">Rate</th></tr></thead>
              <tbody>{Object.entries(trials.byOffer).map(([k, v]) => <tr key={k}><td>{TRIAL_OFFER[k]?.label}</td><td className="r">{v.attended}</td><td className="r">{v.signed}</td><td className="r">{pct(v.signed / v.attended)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="tbl-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Trial taught by</th><th className="r">Attended</th><th className="r">Signed</th><th className="r">Rate</th></tr></thead>
              <tbody>{Object.entries(trials.byInstructor).map(([k, v]) => <tr key={k}><td>{state.staff.find((s) => s.id === k)?.name || "Not recorded"}</td><td className="r">{v.attended}</td><td className="r">{v.signed}</td><td className="r">{pct(v.signed / v.attended)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="lost-h">
          <div className="panel-head"><div><h2 id="lost-h">Why families didn't sign</h2><p>Lost leads from {range.label}, by reason.</p></div></div>
          <HBars color="var(--s2)" rows={lost.map((r) => ({ label: r.label, value: r.count }))} empty="No lost leads in this period." />
          <p className="muted" style={{ fontSize: ".84rem", marginTop: 12 }}>{state.leads.filter((l) => l.stage === "nurture").length} families are in Nurture right now, waiting for a better time.</p>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel" aria-labelledby="prog-h">
          <div className="panel-head"><div><h2 id="prog-h">By program</h2></div></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Program</th><th className="r">Inquiries</th><th className="r">Prospects</th><th className="r">Signed</th><th className="r">Inquiry to student</th></tr></thead>
              <tbody>{programs.map((r) => <tr key={r.program}><td>{r.label}</td><td className="r">{r.inquiries}</td><td className="r">{r.prospects}</td><td className="r">{r.signs}</td><td className="r">{pct(r.inquiryToSign)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="team-h">
          <div className="panel-head"><div><h2 id="team-h">Follow-up work</h2><p>Calls, texts and emails logged in {range.label}.</p></div></div>
          <div className="stats" style={{ marginBottom: 14 }}>
            <Stat label="First reply" value={vel.medianFirstTouchHours == null ? "—" : vel.medianFirstTouchHours < 1 ? `${Math.round(vel.medianFirstTouchHours * 60)} min` : `${vel.medianFirstTouchHours.toFixed(1)} hrs`} foot="Median time from inquiry to first contact" />
            <Stat label="Same-day contact" value={pct(vel.sameDayRate)} foot={`${vel.contacted} of ${vel.cohort} reached out to`} />
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Team member</th><th className="r">Contacts</th><th className="r">Got through</th></tr></thead>
              <tbody>{Object.entries(team).sort((a, b) => b[1].contacts - a[1].contacts).map(([k, v]) => <tr key={k}><td>{state.staff.find((s) => s.id === k)?.name || "Not recorded"}</td><td className="r">{v.contacts}</td><td className="r">{pct(v.reached / v.contacts)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>

      {canSeeBilling && (
        <section className="panel" aria-labelledby="mix-h">
          <div className="panel-head">
            <div><h2 id="mix-h">What new students signed up for</h2><p>{mix.total} enrollments in {range.label}. {pct(mix.pifShare)} paid in full.</p></div>
            <div className="legend"><span><i className="sw" style={{ background: "var(--s1)" }} />Monthly</span><span><i className="sw" style={{ background: "var(--s2)" }} />Paid in full</span></div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {mix.rows.map((r) => (
              <div key={r.membership} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 220px) minmax(0, 1fr) 90px", gap: 10, alignItems: "center", fontSize: ".9rem" }}>
                <span>{r.membership}</span>
                <div style={{ width: `${((r.monthly + r.pif) / Math.max(...mix.rows.map((x) => x.monthly + x.pif))) * 100}%` }}>
                  <SplitBar parts={[{ label: "Monthly", value: r.monthly, color: "var(--s1)" }, { label: "Paid in full", value: r.pif, color: "var(--s2)" }]} />
                </div>
                <span className="num" style={{ textAlign: "right" }}>{r.monthly} + {r.pif} PIF</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {editSpend && <SpendEditor onClose={() => setEditSpend(false)} />}
    </main>
  );
}

function avg(xs) { const v = xs.filter((x) => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

function SpendEditor({ onClose }) {
  const { state, run, today, toast } = useCRM();
  const months = M.monthsBetween(addDays(today, -150), today).reverse();
  const paid = SOURCES.filter((s) => s.paid);
  const val = (m, s) => state.marketing_spend.find((r) => r.month === m && r.source === s)?.amount ?? "";
  const [draft, setDraft] = useState(() => Object.fromEntries(months.flatMap((m) => paid.map((s) => [`${m}|${s.key}`, val(m, s.key)]))));
  return (
    <Modal title="Ad and event spend" lede="What each paid source cost per month. Used for cost per lead and cost per signing." onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => {
        for (const [k, v] of Object.entries(draft)) { const [m, s] = k.split("|"); if (v !== "" || val(m, s) !== "") run(A.setSpend, m, s, v || 0); }
        toast("Spend saved"); onClose();
      }}>Save spend</button></>}>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Month</th>{paid.map((s) => <th key={s.key} className="r">{s.label}</th>)}</tr></thead>
          <tbody>{months.map((m) => (
            <tr key={m}><td className="nowrap">{monthLabel(m)}</td>{paid.map((s) => (
              <td key={s.key} className="r"><input className="input" style={{ width: 90, textAlign: "right" }} type="number" min="0" aria-label={`${s.label} ${monthLabel(m)}`}
                value={draft[`${m}|${s.key}`]} onChange={(e) => setDraft({ ...draft, [`${m}|${s.key}`]: e.target.value })} /></td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>
    </Modal>
  );
}
