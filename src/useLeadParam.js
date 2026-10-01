import { useSearchParams } from "react-router-dom";

/** The open lead lives in the URL (?lead=<id>), so any page can open it and links can be shared. */
export function useLeadParam() {
  const [params, setParams] = useSearchParams();
  const leadId = params.get("lead");
  const open = (id) => { const p = new URLSearchParams(params); p.set("lead", id); setParams(p); };
  const close = () => { const p = new URLSearchParams(params); p.delete("lead"); setParams(p); };
  return { leadId, open, close };
}
