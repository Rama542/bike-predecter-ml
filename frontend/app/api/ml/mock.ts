/**
 * Realistic mock ML responses — used when the Python backend is unreachable.
 * All values are derived from the current time so the data looks "live".
 */

const AREAS = ["Indiranagar","Koramangala","Whitefield","Marathahalli","HSR Layout","Jayanagar","Electronic City","Hebbal"];
const MODELS = ["Ather 450X","Bounce Infinity","Yulu Move","Rapido Bike","Royal Enfield","Honda Activa"];
const BASE = 65.0;

function seed(n: number) { return Math.abs(Math.sin(n) * 10000) % 1; }
function surge(demand: number, p33=30, p66=60, p90=90): number {
  if (demand < p33) return 1.00;
  if (demand < p66) return 1.08;
  if (demand < p90) return 1.17;
  return 1.25;
}
function demandLabel(s: number) {
  return s >= 1.25 ? "Very High" : s >= 1.17 ? "High" : s >= 1.08 ? "Moderate" : "Low";
}
function priceLabel(s: number) {
  return s >= 1.25 ? "Peak Surge" : s >= 1.17 ? "High" : s >= 1.08 ? "Moderate" : "Standard";
}

function hourDemand(hour: number): number {
  const morning = 80 * Math.exp(-0.5 * ((hour - 8) / 2.5) ** 2);
  const evening = 65 * Math.exp(-0.5 * ((hour - 18) / 2.5) ** 2);
  return Math.max(10, Math.round(30 + morning + evening + seed(hour) * 20));
}

