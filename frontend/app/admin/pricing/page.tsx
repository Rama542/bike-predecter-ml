"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  DollarSign, Zap, TrendingUp, RefreshCw,
  WifiOff, MapPin, Clock, Activity, Info,
} from "lucide-react";
import { getPricingRec, getHourlyPriceSchedule, getZonePriceMatrix, getEventPricing, getSurgeConfig, updateSurgeConfig, getDynamicZones } from "@/lib/api";

function surgeColor(surge: number, peak: number = 1.25) {
  const tMod = Number((1.0 + (peak - 1.0) * 0.3).toFixed(2));
  const tHigh = Number((1.0 + (peak - 1.0) * 0.7).toFixed(2));
  if (surge >= peak) return "#ef4444";
  if (surge >= tHigh) return "#f97316";
  if (surge >= tMod) return "#f59e0b";
  return "#10b981";
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs border border-white/5">
      <p className="text-slate-400 mb-1 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="mt-0.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold text-white">
            {p.name === "Price" ? `₹${p.value}` : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// Surge tier badge colours
function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === "Peak Surge" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
    tier === "High"       ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
    tier === "Moderate"   ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{tier}</span>;
}

export default function PricingPage() {
  const [dynamicAreas, setDynamicAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [isWeekend, setIsWeekend]       = useState(new Date().getDay() === 0 || new Date().getDay() === 6);

  // ML recommendation
  const [mlRec, setMlRec]               = useState<any>(null);
  const [recLoading, setRecLoading]     = useState(false);
  const [isLive, setIsLive]             = useState<boolean | null>(null);
  const [recError, setRecError]         = useState(false);

  // 24-hour chart
  const [hourlyData, setHourlyData]     = useState<any[]>([]);
  const [hourlyLoading, setHourlyLoading] = useState(true);
  const [hourlyLive, setHourlyLive]     = useState(false);

  // Zone matrix
  const [zoneData, setZoneData]         = useState<any[]>([]);
  const [zoneLoading, setZoneLoading]   = useState(true);
  const [zoneLive, setZoneLive]         = useState(false);
  const [zoneDay, setZoneDay]           = useState<string>("Today");
  const [zoneHour, setZoneHour]         = useState<string>("Current");

  // Events Data
  const [eventsData, setEventsData]     = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Surge Config
  const [surgeConfig, setSurgeConfig] = useState<{ peak_surge: number; event_multiplier: number } | null>(null);
  const [surgeConfigLoading, setSurgeConfigLoading] = useState(true);
  const [surgeConfigSaving, setSurgeConfigSaving] = useState(false);

  const fetchSurgeConfig = useCallback(async () => {
    setSurgeConfigLoading(true);
    try {
      const data = await getSurgeConfig();
      setSurgeConfig(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSurgeConfigLoading(false);
    }
  }, []);

  useEffect(() => { fetchSurgeConfig(); }, [fetchSurgeConfig]);

  useEffect(() => {
    const initZones = async () => {
      try {
        const zones = await getDynamicZones();
        setDynamicAreas(zones);
        if (!selectedArea && zones.length > 0) {
          setSelectedArea(zones[0]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    initZones();
  }, []);

  const handleSaveSurgeConfig = async () => {
    if (!surgeConfig) return;
    setSurgeConfigSaving(true);
    try {
      await updateSurgeConfig(surgeConfig);
      fetchRecommendation(); // Refresh current rec with new surge
      fetchHourly(); // Refresh charts
    } catch (err) {
      console.error(err);
    } finally {
      setSurgeConfigSaving(false);
    }
  };

  // ── ML Calculator ─────────────────────────────────────────────────────────
  const fetchRecommendation = useCallback(async () => {
    setRecLoading(true);
    setRecError(false);
    try {
      const rec = await getPricingRec(selectedArea, selectedHour, isWeekend, selectedDate);
      if (rec?.recommended_price) {
        setMlRec(rec);
        setIsLive(true);
      } else {
        throw new Error("Invalid response from ML backend");
      }
    } catch {
      setMlRec(null);
      setIsLive(false);
      setRecError(true);
    } finally {
      setRecLoading(false);
    }
  }, [selectedArea, selectedHour, isWeekend, selectedDate]);

  useEffect(() => { if (selectedArea) fetchRecommendation(); }, [fetchRecommendation, selectedArea]);

  // ── 24-hour schedule ───────────────────────────────────────────────────────
  const fetchHourly = useCallback(async () => {
    setHourlyLoading(true);
    try {
      const data = await getHourlyPriceSchedule(selectedArea, isWeekend);
      setHourlyData(data);
      const prices = data.map((d: any) => d.price);
      setHourlyLive(new Set(prices).size > 2);
    } catch { setHourlyData([]); }
    finally  { setHourlyLoading(false); }
  }, [selectedArea, isWeekend]);

  useEffect(() => { if (selectedArea) fetchHourly(); }, [fetchHourly, selectedArea]);

  // ── Zone matrix ───────────────────────────────────────────────────────────
  const fetchZones = useCallback(async () => {
    setZoneLoading(true);
    try {
      let targetDate = undefined;
      let targetIsWeekend = isWeekend;
      if (zoneDay !== "Today") {
        const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const targetIdx = days.indexOf(zoneDay);
        const today = new Date();
        const todayIdx = today.getDay();
        let daysAhead = targetIdx - todayIdx;
        if (daysAhead <= 0) daysAhead += 7; // Get the next occurrence
        const d = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
        targetDate = d.toISOString().split("T")[0];
        targetIsWeekend = (targetIdx === 0 || targetIdx === 6);
      } else {
        targetDate = selectedDate; // use the globally selected date if it's "Today"
      }
      
      let targetHour = undefined;
      if (zoneHour !== "Current") {
        targetHour = parseInt(zoneHour, 10);
      }

      const data = await getZonePriceMatrix(targetIsWeekend, targetDate, targetHour);
      setZoneData(data);
      setZoneLive(new Set(data.map((d: any) => d.price)).size > 2);
    } catch { setZoneData([]); }
    finally  { setZoneLoading(false); }
  }, [isWeekend, zoneDay, zoneHour, selectedDate]);

  useEffect(() => { if (selectedArea) fetchZones(); }, [fetchZones, selectedArea]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const data = await getEventPricing();
      setEventsData(data);
    } catch { setEventsData([]); }
    finally { setEventsLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const refreshAll = () => { fetchRecommendation(); fetchHourly(); fetchZones(); fetchEvents(); };

  // Keep a ref to refreshAll so the ml-trained listener always calls the latest version
  const refreshAllRef = useRef(refreshAll);
  useEffect(() => { refreshAllRef.current = refreshAll; });

  // Reload when a new dataset finishes training — also re-fetch zones (dataset may have new areas)
  useEffect(() => {
    const onTrained = async () => {
      try {
        const zones = await getDynamicZones();
        setDynamicAreas(zones);
        if (zones.length > 0) setSelectedArea(zones[0]);
      } catch {}
      refreshAllRef.current();
    };
    window.addEventListener("ml-trained", onTrained);
    return () => window.removeEventListener("ml-trained", onTrained);
  }, []);

  // ML-provided values (no user override)
  const mlBasePrice  = mlRec?.base_price ?? 65;
  const mlSurge      = mlRec?.surge_multiplier ?? null;
  const mlPrice      = mlRec?.recommended_price ?? null;
  const mlTier       = mlRec?.tier ?? "—";
  const mlStrategy   = mlRec?.strategy ?? "—";
  const mlDemandIdx  = mlRec?.demand_index ?? null;
  const mlDemandPct  = mlRec?.demand_percentile ?? null;
  const mlAreaWeight = mlRec?.area_weight ?? null;
  const mlHrFactor   = mlRec?.hourly_factor ?? null;
  const mlSavings    = mlRec?.savings_vs_peak ?? null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-400" /> Dynamic Pricing Engine
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            AI-driven surge pricing · SARIMA-calibrated · BASE ₹65/ride
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${
            isLive === true
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              : isLive === false
              ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
              : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
          }`}>
            {isLive === true
              ? <><TrendingUp className="w-3 h-3" /> ML Live</>
              : isLive === false
              ? <><WifiOff className="w-3 h-3" /> Backend Offline</>
              : "Connecting…"}
          </span>
          <button onClick={refreshAll} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${(recLoading || hourlyLoading || zoneLoading) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Surge tier legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(() => {
          const peak = surgeConfig?.peak_surge ?? 1.25;
          const tMod = Number((1.0 + (peak - 1.0) * 0.3).toFixed(2));
          const tHigh = Number((1.0 + (peak - 1.0) * 0.7).toFixed(2));
          const tiers = [
            { label: "Standard", surge: 1.00, price: mlBasePrice * 1.00, color: "#10b981", desc: "Low demand · Off-peak" },
            { label: "Moderate", surge: tMod, price: mlBasePrice * tMod, color: "#f59e0b", desc: "Moderate demand" },
            { label: "High", surge: tHigh, price: mlBasePrice * tHigh, color: "#f97316", desc: "High demand · Rush" },
            { label: "Peak Surge", surge: peak, price: mlBasePrice * peak, color: "#ef4444", desc: "Peak hours · Festivals" },
          ];
          return tiers.map((t, i) => (
            <motion.div key={t.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`glass rounded-xl p-4 border ${mlSurge === t.surge ? "border-white/20" : "border-transparent"}`}>
              <div className="text-xs text-slate-500 mb-2">{t.label}</div>
              <div className="font-display font-bold text-2xl mb-0.5" style={{ color: t.color }}>₹{t.price.toFixed(2)}</div>
              <div className="font-mono text-sm text-slate-400 mb-2">×{t.surge.toFixed(2)}</div>
              <div className="text-xs text-slate-600">{t.desc}</div>
              {mlSurge === t.surge && (
                <div className="mt-2 text-xs text-white/50">← Current zone</div>
              )}
            </motion.div>
          ));
        })()}
      </div>

      {/* Calculator + Chart row */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* ── ML Price Calculator ── */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-brand-400" />
            <h3 className="font-display font-semibold text-white">ML Price Calculator</h3>
          </div>

          <div className="space-y-4">
            {/* Zone selector */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Zone
              </label>
              <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
                className="input-dark w-full">
                {dynamicAreas.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            {/* Date selector */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Date
              </label>
              <input type="date" value={selectedDate} 
                onChange={e => {
                  setSelectedDate(e.target.value);
                  const dt = new Date(e.target.value);
                  setIsWeekend(dt.getDay() === 0 || dt.getDay() === 6);
                }}
                className="input-dark w-full" />
            </div>

            {/* Hour slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Hour of Day
                </label>
                <span className="text-xs font-mono text-brand-300">
                  {selectedHour.toString().padStart(2,"0")}:00
                </span>
              </div>
              <input type="range" min={0} max={23} value={selectedHour}
                onChange={e => setSelectedHour(parseInt(e.target.value))}
                className="w-full accent-brand-500" />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>00:00</span><span>12:00</span><span>23:00</span>
              </div>
            </div>

            {/* Weekend toggle */}
            <div className="flex items-center justify-between p-3 glass-light rounded-lg opacity-70 cursor-not-allowed">
              <span className="text-sm text-slate-300">Weekend pricing (auto-set by date)</span>
              <div className={`w-10 h-5 rounded-full transition-all relative ${isWeekend ? "bg-brand-500" : "bg-slate-700"}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isWeekend ? "left-5" : "left-0.5"}`} />
              </div>
            </div>

            {/* ML Base Price — read-only, from engine */}
            <div className="p-3 glass-light rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-500">ML-Defined Base Price</span>
              </div>
              <div className="font-mono text-lg font-bold text-white">₹{mlBasePrice} / ride</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Set by model engine constant · not user-adjustable
              </div>
            </div>

            {/* Surge Configuration Widget */}
            <div className="p-3 glass-light rounded-lg space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-brand-400" />
                  <span className="text-xs text-white font-medium">Surge Constraints</span>
                </div>
                {surgeConfigSaving && <RefreshCw className="w-3 h-3 text-brand-400 animate-spin" />}
              </div>

              {surgeConfigLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-6 bg-white/10 rounded" />
                  <div className="h-6 bg-white/10 rounded" />
                </div>
              ) : surgeConfig ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Peak Surge Limit</span>
                      <span className="font-mono text-brand-300">×{surgeConfig.peak_surge.toFixed(2)}</span>
                    </div>
                    <input type="range" min={1.0} max={3.0} step={0.05} value={surgeConfig.peak_surge}
                      onChange={e => setSurgeConfig({...surgeConfig, peak_surge: parseFloat(e.target.value)})}
                      className="w-full accent-brand-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Event Multiplier</span>
                      <span className="font-mono text-brand-300">×{surgeConfig.event_multiplier.toFixed(2)}</span>
                    </div>
                    <input type="range" min={1.0} max={3.0} step={0.05} value={surgeConfig.event_multiplier}
                      onChange={e => setSurgeConfig({...surgeConfig, event_multiplier: parseFloat(e.target.value)})}
                      className="w-full accent-brand-500" />
                  </div>
                  <button 
                    onClick={handleSaveSurgeConfig}
                    disabled={surgeConfigSaving}
                    className="w-full mt-2 py-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 text-xs font-medium rounded transition-colors disabled:opacity-50">
                    {surgeConfigSaving ? "Saving..." : "Apply Constraints"}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Result card */}
          <div className="mt-5 p-5 rounded-xl"
            style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(0,245,255,0.05))" }}>
            <div className="text-xs text-slate-500 mb-1">
              SARIMA-Computed Final Price
            </div>

            {recLoading ? (
              <div className="h-10 w-32 animate-pulse bg-white/10 rounded-lg mb-3" />
            ) : mlPrice ? (
              <>
                <div className="text-4xl font-display font-bold text-white mb-1">
                  ₹{mlPrice}
                </div>
                <div className="text-xs text-slate-400">
                  ₹{mlBasePrice} base × ×{mlSurge?.toFixed(2)} surge
                  {isWeekend ? " × ×1.1 weekend" : ""}
                  {" "}· {selectedArea}
                </div>

                {/* Breakdown grid */}
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  {[
                    { label:"Surge Tier",       val: <TierBadge tier={mlTier} /> },
                    { label:"Strategy",          val: <span className="text-slate-300">{mlStrategy}</span> },
                    { label:"Demand Index",      val: <span className="font-mono text-brand-300">{mlDemandIdx}</span> },
                    { label:"Demand Percentile", val: <span className="font-mono text-slate-300">{mlDemandPct}%</span> },
                    { label:"Area Weight",       val: <span className="font-mono text-slate-300">{mlAreaWeight}</span> },
                    { label:"Hourly Factor",     val: <span className="font-mono text-slate-300">{mlHrFactor}</span> },
                  ].map(row => (
                    <div key={row.label} className="glass-light rounded-lg p-2">
                      <div className="text-slate-600 text-[10px] uppercase tracking-wider mb-0.5">{row.label}</div>
                      <div>{row.val}</div>
                    </div>
                  ))}
                </div>

                {mlSavings !== null && mlSavings > 0 && (
                  <div className="mt-3 text-xs text-emerald-400">
                    💚 ₹{mlSavings} cheaper than peak rate
                  </div>
                )}
              </>
            ) : recError ? (
              <div className="text-sm text-red-400 mt-2">
                ⚠️ ML backend offline — start the FastAPI server to see prices
              </div>
            ) : (
              <div className="text-sm text-slate-500 mt-2">Waiting for ML engine…</div>
            )}
          </div>
        </div>

        {/* ── 24-Hour Price Chart ── */}
        <div className="lg:col-span-3 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-white">24-Hour Price Schedule</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                SARIMA-computed per-hour pricing · {selectedArea}
                {isWeekend ? " · Weekend" : ""}
              </p>
            </div>
            <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${
              hourlyLive
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${hourlyLive ? "bg-emerald-400" : "bg-blue-400"}`} />
              {hourlyLive ? "Live" : "Demo"}
            </span>
          </div>

          {hourlyLoading ? (
            <Skeleton className="h-56" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={selectedArea + isWeekend} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={hourlyData} barCategoryGap="15%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="hour_label" tick={{ fontSize: 8 }} interval={2} />
                    <YAxis domain={[mlBasePrice - 5, mlBasePrice * (surgeConfig?.peak_surge ?? 1.25) + 5]} tick={{ fontSize: 9 }} tickFormatter={v => `₹${v.toFixed(0)}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine y={mlBasePrice} stroke="#10b981" strokeDasharray="3 3"
                      label={{ value:`Base ₹${mlBasePrice}`, fill:"#10b981", fontSize:9 }} />
                    <ReferenceLine y={mlBasePrice * (surgeConfig?.peak_surge ?? 1.25)} stroke="#ef4444" strokeDasharray="3 3"
                      label={{ value:`Peak ₹${(mlBasePrice * (surgeConfig?.peak_surge ?? 1.25)).toFixed(2)}`, fill:"#ef4444", fontSize:9 }} />
                    <Bar dataKey="price" name="Price" radius={[3,3,0,0]}>
                      {hourlyData.map((entry, i) => (
                        <Cell key={i}
                          fill={surgeColor(entry.surge)}
                          fillOpacity={selectedHour === entry.hour ? 1 : 0.6}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-slate-600 text-right mt-1">
                  Bright bar = selected hour ({selectedHour.toString().padStart(2,"0")}:00)
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Zone Matrix ── */}
      <div className="glass rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <div>
            <h3 className="font-display font-semibold text-white">Live Zone Pricing Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time SARIMA recommendation for all {dynamicAreas.length || 8} zones
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={zoneDay}
              onChange={(e) => setZoneDay(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {["Today", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                <option key={d} value={d} className="bg-slate-900">{d}</option>
              ))}
            </select>
            <select
              value={zoneHour}
              onChange={(e) => setZoneHour(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="Current" className="bg-slate-900">Current Time</option>
              {Array.from({ length: 24 }).map((_, i) => (
                <option key={i} value={i} className="bg-slate-900">{i.toString().padStart(2, "0")}:00</option>
              ))}
            </select>
            <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${
              zoneLive
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${zoneLive ? "bg-emerald-400" : "bg-blue-400"}`} />
              {zoneLive ? "ML Live" : "Demo"}
            </span>
          </div>
        </div>

        {zoneLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {zoneData.map((z, i) => (
              <motion.div key={z.zone}
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-light rounded-xl p-4 border ${
                  selectedArea === z.zone ? "border-brand-500/40" : "border-transparent"
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{z.zone}</span>
                  <span className={`font-mono text-xs ${
                    z.surge >= 1.17 ? "text-red-400" : z.surge >= 1.08 ? "text-amber-400" : "text-emerald-400"
                  }`}>×{z.surge?.toFixed(2)}</span>
                </div>
                <div className="text-2xl font-display font-bold mb-1" style={{ color: surgeColor(z.surge, surgeConfig?.peak_surge) }}>
                  ₹{z.price?.toFixed(2)}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <TierBadge tier={z.demand} />
                  {z.rides > 0 && (
                    <span className="text-xs text-slate-600">{z.rides.toLocaleString()} rides</span>
                  )}
                </div>
                {z.revenue > 0 && (
                  <div className="text-xs text-slate-600 mt-1">
                    ₹{(z.revenue / 1000).toFixed(0)}K revenue
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Festival Calendar ── */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-display font-semibold text-white">Festival &amp; Event Pricing</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Business-rule overrides applied on top of SARIMA base (₹{mlBasePrice}/ride)
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Event","Surge Multiplier","Expected Rides","Impact","Festival Price (₹65 base)"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventsLoading ? (
                <tr><td colSpan={5} className="p-4"><Skeleton className="h-20" /></td></tr>
              ) : eventsData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    No events or holidays found in uploaded dataset
                  </td>
                </tr>
              ) : eventsData.map((f, i) => {
                const festPrice = parseFloat((mlBasePrice * f.multiplier).toFixed(2));
                return (
                  <motion.tr key={f.event}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-white/3 hover:bg-white/2">
                    <td className="py-3 px-3 font-medium text-white">{f.event}</td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-amber-400">×{f.multiplier.toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{f.expected_rides}</td>
                    <td className="py-3 px-3">
                      <span className={f.impact==="High" ? "badge-danger" : f.impact==="Moderate" ? "badge-warning" : "badge-success"}>
                        {f.impact}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold" style={{ color: surgeColor(f.multiplier > 1.25 ? 1.25 : 1.0) }}>
                      ₹{festPrice}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600 mt-3">
          * Base price ₹{mlBasePrice} is ML-engine defined. Festival multipliers are business overrides.
        </p>
      </div>
    </div>
  );
}
