// src/IncentiveDashboard.jsx — no deduct button; auto‑update on DELETEs
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, PieChart } from "lucide-react";

// ===== Supabase client =====
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ===== Helpers =====
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtGBP = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (iso) => new Date(iso).toLocaleString();
const signFmt = (n, money = false) => (money ? (n >= 0 ? `+${fmtGBP(n)}` : `-${fmtGBP(Math.abs(n))}`) : n >= 0 ? `+${fmt(n)}` : `-${fmt(Math.abs(n))}`);

// ===== Donut Chart =====
function Donut({ percent, size = 160, stroke = 18, color = "#FF6341" }) {
  const p = Math.max(0, Math.min(percent || 0, 100));
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const dash = (p / 100) * C;
  return (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center", position: "relative" }}>
      <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEE" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${C - dash}`}
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${dash} ${C - dash}` }}
          transition={{ duration: 0.6 }}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#232D34" }}>{Math.round(p)}%</div>
      </div>
    </div>
  );
}

// ===== Constants =====
const TIER1_NAMES = ["Client Meetings", "New Jobs", "Content", "CVs Out", "Registrations", "BD Conversations"];
const SALES_TIER2_NAME = "Sales Incentive - Tier 2";
const SALES_TIER3_TARGET = 150000;

// ===== Main Component =====
export default function MultiIncentiveDashboard() {
  const [incentives, setIncentives] = useState([]);
  const [totals, setTotals] = useState({});
  const [logs, setLogs] = useState({});
  const [inputs, setInputs] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  // Load incentives + contributions
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!supabase) {
          const demoIncs = [
            { id: "a1", name: "Client Meetings", target: 16 },
            { id: "a2", name: "New Jobs", target: 25 },
            { id: "a3", name: "Content", target: 56 },
            { id: "a4", name: "CVs Out", target: 140 },
            { id: "a5", name: "Registrations", target: 180 },
            { id: "a6", name: "BD Conversations", target: 140 },
            { id: "s2", name: SALES_TIER2_NAME, target: 100000 },
          ];
          setIncentives(demoIncs);
          setTotals({});
          setLogs({});
          return;
        }
        const { data: incs, error: e1 } = await supabase
          .from("incentives")
          .select("id,name,target,created_at")
          .order("created_at", { ascending: true });
        if (e1) throw e1;
        setIncentives(incs || []);
        await refreshContribs();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Realtime: INSERT updates instantly; DELETE triggers a refresh so manual deletions in Supabase reflect in UI
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel("dash_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contributions" }, (payload) => {
        const row = payload.new;
        setTotals((t) => ({ ...t, [row.incentive_id]: (t[row.incentive_id] || 0) + row.amount }));
        setLogs((lg) => ({ ...lg, [row.incentive_id]: [row, ...(lg[row.incentive_id] || [])] }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "contributions" }, async () => {
        await refreshContribs();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function refreshContribs() {
    const { data: contribs, error } = await supabase
      .from("contributions")
      .select("id,incentive_id,amount,note,created_at");
    if (error) {
      console.error(error);
      return;
    }
    recompute(contribs || []);
  }

  function recompute(contribs) {
    const sums = {};
    const grouped = {};
    for (const c of contribs) {
      sums[c.incentive_id] = (sums[c.incentive_id] || 0) + (c.amount || 0);
      if (!grouped[c.incentive_id]) grouped[c.incentive_id] = [];
      grouped[c.incentive_id].push(c);
    }
    for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setTotals(sums);
    setLogs(grouped);
  }

  async function addOnly(incentive) {
    const raw = inputs[incentive.id];
    const val = Number(raw);
    if (!Number.isFinite(val) || val <= 0) return; // only allow positive adds
    const note = notes[incentive.id] || null;

    const temp = { id: `local-${Date.now()}`, incentive_id: incentive.id, amount: val, note, created_at: new Date().toISOString() };
    setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) + val }));
    setLogs((lg) => ({ ...lg, [incentive.id]: [temp, ...(lg[incentive.id] || [])] }));
    setInputs((m) => ({ ...m, [incentive.id]: "" }));
    setNotes((m) => ({ ...m, [incentive.id]: "" }));

    if (!supabase) return;
    const { error } = await supabase.from("contributions").insert({ incentive_id: incentive.id, amount: val, note });
    if (error) {
      // rollback
      setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) - val }));
      setLogs((lg) => ({ ...lg, [incentive.id]: (lg[incentive.id] || []).filter((r) => r.id !== temp.id) }));
      alert(error.message);
    }
  }

  // Derived: Tier summaries
  const activityIncs = incentives.filter((i) => TIER1_NAMES.includes(i.name));
  const tier1Target = activityIncs.reduce((a, i) => a + (Number(i.target) || 0), 0);
  const tier1Total = activityIncs.reduce((a, i) => a + (Number(totals[i.id]) || 0), 0);

  const sales2 = incentives.find((i) => i.name === SALES_TIER2_NAME);
  const sales2Target = sales2?.target ?? 100000;
  const sales2Total = sales2 ? totals[sales2.id] || 0 : 0;

  const sales3Target = SALES_TIER3_TARGET;
  const sales3Total = sales2Total; // mirrors Tier 2

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", padding: 24, color: "#232D34" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <PieChart size={18} color="#FF6341" />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Team Incentive Dashboard</h1>
      </header>

      {/* Summary pies */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        <SummaryCard title="Activity Incentive – Tier 1" total={tier1Total} target={tier1Target} />
        <SummaryCard title="Sales Incentive – Tier 2" total={sales2Total} target={sales2Target} money />
        <SummaryCard title="Sales Incentive – Tier 3" total={sales3Total} target={sales3Target} money />
      </section>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
          <div style={{ width: 40, height: 40, border: "4px solid #e5e7eb", borderTopColor: "#FF6341", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {[...activityIncs, ...(sales2 ? [sales2] : [])].map((inc) => (
            <div key={inc.id} style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(16,24,40,0.06)", display: "grid", gap: 12 }}>
              <h3 style={{ margin: 0 }}>{inc.name}</h3>

              <div style={{ display: "grid", placeItems: "center" }}>
                <Donut percent={Math.min(100, ((totals[inc.id] || 0) / (inc.target || 1)) * 100)} />
              </div>

              <div style={{ textAlign: "center", color: "#475467" }}>
                {inc.name === SALES_TIER2_NAME ? `${fmtGBP(totals[inc.id] || 0)} / ${fmtGBP(inc.target)}` : `${fmt(totals[inc.id] || 0)} / ${fmt(inc.target)}`}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={inc.name === SALES_TIER2_NAME ? "£ Amount" : "Amount"}
                  value={inputs[inc.id] || ""}
                  onChange={(e) => setInputs((m) => ({ ...m, [inc.id]: e.target.value }))}
                  style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px" }}
                />
                <button onClick={() => addOnly(inc)} style={btnStyle("#16a34a")} title="Add">
                  <PlusCircle size={16} /> Add
                </button>
              </div>

              <input
                type="text"
                placeholder="Optional note (who/what)"
                value={notes[inc.id] || ""}
                onChange={(e) => setNotes((m) => ({ ...m, [inc.id]: e.target.value }))}
                style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px" }}
              />

              <div style={{ borderTop: "1px solid #F2F4F7", paddingTop: 8, maxHeight: 140, overflow: "auto" }}>
                <div style={{ fontSize: 12, color: "#667085", fontWeight: 600, marginBottom: 6 }}>Recent activity</div>
                <AnimatePresence>
                  {(logs[inc.id] || []).map((l) => (
                    <motion.div key={l.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, fontSize: 13, padding: "4px 0" }}>
                      <span style={{ fontWeight: 700, color: l.amount >= 0 ? "#047857" : "#B42318" }}>
                        {inc.name === SALES_TIER2_NAME ? signFmt(l.amount, true) : signFmt(l.amount, false)}
                      </span>
                      <span style={{ color: "#475467", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.note || "—"}</span>
                      <span style={{ color: "#98A2B3" }}>{fmtDate(l.created_at)}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} button{cursor:pointer} button:disabled{opacity:.6;cursor:not-allowed}`}</style>
    </div>
  );
}

