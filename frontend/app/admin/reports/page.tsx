"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  FileBarChart2, Download, TrendingUp, TrendingDown,
  RefreshCw, BarChart2, DollarSign, Bike, Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import { getMonthlyReport } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MonthRow {
  month: string;
  rides: number;
  revenue: number;
  growth: number | null;
  avgPrice: number;
  isForecast?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function transformRaw(raw: any[]): MonthRow[] {
  return raw.map((cur, i) => {
    const prev = raw[i - 1];
    const growth = prev && prev.revenue > 0
      ? parseFloat((((cur.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1))
      : null;
    const [year, month] = cur.period.split("-");
    const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "short", year: "2-digit",
    });
    return {
      month: label,
      rides: cur.rides,
      revenue: cur.revenue,
      growth,
      avgPrice: cur.rides > 0 ? parseFloat(((cur.revenue * 100000) / cur.rides).toFixed(1)) : 0,
      isForecast: !!cur.is_forecast
    };
  });
}

function exportCSV(rows: MonthRow[]) {
  const now    = new Date().toISOString().slice(0, 10);
  const header = "Month,Type,Total Rides,Revenue (₹L),Growth (%),Avg Price (₹)\n";
  const body   = rows
    .map(r => `${r.month},${r.isForecast ? "Forecast" : "Actual"},${r.rides},${r.revenue},${r.growth ?? "-"},${r.avgPrice}`)
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `bikesense_report_${now}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function openPrintReport(
  rows: MonthRow[],
  reportType: "monthly" | "investor",
  kpis: {
    totalRevenue: string;
    historicalRevenue: number;
    forecastRevenue: number;
    totalRides: number;
    avgRevenuePerRide: string;
    bestMonth: MonthRow | undefined;
    lastGrowth: number | null;
  }
) {
  const now        = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" });
  const historical = rows.filter(r => !r.isForecast);
  const forecast   = rows.filter(r => r.isForecast);
  const title      = reportType === "monthly" ? "Monthly Performance Report" : "Investor Executive Report";

  const tableRows = [...rows].reverse().map(r => `
    <tr>
      <td class="pl">${r.month}${r.isForecast ? ' <span class="fc-badge">Forecast</span>' : ""}</td>
      <td class="pr">${r.rides.toLocaleString()}</td>
      <td class="pr fw">₹${r.revenue}L</td>
      <td class="pr" style="color:${r.growth === null ? "#94a3b8" : r.growth >= 0 ? "#16a34a" : "#dc2626"}">
        ${r.growth !== null ? (r.growth >= 0 ? "↑" : "↓") + " " + Math.abs(r.growth) + "%" : "—"}
      </td>
      <td class="pr">₹${r.avgPrice}</td>
      <td class="pc">
        <span class="badge ${r.isForecast ? "b-pred" : r.growth && r.growth > 10 ? "b-good" : r.growth && r.growth < 0 ? "b-bad" : "b-mid"}">
          ${r.isForecast ? "Predicted" : r.growth && r.growth > 10 ? "Strong" : r.growth && r.growth < 0 ? "Decline" : "Steady"}
        </span>
      </td>
    </tr>`).join("");

  const investorExtra = reportType === "investor" ? `
    <div class="highlight-box">
      <div class="hb-title">SARIMA Forecast Highlights</div>
      <ul>
        <li>12-month forecast revenue: <b>₹${kpis.forecastRevenue.toFixed(1)}L</b></li>
        <li>Historical verified revenue: <b>₹${kpis.historicalRevenue.toFixed(1)}L</b></li>
        <li>Projected rides (forecast): <b>${forecast.reduce((a,r)=>a+r.rides,0).toLocaleString()}</b></li>
        <li>Current MoM growth: <b>${kpis.lastGrowth !== null ? (kpis.lastGrowth >= 0 ? "+" : "") + kpis.lastGrowth + "%" : "—"}</b></li>
        <li>Best performing month: <b>${kpis.bestMonth?.month ?? "—"} (₹${kpis.bestMonth?.revenue}L)</b></li>
      </ul>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>BikeSense — ${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;background:#fff;padding:40px}
  @media print{.no-print{display:none}body{padding:20px}}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6366f1;padding-bottom:20px;margin-bottom:28px}
  .logo{display:flex;align-items:center;gap:12px}
  .logo-icon{width:44px;height:44px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px}
  .brand-name{font-size:22px;font-weight:800;color:#6366f1}
  .brand-sub{font-size:11px;color:#64748b;margin-top:2px}
  .meta{text-align:right}
  .meta-title{font-size:14px;font-weight:700}
  .meta-date{font-size:11px;color:#94a3b8;margin-top:3px}
  .ai-badge{display:inline-block;background:#ede9fe;color:#6d28d9;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;margin-top:6px}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
  .kpi-label{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
  .kpi-value{font-size:20px;font-weight:800}
  .kpi-sub{font-size:10px;color:#94a3b8;margin-top:3px}
  .section-title{font-size:14px;font-weight:700;margin:22px 0 10px;border-bottom:1px solid #f1f5f9;padding-bottom:7px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead tr{background:#f8fafc}
  th{padding:9px 12px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0}
  td{padding:10px 12px;border-bottom:1px solid #f1f5f9}
  .pl{padding-left:12px;font-weight:600}
  .pr{text-align:right}
  .pc{text-align:center}
  .fw{font-weight:700}
  .fc-badge{font-size:10px;background:#ede9fe;color:#7c3aed;padding:1px 6px;border-radius:4px;font-weight:600;margin-left:4px}
  .badge{display:inline-block;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600}
  .b-pred{background:#ede9fe;color:#6d28d9}
  .b-good{background:#dcfce7;color:#15803d}
  .b-bad{background:#fee2e2;color:#b91c1c}
  .b-mid{background:#fef9c3;color:#92400e}
  .highlight-box{background:#f0fdf4;border-left:4px solid #22c55e;padding:15px 18px;margin:22px 0;border-radius:0 8px 8px 0}
  .hb-title{font-size:12px;color:#166534;font-weight:700;margin-bottom:8px}
  ul{padding-left:18px;color:#15803d;font-size:13px;line-height:2}
  footer{margin-top:36px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
  .print-btn{position:fixed;top:20px;right:20px;padding:9px 18px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(99,102,241,.3)}
</style></head><body>
<button class="no-print print-btn" onclick="window.print()">⬇ Save as PDF</button>
<header>
  <div class="logo">
    <div class="logo-icon">🚲</div>
    <div><div class="brand-name">BikeSense AI</div><div class="brand-sub">Smart Bike Rental Platform</div></div>
  </div>
  <div class="meta">
    <div class="meta-title">${title}</div>
    <div class="meta-date">Generated: ${now}</div>
    <div class="ai-badge">🤖 SARIMA ML Engine</div>
  </div>
</header>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value" style="color:#6366f1">₹${kpis.totalRevenue}L</div><div class="kpi-sub">Actual + 12m forecast</div></div>
  <div class="kpi"><div class="kpi-label">Historical Revenue</div><div class="kpi-value" style="color:#16a34a">₹${kpis.historicalRevenue.toFixed(1)}L</div><div class="kpi-sub">${historical.length} months verified</div></div>
  <div class="kpi"><div class="kpi-label">Total Rides</div><div class="kpi-value">${kpis.totalRides.toLocaleString()}</div><div class="kpi-sub">Actual + predicted</div></div>
  <div class="kpi"><div class="kpi-label">Avg Rev / Ride</div><div class="kpi-value">₹${kpis.avgRevenuePerRide}</div><div class="kpi-sub">Incl. surge pricing</div></div>
</div>
${investorExtra}
<div class="section-title">Monthly Breakdown — Live ML Data</div>
<table>
  <thead><tr><th>Month</th><th style="text-align:right">Rides</th><th style="text-align:right">Revenue</th><th style="text-align:right">Growth</th><th style="text-align:right">Avg Price</th><th style="text-align:center">Status</th></tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<footer>
  <div>© ${new Date().getFullYear()} BikeSense AI · Powered by SARIMA Forecasting Engine</div>
  <div>${rows.length} months (${historical.length} actual + ${forecast.length} forecast)</div>
</footer>
</body></html>`;

  const win = window.open("", "_blank", "width=1000,height=750");
  if (win) { win.document.write(html); win.document.close(); }
  else toast.error("Pop-up blocked! Allow pop-ups for this site.");
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isForecast = payload[0]?.payload?.isForecast;
  return (
    <div className="glass rounded-lg p-3 text-xs border border-white/5">
      <p className="text-slate-400 mb-1 font-semibold flex items-center gap-2">
        {label}
        {isForecast && <span className="text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded text-[10px] uppercase">ML Forecast</span>}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 mt-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold text-white">
            {p.name.includes("₹") || p.name === "Revenue"
              ? `₹${p.value}L`
              : p.name === "Avg Price"
              ? `₹${p.value}`
              : p.name === "Growth"
              ? `${p.value}%`
              : p.value?.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Report Type Tabs ─────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id: "overview",  label: "Overview",       icon: BarChart2 },
  { id: "revenue",   label: "Revenue Trend",  icon: DollarSign },
  { id: "rides",     label: "Rides Volume",   icon: Bike },
  { id: "growth",    label: "Growth Rate",    icon: TrendingUp },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeReport, setActiveReport] = useState("overview");
  const [generating, setGenerating]   = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const raw = await getMonthlyReport();
      if (raw && raw.length > 0) {
        // ML Data successfully loaded! (Historical + Forecast)
        setMonthlyData(transformRaw(raw));
      } else {
        // Empty array
        setMonthlyData([]);
      }
    } catch {
      setMonthlyData([]);
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

  // ── Derived KPIs — split actual vs forecast ──
  const historical     = monthlyData.filter(r => !r.isForecast);
  const forecast       = monthlyData.filter(r => r.isForecast);
  const historicalRevenue = historical.reduce((a, r) => a + r.revenue, 0);
  const forecastRevenue   = forecast.reduce((a, r) => a + r.revenue, 0);
  const totalRevenue      = (historicalRevenue + forecastRevenue).toFixed(1);
  const totalRides        = monthlyData.reduce((a, r) => a + r.rides, 0);
  const totalHistRides    = historical.reduce((a, r) => a + r.rides, 0);
  const totalFcRides      = forecast.reduce((a, r) => a + r.rides, 0);
  const lastGrowth        = monthlyData.at(-1)?.growth ?? null;
  const avgRevenuePerRide =
    totalRides > 0
      ? ((parseFloat(totalRevenue) * 100000) / totalRides).toFixed(0)
      : "0";
  const bestMonth = monthlyData.reduce(
    (best, r) => (r.revenue > (best?.revenue ?? 0) ? r : best),
    monthlyData[0]
  );
  // Revenue progress %  actual / (actual + forecast)
  const revenueProgress =
    parseFloat(totalRevenue) > 0
      ? Math.round((historicalRevenue / parseFloat(totalRevenue)) * 100)
      : 0;

  // ── Export handlers ──
  const handleExport = async (type: string) => {
    if (monthlyData.length === 0) { toast.error("No data to export — load ML data first."); return; }
    setGenerating(type);
    const kpis = {
      totalRevenue, historicalRevenue, forecastRevenue,
      totalRides, avgRevenuePerRide, bestMonth, lastGrowth,
    };
    try {
      if (type === "Raw Data CSV") {
        exportCSV(monthlyData);
        toast.success(`CSV exported — ${monthlyData.length} months of ML data`);
      } else if (type === "Monthly PDF") {
        openPrintReport(monthlyData, "monthly", kpis);
        toast.success("Report opened — click \"Save as PDF\" in the print window");
      } else if (type === "Investor Report") {
        openPrintReport(monthlyData, "investor", kpis);
        toast.success("Investor report opened — click \"Save as PDF\" in the print window");
      }
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-purple-400" />
            ML Performance Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Historical data + real-time SARIMA model forecasts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-success flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-400" />
            ML Engine Live
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh from backend"
            className="glass rounded-lg px-3 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Loading spinner */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 gap-4">
          <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Querying ML Engine &amp; Historical Data…</p>
        </div>
      ) : monthlyData.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <FileBarChart2 className="w-12 h-12 text-slate-500 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-sm">Ensure the ML backend is running. No fallback static data is used.</p>
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="space-y-4">
            {/* ── Revenue Split Widget (replaces single total) ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#00f5ff18", border: "1px solid #00f5ff28" }}>
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Revenue Breakdown</div>
                    <div className="text-white font-semibold text-sm">Actual + ML Forecast</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-display font-bold text-white">₹{totalRevenue}L</div>
                  <div className={`text-xs mt-0.5 ${lastGrowth !== null && lastGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {lastGrowth !== null ? `${lastGrowth >= 0 ? "↑" : "↓"} ${Math.abs(lastGrowth)}% MoM` : "—"}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    Actual Revenue
                  </span>
                  <span className="text-purple-400 flex items-center gap-1">
                    ML Forecast (12m)
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${revenueProgress}%`,
                      background: "linear-gradient(90deg, #10b981, #00f5ff)",
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>
              </div>

              {/* Split figures */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="glass-light rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Revenue Till Now</div>
                  <div className="text-xl font-display font-bold text-emerald-400">₹{historicalRevenue.toFixed(1)}L</div>
                  <div className="text-xs text-slate-500 mt-0.5">{totalHistRides.toLocaleString()} actual rides</div>
                </div>
                <div className="glass-light rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">SARIMA 12m Forecast</div>
                  <div className="text-xl font-display font-bold text-purple-400">₹{forecastRevenue.toFixed(1)}L</div>
                  <div className="text-xs text-slate-500 mt-0.5">{totalFcRides.toLocaleString()} predicted rides</div>
                </div>
              </div>
            </motion.div>

            {/* ── Remaining 3 KPI cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: "Total Rides",
                  value: totalRides.toLocaleString(),
                  sub: "Actual + Predicted trips",
                  subColor: "text-slate-500",
                  icon: Bike, color: "#6366f1",
                },
                {
                  label: "Avg Revenue / Ride",
                  value: `₹${avgRevenuePerRide}`,
                  sub: "Including surge pricing",
                  subColor: "text-slate-500",
                  icon: Activity, color: "#00ff88",
                },
                {
                  label: "Best Month",
                  value: bestMonth?.month ?? "—",
                  sub: bestMonth ? `₹${bestMonth.revenue}L revenue` : "",
                  subColor: "text-amber-400",
                  icon: TrendingUp, color: "#f59e0b",
                },
              ].map((k, i) => (
                <motion.div
                  key={k.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="glass rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${k.color}18`, border: `1px solid ${k.color}28` }}
                    >
                      <k.icon className="w-4 h-4" style={{ color: k.color }} />
                    </div>
                    <span className="text-xs text-slate-500">{k.label}</span>
                  </div>
                  <div className="text-2xl font-display font-bold text-white">{k.value}</div>
                  <div className={`text-xs mt-1 ${k.subColor}`}>{k.sub}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Report Type Selector */}
          <div className="glass rounded-xl p-1 flex gap-1 w-fit">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.id}
                onClick={() => setActiveReport(rt.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeReport === rt.id
                    ? "bg-white/10 text-white shadow"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <rt.icon className="w-3.5 h-3.5" />
                {rt.label}
              </button>
            ))}
          </div>

          {/* Dynamic Chart Panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeReport}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="glass rounded-xl p-6"
            >
              {activeReport === "overview" && (
                <>
                  <h3 className="font-display font-semibold text-white mb-1">Performance Overview</h3>
                  <p className="text-xs text-slate-500 mb-5">Historical vs Forecasted metrics</p>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Monthly Rides</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="month" tick={{ fontSize: 9 }} interval="preserveStartEnd" minTickGap={20} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip content={<ChartTooltip />} />
                          {/* We can use a custom bar color via Cell if needed, but for simplicity: */}
                          <Bar dataKey="rides" name="Rides" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Monthly Revenue</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="month" tick={{ fontSize: 9 }} interval="preserveStartEnd" minTickGap={20} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Line type="monotone" dataKey="revenue" name="Revenue (₹L)" stroke="#00f5ff" strokeWidth={2.5} dot={{ fill: "#00f5ff", r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {activeReport === "revenue" && (
                <>
                  <h3 className="font-display font-semibold text-white mb-1">Revenue Trend</h3>
                  <p className="text-xs text-slate-500 mb-5">Monthly revenue trajectory including SARIMA predictions</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#00f5ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue (₹L)" stroke="#00f5ff" fill="url(#revGrad2)" strokeWidth={2.5} dot={{ fill: "#00f5ff", r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}

              {activeReport === "rides" && (
                <>
                  <h3 className="font-display font-semibold text-white mb-1">Rides Volume</h3>
                  <p className="text-xs text-slate-500 mb-5">Total trips completed and forecasted</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="ridesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="rides" name="Rides" stroke="#6366f1" fill="url(#ridesGrad)" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )}

              {activeReport === "growth" && (
                <>
                  <h3 className="font-display font-semibold text-white mb-1">Month-over-Month Growth</h3>
                  <p className="text-xs text-slate-500 mb-5">Revenue growth % vs prior month</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyData.filter(r => r.growth !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{ fontSize: 10 }} unit="%" />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="growth" name="Growth" radius={[4, 4, 0, 0]} fill="#00ff88" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Monthly Breakdown Table */}
          <div className="glass rounded-xl p-6">
            <h3 className="font-display font-semibold text-white mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Month", "Total Rides", "Revenue (₹L)", "Growth", "Avg Price", "Status"].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-slate-500 font-medium text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...monthlyData].reverse().map((r, i) => (
                    <motion.tr
                      key={r.month}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-white/3 hover:bg-white/2 transition-colors"
                    >
                      <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                        {r.month}
                        {r.isForecast && (
                          <span className="text-[10px] uppercase tracking-wider text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                            Forecast
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{r.rides.toLocaleString()}</td>
                      <td className="py-3 px-3 font-mono text-white">₹{r.revenue}L</td>
                      <td className="py-3 px-3">
                        {r.growth !== null ? (
                          <span className={`font-medium flex items-center gap-1 ${r.growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {r.growth >= 0
                              ? <TrendingUp className="w-3 h-3" />
                              : <TrendingDown className="w-3 h-3" />}
                            {r.growth >= 0 ? "+" : ""}{r.growth}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">₹{r.avgPrice}</td>
                      <td className="py-3 px-3">
                        {r.isForecast ? (
                          <span className="badge-info">Predicted</span>
                        ) : (
                          <span className={
                            r.growth && r.growth > 10
                              ? "badge-success"
                              : r.growth && r.growth < 0
                              ? "badge-danger"
                              : "badge-warning"
                          }>
                            {r.growth && r.growth > 10 ? "Strong" : r.growth && r.growth < 0 ? "Decline" : "Steady"}
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Export Section */}
      <div className="glass rounded-xl p-6">
        <h3 className="font-display font-semibold text-white mb-4">Export Reports</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { type: "Monthly PDF",     desc: "Full monthly analytics with charts and KPIs", icon: "📊", format: "PDF" },
            { type: "Investor Report", desc: "Executive summary with ML forecasts and growth",  icon: "💼", format: "PDF" },
            { type: "Raw Data CSV",    desc: "Complete dataset including ML predictions", icon: "📋", format: "CSV" },
          ].map(r => (
            <div key={r.type} className="glass-light rounded-xl p-4">
              <div className="text-2xl mb-2">{r.icon}</div>
              <div className="font-semibold text-white mb-1">{r.type}</div>
              <p className="text-xs text-slate-500 mb-3">{r.desc}</p>
              <button
                onClick={() => handleExport(r.type)}
                disabled={generating === r.type || loading || monthlyData.length === 0}
                className="btn-ghost w-full flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-50"
              >
                {generating === r.type ? (
                  <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
                ) : (
                  <><Download className="w-3.5 h-3.5" />Export {r.format}</>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
