import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, Target, Users, PieChart, RefreshCw } from "lucide-react";

/**
 * MULTI-INCENTIVE DASHBOARD — React + Supabase (Pure JS, single export)
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

// ------- styles -------
const styles = {
  page: { minHeight: "100vh", background: "#f7f7f8", padding: 24, color: "#232D34" },
  container: { maxWidth: 1160, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 12, background: "#FFE1D9", display: "grid", placeItems: "center" },
  h1: { margin: 0, fontSize: 22, fontWeight: 600 },
  sub: { margin: 0, fontSize: 13, color: "#687481" },

  panel: { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(16,24,40,0.06)" },
  panelTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, alignItems: "stretch" },

  input: { border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" },
  button: { borderRadius: 10, background: "#FF6341", color: "#fff", padding: "10px 14px", fontSize: 14, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },

  card: { background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 3px rgba(16,24,40,0.06)", display: "flex", flexDirection: "column" },
  cardHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, background: "#FFE1D9", display: "grid", placeItems: "center" },
  cardTitle: { margin: 0, fontWeight: 600 },
  cardMeta: { fontSize: 12, color: "#687481" },
  center: { display: "grid", placeItems: "center", padding: 8, flex: 1 },
  numbers: { textAlign: "center", marginTop: 8 },
  big: { fontSize: 18, fontWeight: 600 },
  small: { fontSize: 12, color: "#687481" },

  row: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10 },
  note: { marginTop: 8 },
  spinnerWrap: { display: "grid", placeItems: "center", padding: 60 },
  footer: { marginTop: 24, textAlign: "center", fontSize: 12, color: "#687481" },
  error: { marginTop: 16, background: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 10, fontSize: 14 },
};

// Number formatting
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n ?? 0);

// Donut Pie SVG (animated)
function Donut({ percent, size = 160, stroke = 18 }) {
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
          stroke="#FF6341" fill="none" strokeLinecap="round"
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");

  // Per-card inputs
  const [amountById, setAmountById] = useState({});
  const [noteById, setNoteById] = useState({});

  const demoMode = !supabase;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        // Demo seed
        const demoIncentives = JSON.parse(localStorage.getItem("demo_incentives") || "null") || [
          { id: "1", name: "Q4 Sales", target: 40, created_at: new Date().toISOString() },
          { id: "2", name: "New Logos", target: 25, created_at: new Date().toISOString() },
          { id: "3", name: "Customer Upsells", target: 15, created_at: new Date().toISOString() },
        ];
        const demoTotals = JSON.parse(localStorage.getItem("demo_totals") || "{}") || {};
        setIncentives(demoIncentives);
        setTotals(demoTotals);
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
      const { data: contribs, error: cErr } = await supabase
        .from("contributions")
        .select("id, incentive_id, amount, note, created_at");
      if (cErr) throw cErr;

      const totalsMap = {};
      (contribs || []).forEach((row) => {
        totalsMap[row.incentive_id] = (totalsMap[row.incentive_id] || 0) + (row.amount || 0);
      });
      setTotals(totalsMap);
    } catch (e) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Realtime
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("multi_incentive_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contributions" }, (payload) => {
        const row = payload.new;
        setTotals((t) => ({ ...t, [row.incentive_id]: (t[row.incentive_id] || 0) + (row.amount || 0) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incentives" }, (payload) => {
        const row = payload.new;
        setIncentives((list) => [...list, row]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddContribution = async (incentive) => {
    const raw = amountById[incentive.id];
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) { setError("Please enter a positive number."); return; }
    const note = noteById[incentive.id] || null;

    // Optimistic UI
    setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) + n }));
    setAmountById((m) => ({ ...m, [incentive.id]: "" }));
    setNoteById((m) => ({ ...m, [incentive.id]: "" }));

    if (!supabase) {
      const totalsMap = JSON.parse(localStorage.getItem("demo_totals") || "{}") || {};
      totalsMap[incentive.id] = (totalsMap[incentive.id] || 0) + n;
      localStorage.setItem("demo_totals", JSON.stringify(totalsMap));
      return;
    }

    const { error: insErr } = await supabase
      .from("contributions")
      .insert({ incentive_id: incentive.id, amount: n, note });
    if (insErr) {
      setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) - n }));
      setError(insErr.message);
    }
  };

  const handleAddIncentive = async () => {
    setError(null);
    const name = (newName || "").trim();
    const targetNum = Number(newTarget);
    if (!name) { setError("Please enter a name for the incentive."); return; }
    if (!Number.isFinite(targetNum) || targetNum <= 0) { setError("Target must be a positive number."); return; }

    if (!supabase) {
      const demoIncentives = JSON.parse(localStorage.getItem("demo_incentives") || "[]") || [];
      const newInc = { id: String(Date.now()), name, target: targetNum, created_at: new Date().toISOString() };
      const updated = [...demoIncentives, newInc];
      localStorage.setItem("demo_incentives", JSON.stringify(updated));
      setIncentives(updated);
      setNewName(""); setNewTarget("");
      return;
    }

    const { error: insErr } = await supabase.from("incentives").insert({ name, target: targetNum });
    if (insErr) { setError(insErr.message); return; }
    setNewName(""); setNewTarget("");
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.badge}><PieChart size={18} color="#FF6341" /></div>
            <div>
              <h1 style={styles.h1}>Team Incentive Dashboard</h1>
              <p style={styles.sub}>Realtime pies. Add contributions. Share the link.</p>
            </div>
          </div>
          {!supabase && (
            <div style={{ fontSize: 12, color: "#687481", display: "flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={14}/> Demo mode (no Supabase keys)
            </div>
          )}
        </header>

        <div style={{ ...styles.panel, marginBottom: 16 }}>
          <div style={styles.panelTitle}><Target size={18}/> Add a new incentive</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 10 }}>
            <input value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="Name e.g. Q4 Sales" style={styles.input}/>
            <input value={newTarget} onChange={(e)=>setNewTarget(e.target.value)} type="number" inputMode="numeric" placeholder="Target e.g. 40" style={styles.input}/>
            <button onClick={handleAddIncentive} style={styles.button}><PlusCircle size={16}/> Add incentive</button>
          </div>
        </div>

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
              return (
                <div key={inc.id} style={styles.card}>
                  <div style={styles.cardHead}>
                    <div style={styles.cardIcon}><Users size={16} color="#FF6341"/></div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ ...styles.cardTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={inc.name}>{inc.name}</h3>
                      <div style={styles.cardMeta}>Target {fmt(inc.target)}</div>
                    </div>
                  </div>

                  <div style={styles.center}>
                    <Donut percent={pct} />
                  </div>

                  <div style={styles.numbers}>
                    <div style={styles.big}>{fmt(total)} / {fmt(inc.target)}{over ? " (🎉 exceeded)" : ""}</div>
                    <div style={styles.small}>{fmt(Math.max(inc.target - total, 0))} remaining</div>
                  </div>

                  <div style={styles.row}>
                    <input type="number" inputMode="numeric" placeholder="Add amount" value={amountById[inc.id] || ""} onChange={(e)=>setAmountById((m)=>({ ...m, [inc.id]: e.target.value }))} style={styles.input}/>
                    <button onClick={()=>handleAddContribution(inc)} style={styles.button}><PlusCircle size={16}/> Add</button>
                  </div>
                  <input type="text" placeholder="Optional note (who/what)" value={noteById[inc.id] || ""} onChange={(e)=>setNoteById((m)=>({ ...m, [inc.id]: e.target.value }))} style={{ ...styles.input, ...styles.note }}/>
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
