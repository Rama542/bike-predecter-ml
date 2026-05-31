"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Brain, TrendingUp, Calendar, Clock, Download, RefreshCw, WifiOff } from "lucide-react";
import { getShortForecast, getDailyForecast, getHeatmapData, getForecastMetrics, getForecastInsights, getSurgeConfig, type ForecastPoint } from "@/lib/api";

const BASE_PRICE = 65;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChartPoint {
  label: string;
  demand: number;
  upper: number;
  lower: number;
  price?: number;
}

interface HeatRow { area: string; hours: number[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Convert raw hourly forecast → chart points with CI bands */
function toHourlyChart(points: ForecastPoint[]): ChartPoint[] {
  return points.map(p => {
    const d = new Date(p.dt);
    const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
    const hr  = d.getHours().toString().padStart(2, "0");
    return {
      label: `${day} ${hr}:00`,
      demand: Number(p.demand.toFixed(1)),
      upper:  Number((p.upper || p.demand * 1.18).toFixed(1)),
      lower:  Number((p.lower || Math.max(0, p.demand * 0.82)).toFixed(1)),
      price:  p.price,
    };
  });
}

/** Convert daily forecast → chart points */
function toDailyChart(points: ForecastPoint[]): ChartPoint[] {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return points.map(p => {
    const d   = new Date(p.dt);
    const day = `${days[d.getDay()]} W${Math.ceil(d.getDate() / 7)}`;
    return {
      label:  day,
      demand: Number(p.demand.toFixed(1)),
      upper:  Number((p.upper || p.demand * 1.15).toFixed(1)),
      lower:  Number((p.lower || Math.max(0, p.demand * 0.85)).toFixed(1)),
    };
  });
}

/** Build heatmap grid from flat API response */
function buildHeatmap(raw: { area: string; hour: number; demand: number }[]): HeatRow[] {
  const map: Record<string, number[]> = {};
  raw.forEach(r => {
    if (!map[r.area]) map[r.area] = Array(24).fill(0);
    map[r.area][r.hour] = r.demand;
  });
  return Object.entries(map).map(([area, hours]) => ({ area, hours }));
}

/** Generate fallback heatmap using dynamic zones instead of hardcoded Bengaluru areas */
function generateFallbackHeatmap(zones: string[]): HeatRow[] {
  return zones.map((area, ai) => ({
    area,
    hours: Array.from({ length: 24 }, (_, hr) => {
      const rush = Math.exp(-0.5 * ((hr - 8) / 2.5) ** 2) * 0.8
                 + Math.exp(-0.5 * ((hr - 18) / 2.5) ** 2) * 0.6;
      // cycle through some weights based on index
      const weight = [1.3, 1.2, 1.1, 1.0, 1.15, 0.9, 0.95, 0.85][ai % 8];
      return Math.round((80 + rush * 120) * weight);
    }),
  }));
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs border border-white/5">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex justify-between gap-3">
          <span>{p.name || p.dataKey}</span>
          <span className="font-semibold text-white">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ForecastingPage() {
  const [horizon, setHorizon] = useState<"short" | "medium">("short");
  const [hourlyData, setHourlyData]   = useState<ChartPoint[]>([]);
  const [dailyData,  setDailyData]    = useState<ChartPoint[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isLive, setIsLive]     = useState(false);
  const [modelInfo, setModelInfo] = useState({ short_aic: "—", daily_aic: "—", monthly_aic: "—" });
  const [insights, setInsights]   = useState<Array<{emoji: string, title: string, desc: string, tag: string}>>([]);
  const [dynamicAreas, setDynamicAreas] = useState<string[]>([]);

  const [heatmapDate, setHeatmapDate] = useState("");
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [selectedTrajectoryDay, setSelectedTrajectoryDay] = useState<string | null>(null);
  const [peakSurge, setPeakSurge] = useState(1.25);

  const fetchHeatmap = async (dateStr: string) => {
    setHeatmapLoading(true);
    try {
      const heatRaw = await getHeatmapData(dateStr || undefined);
      if (heatRaw.length > 0) setHeatmapData(buildHeatmap(heatRaw));
    } catch (e) {
      console.error(e);
    } finally {
      setHeatmapLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) fetchHeatmap(heatmapDate);
  }, [heatmapDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shortRaw, dailyRaw, heatRaw, metrics, dynInsights, sConfig] = await Promise.all([
        getShortForecast(),
        getDailyForecast(),
        getHeatmapData(heatmapDate || undefined),
        getForecastMetrics(),
        getForecastInsights(),
        getSurgeConfig(),
      ]);
      const hourly = toHourlyChart(shortRaw);
      const zones = await import("@/lib/api").then(m => m.getDynamicZones().catch(() => ["City Center"]));
      setDynamicAreas(zones);
      setHourlyData(hourly);
      setDailyData(toDailyChart(dailyRaw));
      if (heatRaw.length > 0) setHeatmapData(buildHeatmap(heatRaw));
      // If we got 168 hourly points it's real SARIMA output
      setIsLive(shortRaw.length === 168);
      setModelInfo(metrics);
      setInsights(dynInsights);
      if (sConfig?.peak_surge) setPeakSurge(sConfig.peak_surge);
    } catch (e) {
      console.error("Forecasting page error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Reload when a new dataset finishes training
  useEffect(() => {
    const onTrained = () => { void loadData(); };
    window.addEventListener("ml-trained", onTrained);
    return () => window.removeEventListener("ml-trained", onTrained);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Colors are now dynamically scaled based on the max value in the current dataset
  // inside the render function.

  // Every 6th point for the hourly chart (thinned so X axis is readable)
  const displayHourly = hourlyData.filter((_, i) => i % 2 === 0);

  // Interactive Trajectory
  const trajectoryDays = Array.from(new Set(hourlyData.map(d => d.label.split(" ")[0])));
  const displayTrajectory = selectedTrajectoryDay
    ? hourlyData.filter(d => d.label.startsWith(selectedTrajectoryDay))
    : hourlyData.filter((_, i) => i % 6 === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-brand-400" /> Forecasting Center
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">SARIMA/SARIMAX demand predictions — short, medium &amp; long term</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} disabled={loading}
            className="glass rounded-lg px-3 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className={`flex items-center gap-1.5 badge-${isLive ? "success" : "info"}`}>
            {isLive ? <TrendingUp className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isLive ? "Live SARIMA" : "Demo Mode"}
          </span>
          <button className="btn-ghost flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Model Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: "Short-Term",   order: "SARIMA(0,1,1)(0,1,1,24)", horizon: "7-day hourly",  aic: modelInfo.short_aic, color: "#6366f1" },
          { label: "Medium-Term",  order: "SARIMA(1,1,2)(1,1,1,7)",  horizon: "30-day daily",  aic: modelInfo.daily_aic, color: "#00f5ff" },
          { label: "Long-Term",    order: "SARIMA(0,1,0)(0,1,1,12)", horizon: "12-month",      aic: modelInfo.monthly_aic, color: "#00ff88" },
        ].map(m => (
          <div key={m.label} className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-wider">{m.label}</span>
              <span className={`badge-${isLive ? "success" : "info"}`}>{isLive ? "Active" : "Standby"}</span>
            </div>
            <div className="font-mono text-sm font-medium mb-1" style={{ color: m.color }}>{m.order}</div>
            <div className="text-xs text-slate-500 flex justify-between">
              <span>Horizon: {m.horizon}</span>
              <span>AIC: {m.aic}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Horizon Selector */}
      <div className="flex gap-3">
        {(["short", "medium"] as const).map(h => (
          <button key={h} onClick={() => setHorizon(h)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${horizon === h ? "bg-brand-500 text-white" : "glass text-slate-400 hover:text-white"}`}>
            {h === "short" ? "📈 7-Day Hourly" : "📅 30-Day Daily"}
          </button>
        ))}
      </div>

      {/* Main Forecast Chart */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-display font-semibold text-white">
              {horizon === "short" ? "1-Week Hourly Demand Forecast" : "1-Month Daily Demand Forecast"}
            </h3>
            <p className="text-xs text-slate-500">
              {horizon === "short"
                ? "SARIMA(0,1,1)(0,1,1,24) · 80% confidence band"
                : "SARIMA(1,1,2)(1,1,1,7) · 80% confidence band"}
            </p>
          </div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-brand-400 inline-block" /> Forecast</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-500/20 inline-block rounded" /> 80% CI</span>
          </div>
        </div>
        {loading
          ? <Skeleton className="h-72" />
          : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={horizon === "short" ? displayHourly : dailyData}>
                <defs>
                  <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={horizon === "short" ? 11 : 4} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="upper"  name="Upper CI" stroke="none"     fill="url(#ciGrad)" />
                <Area type="monotone" dataKey="lower"  name="Lower CI" stroke="none"     fill="white" fillOpacity={0} />
                <Area type="monotone" dataKey="demand" name="Demand"   stroke="#6366f1" fill="url(#fcGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
      </div>

      {/* Heatmap + Price Forecast */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Heatmap — from /admin/heatmap endpoint */}
        <div className="glass rounded-xl p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Demand Heatmap · Hour × Zone</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Date:</span>
              <input
                type="date"
                value={heatmapDate}
                onChange={e => setHeatmapDate(e.target.value)}
                className="input-dark text-xs py-1 px-2 h-7 rounded bg-white/5 border border-white/10 text-slate-300"
              />
            </div>
          </div>
          {loading || heatmapLoading
            ? <Skeleton className="h-48" />
            : (() => {
                // Use real API data when available, otherwise the formula fallback using dynamic zones
                const rows = heatmapData.length > 0 ? heatmapData : generateFallbackHeatmap(dynamicAreas.length > 0 ? dynamicAreas : ["City Center"]);
                const maxVal = Math.max(0.1, ...rows.flatMap(r => r.hours));
                const getDemandColor = (v: number) => {
                  const pct = v / maxVal;
                  if (pct > 0.8) return "bg-red-500";
                  if (pct > 0.6) return "bg-orange-400";
                  if (pct > 0.4) return "bg-amber-400";
                  if (pct > 0.2) return "bg-emerald-500";
                  return "bg-slate-600";
                };

                return (
                  <div className="overflow-x-auto">
                    <div className="min-w-max">
                      {/* Hour labels */}
                      <div className="flex items-center ml-24 mb-1 gap-0.5">
                        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                          <div key={h} className="w-7 text-center text-xs text-slate-600">{h}h</div>
                        ))}
                      </div>
                      {/* Zone rows */}
                      {rows.map(row => (
                        <div key={row.area} className="flex items-center gap-0.5 mb-0.5">
                          <span className="text-xs text-slate-400 w-24 shrink-0 truncate">{row.area}</span>
                          {row.hours.filter((_, i) => i % 3 === 0).map((val, i) => (
                            <div
                              key={i}
                              className={`w-7 h-7 rounded-sm ${getDemandColor(val)}`}
                              style={{ opacity: Math.max(0.25, Math.min(0.95, val / maxVal)) }}
                              title={`${row.area} @ ${i * 3}:00 → ${val.toFixed(1)} rides`}
                            />
                          ))}
                        </div>
                      ))}
                      {/* Legend */}
                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                        <span>Low</span>
                        {["bg-slate-600","bg-emerald-500","bg-amber-400","bg-orange-400","bg-red-500"].map((c, i) => (
                          <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
                        ))}
                        <span>High</span>
                        {heatmapData.length === 0 && (
                          <span className="ml-2 text-slate-600 italic">(formula estimate)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
        </div>

        {/* Price Trajectory from hourly forecast */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">7-Day Price Trajectory</h3>
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button 
                onClick={() => setSelectedTrajectoryDay(null)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${selectedTrajectoryDay === null ? "bg-brand-500 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
                7 Days
              </button>
              {trajectoryDays.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedTrajectoryDay(day)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${selectedTrajectoryDay === day ? "bg-brand-500 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
                  {day}
                </button>
              ))}
            </div>
          </div>
          {loading
            ? <Skeleton className="h-52" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={displayTrajectory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 9 }} 
                    interval={selectedTrajectoryDay ? 2 : 3} 
                    tickFormatter={(tick) => selectedTrajectoryDay ? tick.split(" ")[1] : tick}
                  />
                  <YAxis domain={[BASE_PRICE - 5, BASE_PRICE * peakSurge + 5]} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={BASE_PRICE}    stroke="#10b981" strokeDasharray="3 3" label={{ value: `₹${BASE_PRICE}`,    fill: "#10b981", fontSize: 9 }} />
                  <ReferenceLine y={BASE_PRICE * peakSurge} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `₹${(BASE_PRICE * peakSurge).toFixed(2)}`, fill: "#ef4444", fontSize: 9 }} />
                  <Line type="stepAfter" dataKey="price" name="Price (₹)" stroke="#f59e0b" strokeWidth={2.5} dot={selectedTrajectoryDay !== null} />
                </LineChart>
              </ResponsiveContainer>
            )}
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-4 gap-2 text-center">
            {(() => {
              const tMod = Number((1.0 + (peakSurge - 1.0) * 0.3).toFixed(2));
              const tHigh = Number((1.0 + (peakSurge - 1.0) * 0.7).toFixed(2));
              return [
                { l: "Standard", v: `₹${BASE_PRICE}`,    c: "text-emerald-400" },
                { l: "Moderate", v: `₹${(BASE_PRICE * tMod).toFixed(2)}`, c: "text-amber-400" },
                { l: "High",     v: `₹${(BASE_PRICE * tHigh).toFixed(2)}`, c: "text-orange-400" },
                { l: "Peak",     v: `₹${(BASE_PRICE * peakSurge).toFixed(2)}`, c: "text-red-400" },
              ].map(t => (
                <div key={t.l}>
                  <div className={`text-sm font-mono font-bold ${t.c}`}>{t.v}</div>
                  <div className="text-xs text-slate-600">{t.l}</div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Seasonal Insights */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-display font-semibold text-white mb-4">Seasonal &amp; Event Insights</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : insights.map(i => (
            <div key={i.title} className="glass-light rounded-xl p-4">
              <div className="text-2xl mb-2">{i.emoji}</div>
              <div className="text-sm font-semibold text-white mb-1">{i.title}</div>
              <p className="text-xs text-slate-400 leading-relaxed mb-2">{i.desc}</p>
              <span className="badge-info">{i.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
