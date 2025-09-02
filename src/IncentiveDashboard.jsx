// src/IncentiveDashboard.jsx
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, MinusCircle, PieChart } from "lucide-react";

// ---- Supabase ----
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ---- Helpers ----
const fmt = (n) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    n ?? 0
  );
const fmtGBP = (n) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n ?? 0);
const fmtDate = (iso) => new Date(iso).toLocaleString();

// ---- Donut Chart ----
function Donut({ percent, size = 160, stroke = 18 }) {
  const radius = (size - stroke) / 2;
  const C = 2 * Math.PI * radius;
  const offset = C * (1 - percent / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#eee"
        strokeWidth={stroke}
        fill="none"
      />
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
        transition={{ duration: 0.8 }}
      />
    </svg>
  );
}

// ---- Main Dashboard ----
export default function MultiIncentiveDashboard() {
  const [incentives, setIncentives] = useState([]);
  const [totals, setTotals] = useState({});
  const [logs, setLogs] = useState({});

  // Fetch incentives + totals
  useEffect(() => {
    if (!supabase) return;

    async function load() {
      const { data: incs } = await supabase.from("incentives").select("*");
      setIncentives(incs || []);

      const { data: contribs } = await supabase
        .from("contributions")
        .select("*");
      updateState(incs, contribs);
    }
    load();

    // Subscribe realtime
    const sub = supabase
      .channel("db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contributions" },
        (payload) => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  function updateState(incs, contribs) {
    const sums = {};
    const groupedLogs = {};
    contribs.forEach((c) => {
      sums[c.incentive_id] = (sums[c.incentive_id] || 0) + c.amount;
      if (!groupedLogs[c.incentive_id]) groupedLogs[c.incentive_id] = [];
      groupedLogs[c.incentive_id].push(c);
    });
    setTotals(sums);
    setLogs(groupedLogs);
  }

  async function addContribution(incentiveId, amount, note = "") {
    if (!supabase) return;
    await supabase.from("contributions").insert({
      incentive_id: incentiveId,
      amount,
      note,
    });
  }

  // ---- Derived: Tier 1 total ----
  const tier1Ids = incentives
    .filter((i) =>
      [
        "Client Meetings",
        "New Jobs",
        "Content",
        "CVs Out",
        "Registrations",
        "BD Conversations",
      ].includes(i.name)
    )
    .map((i) => i.id);
  const tier1Target = incentives
    .filter((i) => tier1Ids.includes(i.id))
    .reduce((sum, i) => sum + i.target, 0);
  const tier1Total = tier1Ids.reduce(
    (sum, id) => sum + (totals[id] || 0),
    0
  );

  // ---- Derived: Tier 2 & Tier 3 ----
  const tier2 = incentives.find((i) => i.name === "Sales Incentive - Tier 2");
  const tier2Total = tier2 ? totals[tier2.id] || 0 : 0;
  const tier3Target = 150000;
  const tier3Total = tier2Total; // mirrors Tier 2

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1 style={{ color: "#232D34" }}>Team Incentives Dashboard</h1>

      {/* Top Summary Pies */}
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
        <SummaryPie
          title="Activity Incentive – Tier 1"
          total={tier1Total}
          target={tier1Target}
        />
        {tier2 && (
          <SummaryPie
            title="Sales Incentive – Tier 2"
            total={tier2Total}
            target={tier2.target}
            money
          />
        )}
        <SummaryPie
          title="Sales Incentive – Tier 3"
          total={tier3Total}
          target={tier3Target}
          money
        />
      </div>

      {/* Individual Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 40 }}>
        {incentives.map((inc) => (
          <div key={inc.id} style={{ background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
            <h3>{inc.name}</h3>
            <Donut
              percent={Math.min(100, ((totals[inc.id] || 0) / inc.target) * 100)}
              size={140}
            />
            <p>
              {inc.name.includes("Sales")
                ? `${fmtGBP(totals[inc.id] || 0)} / ${fmtGBP(inc.target)}`
                : `${fmt(totals[inc.id] || 0)} / ${fmt(inc.target)}`}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  const val = prompt("Add how many?");
                  if (val) addContribution(inc.id, Number(val), "Added");
                }}
              >
                <PlusCircle size={16} /> Add
              </button>
              <button
                onClick={() => {
                  const val = prompt("Deduct how many?");
                  if (val) addContribution(inc.id, -Number(val), "Deducted");
                }}
              >
                <MinusCircle size={16} /> Deduct
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <h4>Activity Log</h4>
              <ul>
                {(logs[inc.id] || []).map((log) => (
                  <li key={log.id}>
                    {fmtDate(log.created_at)} – {log.amount > 0 ? "+" : ""}
                    {log.amount} ({log.note})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Summary Pie Component ----
function SummaryPie({ title, total, target, money }) {
  const percent = Math.min(100, (total / target) * 100);
  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
      <h3>{title}</h3>
      <Donut percent={percent} size={160} />
      <p>
        {money
          ? `${fmtGBP(total)} / ${fmtGBP(target)}`
          : `${fmt(total)} / ${fmt(target)}`}
      </p>
    </div>
  );
}