// ===== Subcomponents =====
function SummaryCard({ title, total, target, money }) {
  const pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(16,24,40,0.06)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center" }}>
      <div style={{ display: "grid", placeItems: "center" }}>
        <Donut percent={pct} size={120} stroke={14} color={money ? "#FF6341" : "#111827"} />
      </div>
      <div>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: "#667085", marginTop: 4 }}>{money ? `${fmtGBP(total)} / ${fmtGBP(target)}` : `${fmt(total)} / ${fmt(target)}`}</div>
        <div style={{ marginTop: 4, fontWeight: 700 }}>{money ? fmtGBP(Math.max(target - total, 0)) : fmt(Math.max(target - total, 0))} remaining</div>
      </div>
    </div>
  );
}

// Button style helper
function btnStyle(bg) {
  return { background: bg, color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px", display: "inline-flex", alignItems: "center", gap: 6 };
}
// src/IncentiveDashboard.jsx — no deduct button; auto‑update on DELETEs
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, PieChart } from "lucide-react";

// ===== Supabase client =====
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ===== Helpers =====
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtGBP = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (iso) => new Date(iso).toLocaleString();
const signFmt = (n, money = false) => (money ? (n >= 0 ? `+${fmtGBP(n)}` : `-${fmtGBP(Math.abs(n))}`) : n >= 0 ? `+${fmt(n)}` : `-${fmt(Math.abs(n))}`);

