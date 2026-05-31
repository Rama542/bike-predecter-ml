"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { CheckCircle, Calendar, Clock, MapPin, Bike, ArrowLeft, Trash2 } from "lucide-react";

const BIKE_EMOJI: Record<string, string> = {
  "Ather 450X": "⚡", "Bounce Infinity": "⚡", "Yulu Move": "⚡",
  "Honda Activa": "🏍️", "Royal Enfield": "👑", "Rapido Bike": "💰",
};

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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    try {
      const stored: Booking[] = JSON.parse(localStorage.getItem("bs_bookings") || "[]");
      setBookings(stored);
    } catch {
      setBookings([]);
    }
  }, []);

  function remove(id: string) {
    const updated = bookings.filter(b => b.id !== id);
    setBookings(updated);
    try { localStorage.setItem("bs_bookings", JSON.stringify(updated)); } catch {}
  }

  function clearAll() {
    setBookings([]);
    try { localStorage.removeItem("bs_bookings"); } catch {}
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/consumer/home"
            className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-2xl text-white">My Bookings</h1>
            <p className="text-slate-500 text-sm">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {bookings.length > 0 && (
          <button onClick={clearAll}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Clear all
          </button>
        )}
      </div>

      {/* List */}
      <AnimatePresence mode="popLayout">
        {bookings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass rounded-2xl p-16 text-center">
            <Bike className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 font-medium">No bookings yet</div>
            <div className="text-slate-600 text-sm mt-1 mb-5">Your confirmed rides will appear here</div>
            <Link href="/consumer/marketplace"
              className="inline-flex items-center gap-2 px-5 py-2.5 btn-primary rounded-xl text-sm font-semibold">
              Browse Bikes
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b, i) => (
              <motion.div key={b.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl">
                      {BIKE_EMOJI[b.bikeName] ?? "🚲"}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{b.bikeName}</div>
                      <div className="font-mono text-xs text-emerald-400">{b.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-lg">₹{b.totalPaid}</div>
                      <div className="text-xs text-slate-500">{b.duration < 24 ? `${b.duration} hr${b.duration > 1 ? "s" : ""}` : "1 day"}</div>
                    </div>
                    <button onClick={() => remove(b.id)}
                      className="w-7 h-7 rounded-lg glass flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <MapPin className="w-3 h-3 shrink-0 text-slate-500" />{b.area}
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Calendar className="w-3 h-3 shrink-0 text-slate-500" />{b.date}
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3 shrink-0 text-slate-500" />{b.time}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-3 text-xs text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Confirmed</span>
                  <span className="text-slate-700 mx-1">·</span>
                  <span className="text-slate-500">
                    Booked {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
