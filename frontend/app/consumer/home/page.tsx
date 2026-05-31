"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin, Calendar, Clock, Bike, Zap, Shield, Star,
  Search, ChevronRight, CheckCircle, ArrowRight, Sparkles, TrendingDown,
} from "lucide-react";
import { getBikes, getHourlyPricing, getDynamicZones, type BikeItem } from "@/lib/api";

const BIKE_EMOJI: Record<string, string> = {
  "Ather 450X": "⚡", "Bounce Infinity": "⚡", "Yulu Move": "⚡",
  "Honda Activa": "🏍️", "Royal Enfield": "👑", "Rapido Bike": "💰",
};
const BIKE_COLOR: Record<string, string> = {
  "Ather 450X": "#6366f1", "Bounce Infinity": "#00f5ff", "Yulu Move": "#00ff88",
  "Honda Activa": "#f59e0b", "Royal Enfield": "#a78bfa", "Rapido Bike": "#94a3b8",
};

export default function ConsumerHome() {
  const router = useRouter();
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(() => {
    const h = new Date().getHours();
    return `${String(h + 1).padStart(2, "0")}:00`;
  });
  const [featuredBikes, setFeaturedBikes] = useState<BikeItem[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDynamicZones().then(z => {
      setAreas(z);
      setSelectedArea(z[0] || "");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedArea) return;
    setLoading(true);
    Promise.all([getBikes(selectedArea), getHourlyPricing(selectedArea)])
      .then(([bikes, hourly]) => {
        setFeaturedBikes(bikes.filter(b => b.available).slice(0, 4));
        const now = new Date().getHours();
        setCurrentPrice(hourly.find(h => h.hour === now)?.price ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedArea]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedArea) params.set("area", selectedArea);
    if (date) params.set("date", date);
    if (time) params.set("time", time);
    router.push(`/consumer/marketplace?${params.toString()}`);
  };

  return (
    <div className="space-y-8 -mx-6 -mt-6">
      {/* ── Hero ── */}
      <div className="relative px-6 pt-14 pb-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-slate-900 pointer-events-none" />
        <div className="absolute top-0 left-1/3 w-[500px] h-[250px] bg-emerald-500/10 blur-[90px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-brand-500/8 blur-[70px] rounded-full pointer-events-none" />

        <div className="relative max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI-powered live pricing · Always fair
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 leading-tight">
              Book a Bike,<br />
              <span className="text-emerald-400">Ride on Your Terms</span>
            </h1>
            <p className="text-slate-400 text-base md:text-lg max-w-lg mx-auto">
              Hourly bike rentals with real-time surge pricing. Pick up anywhere, pay only for what you ride.
            </p>
          </motion.div>

          {/* Search card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="glass rounded-2xl p-5 shadow-2xl">
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Pickup Area
                </label>
                <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
                  className="input-dark w-full">
                  {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date
                </label>
                <input type="date" value={date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setDate(e.target.value)} className="input-dark w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pickup Time
                </label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="input-dark w-full" />
              </div>
            </div>
            <button onClick={handleSearch}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base font-semibold rounded-xl">
              <Search className="w-5 h-5" />
              Find Available Bikes
            </button>
            {currentPrice && (
              <p className="text-center text-xs text-slate-500 mt-3">
                Right now in <span className="text-white">{selectedArea}</span>:&nbsp;
                <span className="text-emerald-400 font-semibold">₹{currentPrice}/hr</span>
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <div className="px-6 space-y-10 pb-8">

        {/* ── Quick stats ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3">
          {[
            { icon: Bike,        label: "Bikes Online",  value: featuredBikes.length > 0 ? `${featuredBikes.reduce((s, b) => s + (b.available_count ?? 1), 0)}+` : "—", color: "text-emerald-400" },
            { icon: TrendingDown,label: "From",           value: featuredBikes.length > 0 ? `₹${Math.round(Math.min(...featuredBikes.map(b => b.price_per_hr)))}/hr` : "—", color: "text-brand-400" },
            { icon: Sparkles,    label: "Pricing Engine", value: "Live AI",                                                                                                 color: "text-amber-400" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
              className="glass rounded-xl p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
              <div className={`font-display font-bold text-lg ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── How it works ── */}
        <div>
          <h2 className="font-display font-bold text-xl text-white mb-5">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { n: "1", icon: Search,       title: "Search",  color: "emerald", desc: "Choose your area, date and pickup time to see all bikes available at that moment." },
              { n: "2", icon: Bike,         title: "Book",    color: "brand",   desc: "Select a bike, pick your ride duration, and confirm in seconds. No paperwork." },
              { n: "3", icon: CheckCircle,  title: "Ride",    color: "amber",   desc: "Get your booking ID and head to the pickup spot. Pay only for hours you use." },
            ].map((s, i) => (
              <motion.div key={s.n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                className="glass rounded-2xl p-5 flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0
                  bg-${s.color}-500/15 border border-${s.color}-500/25`}>
                  <s.icon className={`w-5 h-5 text-${s.color}-400`} />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm mb-1">{s.n}. {s.title}</div>
                  <div className="text-xs text-slate-400 leading-relaxed">{s.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Available Bikes ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-xl text-white">Bikes Near You</h2>
            <Link href="/consumer/marketplace"
              className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
              See all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass rounded-2xl h-24 animate-pulse" />
                ))
              : featuredBikes.map((bike, i) => (
                  <motion.div key={bike.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    onClick={() => router.push("/consumer/marketplace")}
                    className="glass rounded-2xl p-4 flex items-center gap-4 hover-lift cursor-pointer group">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                      style={{
                        background: `${BIKE_COLOR[bike.name] ?? "#6366f1"}18`,
                        border: `1px solid ${BIKE_COLOR[bike.name] ?? "#6366f1"}28`,
                      }}>
                      {BIKE_EMOJI[bike.name] ?? "🚲"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm">{bike.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />{bike.area}
                        <span className="mx-1 text-slate-700">·</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                        <span className="text-amber-400">{bike.rating}</span>
                      </div>
                      <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full
                        ${bike.surge_multiplier > 1.1 ? "bg-red-500/10 text-red-400" :
                          bike.surge_multiplier > 1   ? "bg-amber-500/10 text-amber-400" :
                                                         "bg-emerald-500/10 text-emerald-400"}`}>
                        {bike.demand_level} demand
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold text-white text-lg">
                        ₹{bike.price_per_hr}
                        <span className="text-xs text-slate-500 font-normal">/hr</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{bike.available_count} free</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                  </motion.div>
                ))}
          </div>
        </div>

        {/* ── Why BikeSense ── */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display font-bold text-xl text-white mb-5 text-center">Why BikeSense?</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: Zap,    color: "amber",   title: "Surge-Smart Pricing",  desc: "Our SARIMA AI predicts demand so you always know the cheapest time to ride." },
              { icon: Shield, color: "emerald", title: "Fully Insured",         desc: "Every ride is covered. Ride worry-free knowing we've got you protected." },
              { icon: Star,   color: "brand",   title: "Earn Rewards",          desc: "Collect points on every booking and redeem them for free rides and discounts." },
            ].map(f => (
              <div key={f.title} className="text-center">
                <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3
                  bg-${f.color}-500/15 border border-${f.color}-500/20`}>
                  <f.icon className={`w-6 h-6 text-${f.color}-400`} />
                </div>
                <div className="font-semibold text-white text-sm mb-1">{f.title}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
