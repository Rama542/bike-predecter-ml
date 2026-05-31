"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, CheckCircle, AlertCircle,
  Loader2, RefreshCw, Database, Clock, Info, Table2,
} from "lucide-react";
import toast from "react-hot-toast";
import { uploadDataset } from "@/lib/api";

type TrainPhase = "idle" | "uploading" | "training" | "done" | "error";

export default function DatasetPage() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<TrainPhase>("idle");
  const [trainedFile, setTrainedFile] = useState<string>("");
  const [trainError, setTrainError] = useState<string | null>(null);
  const [lastTrained, setLastTrained] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/ml/admin/system-status");
        const json = await res.json();
        if (json.last_trained) setLastTrained(json.last_trained);
        if (json.is_training) setPhase("training");
      } catch {}
    };
    loadStatus();
  }, []);

  const startPolling = (snapshotTime: string | null) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/ml/admin/system-status");
        const json = await res.json();

        if (json.train_error) {
          clearInterval(pollRef.current!);
          setPhase("error");
          setTrainError(json.train_error);
          toast.error("Model training failed.");
          return;
        }

        if (!json.is_training) {
          const newLastTrained = json.last_trained ?? null;
          if (newLastTrained && newLastTrained !== snapshotTime) {
            clearInterval(pollRef.current!);
            setLastTrained(newLastTrained);
            setPhase("done");
            toast.success("SARIMA models retrained successfully!", { duration: 6000 });
            window.dispatchEvent(new CustomEvent("ml-trained", { detail: { last_trained: newLastTrained } }));
            setTimeout(() => setPhase("idle"), 6000);
          }
        }
      } catch {}
    }, 3000);
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase("uploading");
    setTrainError(null);
    const snapshot = lastTrained;
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

      setPhase("training");
      setFile(null);
      const inp = document.getElementById("dataset-file") as HTMLInputElement;
      if (inp) inp.value = "";
      startPolling(snapshot);
    } catch {
      setPhase("error");
      setTrainError("Could not reach the ML service.");
      toast.error("Could not reach the ML service.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (trainingBusy) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith(".csv")) {
      setFile(dropped);
      setPhase("idle");
    } else {
      toast.error("Only CSV files are accepted.");
    }
  };

  const trainingBusy = phase === "uploading" || phase === "training";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Dataset &amp; Training</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload a custom CSV dataset to retrain all three SARIMA forecasting models. Every dashboard will update automatically.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-brand-400 mb-3">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Last Trained</span>
          </div>
          <p className="text-white font-semibold text-sm">
            {lastTrained ? new Date(lastTrained).toLocaleString() : "Not yet trained"}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-brand-400 mb-3">
            <Database className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Model Status</span>
          </div>
          <p className={`font-semibold text-sm ${
            phase === "training" || phase === "uploading" ? "text-yellow-400" :
            phase === "done" ? "text-emerald-400" :
            phase === "error" ? "text-red-400" : "text-white"
          }`}>
            {phase === "training" ? "Training..." :
             phase === "uploading" ? "Uploading..." :
             phase === "done" ? "Up to date" :
             phase === "error" ? "Error — see below" : "Ready"}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-brand-400 mb-3">
            <Info className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Active Models</span>
          </div>
          <p className="text-white font-semibold text-sm">3 SARIMA Models</p>
          <p className="text-slate-500 text-xs mt-0.5">Hourly · Daily · Monthly</p>
        </motion.div>
      </div>

      {/* Upload section */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="glass rounded-xl p-6">
        <h2 className="text-lg font-display font-semibold text-white mb-1">Upload Dataset</h2>
        <p className="text-xs text-slate-500 mb-6">
          The ML service validates the file before saving. On success, SARIMA models retrain in the background — no page refresh needed.
        </p>

        {/* Status banners */}
        <AnimatePresence mode="wait">
          {phase === "training" && (
            <motion.div key="training"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="mb-5 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-brand-400 animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">Retraining SARIMA Models...</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Training on <span className="text-brand-300">{trainedFile}</span> — takes 30–90 seconds
                  </p>
                </div>
              </div>
              <p className="text-xs text-brand-400/70 mt-3 ml-8">
                All dashboards will refresh automatically when training completes.
              </p>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div key="done"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Training Complete</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  All models retrained on <span className="text-emerald-300">{trainedFile}</span>. Navigate to any dashboard to see updated forecasts.
                </p>
              </div>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div key="error"
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Upload Failed</p>
                <p className="text-xs text-red-300 mt-0.5">{trainError}</p>
                <button onClick={() => setPhase("idle")}
                  className="mt-2 text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Try again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag & drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); if (!trainingBusy) setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            trainingBusy
              ? "border-white/10 opacity-50 cursor-not-allowed"
              : isDragging
              ? "border-brand-400 bg-brand-500/10"
              : file
              ? "border-brand-500 bg-brand-500/5"
              : "border-white/15 hover:border-brand-500/50"
          }`}>
          <input
            id="dataset-file"
            type="file"
            accept=".csv"
            disabled={trainingBusy}
            onChange={e => { setFile(e.target.files?.[0] || null); setPhase("idle"); setTrainError(null); }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${file ? "bg-brand-500/20" : "bg-white/5"}`}>
              {file
                ? <FileText className="w-7 h-7 text-brand-400" />
                : <UploadCloud className="w-7 h-7 text-slate-500" />
              }
            </div>
            {file ? (
              <div>
                <p className="text-white font-medium text-sm">{file.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click to change file</p>
              </div>
            ) : (
              <div>
                <p className="text-slate-300 font-medium text-sm">Drag &amp; drop your CSV file here</p>
                <p className="text-slate-500 text-xs mt-0.5">or click to browse &mdash; .csv files only</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          {lastTrained && phase === "idle" && (
            <p className="text-xs text-slate-600">
              Last trained: {new Date(lastTrained).toLocaleString()}
            </p>
          )}
          <div className="ml-auto">
            <button
              onClick={handleUpload}
              disabled={!file || trainingBusy}
              className={`px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                !file || trainingBusy
                  ? "bg-white/5 text-slate-500 cursor-not-allowed"
                  : "btn-primary"
              }`}>
              {phase === "uploading" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : phase === "training" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Training...</>
              ) : (
                <><UploadCloud className="w-4 h-4" /> Upload &amp; Train</>
              )}
            </button>
          </div>
        </div>
      </motion.section>

      {/* CSV format guide */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass rounded-xl p-6">
        <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-white mb-5">
          <Table2 className="w-5 h-5 text-brand-400" />
          Required CSV Format
        </h2>
        <div className="space-y-3">
          <div className="p-4 bg-white/3 rounded-lg border border-white/5">
            <p className="text-slate-300 font-medium text-sm mb-2">Required columns</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              <div>
                <span className="text-brand-300 font-mono">datetime</span>
                {" "}or{" "}
                <span className="text-brand-300 font-mono">date</span> + <span className="text-brand-300 font-mono">hour</span>
              </div>
              <div>
                <span className="text-brand-300 font-mono">cnt</span>
                {" / "}
                <span className="text-brand-300 font-mono">rides</span>
                {" / "}
                <span className="text-brand-300 font-mono">demand</span>
                {" / "}
                <span className="text-brand-300 font-mono">trips</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white/3 rounded-lg border border-white/5">
            <p className="text-slate-300 font-medium text-sm mb-1">Minimum size</p>
            <p className="text-xs text-slate-400">
              At least <span className="text-white font-medium">48 rows</span> (2 days of hourly data)
            </p>
          </div>

          <div className="p-4 bg-white/3 rounded-lg border border-white/5">
            <p className="text-slate-300 font-medium text-sm mb-1">Optional enrichment columns</p>
            <p className="text-xs text-slate-400 font-mono">
              zone, area, bike_model, temp, hum, windspeed, weekend_flag, event_name
            </p>
            <p className="text-xs text-slate-500 mt-1">
              When a <span className="font-mono text-slate-400">zone</span> or <span className="font-mono text-slate-400">area</span> column is present, fleet and pricing dashboards will use those zone names automatically.
            </p>
          </div>

          <div className="p-4 bg-white/3 rounded-lg border border-white/5">
            <p className="text-slate-300 font-medium text-sm mb-2">Example header row</p>
            <code className="text-xs text-brand-300 font-mono break-all">
              datetime,cnt,zone,bike_model,temp,hum,windspeed,weekend_flag
            </code>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