// ===== Donut Chart =====
function Donut({ percent, size = 160, stroke = 18, color = "#FF6341" }) {
  const p = Math.max(0, Math.min(percent || 0, 100));
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const dash = (p / 100) * C;
  return (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center", position: "relative" }}>
      <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEE" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${C - dash}`}
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${dash} ${C - dash}` }}
          transition={{ duration: 0.6 }}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#232D34" }}>{Math.round(p)}%</div>
      </div>
    </div>
  );
}

// ===== Constants =====
const TIER1_NAMES = ["Client Meetings", "New Jobs", "Content", "CVs Out", "Registrations", "BD Conversations"];
const SALES_TIER2_NAME = "Sales Incentive - Tier 2";
const SALES_TIER3_TARGET = 150000;

// ===== Main Component =====
export default function MultiIncentiveDashboard() {
  const [incentives, setIncentives] = useState([]);
  const [totals, setTotals] = useState({});
  const [logs, setLogs] = useState({});
  const [inputs, setInputs] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  // Load incentives + contributions
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!supabase) {
          const demoIncs = [
            { id: "a1", name: "Client Meetings", target: 16 },
            { id: "a2", name: "New Jobs", target: 25 },
            { id: "a3", name: "Content", target: 56 },
            { id: "a4", name: "CVs Out", target: 140 },
            { id: "a5", name: "Registrations", target: 180 },
            { id: "a6", name: "BD Conversations", target: 140 },
            { id: "s2", name: SALES_TIER2_NAME, target: 100000 },
          ];
          setIncentives(demoIncs);
          setTotals({});
          setLogs({});
          return;
        }
        const { data: incs, error: e1 } = await supabase
          .from("incentives")
          .select("id,name,target,created_at")
          .order("created_at", { ascending: true });
        if (e1) throw e1;
        setIncentives(incs || []);
        await refreshContribs();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Realtime: INSERT updates instantly; DELETE triggers a refresh so manual deletions in Supabase reflect in UI
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel("dash_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contributions" }, (payload) => {
        const row = payload.new;
        setTotals((t) => ({ ...t, [row.incentive_id]: (t[row.incentive_id] || 0) + row.amount }));
        setLogs((lg) => ({ ...lg, [row.incentive_id]: [row, ...(lg[row.incentive_id] || [])] }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "contributions" }, async () => {
        await refreshContribs();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function refreshContribs() {
    const { data: contribs, error } = await supabase
      .from("contributions")
      .select("id,incentive_id,amount,note,created_at");
    if (error) {
      console.error(error);
      return;
    }
    recompute(contribs || []);
  }

  function recompute(contribs) {
    const sums = {};
    const grouped = {};
    for (const c of contribs) {
      sums[c.incentive_id] = (sums[c.incentive_id] || 0) + (c.amount || 0);
      if (!grouped[c.incentive_id]) grouped[c.incentive_id] = [];
      grouped[c.incentive_id].push(c);
    }
    for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setTotals(sums);
    setLogs(grouped);
  }

  async function addOnly(incentive) {
    const raw = inputs[incentive.id];
    const val = Number(raw);
    if (!Number.isFinite(val) || val <= 0) return; // only allow positive adds
    const note = notes[incentive.id] || null;

    const temp = { id: `local-${Date.now()}`, incentive_id: incentive.id, amount: val, note, created_at: new Date().toISOString() };
    setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) + val }));
    setLogs((lg) => ({ ...lg, [incentive.id]: [temp, ...(lg[incentive.id] || [])] }));
    setInputs((m) => ({ ...m, [incentive.id]: "" }));
    setNotes((m) => ({ ...m, [incentive.id]: "" }));

    if (!supabase) return;
    const { error } = await supabase.from("contributions").insert({ incentive_id: incentive.id, amount: val, note });
    if (error) {
      // rollback
      setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) - val }));
      setLogs((lg) => ({ ...lg, [incentive.id]: (lg[incentive.id] || []).filter((r) => r.id !== temp.id) }));
      alert(error.message);
    }
  }

  // Derived: Tier summaries
  const activityIncs = incentives.filter((i) => TIER1_NAMES.includes(i.name));
  const tier1Target = activityIncs.reduce((a, i) => a + (Number(i.target) || 0), 0);
  const tier1Total = activityIncs.reduce((a, i) => a + (Number(totals[i.id]) || 0), 0);

  const sales2 = incentives.find((i) => i.name === SALES_TIER2_NAME);
  const sales2Target = sales2?.target ?? 100000;
  const sales2Total = sales2 ? totals[sales2.id] || 0 : 0;

  const sales3Target = SALES_TIER3_TARGET;
  const sales3Total = sales2Total; // mirrors Tier 2

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", padding: 24, color: "#232D34" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <PieChart size={18} color="#FF6341" />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Team Incentive Dashboard</h1>
      </header>

      {/* Summary pies */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
        <SummaryCard title="Activity Incentive – Tier 1" total={tier1Total} target={tier1Target} />
        <SummaryCard title="Sales Incentive – Tier 2" total={sales2Total} target={sales2Target} money />
        <SummaryCard title="Sales Incentive – Tier 3" total={sales3Total} target={sales3Target} money />
      </section>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
          <div style={{ width: 40, height: 40, border: "4px solid #e5e7eb", borderTopColor: "#FF6341", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {[...activityIncs, ...(sales2 ? [sales2] : [])].map((inc) => (
            <div key={inc.id} style={{ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(16,24,40,0.06)", display: "grid", gap: 12 }}>
              <h3 style={{ margin: 0 }}>{inc.name}</h3>

              <div style={{ display: "grid", placeItems: "center" }}>
                <Donut percent={Math.min(100, ((totals[inc.id] || 0) / (inc.target || 1)) * 100)} />
              </div>

              <div style={{ textAlign: "center", color: "#475467" }}>
                {inc.name === SALES_TIER2_NAME ? `${fmtGBP(totals[inc.id] || 0)} / ${fmtGBP(inc.target)}` : `${fmt(totals[inc.id] || 0)} / ${fmt(inc.target)}`}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={inc.name === SALES_TIER2_NAME ? "£ Amount" : "Amount"}
                  value={inputs[inc.id] || ""}
                  onChange={(e) => setInputs((m) => ({ ...m, [inc.id]: e.target.value }))}
                  style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px" }}
                />
                <button onClick={() => addOnly(inc)} style={btnStyle("#16a34a")} title="Add">
                  <PlusCircle size={16} /> Add
                </button>
              </div>

              <input
                type="text"
                placeholder="Optional note (who/what)"
                value={notes[inc.id] || ""}
                onChange={(e) => setNotes((m) => ({ ...m, [inc.id]: e.target.value }))}
                style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px" }}
              />

              <div style={{ borderTop: "1px solid #F2F4F7", paddingTop: 8, maxHeight: 140, overflow: "auto" }}>
                <div style={{ fontSize: 12, color: "#667085", fontWeight: 600, marginBottom: 6 }}>Recent activity</div>
                <AnimatePresence>
                  {(logs[inc.id] || []).map((l) => (
                    <motion.div key={l.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, fontSize: 13, padding: "4px 0" }}>
                      <span style={{ fontWeight: 700, color: l.amount >= 0 ? "#047857" : "#B42318" }}>
                        {inc.name === SALES_TIER2_NAME ? signFmt(l.amount, true) : signFmt(l.amount, false)}
                      </span>
                      <span style={{ color: "#475467", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.note || "—"}</span>
                      <span style={{ color: "#98A2B3" }}>{fmtDate(l.created_at)}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} button{cursor:pointer} button:disabled{opacity:.6;cursor:not-allowed}`}</style>
    </div>
  );
}

// ===== Subcomponents =====
function SummaryCard({ title, total, target, money }) {
  const pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(16,24,40,0.06)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center" }}>
      <div style={{ display: "grid", placeItems: "center" }}>
        <Donut percent={pct} size={120} stroke={14} color={money ? "#FF6341" : "#111827"} />
      </div>
      <div>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: "#667085", marginTop: 4 }}>{money ? `${fmtGBP(total)} / ${fmtGBP(target)}` : `${fmt(total)} / ${fmt(target)}`}</div>
        <div style={{ marginTop: 4, fontWeight: 700 }}>{money ? fmtGBP(Math.max(target - total, 0)) : fmt(Math.max(target - total, 0))} remaining</div>
      </div>
    </div>
  );
}

// Button style helper
function btnStyle(bg) {
  return { background: bg, color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px", display: "inline-flex", alignItems: "center", gap: 6 };
}
