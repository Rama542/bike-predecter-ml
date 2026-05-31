/**
 * BikeSense API Client
 * Routes all ML requests through the Next.js /api/ml/* proxy
 * which rewrites to ML_API_URL/api/v1/* (see next.config.js).
 * All data is sourced exclusively from the live SARIMA ML backend.
 * NO static mock fallbacks — the backend must be running.
 */

const ML_API = "/api/ml";

// ─── Safe Fetch ───────────────────────────────────────────────────────────────
/**
 * Wraps fetch with a 15s timeout and consistent error extraction.
 * Throws on network error, non-OK status, or backend success=false.
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`ML API error: HTTP ${res.status}`);
    const json = await res.json();
    if (json.success === false) throw new Error(json.error || "ML backend returned an error");
    return json.data ?? json;
  } catch (err: any) {
    clearTimeout(timeout);
    const msg = err?.name === "AbortError"
      ? "ML backend request timed out (>15s)"
      : err?.message ?? "Unknown ML API error";
    console.error(`[BikeSense API] ${url} → ${msg}`);
    throw new Error(msg);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PredictInput {
  date: string;
  time: string;
  location?: string;
  bike_model?: string;
}

export interface PredictionResult {
  datetime: string;
  location: string;
  bike_model: string;
  expected_demand: number;
  confidence_interval: [number, number];
  demand_level: "Low" | "Moderate" | "High" | "Very High";
  surge_multiplier: number;
  base_price: number;
  predicted_price: number;
  price_label: string;
  savings_vs_peak: number;
  alt_time?: string;
  alt_price?: number;
}

export interface ForecastPoint {
  dt: string;
  demand: number;
  lower?: number;
  upper?: number;
  price?: number;
}

export interface RevenueData {
  total_rides: number;
  total_revenue: number;
  avg_price: number;
  peak_hour: number;
  monthly_rides: number;
  occupancy_pct: number;
  active_bikes: number;
  repeat_rate: number;
}

export interface BikeItem {
  id: string; name: string; type: string; area: string;
  price_per_hr: number; rating: number; available: boolean;
  image: string; range_km: number | null; battery: number | null;
  surge_multiplier?: number; demand_level?: string; demand_index?: number;
}

export interface HourlyPricePoint {
  hour: number;
  hour_label: string;
  price: number;
  demand: number;
  demand_label: string;
  surge: number;
}

export interface WeeklyDayForecast {
  day: string;
  price: number;
  demand: number;
  demand_label: string;
  surge: number;
}

// ─── Prediction APIs ──────────────────────────────────────────────────────────
export const predictDemand = (input: PredictInput) =>
  apiFetch<PredictionResult>(
    `${ML_API}/predict-demand`,
    { method: "POST", body: JSON.stringify({ ...input, location: input.location || "City Center", bike_model: input.bike_model || "All" }) }
  );

export const predictPrice = (input: PredictInput) =>
  apiFetch<{ predicted_price: number; surge_multiplier: number; price_label: string; demand_level: string; savings_vs_peak: number; base_price: number; confidence_interval: [number, number]; alt_time?: string; alt_price?: number; }>(
    `${ML_API}/predict-price`,
    { method: "POST", body: JSON.stringify({ ...input, location: input.location || "City Center", bike_model: input.bike_model || "All" }) }
  );

// ─── Forecast Series ──────────────────────────────────────────────────────────
export const getShortForecast   = () => apiFetch<ForecastPoint[]>(`${ML_API}/forecast/short`);
export const getDailyForecast   = () => apiFetch<ForecastPoint[]>(`${ML_API}/forecast/daily`);
export const getMonthlyForecast = () => apiFetch<ForecastPoint[]>(`${ML_API}/forecast/monthly`);
export const getForecastMetrics = () => apiFetch<{ short_aic: string, daily_aic: string, monthly_aic: string }>(`${ML_API}/forecast/metrics`);
export const getForecastInsights = () => apiFetch<Array<{ emoji: string, title: string, desc: string, tag: string }>>(`${ML_API}/forecast/insights`);

// ─── Admin APIs ───────────────────────────────────────────────────────────────
export const getAdminRevenue = () => apiFetch<RevenueData>(`${ML_API}/admin/revenue`);

export const getHeatmapData = (date?: string) => {
  const url = date ? `${ML_API}/admin/heatmap?date=${date}` : `${ML_API}/admin/heatmap`;
  return apiFetch<{ area: string; hour: number; demand: number }[]>(url);
};

export const getFleetData  = () => apiFetch<any[]>(`${ML_API}/admin/fleet`);
export const getBikeModels = () => apiFetch<any[]>(`${ML_API}/admin/fleet/models`);
export const getLiveAlerts        = () => apiFetch<any[]>(`${ML_API}/admin/alerts`);
export const getZoneIntelligence  = () => apiFetch<any[]>(`${ML_API}/admin/zone-intelligence`);
export const getCustomerAnalytics = () => apiFetch<any>(`${ML_API}/admin/customers/analytics`);
export const getMonthlyReport     = () => apiFetch<any[]>(`${ML_API}/admin/reports/monthly`);
export const getDynamicZones      = () => apiFetch<string[]>(`${ML_API}/admin/config/zones`);
export const getDynamicModels     = () => apiFetch<string[]>(`${ML_API}/admin/config/models`);

export const getPricingRec = (area: string, hour: number, is_weekend = false, date?: string) => {
  let url = `${ML_API}/admin/pricing/recommend?area=${encodeURIComponent(area)}&hour=${hour}&is_weekend=${is_weekend}`;
  if (date) url += `&date=${encodeURIComponent(date)}`;
  return apiFetch<any>(url);
};

export const getEventPricing = () => apiFetch<any[]>(`${ML_API}/admin/pricing/events`);

export const getSurgeConfig = () => apiFetch<any>(`${ML_API}/admin/ml-config`).then(res => res.config);

export const updateSurgeConfig = async (config: { peak_surge: number; event_multiplier: number }) => {
  const res = await fetch(`${ML_API}/admin/ml-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update surge config");
  return res.json();
};

export const getHourlyPriceSchedule = (area = "Indiranagar", is_weekend = false) =>
  apiFetch<any[]>(`${ML_API}/admin/pricing/hourly-schedule?area=${encodeURIComponent(area)}&is_weekend=${is_weekend}`);

export const getZonePriceMatrix = (is_weekend = false, date?: string, hour?: number) => {
  let url = `${ML_API}/admin/pricing/zone-matrix?is_weekend=${is_weekend}`;
  if (date) url += `&date=${encodeURIComponent(date)}`;
  if (hour !== undefined) url += `&hour=${hour}`;
  return apiFetch<any[]>(url);
};

// ─── Consumer APIs ────────────────────────────────────────────────────────────
export const getBikes = (area?: string, type?: string, targetTime?: string) => {
  const params = new URLSearchParams();
  if (area && area !== "All") params.append("area", area);
  if (type && type !== "All") params.append("bike_type", type);
  if (targetTime) params.append("target_time", targetTime);
  return apiFetch<BikeItem[]>(`${ML_API}/consumer/bikes${params.toString() ? `?${params.toString()}` : ""}`);
};

export const getBestTime        = (area?: string) => apiFetch<any>(`${ML_API}/consumer/best-time${area ? `?area=${encodeURIComponent(area)}` : ""}`);
export const getRecommendations = (area?: string) => apiFetch<any>(`${ML_API}/consumer/recommendations${area ? `?area=${encodeURIComponent(area)}` : ""}`);
export const getPriceTrend      = () => apiFetch<{ dt: string; price: number; demand: number }[]>(`${ML_API}/consumer/price-trend`);
export const getHourlyPricing    = (area?: string) => apiFetch<HourlyPricePoint[]>(`${ML_API}/consumer/hourly-pricing${area ? `?area=${encodeURIComponent(area)}` : ""}`);
export const getWeeklyDayForecast = () => apiFetch<WeeklyDayForecast[]>(`${ML_API}/consumer/weekly-forecast`);

// ─── Dataset Upload ───────────────────────────────────────────────────────────
// Routes through the Next.js proxy (/api/ml/*) which streams multipart bodies
// directly via req.body — no buffering, no CORS issue.
export async function uploadDataset(
  file: File,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`/api/ml/admin/upload-dataset`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Could not reach the ML service." };
  }
}

// ── Email Verification ─────────────────────────────────────────────────────────
export interface SendVerificationResult {
  success: boolean;
  dev_mode?: boolean;
  dev_otp?: string;   // only present in dev mode (no SMTP configured)
  message?: string;
  error?: string;
}
export interface VerifyCodeResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function sendVerificationEmail(email: string, name: string): Promise<SendVerificationResult> {
  const res = await fetch(`${ML_API}/auth/send-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  return res.json();
}

export async function verifyEmailCode(email: string, code: string): Promise<VerifyCodeResult> {
  const res = await fetch(`${ML_API}/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return res.json();
}
