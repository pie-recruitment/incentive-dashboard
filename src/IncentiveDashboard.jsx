import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, Target, Users, PieChart, RefreshCw } from "lucide-react";

/**
 * MULTI‑INCENTIVE DASHBOARD — React + Supabase
 * ----------------------------------------------------
 * One file. Drop into any React app (Next.js, Vite, CRA). Shows a realtime
 * dashboard of multiple incentive pies. Team can add contributions per incentive.
 *
 * What you need to set:
 * - Environment variables (public) in your hosting platform:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Database (already provided earlier, repeated here for convenience):
 * ----------------------------------------------------
 * create table if not exists public.incentives (
 *   id uuid primary key default gen_random_uuid(),
 *   name text not null,
 *   target integer not null check (target > 0),
 *   created_at timestamptz default now()
 * );
 *
 * create table if not exists public.contributions (
 *   id uuid primary key default gen_random_uuid(),
 *   incentive_id uuid not null references public.incentives (id) on delete cascade,
 *   amount integer not null check (amount > 0),
 *   note text,
 *   created_at timestamptz default now()
 * );
 *
 * alter table public.incentives enable row level security;
 * alter table public.contributions enable row level security;
 *
 * -- Policies (public read + public insert for demo)
 * do $$
 * begin
 *   if not exists (select 1 from pg_policies where schemaname='public' and tablename='incentives' and policyname='Public read incentives') then
 *     create policy "Public read incentives" on public.incentives for select using (true);
 *   end if;
 *   if not exists (select 1 from pg_policies where schemaname='public' and tablename='contributions' and policyname='Public read contributions') then
 *     create policy "Public read contributions" on public.contributions for select using (true);
 *   end if;
 *   if not exists (select 1 from pg_policies where schemaname='public' and tablename='contributions' and policyname='Public insert contributions') then
 *     create policy "Public insert contributions" on public.contributions for insert with check (true);
 *   end if;
 * end $$;
 * ----------------------------------------------------
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/** Number formatting */
const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);

/** Donut Pie SVG */
function Donut({ percent, size = 160, stroke = 18 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const C = 2 * Math.PI * radius;
  const p = Math.max(0, Math.min(percent, 1));
  const dash = p * C;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
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
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-2xl font-semibold">{Math.round(p*100)}%</div>
          <div className="text-xs text-gray-500">toward target</div>
        </div>
      </div>
    </div>
  );
}

/** Types */
interface Incentive { id: string; name: string; target: number; created_at: string }
interface Contribution { id: string; incentive_id: string; amount: number; note?: string | null; created_at: string }

