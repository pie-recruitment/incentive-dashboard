import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, MinusCircle, Users, PieChart } from "lucide-react";

// Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Number formatting helpers
const fmt = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (iso) => new Date(iso).toLocaleString();
const signFmt = (n) => (n >= 0 ? `+${fmt(n)}` : `-${fmt(Math.abs(n))}`);

// Donut Pie SVG
function Donut({ percent, size = 160, stroke = 18 }) {
  const radius = (size - stroke) / 2;
  const C = 2 * Math.PI * radius;
  const offset = C - (percent / 100) * C;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#eee" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#FF6341"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={C}
        strokeDashoffset={offset}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6 }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        fontSize="20"
        fill="#232D34"
        transform="rotate(90, 80, 80)"
      >
        {percent.toFixed(1)}%
      </text>
    </svg>
  );
}

export default function MultiIncentiveDashboard() {
  const [incentives, setIncentives] = useState([]);
  const [totals, setTotals] = useState({});
  const [logs, setLogs] = useState({});
  const [inputs, setInputs] = useState({});
  const [notes, setNotes] = useState({});

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      const { data: incs } = await supabase.from("incentives").select("*");
      setIncentives(incs || []);

      const { data: contribs } = await supabase.from("contributions").select("*").order("created_at", { ascending: false });
      updateFromContributions(contribs || []);

      supabase
        .channel("db-changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "contributions" },
          (payload) => updateFromContributions([payload.new], true)
        )
        .subscribe();
    }
    fetchData();
  }, []);

  function updateFromContributions(contribs, append = false) {
    setTotals((prev) => {
      const updated = { ...prev };
      contribs.forEach((c) => {
        updated[c.incentive_id] = (updated[c.incentive_id] || 0) + c.amount;
      });
      return updated;
    });
    setLogs((prev) => {
      const updated = { ...prev };
      contribs.forEach((c) => {
        if (!updated[c.incentive_id]) updated[c.incentive_id] = [];
        updated[c.incentive_id] = append ? [c, ...updated[c.incentive_id]] : [...(updated[c.incentive_id] || []), c];
      });
      return updated;
    });
  }

  async function addContribution(id, amount) {
    if (!amount) return;
    await supabase.from("contributions").insert({ incentive_id: id, amount, note: notes[id] || null });
    setInputs((p) => ({ ...p, [id]: "" }));
    setNotes((p) => ({ ...p, [id]: "" }));
  }

  // Group incentives
  const activityMetrics = incentives.filter((i) =>
    ["Client Meetings", "New Jobs", "Content", "CVs Out", "Registrations", "BD Conversations"].includes(i.name)
  );
  const salesTier2 = incentives.find((i) => i.name === "Sales Incentive - Tier 2");
  const salesTier3 = { id: "tier3", name: "Sales Incentive - Tier 3", target: 150000 };

  // Calculate totals
  const totalActivityTarget = activityMetrics.reduce((a, b) => a + b.target, 0);
  const totalActivityValue = activityMetrics.reduce((a, b) => a + (totals[b.id] || 0), 0);

  const tier2Value = salesTier2 ? totals[salesTier2.id] || 0 : 0;
  const tier3Value = tier2Value;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", padding: 24, color: "#232D34" }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>🎯 Incentive Dashboard</h1>

      {/* Top summary pies */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <h3>Activity Incentive - Tier 1</h3>
          <Donut percent={(totalActivityValue / totalActivityTarget) * 100} />
          <p>{fmt(totalActivityValue)} / {fmt(totalActivityTarget)}</p>
        </div>
        {salesTier2 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h3>{salesTier2.name}</h3>
            <Donut percent={(tier2Value / salesTier2.target) * 100} />
            <p>£{fmt(tier2Value)} / £{fmt(salesTier2.target)}</p>
          </div>
        )}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <h3>{salesTier3.name}</h3>
          <Donut percent={(tier3Value / salesTier3.target) * 100} />
          <p>£{fmt(tier3Value)} / £{fmt(salesTier3.target)}</p>
        </div>
      </div>

      {/* Individual activity metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {activityMetrics.map((i) => (
          <div key={i.id} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h3>{i.name}</h3>
            <Donut percent={((totals[i.id] || 0) / i.target) * 100} />
            <p>{fmt(totals[i.id] || 0)} / {fmt(i.target)}</p>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input
                type="number"
                value={inputs[i.id] || ""}
                onChange={(e) => setInputs((p) => ({ ...p, [i.id]: e.target.value }))}
                placeholder="Amount"
                style={{ flex: 1, padding: 6 }}
              />
              <button onClick={() => addContribution(i.id, parseInt(inputs[i.id]))} style={{ background: "#28a745", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6 }}>
                <PlusCircle size={18} />
              </button>
              <button onClick={() => addContribution(i.id, -Math.abs(parseInt(inputs[i.id])))} style={{ background: "#dc3545", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6 }}>
                <MinusCircle size={18} />
              </button>
            </div>

            <input
              type="text"
              value={notes[i.id] || ""}
              onChange={(e) => setNotes((p) => ({ ...p, [i.id]: e.target.value }))}
              placeholder="Note (optional)"
              style={{ width: "100%", marginTop: 6, padding: 6 }}
            />

            <div style={{ marginTop: 12 }}>
              <h4>Log</h4>
              <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 13 }}>
                <AnimatePresence>
                  {(logs[i.id] || []).map((l) => (
                    <motion.div key={l.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {signFmt(l.amount)} ({fmtDate(l.created_at)}) {l.note && `- ${l.note}`}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

