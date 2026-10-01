/*
 * Billing math and spreadsheet import, ported from the original
 * Tuition Dashboard (reference/billing-dashboard.html, first <script> block).
 *
 * These functions were tested against the real roster, so their behavior is
 * kept exactly as it was. Only two things changed:
 *   - they are exported as a module, and
 *   - the date helpers (pd, iso, dim, daysBetween, MS_DAY) come from ./dates.js.
 *
 * A "member" here is the dashboard's flat shape:
 *   { name, family, program, plan, type: "monthly"|"pif", amount, rate, discount,
 *     pifDiscount, method, billDay, start, end, paid, paidDate, status, resume }
 * Use memberFromMembership() in ./billingAdapter.js to build one from CRM records.
 */
import { MS_DAY, pd, iso, dim, daysBetween } from "./dates.js";

/* ===== calculations ===== */
const STATUS={active:{label:"Active",cls:"st-good"},onbreak:{label:"On break",cls:"st-info"},paused:{label:"Paused",cls:"st-warn"},awaiting:{label:"Awaiting renewal",cls:"st-crit"},paidahead:{label:"Paid ahead",cls:"st-info"},notpaying:{label:"Not paying",cls:"st-warn"}};
function normStatus(v){ const s=String(v||"").toLowerCase();
  if(!s.trim()||/active|current|billing/.test(s)) return "active";
  if(/break|vacation|hold/.test(s)) return "onbreak";
  if(/pause|freeze|frozen/.test(s)) return "paused";
  if(/await|renew|pending/.test(s)) return "awaiting";
  if(/ahead|prepaid|paid up/.test(s)) return "paidahead";
  if(/not\s*pay|comp|free|staff|scholar|no\s*tuition/.test(s)) return "notpaying";
  return "active"; }
function st(m){ return m.status||"active"; }
function billsOn(m,date){
  const k=st(m); if(k==="active") return true;
  if(k==="onbreak"){ const r=pd(m.resume); return !!r&&date>=r; }
  return false; }
function isM2M(m){ return !m.end || /month\s*to\s*month|m2m|month-to-month/i.test(m.plan||""); }
function monthDays(members,y,mo){
  const n=dim(y,mo), days=Array.from({length:n},()=>({amt:0,list:[]}));
  for(const m of members){
    if(m.type!=="monthly"||!m.billDay||!m.amount) continue;
    const d=Math.min(m.billDay,n), date=new Date(y,mo,d), s=pd(m.start), e=pd(m.end);
    if(s&&date<s) continue; if(e&&date>e) continue; if(!billsOn(m,date)) continue;
    days[d-1].amt+=m.amount; days[d-1].list.push(m);
  }
  return days;
}
function projection(members,today,count){
  const out=[];
  for(let i=0;i<count;i++){
    const y=today.getFullYear()+Math.floor((today.getMonth()+i)/12), mo=(today.getMonth()+i)%12;
    let term=0,m2m=0,n=0; const ending=[];
    for(const d of monthDays(members,y,mo)) for(const m of d.list){ n++; if(isM2M(m)) m2m+=m.amount; else term+=m.amount; }
    for(const m of members){ const e=pd(m.end); if(m.type==="monthly"&&["active","onbreak","paidahead"].includes(st(m))&&e&&e.getFullYear()===y&&e.getMonth()===mo) ending.push(m); }
    out.push({y,mo,term,m2m,total:term+m2m,payers:n,ending});
  }
  return out;
}
function pifStatus(m,today){
  const e=pd(m.end); if(!e) return {key:"active",label:"No end date",cls:"st-info",days:Infinity};
  const d=daysBetween(today,e);
  if(d<0) return {key:"expired",label:"Expired",cls:"st-crit",days:d};
  if(d<=30) return {key:"due",label:"Renew now",cls:"st-crit",days:d};
  if(d<=60) return {key:"soon",label:"Renew soon",cls:"st-warn",days:d};
  if(d<=90) return {key:"upcoming",label:"Coming up",cls:"st-info",days:d};
  return {key:"active",label:"Active",cls:"st-good",days:d};
}
function summarize(members,today){
  const y=today.getFullYear(), mo=today.getMonth();
  const days=monthDays(members,y,mo);
  const total=days.reduce((a,d)=>a+d.amt,0);
  const toCome=days.slice(today.getDate()-1).reduce((a,d)=>a+d.amt,0);
  const monthly=members.filter(m=>m.type==="monthly"&&st(m)==="active"&&(!m.end||pd(m.end)>=today));
  const pif=members.filter(m=>m.type==="pif");
  const pifActive=pif.filter(m=>pifStatus(m,today).days>=0);
  const mrr=monthly.reduce((a,m)=>a+(m.amount||0),0);
  return {total,toCome,monthlyCount:monthly.length,mrr,pifCount:pifActive.length,pifValue:pifActive.reduce((a,m)=>a+(m.paid||0),0),
    pifRenew90:pif.filter(m=>{const s=pifStatus(m,today);return s.days>=0&&s.days<=90;}),
    pifExpired:pif.filter(m=>pifStatus(m,today).days<0)};
}

