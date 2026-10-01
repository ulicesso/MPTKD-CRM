/* Reusable building blocks used across pages. */
import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { STAGE, STAGES, ACTIVE_TRACK, SOURCE } from "../lib/constants.js";
import { relDay, fmtDate } from "../lib/dates.js";

/* ---------- stage / belt ---------- */
export function beltVar(belt) { return { "--belt": `var(--belt-${belt})` }; }

export function BeltTag({ stage, short = false }) {
  const s = STAGE[stage];
  if (!s) return null;
  return (
    <span className="belt-tag">
      <i data-belt={s.belt} style={beltVar(s.belt)} aria-hidden="true" />
      {short ? s.short : s.label}
    </span>
  );
}

/** The belt-colored stage track: counts per stage, each linking to the filtered list. */
export function StageTrack({ counts, hrefFor }) {
  const main = [...ACTIVE_TRACK, "enrolled"];
  return (
    <div>
      <div className="track" role="list" aria-label="Leads by stage">
        {main.map((k) => {
          const s = STAGE[k];
          return (
            <Link key={k} role="listitem" className="track-seg" data-belt={s.belt} style={beltVar(s.belt)} to={hrefFor(k)}
              aria-label={`${s.label}: ${counts[k] || 0}`}>
              <span className="band" aria-hidden="true" />
              <span className="n">{counts[k] || 0}</span>
              <span className="l">{s.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="track-side">
        <Link to={hrefFor("nurture")}>{counts.nurture || 0} in Nurture</Link>
        <Link to={hrefFor("lost")}>{counts.lost || 0} lost</Link>
      </div>
    </div>
  );
}

/* ---------- follow-up chip ---------- */
export function DueChip({ followUp, date, today }) {
  if (!followUp || followUp.key === "none") return <span className="muted">—</span>;
  const label = followUp.key === "overdue"
    ? `${-followUp.days}d overdue`
    : followUp.key === "today" ? "Due today" : relDay(date, today) === "tomorrow" ? "Tomorrow" : fmtDate(date, { today });
  return (
    <span className={`due ${followUp.key}`} title={`Follow up ${fmtDate(date, { year: true })}`}>
      {followUp.key === "overdue" && <Icon name="alert" size={13} />}
      {label}
    </span>
  );
}

export function SourceLabel({ source }) {
  return <span>{SOURCE[source]?.label || source}</span>;
}

/* ---------- stat tile ---------- */
export function Stat({ label, value, foot, children }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {foot && <span className="foot">{foot}</span>}
      {children}
    </div>
  );
}

/* ---------- forms ---------- */
export function Field({ label, help, children, className = "" }) {
  // Link the label to its control by id, so the control's name is just the label text.
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children, { id: children.props.id || id }) : children;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={isValidElement(children) ? child.props.id : undefined}>{label}{help && <span className="help"> {help}</span>}</label>
      {child}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, ...rest }) {
  return (
    <select className="select" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value ?? o.key} value={o.value ?? o.key}>{o.label}</option>))}
    </select>
  );
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- overlays ---------- */
function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}
function useFocusFirst(ref) {
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current?.querySelector("input, select, textarea, button");
    el?.focus();
    return () => prev?.focus?.();
  }, [ref]);
}

export function Modal({ title, lede, onClose, children, actions }) {
  const ref = useRef(null);
  const id = useId();
  useEscape(onClose);
  useFocusFirst(ref);
  return (
    <>
      <div className="scrim modal-scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <h2 id={id}>{title}</h2>
        {lede && <p className="lede">{lede}</p>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </>
  );
}

export function Drawer({ onClose, head, children, label }) {
  const ref = useRef(null);
  useEscape(onClose);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div className="drawer-head">{head}</div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function StageOptions() {
  return STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>);
}