export function getMockResponse(path: string[], searchParams: URLSearchParams): object | null {
  const route = path.join("/");
  const now = new Date();
  const hour = now.getHours();

  // ── Predict ──────────────────────────────────────────────────────────────
  if (route === "predict-demand" || route === "predict-price") {
    const dem = hourDemand(hour);
    const s = surge(dem);
    const price = Math.round(BASE * s * 100) / 100;
    return {
      success: true,
      data: {
        datetime: now.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }),
        location: "Indiranagar",
        bike_model: "Ather 450X",
        expected_demand: dem,
        confidence_interval: [Math.round(dem * 0.8), Math.round(dem * 1.2)],
        demand_level: demandLabel(s),
        surge_multiplier: s,
        base_price: BASE,
        predicted_price: price,
        price_label: priceLabel(s),
        savings_vs_peak: Math.max(0, Math.round((BASE * 1.25 - price) * 100) / 100),
        alt_time: s > 1.0 ? "02:00 AM" : null,
        alt_price: s > 1.0 ? BASE : null,
      }
    };
  }

  // ── Short forecast (7-day hourly) ─────────────────────────────────────────
  if (route === "forecast/short") {
    const arr = [];
    const start = new Date(now); start.setMinutes(0, 0, 0);
    for (let i = 0; i < 7 * 24; i++) {
      const dt = new Date(start.getTime() + i * 3600000);
      const d = hourDemand(dt.getHours()) + seed(i) * 15;
      const s = surge(d);
      arr.push({ dt: dt.toISOString(), demand: Math.round(d), lower: Math.round(d * 0.8), upper: Math.round(d * 1.2), price: Math.round(BASE * s * 100) / 100, surge_multiplier: s });
    }
    return { success: true, data: arr };
  }

  // ── Daily forecast (30-day) ────────────────────────────────────────────────
  if (route === "forecast/daily") {
    const arr = [];
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const dt = new Date(start.getTime() + i * 86400000);
      const d = 400 + seed(i) * 200 + (dt.getDay() >= 5 ? -60 : 40);
      arr.push({ dt: dt.toISOString().split("T")[0], demand: Math.round(d), lower: Math.round(d * 0.82), upper: Math.round(d * 1.18) });
    }
    return { success: true, data: arr };
  }

  // ── Monthly forecast ──────────────────────────────────────────────────────
  if (route === "forecast/monthly") {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      arr.push({ dt: dt.toISOString().split("T")[0], demand: Math.round(12000 + seed(i + 100) * 4000) });
    }
    return { success: true, data: arr };
  }

  if (route === "forecast/metrics") return { success: true, data: { short_aic: "1,204", daily_aic: "892", monthly_aic: "143" } };

  if (route === "forecast/insights") return {
    success: true, data: [
      { emoji: "📈", title: "Weekend Pattern", desc: "Weekend rides average 18% lower than weekdays — commuters drive weekday demand.", tag: "Weekly" },
      { emoji: "⚡", title: "Daily Peak", desc: "System demand peaks at 8:00, reaching 2.3× the daily average.", tag: "Daily" },
      { emoji: "🔮", title: "7-Day Outlook", desc: "Short-term forecast expects a 12% surge in city demand vs. historical average.", tag: "Forecast" },
    ]
  };

  // ── Admin: Revenue ─────────────────────────────────────────────────────────
  if (route === "admin/revenue") return {
    success: true, data: {
      total_rides: 2_418_320, total_revenue: 15_739_080, avg_price: 70.2,
      peak_hour: 8, monthly_rides: 89_340, occupancy_pct: 73,
      active_bikes: 847, repeat_rate: 64.8,
    }
  };

  // ── Admin: Heatmap ─────────────────────────────────────────────────────────
  if (route === "admin/heatmap") {
    const arr: object[] = [];
    AREAS.forEach(area => {
      for (let h = 0; h < 24; h++) {
        arr.push({ area, hour: h, demand: Math.round(hourDemand(h) * (0.8 + seed(area.length + h) * 0.6)) });
      }
    });
    return { success: true, data: arr };
  }

  // ── Admin: Fleet ───────────────────────────────────────────────────────────
  if (route === "admin/fleet") {
    const baseCounts: Record<string, number> = { "Indiranagar": 250, "Koramangala": 220, "Whitefield": 180, "Marathahalli": 160, "HSR Layout": 190, "Jayanagar": 140, "Electronic City": 130, "Hebbal": 110 };
    return {
      success: true, data: AREAS.map(area => {
        const total = baseCounts[area] || 150;
        const inUse = Math.round(total * 0.38);
        const maintenance = Math.round(total * 0.05);
        return { area, total, available: total - inUse - maintenance, in_use: inUse, maintenance, low_battery: Math.round(total * 0.04), demand_score: 1.0 + seed(area.length) * 0.3 };
      })
    };
  }

  if (route === "admin/fleet/models") return {
    success: true, data: MODELS.map((m, i) => ({
      model: m, count: 150 + i * 20, available: 80 + i * 10, type: i < 3 ? "EV" : i === 3 ? "Budget" : "Standard",
      issues: 7 + i, revenue: `₹${(3.5 + i * 0.4).toFixed(1)}L`, demand_idx: 1.0 + seed(i) * 0.25, avg_battery: i < 3 ? 75 + i * 3 : null,
    }))
  };

  // ── Admin: Alerts ──────────────────────────────────────────────────────────
  if (route === "admin/alerts") {
    const hotArea = AREAS[hour % AREAS.length];
    const coolArea = AREAS[(hour + 4) % AREAS.length];
    return {
      success: true, data: [
        { type: "critical", title: "Surge Spike Predicted", msg: `SARIMA forecasts 1.25x surge in ${hotArea} at ${(hour + 1) % 24}:00. Only 34 bikes available.`, action: null, time: "Just now", area_high: hotArea, area_low: null, bikes: null },
        { type: "rebalance", title: "⚡ Rebalancing Required", msg: `Move 18 bikes from ${coolArea} (1.00x) → ${hotArea} before ${(hour + 1) % 24}:00.`, action: `Move 18 bikes: ${coolArea} → ${hotArea}`, time: "Just now", area_high: hotArea, area_low: coolArea, bikes: 18 },
        { type: "info", title: "ML Engine Active", msg: "SARIMA models scanning 8 zones across 3-hour horizon.", action: null, time: "Live", area_high: null, area_low: null, bikes: null },
      ]
    };
  }

  if (route === "admin/zone-intelligence") return {
    success: true, data: AREAS.map((zone, i) => ({
      zone, rides: 8000 + i * 1200, revenue: Math.round((8000 + i * 1200) * 70.2 / 100000 * 10) / 10,
      avg_surge: 1.0 + seed(i) * 0.25, peak_hour: [8, 9, 18, 17][i % 4], demand_trend: seed(i) > 0.5 ? "up" : "stable",
    }))
  };

  if (route === "admin/customers/analytics") return {
    success: true, data: {
      total_customers: 12847, returning_users: 8341, high_spend_users: 1204, churn_risk: 673,
      new_this_month: 891, avg_ltv: 4820,
      segments: [
        { name: "Daily Commuters", count: 4120, avg_rides: 22, color: "#3B82F6" },
        { name: "Weekend Riders",  count: 3210, avg_rides: 8,  color: "#10B981" },
        { name: "Occasional",      count: 3870, avg_rides: 3,  color: "#F59E0B" },
        { name: "Power Users",     count: 1647, avg_rides: 31, color: "#8B5CF6" },
      ]
    }
  };

  if (route === "admin/reports/monthly") {
    const arr = [];
    for (let i = -5; i < 7; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const rides = Math.round(85000 + seed(i + 50) * 20000);
      arr.push({ period: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`, rides, revenue: Math.round(rides * 70.2 / 100000 * 10) / 10, is_forecast: i >= 0 });
    }
    return { success: true, data: arr };
  }

  if (route === "admin/config/zones")  return { success: true, data: AREAS };
  if (route === "admin/config/models") return { success: true, data: MODELS };

  if (route === "admin/pricing/recommend") {
    const h = parseInt(searchParams.get("hour") || String(hour));
    const dem = hourDemand(h);
    const s = surge(dem);
    return { success: true, data: { recommended_price: Math.round(BASE * s * 100) / 100, surge_multiplier: s, strategy: priceLabel(s), demand_index: dem / 90, area: searchParams.get("area") || "Indiranagar" } };
  }

  if (route === "admin/pricing/events") return {
    success: true, data: [
      { event: "Diwali", multiplier: 2.3, expected_rides: 18400, price_range: "₹149.5 – ₹162.25" },
      { event: "Bangalore Marathon", multiplier: 1.6, expected_rides: 9200, price_range: "₹104 – ₹113.75" },
      { event: "IPL Match Days", multiplier: 1.45, expected_rides: 7800, price_range: "₹94.25 – ₹103" },
    ]
  };

  if (route === "admin/ml-config") return { success: true, config: { peak_surge: 1.25, event_multiplier: 1.50 } };

  if (route === "admin/pricing/hourly-schedule") {
    return {
      success: true, data: Array.from({ length: 24 }, (_, h) => {
        const dem = hourDemand(h);
        const s = surge(dem);
        return { hour: h, hour_label: `${String(h).padStart(2, "0")}:00`, price: Math.round(BASE * s * 100) / 100, surge: s, demand_index: dem / 90, strategy: priceLabel(s) };
      })
    };
  }

  if (route === "admin/pricing/zone-matrix") {
    const h = parseInt(searchParams.get("hour") || String(hour));
    return {
      success: true, data: AREAS.map((zone, i) => {
        const dem = hourDemand(h) * (0.8 + seed(i) * 0.5);
        const s = surge(dem);
        return { zone, price: Math.round(BASE * s * 100) / 100, surge: s, demand: demandLabel(s), demand_index: Math.round(dem) / 90, revenue: Math.round(dem * 70.2 / 1000 * 10) / 10, rides: Math.round(dem * 12) };
      })
    };
  }

  if (route === "admin/system-status") return { success: true, is_training: false, last_trained: new Date(Date.now() - 3600000).toISOString(), train_error: null };

  // ── Consumer ───────────────────────────────────────────────────────────────
  if (route === "consumer/bikes") {
    const area = searchParams.get("area") || null;
    const zones = area ? [area] : AREAS;
    const bikes: object[] = [];
    zones.forEach(z => {
      MODELS.forEach((m, i) => {
        const dem = hourDemand(hour);
        const s = surge(dem);
        bikes.push({
          id: `${z}-${m}-${i}`.replace(/\s/g, "-").toLowerCase(),
          name: m, type: i < 3 ? "Electric" : i === 3 ? "Budget" : "Standard",
          area: z, price_per_hr: Math.round(BASE * s * 100) / 100,
          rating: 3.8 + seed(i) * 1.2, available: seed(z.length + i) > 0.3,
          image: "", range_km: i < 3 ? 60 + i * 20 : null,
          battery: i < 3 ? 60 + Math.round(seed(i) * 35) : null,
          surge_multiplier: s, demand_level: demandLabel(s), demand_index: dem / 90,
        });
      });
    });
    return { success: true, data: bikes };
  }

  if (route === "consumer/best-time") {
    const cheapHours = [2, 3, 4, 14, 15].map(h => ({ hour: h, hour_label: `${String(h).padStart(2, "0")}:00`, price: BASE, demand_label: "Low", surge: 1.0 }));
    return { success: true, data: { best_hours: cheapHours, area: searchParams.get("area") || "All", savings_vs_peak: 16.25 } };
  }

  if (route === "consumer/recommendations") return {
    success: true, data: {
      bikes: MODELS.slice(0, 3).map((m, i) => ({ id: `rec-${i}`, name: m, area: AREAS[i], price_per_hr: BASE + i * 5, rating: 4.2 + seed(i) * 0.6, available: true })),
      reason: "Based on your ride history in this area",
    }
  };

  if (route === "consumer/price-trend") {
    return {
      success: true,
      data: Array.from({ length: 7 * 24 }, (_, i) => {
        const dt = new Date(now.getTime() - (7 * 24 - i) * 3600000);
        const d = hourDemand(dt.getHours());
        return { dt: dt.toISOString(), price: Math.round(BASE * surge(d) * 100) / 100, demand: d };
      })
    };
  }

  if (route === "consumer/hourly-pricing") {
    return {
      success: true, data: Array.from({ length: 24 }, (_, h) => {
        const dem = hourDemand(h);
        const s = surge(dem);
        return { hour: h, hour_label: `${String(h).padStart(2, "0")}:00`, price: Math.round(BASE * s * 100) / 100, demand: dem, demand_label: demandLabel(s), surge: s };
      })
    };
  }

  if (route === "consumer/weekly-forecast") {
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    return {
      success: true, data: days.map((day, i) => {
        const dem = 400 + seed(i) * 200 + (i >= 5 ? -80 : 30);
        const s = surge(dem, 300, 500, 600);
        return { day, price: Math.round(BASE * s * 100) / 100, demand: Math.round(dem), demand_label: demandLabel(s), surge: s };
      })
    };
  }

  // ── Auth (best-effort, always succeed) ────────────────────────────────────
  if (route === "auth/register")          return { success: true };
  if (route === "auth/send-verification") return { success: true, dev_mode: true, dev_otp: "123456", message: "Demo mode — OTP is 123456" };
  if (route === "auth/verify-code")       return { success: true, message: "Verified (demo mode)" };

  // ── Dataset upload — not mockable ─────────────────────────────────────────
  if (route === "admin/upload-dataset") return null; // let it fall through to real 503

  return null; // no mock for this endpoint
}
