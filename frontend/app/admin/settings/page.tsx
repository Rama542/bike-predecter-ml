"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, User, Database, Shield, UploadCloud, FileText,
  CheckCircle, AlertCircle, Loader2, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { getUser, signOut as authSignOut, type AuthUser } from "@/lib/auth";
import { uploadDataset } from "@/lib/api";
import { useRouter } from "next/navigation";

type TrainPhase = "idle" | "uploading" | "training" | "done" | "error";

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [peakSurge, setPeakSurge] = useState(1.25);
  const [eventMultiplier, setEventMultiplier] = useState(1.50);
  const [file, setFile] = useState<File | null>(null);

  // Training lifecycle state
  const [phase, setPhase] = useState<TrainPhase>("idle");
  const [trainedFile, setTrainedFile] = useState<string>("");
  const [trainError, setTrainError] = useState<string | null>(null);
  const [lastTrained, setLastTrained] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    setCurrentUser(getUser());
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/ml/admin/ml-config");
        const json = await res.json();
        if (json.success && json.config) {
          setPeakSurge(json.config.peak_surge);
          setEventMultiplier(json.config.event_multiplier);
        }
      } catch (err) {
        console.error("Failed to load ML config", err);
      }
    };
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/ml/admin/system-status");
        const json = await res.json();
        if (json.last_trained) setLastTrained(json.last_trained);
      } catch {}
    };
    loadConfig();
    loadStatus();
  }, []);

  const handleSignOut = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).Clerk) {
        await (window as any).Clerk.signOut();
      }
    } catch (e) {
      console.warn("Clerk signout bypassed", e);
    }
    authSignOut();
    router.push("/auth/login");
  };

  const saveSettings = async () => {
    try {
      const res = await fetch("/api/ml/admin/ml-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peak_surge: Number(peakSurge), event_multiplier: Number(eventMultiplier) })
      });
      const json = await res.json();
      if (json.success) toast.success("ML Engine updated dynamically!");
      else toast.error("Failed to update ML settings.");
    } catch {
      toast.error("API error while saving settings.");
    }
  };

  // Poll /admin/system-status every 3 s until is_training flips to false
  const startPolling = (snapshotTime: string | null) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch("/api/ml/admin/system-status");
        const json = await res.json();

        if (json.train_error) {
          clearInterval(pollRef.current!);
          setPhase("error");
          setTrainError(json.train_error);
          toast.error("Model training failed — check the server logs.");
          return;
        }

        if (!json.is_training) {
          // Training finished — confirm last_trained actually changed (guards against
          // early polls that fire before the background thread even starts training)
          const newLastTrained = json.last_trained ?? null;
          const isNewer = newLastTrained && newLastTrained !== snapshotTime;
          if (isNewer) {
            clearInterval(pollRef.current!);
            setLastTrained(newLastTrained);
            setPhase("done");
            toast.success("SARIMA models retrained! All dashboards now reflect your dataset.", { duration: 6000 });
            // Notify every open dashboard page to refetch from the new model
            window.dispatchEvent(new CustomEvent("ml-trained", { detail: { last_trained: newLastTrained } }));
            // Auto-reset to idle after 6 s so they can upload again
            setTimeout(() => setPhase("idle"), 6000);
          }
        }
      } catch {
        // Transient network error — keep polling
      }
    }, 3000);
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase("uploading");
    setTrainError(null);
    const snapshot = lastTrained;         // remember the pre-upload timestamp
    setTrainedFile(file.name);

    try {
      const data = await uploadDataset(file);

      if (!data.success) {
        const errorMsg = data.error || "Upload failed.";
        setPhase("error");
        setTrainError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // File saved — SARIMA training now running in background
      setPhase("training");
      setFile(null);
      const inp = document.getElementById("dataset-upload") as HTMLInputElement;
      if (inp) inp.value = "";
      startPolling(snapshot);
    } catch {
      setPhase("error");
      setTrainError("Could not reach the ML service.");
      toast.error("Could not reach the ML service.");
    }
  };

  const trainingBusy = phase === "uploading" || phase === "training";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account, preferences, and ML engine configurations.</p>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="space-y-6">

          {/* Account Profile */}
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-white mb-6">
              <User className="w-5 h-5 text-brand-400" />
              Account Profile
            </h2>
            <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="w-16 h-16 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                <User className="w-8 h-8 text-brand-400" />
              </div>
              <div>
                <h3 className="text-white font-medium text-lg">
                  {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin User"}
                </h3>
                <p className="text-slate-400 text-sm">{currentUser?.email ?? "admin@bikesense.ai"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Superadmin Privileges</span>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10">
              <button onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors font-medium text-sm">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
              <p className="text-xs text-slate-500 mt-2">This will end your current session and return you to the login page.</p>
            </div>
          </motion.section>

          {/* ML Engine Config */}
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-white mb-6">
              <Database className="w-5 h-5 text-brand-400" />
              SARIMA Engine Configuration
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-medium text-sm">Peak Demand Surge Ceiling</h4>
                    <p className="text-xs text-slate-400 mt-1">Maximum surge multiplier allowed during rush hours.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.05" min="1.0" max="3.0" value={peakSurge}
                      onChange={e => setPeakSurge(Number(e.target.value))}
                      className="w-20 bg-dark-800 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-brand-500 text-right" />
                    <span className="text-slate-400 text-sm font-medium">x</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-white font-medium text-sm">Event / Festival Multiplier</h4>
                    <p className="text-xs text-slate-400 mt-1">Global multiplier applied during known events (e.g. Diwali).</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.05" min="1.0" max="5.0" value={eventMultiplier}
                      onChange={e => setEventMultiplier(Number(e.target.value))}
                      className="w-20 bg-dark-800 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-brand-500 text-right" />
                    <span className="text-slate-400 text-sm font-medium">x</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={saveSettings} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors">
                Save ML Settings
              </button>
            </div>
          </motion.section>

          {/* Custom Dataset Upload */}
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-white mb-2">
              <UploadCloud className="w-5 h-5 text-brand-400" />
              Custom Dataset Upload
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Upload your own <span className="text-white font-medium">bike_data.csv</span> — the SARIMA models retrain on it and every dashboard page (Pricing, Fleet, Forecasting, Analytics) updates automatically.
            </p>

            {/* ── Training Progress Banner ── */}
            <AnimatePresence>
              {phase === "training" && (
                <motion.div key="training"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="mb-5 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 text-brand-400 animate-spin shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-white">Retraining SARIMA Models…</div>
                      <div className="text-xs text-slate-400 mt-0.5">Training on <span className="text-brand-300">{trainedFile}</span> — this takes 30–90 seconds</div>
                    </div>
                  </div>
                  {/* Animated progress steps */}
                  <div className="space-y-1.5 pl-8">
                    {["Loading & parsing dataset", "Building hourly / daily / monthly time series", "Fitting short-term SARIMA (hourly)", "Fitting medium-term SARIMA (daily)", "Fitting long-term SARIMA (monthly)", "Caching forecast series"].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500/50 shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-brand-400/70 mt-3 pl-8">The dashboard will refresh automatically when training completes.</p>
                </motion.div>
              )}

              {phase === "done" && (
                <motion.div key="done"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">Training Complete!</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      All SARIMA models have been retrained on <span className="text-emerald-300">{trainedFile}</span>.
                      Navigate to any dashboard page to see updated analysis.
                    </div>
                  </div>
                </motion.div>
              )}

              {phase === "error" && (
                <motion.div key="error"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">Training Failed</div>
                    <div className="text-xs text-red-300 mt-0.5">{trainError}</div>
                    <button onClick={() => setPhase("idle")}
                      className="mt-2 text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                      <RefreshCw className="w-3 h-3" /> Try again
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── File picker + Upload button ── */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-full sm:w-auto flex-1">
                <input id="dataset-upload" type="file" accept=".csv"
                  disabled={trainingBusy}
                  onChange={e => { setPhase("idle"); setFile(e.target.files?.[0] || null); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed transition-colors ${
                  trainingBusy   ? "border-white/10 bg-white/3 opacity-50"
                  : file          ? "border-brand-500 bg-brand-500/10"
                  :                 "border-white/20 bg-dark-800 hover:border-brand-500/50"
                }`}>
                  <FileText className={`w-5 h-5 ${file ? "text-brand-400" : "text-slate-500"}`} />
                  <span className={`text-sm font-medium truncate ${file ? "text-brand-300" : "text-slate-400"}`}>
                    {phase === "training"
                      ? `Training on ${trainedFile}…`
                      : file ? file.name : "Select CSV Dataset…"}
                  </span>
                </div>
              </div>

              <button onClick={handleUpload} disabled={!file || trainingBusy}
                className={`px-5 py-3 rounded-lg font-medium text-sm flex items-center justify-center min-w-[150px] transition-all ${
                  !file || trainingBusy ? "bg-white/5 text-slate-500 cursor-not-allowed" : "btn-primary"
                }`}>
                {phase === "uploading" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                  </span>
                ) : phase === "training" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Training…
                  </span>
                ) : "Upload & Train"}
              </button>
            </div>

            {/* Last trained timestamp */}
            {lastTrained && phase === "idle" && (
              <p className="text-xs text-slate-600 mt-3">
                Last trained: {new Date(lastTrained).toLocaleString()}
              </p>
            )}
          </motion.section>

        </div>
      </div>
    </div>
  );
}
