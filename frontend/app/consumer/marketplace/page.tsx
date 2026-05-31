"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Bike, Battery, Star, MapPin, Search, Zap, ChevronRight,
  RefreshCw, WifiOff, Calendar, Clock, X, CheckCircle, Tag,
  ArrowLeft, Filter,
} from "lucide-react";
import { getBikes, getDynamicZones, type BikeItem } from "@/lib/api";

// ─── Bike metadata ─────────────────────────────────────────────────────────────
const BIKE_META: Record<string, { color: string; emoji: string; desc: string }> = {
  "Ather 450X":      { color: "#6366f1", emoji: "⚡", desc: "Premium EV scooter with smart dashboard & regenerative braking." },
  "Bounce Infinity": { color: "#00f5ff", emoji: "⚡", desc: "Mid-range EV with swappable battery. Lightweight and easy to manoeuvre." },
  "Yulu Move":       { color: "#00ff88", emoji: "⚡", desc: "Compact city EV. Perfect for short commutes. Lock/unlock via app." },
  "Honda Activa":    { color: "#f59e0b", emoji: "🏍️", desc: "India's most trusted scooter. Reliable, fuel-efficient, comfortable ride." },
  "Royal Enfield":   { color: "#a78bfa", emoji: "👑", desc: "Classic 350cc. Weekend warrior. Book in advance — very popular!" },
  "Rapido Bike":     { color: "#94a3b8", emoji: "💰", desc: "Budget-friendly. Get around without breaking the bank." },
};
const getMeta = (name: string) =>
  BIKE_META[name] ?? { color: "#6366f1", emoji: "🚲", desc: "Available for rent in your city." };

const DURATION_OPTIONS = [
  { label: "1 hr",   value: 1 },
  { label: "2 hrs",  value: 2 },
  { label: "3 hrs",  value: 3 },
  { label: "4 hrs",  value: 4 },
  { label: "6 hrs",  value: 6 },
  { label: "8 hrs",  value: 8 },
  { label: "12 hrs", value: 12 },
  { label: "1 day",  value: 24 },
];

const PROMO_CODES: Record<string, number> = {
  RIDE10:  0.10,
  BIKE20:  0.20,
  FIRST50: 0.50,
};

function generateBookingId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "BKS-2026-";
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

interface Booking {
  id: string;
  bikeId: string;
  bikeName: string;
  area: string;
  date: string;
  time: string;
  duration: number;
  totalPaid: number;
  surge: number;
  createdAt: string;
}