export default function MultiIncentiveDashboard() {
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({}); // incentive_id -> sum
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState<string>("");

  // For per‑card inputs
  const [amountById, setAmountById] = useState<Record<string, string>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const demoMode = !supabase;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        // Demo seed
        const demoIncentives: Incentive[] = JSON.parse(localStorage.getItem("demo_incentives") || "null") || [
          { id: "1", name: "Q4 Sales", target: 40, created_at: new Date().toISOString() },
          { id: "2", name: "New Logos", target: 25, created_at: new Date().toISOString() },
          { id: "3", name: "Customer Upsells", target: 15, created_at: new Date().toISOString() },
        ];
        const demoTotals: Record<string, number> = JSON.parse(localStorage.getItem("demo_totals") || "{}");
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

      const totalsMap: Record<string, number> = {};
      (contribs || []).forEach((row: Contribution) => {
        totalsMap[row.incentive_id] = (totalsMap[row.incentive_id] || 0) + (row.amount || 0);
      });
      setTotals(totalsMap);
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Realtime: listen for new contributions and new incentives
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel("multi_incentive_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contributions" }, (payload) => {
        const row = payload.new as Contribution;
        setTotals((t) => ({ ...t, [row.incentive_id]: (t[row.incentive_id] || 0) + (row.amount || 0) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incentives" }, (payload) => {
        const row = payload.new as Incentive;
        setIncentives((list) => [...list, row]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddContribution = async (incentive: Incentive) => {
    const raw = amountById[incentive.id];
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Please enter a positive number.");
      return;
    }
    const note = noteById[incentive.id] || null;

    // Optimistic UI
    setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) + n }));
    setAmountById((m) => ({ ...m, [incentive.id]: "" }));
    setNoteById((m) => ({ ...m, [incentive.id]: "" }));

    if (!supabase) {
      const totalsMap: Record<string, number> = JSON.parse(localStorage.getItem("demo_totals") || "{}");
      totalsMap[incentive.id] = (totalsMap[incentive.id] || 0) + n;
      localStorage.setItem("demo_totals", JSON.stringify(totalsMap));
      return;
    }

    const { error: insErr } = await supabase
      .from("contributions")
      .insert({ incentive_id: incentive.id, amount: n, note });
    if (insErr) {
      // rollback
      setTotals((t) => ({ ...t, [incentive.id]: (t[incentive.id] || 0) - n }));
      setError(insErr.message);
    }
  };

  const handleAddIncentive = async () => {
    setError(null);
    const name = newName.trim();
    const targetNum = Number(newTarget);
    if (!name) { setError("Please enter a name for the incentive."); return; }
    if (!Number.isFinite(targetNum) || targetNum <= 0) { setError("Target must be a positive number."); return; }

    if (!supabase) {
      const demoIncentives: Incentive[] = JSON.parse(localStorage.getItem("demo_incentives") || "[]");
      const newInc: Incentive = { id: String(Date.now()), name, target: targetNum, created_at: new Date().toISOString() };
      const updated = [...demoIncentives, newInc];
      localStorage.setItem("demo_incentives", JSON.stringify(updated));
      setIncentives(updated);
      setNewName(""); setNewTarget("");
      return;
    }

    const { error: insErr } = await supabase
      .from("incentives")
      .insert({ name, target: targetNum });
    if (insErr) { setError(insErr.message); return; }
    setNewName(""); setNewTarget("");
  };

  return (
    <div className="min-h-[100vh] w-full bg-[#f9f9f9] text-[#232D34] p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6341]/10 grid place-items-center"><PieChart className="w-5 h-5 text-[#FF6341]"/></div>
            <div>
              <h1 className="text-2xl font-semibold">Team Incentive Dashboard</h1>
              <p className="text-sm text-gray-500">Realtime pies. Add contributions. Share the link.</p>
            </div>
          </div>
          {demoMode && (
            <div className="text-xs text-gray-500 flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Demo mode (no Supabase keys)</div>
          )}
        </header>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Target className="w-5 h-5"/> Add a new incentive</h2>
          <div className="grid sm:grid-cols-[1fr_160px_auto] gap-3">
            <input value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="Name e.g. Q4 Sales" className="rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF6341]"/>
            <input value={newTarget} onChange={(e)=>setNewTarget(e.target.value)} type="number" inputMode="numeric" placeholder="Target e.g. 40" className="rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF6341]"/>
            <button onClick={handleAddIncentive} className="rounded-xl bg-[#FF6341] text-white px-4 py-3 inline-flex items-center justify-center gap-2 hover:opacity-90"><PlusCircle className="w-5 h-5"/> Add incentive</button>
          </div>
          {demoMode && (
            <p className="text-xs text-gray-500 mt-2">Demo mode uses your browser storage. Add your Supabase keys to go live.</p>
          )}
        </div>

        {loading ? (
          <div className="py-24 grid place-items-center">
            <div className="animate-spin w-12 h-12 rounded-full border-4 border-gray-200 border-t-[#FF6341]" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incentives.map((inc) => {
              const total = totals[inc.id] || 0;
              const pct = inc.target > 0 ? Math.min(total / inc.target, 1) : 0;
              const over = total > inc.target;
              return (
                <div key={inc.id} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-[#FF6341]/10 grid place-items-center"><Users className="w-4 h-4 text-[#FF6341]"/></div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate" title={inc.name}>{inc.name}</h3>
                      <div className="text-xs text-gray-500">Target {fmt(inc.target)}</div>
                    </div>
                  </div>

                  <div className="flex-1 grid place-items-center">
                    <Donut percent={pct} />
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-xl font-semibold">{fmt(total)} / {fmt(inc.target)}{over ? " (🎉 exceeded)" : ""}</div>
                    <div className="text-xs text-gray-500">{fmt(Math.max(inc.target - total, 0))} remaining</div>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr] sm:grid-cols-[1fr_auto] gap-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Add amount"
                      value={amountById[inc.id] || ""}
                      onChange={(e)=>setAmountById((m)=>({ ...m, [inc.id]: e.target.value }))}
                      className="rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF6341]"
                    />
                    <button onClick={()=>handleAddContribution(inc)} className="rounded-xl bg-[#FF6341] text-white px-4 py-3 inline-flex items-center justify-center gap-2 hover:opacity-90"><PlusCircle className="w-5 h-5"/> Add</button>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional note (who/what)"
                    value={noteById[inc.id] || ""}
                    onChange={(e)=>setNoteById((m)=>({ ...m, [inc.id]: e.target.value }))}
                    className="mt-2 rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF6341]"
                  />
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-6 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-10 text-xs text-gray-500 text-center">Built for PIE — brand accents #FF6341 / #232D34</footer>
      </div>
    </div>
  );
}