/* ===== import: parsing and column matching ===== */
const FIELDS=[
  {k:"name",label:"Student name",req:true,hints:["student name","full name","member name","name","student"]},
  {k:"first",label:"First name (if split)",hints:["first name","first"]},
  {k:"last",label:"Last name (if split)",hints:["last name","last","surname"]},
  {k:"family",label:"Family / household",hints:["family","household","account","parent","guardian"]},
  {k:"program",label:"Program",hints:["program","class","division","group"]},
  {k:"plan",label:"Membership / plan",hints:["membership","plan","contract","package","agreement","term"]},
  {k:"type",label:"Payment type (monthly or PIF)",hints:["payment type","billing type","frequency","pay type","type"]},
  {k:"amount",label:"Monthly amount",hints:["monthly amount","monthly","recurring","payment amount","tuition","rate","amount"]},
  {k:"billDay",label:"Billing day or next payment date",hints:["billing day","bill day","draft day","next payment","next bill","next draft","due date","billing date"]},
  {k:"method",label:"Payment method",hints:["payment method","method","card","ach","bank"]},
  {k:"start",label:"Start date",hints:["start date","start","begin","enroll","join","signup"]},
  {k:"end",label:"End / expiration date",hints:["end date","expiration","expire","end","renewal"]},
  {k:"paid",label:"Paid-in-full amount",hints:["pif amount","paid in full amount","total paid","amount paid","pif total","paid"]},
  {k:"paidDate",label:"Paid date",hints:["paid date","payment date","date paid"]},
  {k:"pifDiscount",label:"PIF discount ($)",hints:["pif discount","pif savings","prepay discount","paid in full discount"]},
  {k:"discount",label:"Family discount ($)",hints:["family discount","sibling discount","discount"]},
  {k:"status",label:"Status",hints:["status","billing status","member status"]},
  {k:"resume",label:"Billing resumes",hints:["billing resumes","resumes","resume date","resume"]},
];
function norm(s){ return String(s||"").toLowerCase().replace(/[_\-\/]+/g," ").replace(/\s+/g," ").trim(); }
function autoMap(headers){
  const nh=headers.map(norm), used=new Set(), map={};
  for(const f of FIELDS){
    let best=-1;
    for(const h of f.hints){ const i=nh.findIndex((x,j)=>!used.has(j)&&x===h); if(i>=0){best=i;break;} }
    if(best<0) for(const h of f.hints){ const i=nh.findIndex((x,j)=>!used.has(j)&&x.includes(h)); if(i>=0){best=i;break;} }
    if(best>=0){ map[f.k]=best; used.add(best); } else map[f.k]=-1;
  }
  if(map.name>=0&&map.first>=0&&map.last>=0&&norm(headers[map.name]).includes("first")) { map.name=-1; }
  return map;
}
function money(v){ if(v==null||v==="") return 0; const n=parseFloat(String(v).replace(/[^0-9.\-]/g,"")); return isFinite(n)?n:0; }
function toDate(v){
  if(v==null||v==="") return "";
  if(v instanceof Date&&!isNaN(v)) return iso(v);
  const s=String(v).trim();
  if(/^\d{5}$/.test(s)){ const d=new Date(Date.UTC(1899,11,30)+(+s)*MS_DAY); return iso(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); }
  let m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if(m) return iso(new Date(+m[1],+m[2]-1,+m[3]));
  m=/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s); if(m){ let y=+m[3]; if(y<100) y+=2000; return iso(new Date(y,+m[1]-1,+m[2])); }
  const d=new Date(s); return isNaN(d)?"":iso(d);
}
function toBillDay(v){
  if(v==null||v==="") return 0;
  if(typeof v==="number"&&v>=1&&v<=31) return Math.round(v);
  const s=String(v).trim();
  const n=parseInt(s.replace(/(st|nd|rd|th)$/i,""),10);
  if(/^\d{1,2}(\.0+)?(st|nd|rd|th)?$/i.test(s)&&n>=1&&n<=31) return n;
  const d=toDate(s); return d?pd(d).getDate():0;
}
const PIF_RE=/\bpif\b|paid\s*in\s*full|holiday|buy\s*\d+|prepaid|pre-paid/i;
function buildMembers(rows,map,addCard){
  const g=(r,k)=>map[k]>=0?r[map[k]]:"";
  const out=[];
  for(const r of rows){
    let name=String(g(r,"name")||"").trim();
    if(!name) name=[g(r,"first"),g(r,"last")].map(x=>String(x||"").trim()).filter(Boolean).join(" ");
    if(!name) continue;
    const plan=String(g(r,"plan")||"").trim(), typeRaw=String(g(r,"type")||"");
    let amount=money(g(r,"amount")), paid=money(g(r,"paid"));
    let type = /pif|paid\s*in\s*full|full|prepaid/i.test(typeRaw) ? "pif" : /month|recurr|auto|ach|draft/i.test(typeRaw) ? "monthly" : (PIF_RE.test(plan)||(!amount&&paid>0)) ? "pif" : "monthly";
    if(type==="pif"&&!paid&&amount>300) { paid=amount; }
    const mRaw=String(g(r,"method")||"");
    const isCard=/card|visa|master|amex|discover|credit|cc/i.test(mRaw);
    const method=isCard?(/no\s*fee|without\s*fee|waiv|absorb|grandfather|old\s*rate|ach\s*rate/i.test(mRaw)?"Card (no fee)":"Card"):(mRaw?"ACH":"");
    if(type==="monthly"&&addCard&&method==="Card") amount=Math.round(amount*103)/100;
    out.push({name,family:String(g(r,"family")||"").trim(),program:String(g(r,"program")||"").trim()||"Unassigned",plan:plan||(type==="pif"?"Paid in full":"Monthly"),
      type,amount:type==="monthly"?amount:0,rate:type==="monthly"?amount:0,discount:money(g(r,"discount")),pifDiscount:type==="pif"?money(g(r,"pifDiscount")):0,method:type==="monthly"?method:"",
      billDay:type==="monthly"?toBillDay(g(r,"billDay")):0,start:toDate(g(r,"start")),end:toDate(g(r,"end")),paid:type==="pif"?paid:0,paidDate:toDate(g(r,"paidDate"))||(type==="pif"?toDate(g(r,"start")):""),status:normStatus(g(r,"status")),resume:toDate(g(r,"resume"))});
  }
  return out;
}
function parseCSV(text){
  const rows=[]; let row=[], f="", q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
    else if(c==='"') q=true;
    else if(c===","){ row.push(f); f=""; }
    else if(c==="\n"||c==="\r"){ if(c==="\r"&&text[i+1]==="\n") i++; row.push(f); rows.push(row); row=[]; f=""; }
    else f+=c;
  }
  if(f!==""||row.length){ row.push(f); rows.push(row); }
  return rows.filter(r=>r.some(x=>String(x).trim()!==""));
}

export { STATUS, normStatus, st, billsOn, isM2M, monthDays, projection, pifStatus, summarize, FIELDS, norm, autoMap, money, toDate, toBillDay, PIF_RE, buildMembers, parseCSV };