// ─── Booking Modal ─────────────────────────────────────────────────────────────
function BookingModal({
  bike, initialDate, initialTime, onClose, onConfirm,
}: {
  bike: BikeItem;
  initialDate: string;
  initialTime: string;
  onClose: () => void;
  onConfirm: (b: Booking) => void;
}) {
  const meta = getMeta(bike.name);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(
    initialTime || `${String(new Date().getHours() + 1).padStart(2, "0")}:00`
  );
  const [duration, setDuration] = useState(2);
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState<number | null>(null);
  const [promoError, setPromoError] = useState("");

  const surge = bike.surge_multiplier ?? 1;
  const baseRate = bike.price_per_hr;
  const surgedRate = Math.round(baseRate * surge);
  const subtotal = surgedRate * duration;
  const discount = promoApplied ? Math.round(subtotal * promoApplied) : 0;
  const total = subtotal - discount;

  function applyPromo() {
    const code = promo.trim().toUpperCase();
    const disc = PROMO_CODES[code];
    if (disc) { setPromoApplied(disc); setPromoError(""); }
    else       { setPromoApplied(null); setPromoError("Invalid promo code"); }
  }

  function handleConfirm() {
    const booking: Booking = {
      id: generateBookingId(),
      bikeId: bike.id,
      bikeName: bike.name,
      area: bike.area,
      date, time, duration,
      totalPaid: total,
      surge,
      createdAt: new Date().toISOString(),
    };
    try {
      const existing: Booking[] = JSON.parse(localStorage.getItem("bs_bookings") || "[]");
      localStorage.setItem("bs_bookings", JSON.stringify([booking, ...existing]));
    } catch {}
    onConfirm(booking);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-md glass rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}>
              {meta.emoji}
            </div>
            <div>
              <div className="font-semibold text-white">{bike.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{bike.area}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full glass flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </label>
              <input type="date" value={date}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setDate(e.target.value)}
                className="input-dark w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Pickup Time
              </label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="input-dark w-full text-sm" />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs text-slate-500 mb-2 block">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setDuration(opt.value)}
                  className={`py-2 rounded-lg text-xs font-medium transition-all ${
                    duration === opt.value
                      ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                      : "glass-light text-slate-400 hover:text-white border border-transparent"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="glass rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Price Breakdown</div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">₹{baseRate}/hr × {duration} {duration === 1 ? "hr" : "hrs"}</span>
              <span className="text-white">₹{baseRate * duration}</span>
            </div>
            {surge > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Surge ({surge.toFixed(1)}×)
                </span>
                <span className="text-amber-400">+₹{subtotal - baseRate * duration}</span>
              </div>
            )}
            {promoApplied !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-emerald-400 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Promo ({Math.round(promoApplied * 100)}% off)
                </span>
                <span className="text-emerald-400">−₹{discount}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2.5 flex justify-between font-bold">
              <span className="text-white">Total</span>
              <span className="text-emerald-400 text-xl">₹{total}</span>
            </div>
          </div>

          {/* Promo Code */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Promo Code
              <span className="text-slate-600 ml-1">(Try: RIDE10)</span>
            </label>
            <div className="flex gap-2">
              <input value={promo} onChange={e => { setPromo(e.target.value); setPromoError(""); }}
                onKeyDown={e => e.key === "Enter" && applyPromo()}
                placeholder="Enter code"
                className="input-dark flex-1 text-sm" style={{ textTransform: "uppercase" }} />
              <button onClick={applyPromo}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors shrink-0">
                Apply
              </button>
            </div>
            {promoError && <p className="text-xs text-red-400 mt-1.5">{promoError}</p>}
            {promoApplied !== null && <p className="text-xs text-emerald-400 mt-1.5">✓ Promo applied! Saving ₹{discount}</p>}
          </div>
        </div>

        {/* CTA */}
        <div className="p-5 border-t border-white/10">
          <button onClick={handleConfirm}
            className="btn-primary w-full py-3.5 text-base font-semibold rounded-xl flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Confirm Booking · ₹{total}
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">Free cancellation within 30 mins of booking</p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Booking Success Modal ─────────────────────────────────────────────────────
function BookingSuccessModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const meta = getMeta(booking.bikeName);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="w-full max-w-sm glass rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />

        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>

          <div className="text-xl font-bold text-white mb-1">Booking Confirmed!</div>
          <div className="font-mono text-emerald-400 text-sm mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2.5 px-4 tracking-widest">
            {booking.id}
          </div>

          <div className="space-y-2 text-sm mb-6">
            {[
              { label: "Bike",       value: `${meta.emoji} ${booking.bikeName}` },
              { label: "Pickup",     value: booking.area },
              { label: "Date",       value: booking.date },
              { label: "Time",       value: booking.time },
              { label: "Duration",   value: booking.duration < 24 ? `${booking.duration} hr${booking.duration > 1 ? "s" : ""}` : "1 day" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between glass rounded-lg px-4 py-2.5">
                <span className="text-slate-400">{row.label}</span>
                <span className="text-white font-medium">{row.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between glass rounded-lg px-4 py-2.5 border border-emerald-500/20">
              <span className="text-slate-400">Total Paid</span>
              <span className="text-emerald-400 font-bold text-base">₹{booking.totalPaid}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-5">
            Show this booking ID at the pickup spot. Your bike will be ready.
          </p>

          <button onClick={onClose} className="btn-primary w-full py-3 rounded-xl font-semibold">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-1 bg-white/10" />
      <div className="p-5 space-y-3">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/5 rounded w-2/3" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
          </div>
          <div className="w-16 h-8 bg-white/5 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-10 bg-white/5 rounded-full" />
          <div className="h-5 w-14 bg-white/5 rounded-full" />
        </div>
        <div className="h-3 bg-white/5 rounded w-full" />
        <div className="h-10 bg-white/5 rounded-xl w-full" />
      </div>
    </div>
  );
}

// ─── Bike Card ─────────────────────────────────────────────────────────────────
function BikeCard({ bike, onBook }: { bike: BikeItem; onBook: () => void }) {
  const meta = getMeta(bike.name);
  const surge = bike.surge_multiplier ?? 1;
  const availCount = (bike as any).available_count ?? 3;

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className={`glass rounded-2xl overflow-hidden hover-lift transition-all ${!bike.available ? "opacity-60" : ""}`}>
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}>
              {meta.emoji}
            </div>
            <div>
              <div className="font-semibold text-white">{bike.name}</div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <MapPin className="w-3 h-3" />{bike.area}
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                <Star className="w-3 h-3 fill-amber-400" />{bike.rating}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-xl text-white">
              ₹{bike.price_per_hr}<span className="text-xs text-slate-500 font-normal">/hr</span>
            </div>
            {surge > 1 && (
              <div className="text-xs text-amber-400 flex items-center gap-0.5 justify-end mt-0.5">
                <Zap className="w-3 h-3" />{surge.toFixed(1)}× surge
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ color: meta.color, borderColor: `${meta.color}30`, background: `${meta.color}10` }}>
            {bike.type}
          </span>
          {bike.battery != null && (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
              bike.battery > 70
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
              <Battery className="w-3 h-3" />{bike.battery}%
            </span>
          )}
          {bike.range_km != null && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30">
              {bike.range_km} km
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            !bike.available
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : availCount < 3
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
            {bike.available ? `${availCount} free` : "Unavailable"}
          </span>
          {bike.demand_level && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              bike.demand_level === "High" || bike.demand_level === "Very High"
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : bike.demand_level === "Moderate"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
              {bike.demand_level}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4">{meta.desc}</p>

        <button
          disabled={!bike.available}
          onClick={onBook}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            bike.available
              ? "btn-primary"
              : "bg-slate-700/30 text-slate-600 cursor-not-allowed"
          }`}>
          {bike.available
            ? <><span>Book Now</span><ChevronRight className="w-4 h-4" /></>
            : "Not Available"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Inner page (uses useSearchParams — must be inside Suspense) ───────────────
const TYPES        = ["All", "EV", "Scooter", "Premium", "Budget"];
const FALLBACK_AREAS = ["All", "Zone A", "Zone B", "Zone C", "Zone D"];

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const urlArea = searchParams.get("area") || "";
  const urlDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const urlTime = searchParams.get("time") || "";

  const [bikes,        setBikes]        = useState<BikeItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [typeFilter,   setTypeFilter]   = useState("All");
  const [areaFilter,   setAreaFilter]   = useState(urlArea || "All");
  const [search,       setSearch]       = useState("");
  const [sortBy,       setSortBy]       = useState<"price" | "rating">("price");
  const [availOnly,    setAvailOnly]    = useState(true);
  const [dynamicAreas, setDynamicAreas] = useState<string[]>([]);
  const [bookingBike,  setBookingBike]  = useState<BikeItem | null>(null);
  const [confirmed,    setConfirmed]    = useState<Booking | null>(null);

  useEffect(() => {
    getDynamicZones()
      .then(z => setDynamicAreas(["All", ...z]))
      .catch(() => setDynamicAreas(FALLBACK_AREAS));
  }, []);

  const fetchBikes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBikes(urlArea || undefined);
      setBikes(data);
    } catch {
      setError("Could not reach the ML backend. Make sure both services are running.");
    } finally {
      setLoading(false);
    }
  }, [urlArea]);

  useEffect(() => { fetchBikes(); }, [fetchBikes]);

  const filtered = bikes
    .filter(b => typeFilter === "All" || b.type === typeFilter)
    .filter(b => areaFilter === "All" || b.area === areaFilter)
    .filter(b => !availOnly || b.available)
    .filter(b => !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.area.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === "price" ? a.price_per_hr - b.price_per_hr : b.rating - a.rating);

  return (
    <>
      <AnimatePresence>
        {bookingBike && (
          <BookingModal
            bike={bookingBike}
            initialDate={urlDate}
            initialTime={urlTime}
            onClose={() => setBookingBike(null)}
            onConfirm={booking => { setBookingBike(null); setConfirmed(booking); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmed && (
          <BookingSuccessModal booking={confirmed} onClose={() => setConfirmed(null)} />
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/consumer/home"
                className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="font-display font-bold text-2xl text-white">
                {urlArea ? `Bikes in ${urlArea}` : "All Bikes"}
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
              {urlDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{urlDate}
                </span>
              )}
              {urlTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />{urlTime}
                </span>
              )}
              {(urlDate || urlTime) && <span className="text-slate-700">·</span>}
              {loading ? "Loading bikes…" : `${filtered.length} bikes found`}
            </p>
          </div>
          <button onClick={fetchBikes} disabled={loading}
            className="glass rounded-lg px-3 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm">
            <WifiOff className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* Filters */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search bike name or area…"
                className="input-dark w-full pl-9 py-1.5 text-sm" />
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setAvailOnly(!availOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${availOnly
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "glass text-slate-400 hover:text-white border border-transparent"}`}>
                <Filter className="w-3 h-3" />Available Only
              </button>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as "price" | "rating")}
                className="input-dark text-sm py-1.5">
                <option value="price">Cheapest first</option>
                <option value="rating">Top rated</option>
              </select>
            </div>
          </div>

          {/* Type pills */}
          <div className="flex gap-2 flex-wrap">
            {TYPES.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${typeFilter === t
                  ? "bg-brand-500 text-white"
                  : "glass-light text-slate-400 hover:text-white"}`}>
                {t === "EV" ? "⚡ EV" : t === "Premium" ? "👑 Premium" : t === "Budget" ? "💰 Budget" : t === "Scooter" ? "🛵 Scooter" : "All"}
              </button>
            ))}
          </div>

          {/* Area pills */}
          <div className="flex gap-2 flex-wrap">
            {(dynamicAreas.length > 0 ? dynamicAreas : FALLBACK_AREAS).map(a => (
              <button key={a} onClick={() => setAreaFilter(a)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${areaFilter === a
                  ? "bg-brand-500 text-white"
                  : "glass-light text-slate-400 hover:text-white"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div layout className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </motion.div>
          ) : filtered.length > 0 ? (
            <motion.div layout className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(bike => (
                <BikeCard key={bike.id} bike={bike} onBook={() => setBookingBike(bike)} />
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-2xl p-16 text-center">
              <Bike className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <div className="text-slate-400 font-medium">No bikes found</div>
              <div className="text-slate-600 text-sm mt-1">Try adjusting your filters or area</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── Page export (wraps content in Suspense for useSearchParams) ───────────────
export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="glass rounded-xl h-14 animate-pulse" />
        <div className="glass rounded-xl h-32 animate-pulse" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
