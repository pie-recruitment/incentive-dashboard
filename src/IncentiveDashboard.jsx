import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, MinusCircle, Users, PieChart, RefreshCw } from "lucide-react";

/**
 * MULTI‑INCENTIVE DASHBOARD — React + Supabase (Pure JS, single export)
 * Clean card grid with Donut pies + activity log + add/deduct entries.
 * NEW SUMMARY: three top pies
 *   1) Activity Incentive – Tier 1 (sum of 6 named activity metrics)
 *   2) Sales Incentive – Tier 2 (own incentive card, target £100,000)
 *   3) Sales Incentive – Tier 3 (target £150,000, progress mirrors Tier 2)
 *
 * Notes:
 * - Tier 3 automatically uses Tier 2's achieved amount. Do NOT create a separate Tier 3 card for data entry.
 * - For Tier 2, create one incentive named exactly "Sales Incentive - Tier 2" and add/deduct £ amounts on that card.
 * - For Tier 1, create SIX incentives with the exact names below; their targets are summed into the overall pie.
 *
 * ENV (Vercel → Settings → Environment Variables):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ------- constants (Tier 1 names + Tier 2/3 targets) -------
const TIER1_NAMES = [
  "Client Meetings",
  "New Jobs",
  "Content",
  "CVs Out",
  "Registrations",
  "BD Conversations",
];
const SALES_TIER2_NAME = "Sales Incentive - Tier 2";
const SALES_TIER2_TARGET = 100_000; // £
const SALES_TIER3_TARGET = 150_000; // £

// ------- styles -------
const styles = {
  page: { minHeight: "100vh", background: "#f7f7f8", padding: 24, color: "#232D34" },
  container: { maxWidth: 1160, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 12, background: "#FFE1D9", display: "grid", placeItems: "center" },
  h1: { margin: 0, fontSize: 22, fontWeight: 600 },
  sub: { margin: 0, fontSize: 13, color: "#687481" },

  // summary panel
  summaryWrap: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 },
  summaryCard: { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", display: "flex", alignItems: "center", gap: 16 },
  summaryInfo: { display: "grid", gap: 6 },
  summaryTitle: { margin: 0, fontSize: 16, fontWeight: 700 },
  summaryMeta: { margin: 0, fontSize: 13, color: "#687481" },
  summaryBig: { fontSize: 20, fontWeight: 700 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, alignItems: "stretch" },

  input: { border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" },
  button: { borderRadius: 10, background: "#FF6341", color: "#fff", padding: "10px 14px", fontSize: 14, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },
  buttonAlt: { borderRadius: 10, background: "#111827", color: "#fff", padding: "10px 14px", fontSize: 14, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },

  card: { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", display: "flex", flexDirection: "column" },
  cardHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, background: "#FFE1D9", display: "grid", placeItems: "center" },
  cardTitle: { margin: 0, fontWeight: 600 },
  cardMeta: { fontSize: 12, color: "#687481" },
  center: { display: "grid", placeItems: "center", padding: 8, flex: 1 },
  numbers: { textAlign: "center", marginTop: 8 },
  big: { fontSize: 18, fontWeight: 600 },
  small: { fontSize: 12, color: "#687481" },

  row: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, marginTop: 10 },
  note: { marginTop: 8 },
  spinnerWrap: { display: "grid", placeItems: "center", padding: 60 },
  footer: { marginTop: 24, textAlign: "center", fontSize: 12, color: "#687481" },
  error: { marginTop: 16, background: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 10, fontSize: 14 },

  // Activity log styles
  activity: { marginTop: 12, borderTop: "1px solid #F0F2F4", paddingTop: 10, maxHeight: 160, overflow: "auto" },
  activityHeader: { fontSize: 12, color: "#687481", marginBottom: 6, fontWeight: 600 },
  activityItem: { display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, fontSize: 13, padding: "6px 0" },
  activityAmount: { fontWeight: 700 },
  activityNote: { color: "#475467", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  activityTime: { color: "#98A2B3", fontSize: 12 },
};

// Number formatting
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtGBP = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (iso) => new Date(iso).toLocaleString();
const signFmt = (n) => (n >= 0 ? `+${fmt(n)}` : `-${fmt(Math.abs(n))}`);

// Donut Pie SVG (animated)
function Donut({ percent, size = 160, stroke = 18, color = "#FF6341" }) {
  const radius = (size - stroke) / 2;
  const C = 2 * Math.PI * radius;
  const p = Math.max(0, Math.min(percent || 0, 1));
  const dash = p * C;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle cx={size/2} cy={size/2} r={radius} strokeWidth={stroke} stroke="#ECECEC" fill="none" strokeLinecap="round" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius} strokeWidth={stroke}
          stroke={color} fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${dash} ${C - dash}` }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{Math.round(p*100)}%</div>
          <div style={{ fontSize: 12, color: "#687481" }}>toward target</div>
        </div>
      </div>
    </div>
  );
}

export default function MultiIncentiveDashboard() {
  const [incentives, setIncentives] = useState([]); // { id, name, target, created_at }
  const [totals, setTotals] = useState({}); // incentive_id -> sum
  const [contribs, setContribs] = useState([]); // raw contributions for activity log
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per‑card inputs
  const [amountById, setAmountById] = useState({});
  const [noteById, setNoteById] = useState({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        // Demo seed — includes your six activity metrics and Sales Tier 2 card
        const demoIncentives = [
          { id: "a1", name: "Client Meetings", target: 16, created_at: new Date().toISOString() },
          { id: "a2", name: "New Jobs", target: 25, created_at: new Date().toISOString() },
          { id: "a3", name: "Content", target: 56, created_at: new Date().toISOString() },
          { id: "a4", name: "CVs Out", target: 140, created_at: new Date().toISOString() },
          { id: "a5", name: "Registrations", target: 180, created_at: new Date().toISOString() },
          { id: "a6", name: "BD Conversations", target: 140, created_at: new Date().toISOString() },
          { id: "s2", name: SALES_TIER2_NAME, target: SALES_TIER2_TARGET, created_at: new Date().toISOString() },
        ];
        const demoTotals = JSON.parse(localStorage.getItem("demo_totals") || "{}") || {};
        const demoContribs = JSON.parse(localStorage.getItem("demo_contribs") || "[]") || [];
        setIncentives(demoIncentives);
        setTotals(demoTotals);
        setContribs(demoContribs);
        setLoading(false);
        return;
      }

      // Fetch incentives
      const { data: inc, error: incErr } = await supabase
        .from("incentives")
        .select("id, name, target, created_at")
        .order("created_at", { ascending: true });
      if (incErr) throw incErr;
      setIncentives(inc || []);

      // Fetch contributions and compute totals by incentive
      const { data: rows, error: cErr } = await supabase
        .from("contributions")
        .select("id, incentive_id, amount, note, created_at");
      if (cErr) throw cErr;

      const totalsMap = {};
      (rows || []).forEach((row) => {
        totalsMap[row.incentive_id] = (totalsMap[row.incentive_id] || 0) + (row.amount || 0);
      });
      setTotals(totalsMap);
      setContribs(rows || []);
    } catch (e) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Realtime: listen for new contributions and new incentives
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel("multi_incentive_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contributions" }, (payload) => {
        const row = payload.new;
        setTotals((t) => ({ ...t, [row.incentive_id]: (t[row.incentive_id] || 0) + (row.amount || 0) }));
        setContribs((prev) => [row, ...prev]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incentives" }, (payload) => {
        const row = payload.new;
        setIncentives((list) => [...list, row]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const applyContribution = async (incentive, delta) => {
    // delta can be positive (add) or negative (deduct); disallow 0
    if (!Number.isFinite(delta) || delta === 0) { setError("Please enter a non‑zero number."); return; }
    const note = (noteById[incentive.id] || null);

    // Optimistic UI
    const optimistic = { id: `local-${Date.now()}`, incentive_id: incentive.id, amount: delta, note, created_at: new Date().toISOString() };
    setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) + delta }));
    setContribs((prev) => [optimistic, ...prev]);
    // Clear just the amount field but keep the note so you can add multiple
    setAmountById((m) => ({ ...m, [incentive.id]: "" }));

    if (!supabase) {
      const totalsMap = JSON.parse(localStorage.getItem("demo_totals") || "{}") || {};
      totalsMap[incentive.id] = (totalsMap[incentive.id] || 0) + delta;
      localStorage.setItem("demo_totals", JSON.stringify(totalsMap));
      const demoContribs = JSON.parse(localStorage.getItem("demo_contribs") || "[]") || [];
      localStorage.setItem("demo_contribs", JSON.stringify([optimistic, ...demoContribs]));
      return;
    }

    const { error: insErr, data } = await supabase
      .from("contributions")
      .insert({ incentive_id: incentive.id, amount: delta, note })
      .select("id, incentive_id, amount, note, created_at")
      .single();

    if (insErr) {
      // rollback optimistic
      setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) - delta }));
      setContribs((prev) => prev.filter((c) => c.id !== optimistic.id));
      setError(insErr.message);
    } else if (data) {
      // replace optimistic row with the real row
      setContribs((prev) => [data, ...prev.filter((c) => c.id !== optimistic.id)]);
    }
  };

  // ------- derived summaries -------
  // Tier 1 (Activity): sum the six named metrics
  const tier1Incs = incentives.filter((i) => TIER1_NAMES.includes(i.name));
  const tier1Target = tier1Incs.reduce((acc, i) => acc + (Number(i.target) || 0), 0);
  const tier1Achieved = tier1Incs.reduce((acc, i) => acc + (Number(totals[i.id]) || 0), 0);
  const tier1Pct = tier1Target > 0 ? Math.min(tier1Achieved / tier1Target, 1) : 0;

  // Tier 2 (Sales): use its own incentive card by name
  const sales2 = incentives.find((i) => i.name === SALES_TIER2_NAME);
  const sales2Target = sales2?.target ?? SALES_TIER2_TARGET;
  const sales2Achieved = sales2 ? (Number(totals[sales2.id]) || 0) : 0;
  const sales2Pct = sales2Target > 0 ? Math.min(sales2Achieved / sales2Target, 1) : 0;

  // Tier 3 (Sales): mirrors Tier 2 progress but has a higher target
  const sales3Target = SALES_TIER3_TARGET;
  const sales3Achieved = sales2Achieved; // mirror Tier 2
  const sales3Pct = sales3Target > 0 ? Math.min(sales3Achieved / sales3Target, 1) : 0;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.badge}><PieChart size={18} color="#FF6341" /></div>
            <div>
              <h1 style={styles.h1}>Team Incentive Dashboard</h1>
              <p style={styles.sub}>Realtime pies. Add or deduct entries. Share the link.</p>
            </div>
          </div>
          {!supabase && (
            <div style={{ fontSize: 12, color: "#687481", display: "flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={14}/> Demo mode (no Supabase keys)
            </div>
          )}
        </header>

        {/* Summary pies */}
        <section style={styles.summaryWrap}>
          <div style={styles.summaryCard}>
            <Donut percent={tier1Pct} size={140} stroke={16} color="#111827" />
            <div style={styles.summaryInfo}>
              <h3 style={styles.summaryTitle}>Activity Incentive – Tier 1</h3>
              <p style={styles.summaryMeta}>{TIER1_NAMES.length} metrics · {fmt(tier1Achieved)} / {fmt(tier1Target)}</p>
              <div style={styles.summaryBig}>{fmt(Math.max(tier1Target - tier1Achieved, 0))} remaining</div>
            </div>
          </div>

          <div style={styles.summaryCard}>
            <Donut percent={sales2Pct} size={140} stroke={16} color="#FF6341" />
            <div style={styles.summaryInfo}>
              <h3 style={styles.summaryTitle}>Sales Incentive – Tier 2</h3>
              <p style={styles.summaryMeta}>{fmtGBP(sales2Achieved)} / {fmtGBP(sales2Target)}</p>
              <div style={styles.summaryBig}>{fmtGBP(Math.max(sales2Target - sales2Achieved, 0))} remaining</div>
            </div>
          </div>

          <div style={styles.summaryCard}>
            <Donut percent={sales3Pct} size={140} stroke={16} color="#0EA5E9" />
            <div style={styles.summaryInfo}>
              <h3 style={styles.summaryTitle}>Sales Incentive – Tier 3</h3>
              <p style={styles.summaryMeta}>{fmtGBP(sales3Achieved)} / {fmtGBP(sales3Target)}</p>
              <div style={styles.summaryBig}>{fmtGBP(Math.max(sales3Target - sales3Achieved, 0))} remaining</div>
            </div>
          </div>
        </section>

        {loading ? (
          <div style={styles.spinnerWrap}>
            <div style={{ width: 40, height: 40, border: "4px solid #e5e7eb", borderTopColor: "#FF6341", borderRadius: "50%", animation: "spin 1s linear infinite" }}/>
          </div>
        ) : (
          <div style={styles.grid}>
            {incentives.map((inc) => {
              const total = totals[inc.id] || 0;
              const pct = inc.target > 0 ? Math.min(total / inc.target, 1) : 0;
              const over = total > inc.target;
              const list = contribs
                .filter((c) => c.incentive_id === inc.id)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 6);

              const amountVal = amountById[inc.id] || "";
              const parsed = Number(amountVal);

              return (
                <div key={inc.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div style={styles.cardIcon}><Users size={16} color="#FF6341"/></div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ ...styles.cardTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={inc.name}>{inc.name}</h3>
                      <div style={styles.cardMeta}>Target {inc.name === SALES_TIER2_NAME ? fmtGBP(inc.target) : fmt(inc.target)}</div>
                    </div>
                  </div>

                  <div style={styles.center}>
                    <Donut percent={pct} />
                  </div>

                  <div style={styles.numbers}>
                    <div style={styles.big}>
                      {inc.name === SALES_TIER2_NAME ? (
                        <>
                          {fmtGBP(total)} / {fmtGBP(inc.target)}{over ? " (🎉 exceeded)" : ""}
                        </>
                      ) : (
                        <>
                          {fmt(total)} / {fmt(inc.target)}{over ? " (🎉 exceeded)" : ""}
                        </>
                      )}
                    </div>
                    <div style={styles.small}>
                      {inc.name === SALES_TIER2_NAME
                        ? fmtGBP(Math.max(inc.target - total, 0))
                        : fmt(Math.max(inc.target - total, 0))} remaining
                    </div>
                  </div>

                  <div style={styles.row}>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={inc.name === SALES_TIER2_NAME ? "£ Amount" : "Amount"}
                      value={amountVal}
                      onChange={(e)=>setAmountById((m)=>({ ...m, [inc.id]: e.target.value }))}
                      style={styles.input}
                    />
                    <button
                      onClick={() => applyContribution(inc, Number.isFinite(parsed) ? Math.abs(parsed) : NaN)}
                      style={styles.button}
                      title="Add this amount"
                    >
                      <PlusCircle size={16}/> Add
                    </button>
                    <button
                      onClick={() => applyContribution(inc, Number.isFinite(parsed) ? -Math.abs(parsed) : NaN)}
                      style={styles.buttonAlt}
                      title="Deduct this amount"
                    >
                      <MinusCircle size={16}/> Deduct
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional note (who/what)"
                    value={noteById[inc.id] || ""}
                    onChange={(e)=>setNoteById((m)=>({ ...m, [inc.id]: e.target.value }))}
                    style={{ ...styles.input, ...styles.note }}
                  />

                  {/* Activity log */}
                  <div style={styles.activity}>
                    <div style={styles.activityHeader}>Recent activity</div>
                    {list.map((c) => (
                      <div key={c.id} style={styles.activityItem} title={c.note || ""}>
                        <span style={{ ...styles.activityAmount, color: c.amount >= 0 ? "#047857" : "#B42318" }}>
                          {inc.name === SALES_TIER2_NAME ? (c.amount >=0 ? `+${fmtGBP(c.amount)}` : `-${fmtGBP(Math.abs(c.amount))}`) : signFmt(c.amount)}
                        </span>
                        <span style={styles.activityNote}>{c.note || "—"}</span>
                        <span style={styles.activityTime}>{fmtDate(c.created_at)}</span>
                      </div>
                    ))}
                    {list.length === 0 && (
                      <div style={{ fontSize: 12, color: "#98A2B3" }}>No entries yet.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={styles.error}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={styles.footer}>Built for PIE — brand accents #FF6341 / #232D34</div>
      </div>

      {/* spinner keyframe */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, MinusCircle, Users, PieChart, RefreshCw } from "lucide-react";

/**
 * MULTI‑INCENTIVE DASHBOARD — React + Supabase (Pure JS, single export)
 * Clean card grid with Donut pies + activity log + add/deduct entries.
 * NEW SUMMARY: three top pies
 *   1) Activity Incentive – Tier 1 (sum of 6 named activity metrics)
 *   2) Sales Incentive – Tier 2 (own incentive card, target £100,000)
 *   3) Sales Incentive – Tier 3 (target £150,000, progress mirrors Tier 2)
 *
 * Notes:
 * - Tier 3 automatically uses Tier 2's achieved amount. Do NOT create a separate Tier 3 card for data entry.
 * - For Tier 2, create one incentive named exactly "Sales Incentive - Tier 2" and add/deduct £ amounts on that card.
 * - For Tier 1, create SIX incentives with the exact names below; their targets are summed into the overall pie.
 *
 * ENV (Vercel → Settings → Environment Variables):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ------- constants (Tier 1 names + Tier 2/3 targets) -------
const TIER1_NAMES = [
  "Client Meetings",
  "New Jobs",
  "Content",
  "CVs Out",
  "Registrations",
  "BD Conversations",
];
const SALES_TIER2_NAME = "Sales Incentive - Tier 2";
const SALES_TIER2_TARGET = 100_000; // £
const SALES_TIER3_TARGET = 150_000; // £

// ------- styles -------
const styles = {
  page: { minHeight: "100vh", background: "#f7f7f8", padding: 24, color: "#232D34" },
  container: { maxWidth: 1160, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 12, background: "#FFE1D9", display: "grid", placeItems: "center" },
  h1: { margin: 0, fontSize: 22, fontWeight: 600 },
  sub: { margin: 0, fontSize: 13, color: "#687481" },

  // summary panel
  summaryWrap: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 },
  summaryCard: { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", display: "flex", alignItems: "center", gap: 16 },
  summaryInfo: { display: "grid", gap: 6 },
  summaryTitle: { margin: 0, fontSize: 16, fontWeight: 700 },
  summaryMeta: { margin: 0, fontSize: 13, color: "#687481" },
  summaryBig: { fontSize: 20, fontWeight: 700 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, alignItems: "stretch" },

  input: { border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" },
  button: { borderRadius: 10, background: "#FF6341", color: "#fff", padding: "10px 14px", fontSize: 14, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },
  buttonAlt: { borderRadius: 10, background: "#111827", color: "#fff", padding: "10px 14px", fontSize: 14, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },

  card: { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", display: "flex", flexDirection: "column" },
  cardHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, background: "#FFE1D9", display: "grid", placeItems: "center" },
  cardTitle: { margin: 0, fontWeight: 600 },
  cardMeta: { fontSize: 12, color: "#687481" },
  center: { display: "grid", placeItems: "center", padding: 8, flex: 1 },
  numbers: { textAlign: "center", marginTop: 8 },
  big: { fontSize: 18, fontWeight: 600 },
  small: { fontSize: 12, color: "#687481" },

  row: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, marginTop: 10 },
  note: { marginTop: 8 },
  spinnerWrap: { display: "grid", placeItems: "center", padding: 60 },
  footer: { marginTop: 24, textAlign: "center", fontSize: 12, color: "#687481" },
  error: { marginTop: 16, background: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 10, fontSize: 14 },

  // Activity log styles
  activity: { marginTop: 12, borderTop: "1px solid #F0F2F4", paddingTop: 10, maxHeight: 160, overflow: "auto" },
  activityHeader: { fontSize: 12, color: "#687481", marginBottom: 6, fontWeight: 600 },
  activityItem: { display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, fontSize: 13, padding: "6px 0" },
  activityAmount: { fontWeight: 700 },
  activityNote: { color: "#475467", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  activityTime: { color: "#98A2B3", fontSize: 12 },
};

// Number formatting
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtGBP = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (iso) => new Date(iso).toLocaleString();
const signFmt = (n) => (n >= 0 ? `+${fmt(n)}` : `-${fmt(Math.abs(n))}`);

// Donut Pie SVG (animated)
function Donut({ percent, size = 160, stroke = 18, color = "#FF6341" }) {
  const radius = (size - stroke) / 2;
  const C = 2 * Math.PI * radius;
  const p = Math.max(0, Math.min(percent || 0, 1));
  const dash = p * C;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle cx={size/2} cy={size/2} r={radius} strokeWidth={stroke} stroke="#ECECEC" fill="none" strokeLinecap="round" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius} strokeWidth={stroke}
          stroke={color} fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${dash} ${C - dash}` }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{Math.round(p*100)}%</div>
          <div style={{ fontSize: 12, color: "#687481" }}>toward target</div>
        </div>
      </div>
    </div>
  );
}

export default function MultiIncentiveDashboard() {
  const [incentives, setIncentives] = useState([]); // { id, name, target, created_at }
  const [totals, setTotals] = useState({}); // incentive_id -> sum
  const [contribs, setContribs] = useState([]); // raw contributions for activity log
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per‑card inputs
  const [amountById, setAmountById] = useState({});
  const [noteById, setNoteById] = useState({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        // Demo seed — includes your six activity metrics and Sales Tier 2 card
        const demoIncentives = [
          { id: "a1", name: "Client Meetings", target: 16, created_at: new Date().toISOString() },
          { id: "a2", name: "New Jobs", target: 25, created_at: new Date().toISOString() },
          { id: "a3", name: "Content", target: 56, created_at: new Date().toISOString() },
          { id: "a4", name: "CVs Out", target: 140, created_at: new Date().toISOString() },
          { id: "a5", name: "Registrations", target: 180, created_at: new Date().toISOString() },
          { id: "a6", name: "BD Conversations", target: 140, created_at: new Date().toISOString() },
          { id: "s2", name: SALES_TIER2_NAME, target: SALES_TIER2_TARGET, created_at: new Date().toISOString() },
        ];
        const demoTotals = JSON.parse(localStorage.getItem("demo_totals") || "{}") || {};
        const demoContribs = JSON.parse(localStorage.getItem("demo_contribs") || "[]") || [];
        setIncentives(demoIncentives);
        setTotals(demoTotals);
        setContribs(demoContribs);
        setLoading(false);
        return;
      }

      // Fetch incentives
      const { data: inc, error: incErr } = await supabase
        .from("incentives")
        .select("id, name, target, created_at")
        .order("created_at", { ascending: true });
      if (incErr) throw incErr;
      setIncentives(inc || []);

      // Fetch contributions and compute totals by incentive
      const { data: rows, error: cErr } = await supabase
        .from("contributions")
        .select("id, incentive_id, amount, note, created_at");
      if (cErr) throw cErr;

      const totalsMap = {};
      (rows || []).forEach((row) => {
        totalsMap[row.incentive_id] = (totalsMap[row.incentive_id] || 0) + (row.amount || 0);
      });
      setTotals(totalsMap);
      setContribs(rows || []);
    } catch (e) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Realtime: listen for new contributions and new incentives
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel("multi_incentive_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contributions" }, (payload) => {
        const row = payload.new;
        setTotals((t) => ({ ...t, [row.incentive_id]: (t[row.incentive_id] || 0) + (row.amount || 0) }));
        setContribs((prev) => [row, ...prev]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incentives" }, (payload) => {
        const row = payload.new;
        setIncentives((list) => [...list, row]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const applyContribution = async (incentive, delta) => {
    // delta can be positive (add) or negative (deduct); disallow 0
    if (!Number.isFinite(delta) || delta === 0) { setError("Please enter a non‑zero number."); return; }
    const note = (noteById[incentive.id] || null);

    // Optimistic UI
    const optimistic = { id: `local-${Date.now()}`, incentive_id: incentive.id, amount: delta, note, created_at: new Date().toISOString() };
    setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) + delta }));
    setContribs((prev) => [optimistic, ...prev]);
    // Clear just the amount field but keep the note so you can add multiple
    setAmountById((m) => ({ ...m, [incentive.id]: "" }));

    if (!supabase) {
      const totalsMap = JSON.parse(localStorage.getItem("demo_totals") || "{}") || {};
      totalsMap[incentive.id] = (totalsMap[incentive.id] || 0) + delta;
      localStorage.setItem("demo_totals", JSON.stringify(totalsMap));
      const demoContribs = JSON.parse(localStorage.getItem("demo_contribs") || "[]") || [];
      localStorage.setItem("demo_contribs", JSON.stringify([optimistic, ...demoContribs]));
      return;
    }

    const { error: insErr, data } = await supabase
      .from("contributions")
      .insert({ incentive_id: incentive.id, amount: delta, note })
      .select("id, incentive_id, amount, note, created_at")
      .single();

    if (insErr) {
      // rollback optimistic
      setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) - delta }));
      setContribs((prev) => prev.filter((c) => c.id !== optimistic.id));
      setError(insErr.message);
    } else if (data) {
      // replace optimistic row with the real row
      setContribs((prev) => [data, ...prev.filter((c) => c.id !== optimistic.id)]);
    }
  };

  // ------- derived summaries -------
  // Tier 1 (Activity): sum the six named metrics
  const tier1Incs = incentives.filter((i) => TIER1_NAMES.includes(i.name));
  const tier1Target = tier1Incs.reduce((acc, i) => acc + (Number(i.target) || 0), 0);
  const tier1Achieved = tier1Incs.reduce((acc, i) => acc + (Number(totals[i.id]) || 0), 0);
  const tier1Pct = tier1Target > 0 ? Math.min(tier1Achieved / tier1Target, 1) : 0;

  // Tier 2 (Sales): use its own incentive card by name
  const sales2 = incentives.find((i) => i.name === SALES_TIER2_NAME);
  const sales2Target = sales2?.target ?? SALES_TIER2_TARGET;
  const sales2Achieved = sales2 ? (Number(totals[sales2.id]) || 0) : 0;
  const sales2Pct = sales2Target > 0 ? Math.min(sales2Achieved / sales2Target, 1) : 0;

  // Tier 3 (Sales): mirrors Tier 2 progress but has a higher target
  const sales3Target = SALES_TIER3_TARGET;
  const sales3Achieved = sales2Achieved; // mirror Tier 2
  const sales3Pct = sales3Target > 0 ? Math.min(sales3Achieved / sales3Target, 1) : 0;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.badge}><PieChart size={18} color="#FF6341" /></div>
            <div>
              <h1 style={styles.h1}>Team Incentive Dashboard</h1>
              <p style={styles.sub}>Realtime pies. Add or deduct entries. Share the link.</p>
            </div>
          </div>
          {!supabase && (
            <div style={{ fontSize: 12, color: "#687481", display: "flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={14}/> Demo mode (no Supabase keys)
            </div>
          )}
        </header>

        {/* Summary pies */}
        <section style={styles.summaryWrap}>
          <div style={styles.summaryCard}>
            <Donut percent={tier1Pct} size={140} stroke={16} color="#111827" />
            <div style={styles.summaryInfo}>
              <h3 style={styles.summaryTitle}>Activity Incentive – Tier 1</h3>
              <p style={styles.summaryMeta}>{TIER1_NAMES.length} metrics · {fmt(tier1Achieved)} / {fmt(tier1Target)}</p>
              <div style={styles.summaryBig}>{fmt(Math.max(tier1Target - tier1Achieved, 0))} remaining</div>
            </div>
          </div>

          <div style={styles.summaryCard}>
            <Donut percent={sales2Pct} size={140} stroke={16} color="#FF6341" />
            <div style={styles.summaryInfo}>
              <h3 style={styles.summaryTitle}>Sales Incentive – Tier 2</h3>
              <p style={styles.summaryMeta}>{fmtGBP(sales2Achieved)} / {fmtGBP(sales2Target)}</p>
              <div style={styles.summaryBig}>{fmtGBP(Math.max(sales2Target - sales2Achieved, 0))} remaining</div>
            </div>
          </div>

          <div style={styles.summaryCard}>
            <Donut percent={sales3Pct} size={140} stroke={16} color="#0EA5E9" />
            <div style={styles.summaryInfo}>
              <h3 style={styles.summaryTitle}>Sales Incentive – Tier 3</h3>
              <p style={styles.summaryMeta}>{fmtGBP(sales3Achieved)} / {fmtGBP(sales3Target)}</p>
              <div style={styles.summaryBig}>{fmtGBP(Math.max(sales3Target - sales3Achieved, 0))} remaining</div>
            </div>
          </div>
        </section>

        {loading ? (
          <div style={styles.spinnerWrap}>
            <div style={{ width: 40, height: 40, border: "4px solid #e5e7eb", borderTopColor: "#FF6341", borderRadius: "50%", animation: "spin 1s linear infinite" }}/>
          </div>
        ) : (
          <div style={styles.grid}>
            {incentives.map((inc) => {
              const total = totals[inc.id] || 0;
              const pct = inc.target > 0 ? Math.min(total / inc.target, 1) : 0;
              const over = total > inc.target;
              const list = contribs
                .filter((c) => c.incentive_id === inc.id)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 6);

              const amountVal = amountById[inc.id] || "";
              const parsed = Number(amountVal);

              return (
                <div key={inc.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div style={styles.cardIcon}><Users size={16} color="#FF6341"/></div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ ...styles.cardTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={inc.name}>{inc.name}</h3>
                      <div style={styles.cardMeta}>Target {inc.name === SALES_TIER2_NAME ? fmtGBP(inc.target) : fmt(inc.target)}</div>
                    </div>
                  </div>

                  <div style={styles.center}>
                    <Donut percent={pct} />
                  </div>

                  <div style={styles.numbers}>
                    <div style={styles.big}>
                      {inc.name === SALES_TIER2_NAME ? (
                        <>
                          {fmtGBP(total)} / {fmtGBP(inc.target)}{over ? " (🎉 exceeded)" : ""}
                        </>
                      ) : (
                        <>
                          {fmt(total)} / {fmt(inc.target)}{over ? " (🎉 exceeded)" : ""}
                        </>
                      )}
                    </div>
                    <div style={styles.small}>
                      {inc.name === SALES_TIER2_NAME
                        ? fmtGBP(Math.max(inc.target - total, 0))
                        : fmt(Math.max(inc.target - total, 0))} remaining
                    </div>
                  </div>

                  <div style={styles.row}>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={inc.name === SALES_TIER2_NAME ? "£ Amount" : "Amount"}
                      value={amountVal}
                      onChange={(e)=>setAmountById((m)=>({ ...m, [inc.id]: e.target.value }))}
                      style={styles.input}
                    />
                    <button
                      onClick={() => applyContribution(inc, Number.isFinite(parsed) ? Math.abs(parsed) : NaN)}
                      style={styles.button}
                      title="Add this amount"
                    >
                      <PlusCircle size={16}/> Add
                    </button>
                    <button
                      onClick={() => applyContribution(inc, Number.isFinite(parsed) ? -Math.abs(parsed) : NaN)}
                      style={styles.buttonAlt}
                      title="Deduct this amount"
                    >
                      <MinusCircle size={16}/> Deduct
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional note (who/what)"
                    value={noteById[inc.id] || ""}
                    onChange={(e)=>setNoteById((m)=>({ ...m, [inc.id]: e.target.value }))}
                    style={{ ...styles.input, ...styles.note }}
                  />

                  {/* Activity log */}
                  <div style={styles.activity}>
                    <div style={styles.activityHeader}>Recent activity</div>
                    {list.map((c) => (
                      <div key={c.id} style={styles.activityItem} title={c.note || ""}>
                        <span style={{ ...styles.activityAmount, color: c.amount >= 0 ? "#047857" : "#B42318" }}>
                          {inc.name === SALES_TIER2_NAME ? (c.amount >=0 ? `+${fmtGBP(c.amount)}` : `-${fmtGBP(Math.abs(c.amount))}`) : signFmt(c.amount)}
                        </span>
                        <span style={styles.activityNote}>{c.note || "—"}</span>
                        <span style={styles.activityTime}>{fmtDate(c.created_at)}</span>
                      </div>
                    ))}
                    {list.length === 0 && (
                      <div style={{ fontSize: 12, color: "#98A2B3" }}>No entries yet.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={styles.error}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={styles.footer}>Built for PIE — brand accents #FF6341 / #232D34</div>
      </div>

      {/* spinner keyframe */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

