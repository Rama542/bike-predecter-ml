"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bike, Battery, AlertTriangle, CheckCircle,
  Wrench, RefreshCw, MapPin, Activity,
} from "lucide-react";
import { getFleetData, getBikeModels } from "@/lib/api";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />;
}

export default function FleetPage() {
  const [view, setView]             = useState<"zones" | "models">("zones");
  const [fleetData, setFleetData]   = useState<any[]>([]);
  const [bikeModels, setBikeModels] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "fallback">("fallback");
  const [lastSync, setLastSync]     = useState<Date | null>(null);

  const fetchFleet = async () => {
    setLoading(true);
    try {
      const [data, modelsData] = await Promise.all([
        getFleetData(),
        getBikeModels(),
      ]);

      // Detect live vs fallback: live data has varying demand_score from ML
      const scores = data.map((z: any) => z.demand_score);
      const isLive = new Set(scores).size > 3;
      setDataSource(isLive ? "live" : "fallback");

      const formatted = data.map((z: any) => {
        let rebalance = "Balanced";
        if (z.demand_score > 1.1)
          rebalance = `Receive ${Math.round((z.demand_score - 1) * 30)} bikes`;
        else if (z.demand_score < 0.9)
          rebalance = `Send ${Math.round((1 - z.demand_score) * 30)} bikes`;
        return { ...z, demand: z.demand_score, rebalance };
      });

      setFleetData(formatted);
      setBikeModels(modelsData);
      setLastSync(new Date());
    } catch (error) {
      console.error("Fleet fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFleet(); }, []);

  // Reload when a new dataset finishes training
  useEffect(() => {
    const onTrained = () => { void fetchFleet(); };
    window.addEventListener("ml-trained", onTrained);
    return () => window.removeEventListener("ml-trained", onTrained);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = fleetData.reduce(
    (a, z) => ({
      total:       a.total       + z.total,
      available:   a.available   + z.available,
      in_use:      a.in_use      + z.in_use,
      maintenance: a.maintenance + z.maintenance,
      low_battery: a.low_battery + z.low_battery,
    }),
    { total: 0, available: 0, in_use: 0, maintenance: 0, low_battery: 0 }
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <Bike className="w-6 h-6 text-emerald-400" /> Fleet Management
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time bike availability, health &amp; SARIMA rebalancing intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live / Demo badge */}
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${
            dataSource === "live"
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              dataSource === "live" ? "bg-emerald-400" : "bg-blue-400"
            }`} />
            {dataSource === "live" ? "ML Live" : "Demo Data"}
          </span>
          <button
            onClick={fetchFleet}
            disabled={loading}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Sync Fleet
          </button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : [
              { label: "Total Fleet",  value: totals.total,       icon: Bike,         color: "#6366f1" },
              { label: "Available",    value: totals.available,   icon: CheckCircle,  color: "#10b981" },
              { label: "In Use",       value: totals.in_use,      icon: Activity,     color: "#00f5ff" },
              { label: "Maintenance",  value: totals.maintenance, icon: Wrench,       color: "#f59e0b" },
              { label: "Low Battery",  value: totals.low_battery, icon: Battery,      color: "#ef4444" },
            ].map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-xl p-4"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${k.color}15`, border: `1px solid ${k.color}25` }}
                >
                  <k.icon className="w-4 h-4" style={{ color: k.color }} />
                </div>
                <div className="text-2xl font-display font-bold text-white">{k.value}</div>
                <div className="text-xs text-slate-500">{k.label}</div>
              </motion.div>
            ))}
      </div>

      {/* View toggle */}
      <div className="glass rounded-xl p-1 flex gap-1 w-fit">
        {(["zones", "models"] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              view === v ? "bg-brand-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {v === "zones" ? "🗺️ By Zone" : "🏍️ By Model"}
          </button>
        ))}
      </div>

      {/* ── By Zone ── */}
      {view === "zones" && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : fleetData.length > 0 ? (
            fleetData.map((z, i) => {
              const utilPct  = Math.round((z.in_use   / z.total) * 100);
              const availPct = Math.round((z.available / z.total) * 100);
              const needsRebalance = z.rebalance !== "Balanced";
              return (
                <motion.div
                  key={z.area}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="glass rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl glass-light flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-brand-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{z.area}</div>
                        <div className="text-xs text-slate-500">
                          SARIMA Demand:{" "}
                          <span className={`font-semibold ${
                            z.demand > 1.1 ? "text-red-400" : z.demand > 1 ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {z.demand.toFixed(2)}
                          </span>
                          {" "}· Total: <span className="text-white font-medium">{z.total}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsRebalance && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        needsRebalance
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {z.rebalance}
                      </span>
                    </div>
                  </div>

                  {/* Stat bars */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Available",   val: z.available,   pct: availPct,                                    color: "#10b981" },
                      { label: "In Use",      val: z.in_use,      pct: utilPct,                                     color: "#6366f1" },
                      { label: "Maintenance", val: z.maintenance, pct: Math.round(z.maintenance / z.total * 100),   color: "#f59e0b" },
                      { label: "Low Battery", val: z.low_battery, pct: Math.round(z.low_battery / z.total * 100),   color: "#ef4444" },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="text-xs text-slate-500 mb-1">{m.label}</div>
                        <div className="text-lg font-display font-bold" style={{ color: m.color }}>{m.val}</div>
                        <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${m.pct}%` }}
                            transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ background: m.color }}
                          />
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{m.pct}%</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center text-slate-500 py-10">No fleet zone data available.</div>
          )}
        </div>
      )}

      {/* ── By Model ── */}
      {view === "models" && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Fleet by Bike Model</h3>
            <span className="text-xs text-slate-500">
              Revenue scaled by real-time SARIMA demand index
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Model", "Type", "Total", "Available", "Issues", "Avg Battery", "Revenue", "Status"].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : bikeModels.length > 0 ? (
                  bikeModels.map((b, i) => (
                    <motion.tr
                      key={b.model}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.07 }}
                      className="border-b border-white/3 hover:bg-white/2 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-white">{b.model}</td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          b.type === "EV"      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : b.type === "Premium" ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}>
                          {b.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{b.count}</td>
                      <td className="py-3 px-3 text-emerald-400 font-medium">{b.available}</td>
                      <td className="py-3 px-3">
                        <span className={b.issues > 10 ? "text-red-400" : b.issues > 6 ? "text-amber-400" : "text-slate-300"}>
                          {b.issues}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {b.avg_battery ? (
                          <div className="flex items-center gap-1.5">
                            <Battery className="w-3.5 h-3.5 text-emerald-400" />
                            <span className={`font-mono text-xs ${
                              b.avg_battery > 70 ? "text-emerald-400"
                              : b.avg_battery > 50 ? "text-amber-400"
                              : "text-red-400"
                            }`}>
                              {b.avg_battery}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-white">{b.revenue}</td>
                      <td className="py-3 px-3">
                        <span className={b.issues > 10 ? "badge-danger" : b.issues > 6 ? "badge-warning" : "badge-success"}>
                          {b.issues > 10 ? "Needs Attention" : b.issues > 6 ? "Monitor" : "Healthy"}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-500">
                      No bike model data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {lastSync && (
            <p className="text-xs text-slate-700 mt-4 text-right">
              Last synced: {lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
