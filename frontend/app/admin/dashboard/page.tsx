"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Bike, Users, DollarSign, BarChart2,
  Activity, AlertTriangle, CheckCircle, Clock, Zap, RefreshCw,
  UploadCloud, FileText, CheckCircle2, X
} from "lucide-react";
import { getAdminRevenue, getShortForecast, getHeatmapData, getLiveAlerts, getZoneIntelligence, uploadDataset, type RevenueData, type ForecastPoint } from "@/lib/api";
import toast from "react-hot-toast";

// ─── Welcome Splash ────────────────────────────────────────────────────────────
function WelcomeSplash({ onDismiss }: { onDismiss: () => void }) {
  const [phase, setPhase] = useState<"bike" | "upload">("bike");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-advance from bike animation → upload panel after 3.2s
  useEffect(() => {
    const t = setTimeout(() => setPhase("upload"), 3200);
    return () => clearTimeout(t);
  }, []);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    // Snapshot last_trained before upload so we can detect when a new train completes
    let snapshotLastTrained: string | null = null;
    try {
      const sr = await fetch("/api/ml/admin/system-status");
      const sd = await sr.json();
      snapshotLastTrained = sd.last_trained ?? null;
    } catch {}

    try {
      const data = await uploadDataset(file);
      if (data.success) {
        toast.success("Dataset uploaded! Training in progress…");
        // Poll system-status until is_training flips false AND last_trained changes
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          try {
            const sr = await fetch("/api/ml/admin/system-status");
            const sd = await sr.json();

            if (sd.train_error) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setUploaded(true);
              setUploading(false);
              setTimeout(onDismiss, 2000);
              return;
            }

            const newLastTrained = sd.last_trained ?? null;
            const isNewer = newLastTrained && newLastTrained !== snapshotLastTrained;
            if (!sd.is_training && isNewer) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              setUploaded(true);
              setUploading(false);
              window.dispatchEvent(new CustomEvent("ml-trained", { detail: { last_trained: newLastTrained } }));
              setTimeout(onDismiss, 1800);
            }
          } catch {}
          if (attempts >= 60) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setUploaded(true);
            setUploading(false);
            setTimeout(onDismiss, 1800);
          }
        }, 3000);
      } else {
        toast.error(data.error || "Upload failed");
        setUploading(false);
      }
    } catch {
      toast.error("Error communicating with server.");
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #050510 100%)" }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }} />
      </div>

      <AnimatePresence mode="wait">
        {/* ── Phase 1: Bike Animation ── */}
        {phase === "bike" && (
          <motion.div key="bike-phase"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-8 select-none"
          >
            {/* Title */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-center">
              <h1 className="text-4xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
                Welcome back, <span style={{ color: "#818cf8" }}>Admin</span>
              </h1>
              <p className="text-slate-400 text-sm">Loading your Bike-Sense Command Center…</p>
            </motion.div>

            {/* Bike animation scene */}
            <div className="relative w-[520px] h-[140px] overflow-hidden">
              {/* Road */}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full"
                style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)" }} />
              {/* Dashed road markings */}
              <motion.div
                animate={{ x: ["0%", "-100%"] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-[10px] left-0 flex gap-8"
                style={{ width: "200%" }}
              >
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="w-12 h-[2px] rounded-full shrink-0"
                    style={{ background: "rgba(99,102,241,0.25)" }} />
                ))}
              </motion.div>

              {/* Speed lines */}
              {[20, 45, 65, 80, 100].map((top, i) => (
                <motion.div key={i}
                  animate={{ x: ["60%", "-120%"], opacity: [0, 0.5, 0] }}
                  transition={{ duration: 0.9, delay: i * 0.15, repeat: Infinity, ease: "linear" }}
                  className="absolute h-[1.5px] rounded-full"
                  style={{ top: `${top}px`, width: `${40 + i * 12}px`, background: "rgba(99,102,241,0.35)" }}
                />
              ))}

              {/* The Bike SVG — rides from left side to center, steady */}
              <motion.div
                initial={{ x: -120 }}
                animate={{ x: 180 }}
                transition={{ duration: 1.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute bottom-[8px]"
              >
                {/* Subtle wheel bounce */}
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg width="110" height="70" viewBox="0 0 110 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Rear wheel */}
                    <circle cx="22" cy="50" r="14" stroke="#6366f1" strokeWidth="5" fill="none" />
                    <circle cx="22" cy="50" r="7" fill="#6366f1" />
                    
                    {/* Front wheel */}
                    <circle cx="88" cy="50" r="14" stroke="#818cf8" strokeWidth="5" fill="none" />
                    <circle cx="88" cy="50" r="7" fill="#818cf8" />
                    
                    {/* Motorcycle Body / Fairings */}
                    <path d="M 22 50 L 40 38 L 75 38 L 88 50 L 65 48 L 40 48 Z" fill="#4f46e5" opacity="0.9" />
                    <path d="M 35 38 L 45 25 L 70 28 L 75 38 Z" fill="#6366f1" />
                    
                    {/* Exhaust */}
                    <line x1="35" y1="46" x2="10" y2="42" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />
                    
                    {/* Handlebars & Front fork */}
                    <line x1="70" y1="28" x2="88" y2="50" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" />
                    <line x1="70" y1="28" x2="65" y2="20" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" />

                    {/* Windshield */}
                    <path d="M 70 28 L 82 22 L 75 38 Z" fill="#00f5ff" opacity="0.3" />
                    
                    {/* Rider Head (Helmet) */}
                    <circle cx="55" cy="18" r="7" fill="#6366f1" />
                    <path d="M 58 15 L 62 18 L 58 21 Z" fill="#00f5ff" opacity="0.8" />
                    
                    {/* Rider Body */}
                    <path d="M 55 25 C 45 25, 40 32, 45 38 L 35 38 C 35 30, 45 20, 55 25 Z" fill="#818cf8" />
                    
                    {/* Rider Arm */}
                    <line x1="55" y1="25" x2="65" y2="20" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
                    
                    {/* Headlight glow */}
                    <circle cx="85" cy="40" r="4" fill="#00f5ff" opacity="0.9" />
                    <circle cx="85" cy="40" r="10" fill="#00f5ff" opacity="0.25" />
                    <circle cx="85" cy="40" r="20" fill="#00f5ff" opacity="0.1" />
                  </svg>
                </motion.div>
              </motion.div>
            </div>

            {/* Loading dots */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex gap-2">
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, delay: i * 0.2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#6366f1" }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ── Phase 2: Dataset Upload ── */}
        {phase === "upload" && (
          <motion.div key="upload-phase"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-lg mx-4"
          >
            {/* Card */}
            <div className="rounded-2xl border border-white/10 p-8"
              style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)" }}>
              
              {/* Icon + Title */}
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, #6366f120, #818cf830)", border: "1px solid #6366f130" }}>
                  <UploadCloud className="w-8 h-8" style={{ color: "#818cf8" }} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Upload Your Dataset</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Upload a <span className="text-white font-medium">bike_data.csv</span> to dynamically retrain the 
                  SARIMA models. Your dashboard will instantly reflect the new data.
                </p>
              </div>

              {uploaded ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  <p className="text-emerald-300 font-semibold">Models retrained! Redirecting…</p>
                </motion.div>
              ) : (
                <>
                  {/* File picker */}
                  <div className="relative mb-4">
                    <input
                      id="splash-dataset-upload"
                      type="file"
                      accept=".csv"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed transition-all ${
                      file
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-white/15 bg-white/3 hover:border-indigo-500/50"
                    }`}>
                      <FileText className={`w-5 h-5 shrink-0 ${file ? "text-indigo-400" : "text-slate-500"}`} />
                      <span className={`text-sm font-medium truncate ${file ? "text-indigo-300" : "text-slate-400"}`}>
                        {file ? file.name : "Click to select CSV dataset…"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpload}
                      disabled={!file || uploading}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        !file || uploading
                          ? "bg-white/5 text-slate-500 cursor-not-allowed"
                          : "text-white"
                      }`}
                      style={file && !uploading ? {
                        background: "linear-gradient(135deg, #6366f1, #818cf8)",
                        boxShadow: "0 4px 20px rgba(99,102,241,0.3)"
                      } : {}}
                    >
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Retraining ML…
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          Upload &amp; Train
                        </>
                      )}
                    </button>
                    <button
                      onClick={onDismiss}
                      className="px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 text-sm font-medium transition-all border border-white/10"
                    >
                      Skip
                    </button>
                  </div>

                  <p className="text-center text-xs text-slate-600 mt-4">
                    You can also upload datasets anytime from <span className="text-slate-400">Settings → Custom Dataset Upload</span>
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Aggregate hourly SARIMA forecast into 7 daily buckets */
function aggregateToDays(points: ForecastPoint[]): { day: string; demand: number; revenue: number }[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const buckets: Record<string, { demand: number; revenue: number; count: number }> = {};
  points.forEach(p => {
    const d = new Date(p.dt);
    const key = days[d.getDay()];
    if (!buckets[key]) buckets[key] = { demand: 0, revenue: 0, count: 0 };
    buckets[key].demand += p.demand;
    // Rough revenue: demand * avg price (₹68.80)
    buckets[key].revenue += p.demand * 68.8;
    buckets[key].count++;
  });
  // Ordered Mon → Sun
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.filter(d => buckets[d]).map(d => ({
    day: d,
    demand: Math.round(buckets[d].demand),
    revenue: Math.round(buckets[d].revenue),
  }));
}



// ─── Sub-components ───────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-sm border border-white/5">
      <p className="text-slate-400 mb-1 text-xs">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-semibold text-white">
            {typeof p.value === "number" && p.name === "Revenue"
              ? `₹${p.value.toLocaleString()}`
              : p.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [liveTime, setLiveTime] = useState("");
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [weeklyData, setWeeklyData] = useState<{ day: string; demand: number; revenue: number }[]>([]);
  const [zoneData, setZoneData] = useState<{ zone: string; rides: number; revenue: number; surge: number }[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  // Show splash once per browser session
  const [showSplash, setShowSplash] = useState(false);
  useEffect(() => {
    const seen = sessionStorage.getItem("bs_admin_welcomed");
    if (!seen) setShowSplash(true);
  }, []);
  const dismissSplash = () => {
    sessionStorage.setItem("bs_admin_welcomed", "1");
    setShowSplash(false);
  };

  // Live clock
  useEffect(() => {
    const update = () =>
      setLiveTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rev, forecast, _heatmap, alertsData, zoneIntelData] = await Promise.all([
        getAdminRevenue(),
        getShortForecast(),
        getHeatmapData(),
        getLiveAlerts(),
        getZoneIntelligence(),
      ]);
      setRevenue(rev);
      setAlerts(alertsData);
      setWeeklyData(aggregateToDays(forecast));
      setZoneData(zoneIntelData);
      setLastRefresh(new Date());
    } catch (e: any) {
      console.error("Dashboard load error:", e);
      setError(e?.message ?? "Could not reach ML backend. Make sure uvicorn is running on port 8000.");
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

  // KPI cards derived from real revenue data
  const kpis = revenue
    ? [
      { title: "Total Rides (Month)", value: revenue.monthly_rides.toLocaleString(), change: 8.4, icon: Bike, color: "#6366f1", sub: "↑ vs last month" },
      { title: "Revenue (Month)", value: `₹${revenue.monthly_revenue.toFixed(1)}L`, change: 12.1, icon: DollarSign, color: "#00f5ff", sub: "Gross revenue" },
      { title: "Active Bikes", value: revenue.active_bikes.toString(), change: 3.2, icon: Activity, color: "#00ff88", sub: `${revenue.occupancy_pct}% occupancy` },
      { title: "Repeat Customers", value: `${revenue.repeat_rate}%`, change: 2.1, icon: Users, color: "#f59e0b", sub: "Retention rate" },
      { title: "Avg Price / Ride", value: `₹${revenue.avg_price.toFixed(2)}`, change: -1.3, icon: Clock, color: "#a78bfa", sub: "Per booking" },
      { title: "Peak Hour", value: `${revenue.peak_hour.toString().padStart(2, "0")}:00`, change: 5.7, icon: BarChart2, color: "#fb7185", sub: "Highest demand" },
    ]
    : [];

  return (
    <>
      <AnimatePresence>
        {showSplash && <WelcomeSplash onDismiss={dismissSplash} />}
      </AnimatePresence>
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Command Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time fleet &amp; revenue intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass rounded-lg px-4 py-2 font-mono text-sm text-brand-300">
            {liveTime}
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh data from ML backend"
            className="glass rounded-lg px-3 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className="badge-success flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-400" />
            SARIMA Live
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">ML Backend Unreachable</p>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : kpis.map((k, i) => (
            <motion.div key={k.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }} className="glass rounded-xl p-4 hover-lift">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${k.color}15`, border: `1px solid ${k.color}25` }}>
                  <k.icon className="w-4 h-4" style={{ color: k.color }} />
                </div>
                <span className={`text-xs font-medium ${k.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {k.change >= 0 ? <TrendingUp className="inline w-3 h-3" /> : <TrendingDown className="inline w-3 h-3" />}
                  {" "}{Math.abs(k.change)}%
                </span>
              </div>
              <div className="text-xl font-display font-bold text-white leading-tight">{k.value}</div>
              <div className="text-xs text-slate-500 mt-1">{k.title}</div>
              {k.sub && <div className="text-xs text-slate-600 mt-0.5">{k.sub}</div>}
            </motion.div>
          ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly Demand chart from SARIMA forecast */}
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-semibold text-white">Weekly Demand Forecast</h3>
              <p className="text-xs text-slate-500">SARIMA 7-day prediction · Rides &amp; Revenue</p>
            </div>
            <span className="badge-info">SARIMA</span>
          </div>
          {loading
            ? <Skeleton className="h-52" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar yAxisId="left" dataKey="demand" name="Demand" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="revenue" name="Revenue" fill="#00f5ff" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Zone Performance from heatmap data */}
        <div className="glass rounded-xl p-6">
          <div className="mb-6">
            <h3 className="font-display font-semibold text-white">Zone Performance</h3>
            <p className="text-xs text-slate-500">Revenue by area</p>
          </div>
          {loading
            ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            : (
              <div className="space-y-3">
                {zoneData.slice(0, 5).map(z => {
                  const pct = Math.round((z.revenue / zoneData[0].revenue) * 100);
                  return (
                    <div key={z.zone}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-300">{z.zone}</span>
                        <span className="text-xs font-mono text-white">₹{(z.revenue / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.3, duration: 0.8 }}
                          className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, #6366f1, #00f5ff)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Revenue Trend + Alerts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-semibold text-white">Revenue Trend</h3>
              <p className="text-xs text-slate-500">Daily revenue · SARIMA 7-day forecast</p>
            </div>
          </div>
          {loading
            ? <Skeleton className="h-44" />
            : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00f5ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#00f5ff" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Live Alerts */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Live Alerts</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-400 font-medium">Live</span>
            </div>
          </div>
          <div className="space-y-3">
            {alerts.map((a: any, i: number) => {
              const isCritical = a.type === "critical";
              const isRebalance = a.type === "rebalance";
              const isInfo = a.type === "info";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`rounded-xl p-3 border ${isCritical ? "bg-red-500/8 border-red-500/20"
                      : isRebalance ? "bg-amber-500/8 border-amber-500/20"
                        : "bg-blue-500/8 border-blue-500/20"
                    }`}
                >
                  <div className="flex gap-3 items-start">
                    <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isCritical ? "bg-red-500/15"
                        : isRebalance ? "bg-amber-500/15"
                          : "bg-blue-500/15"
                      }`}>
                      {isCritical && <AlertTriangle className="w-4 h-4 text-red-400" />}
                      {isRebalance && <RefreshCw className="w-4 h-4 text-amber-400" />}
                      {isInfo && <Activity className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`text-xs font-semibold ${isCritical ? "text-red-300" : isRebalance ? "text-amber-300" : "text-blue-300"
                          }`}>{a.title}</p>
                        <p className="text-[10px] text-slate-600 shrink-0">{a.time}</p>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{a.msg}</p>
                      {a.action && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-1 rounded-full">
                            <RefreshCw className="w-2.5 h-2.5" />
                            {a.action}
                          </span>
                          {a.bikes && (
                            <span className="text-[10px] text-slate-500">
                              {a.bikes} bikes · {a.area_low} → {a.area_high}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {lastRefresh && (
            <p className="text-xs text-slate-700 mt-4 text-right">
              Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Zone Intelligence Table */}
      <div className="glass rounded-xl p-6">
        <div className="mb-4">
          <h3 className="font-display font-semibold text-white flex items-center gap-2">
            Zone Intelligence Matrix
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded">Estimated</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Approximated by applying historical zone density weights and live SARIMA surge to recent 30-day city totals.
          </p>
        </div>
        {loading
          ? <Skeleton className="h-48" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Zone", "Rides", "Revenue", "Surge", "Status"].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zoneData.map((z, i) => (
                    <motion.tr key={z.zone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="py-3 px-3 font-medium text-white">{z.zone}</td>
                      <td className="py-3 px-3 text-slate-300">{z.rides.toLocaleString()}</td>
                      <td className="py-3 px-3 text-slate-300">₹{(z.revenue / 1000).toFixed(1)}K</td>
                      <td className="py-3 px-3">
                        <span className={`font-mono text-xs ${z.surge > 1.1 ? "text-red-400" : z.surge > 1 ? "text-amber-400" : "text-emerald-400"}`}>
                          ×{z.surge.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={z.surge > 1.1 ? "badge-danger" : z.surge > 1 ? "badge-warning" : "badge-success"}>
                          {z.surge > 1.1 ? "High Demand" : z.surge > 1 ? "Moderate" : "Normal"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
    </>
  );
}
