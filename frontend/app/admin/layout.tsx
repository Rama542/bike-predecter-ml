"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, TrendingUp, DollarSign, Bike, Users,
  FileBarChart2, Settings, Menu, X, ChevronRight,
  Zap, User, LogOut, Shield, Database
} from "lucide-react";
import { getUser, signOut as authSignOut, type AuthUser } from "@/lib/auth";


const DEVELOPER_EMAILS = [
  "thiruveedhula.sriram2007@gmail.com",
  "ramasasankgudipati@gmail.com"
];

const navItems = [
  { href:"/admin/dashboard",   label:"Dashboard",         icon:LayoutDashboard },
  { href:"/admin/forecasting", label:"Forecasting",       icon:TrendingUp },
  { href:"/admin/pricing",     label:"Pricing Engine",    icon:DollarSign },
  { href:"/admin/fleet",       label:"Fleet",             icon:Bike },
  { href:"/admin/analytics",   label:"Customer Analytics",icon:Users },
  { href:"/admin/reports",     label:"Reports",           icon:FileBarChart2 },
  { href:"/admin/dataset",     label:"Dataset & Training",icon:Database },
  { href:"/admin/settings",    label:"Settings",          icon:Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [lastTrained, setLastTrained] = useState("just now");

  // ── Auth guard ──────────────────────────────────────────────────
  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/consumer/home");
      return;
    }
    setCurrentUser(user);
  }, [router]);

  const handleSignOut = () => {
    authSignOut();
    router.push("/auth/login");
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const req = await fetch("/api/ml/admin/system-status");
        const res = await req.json();
        if (res.success && res.last_trained) {
          const trainedTime = new Date(res.last_trained).getTime();
          const now = Date.now();
          const diffMins = Math.floor((now - trainedTime) / 60000);
          
          if (diffMins < 1) setLastTrained("just now");
          else if (diffMins < 60) setLastTrained(`${diffMins}m ago`);
          else setLastTrained(`${Math.floor(diffMins / 60)}h ago`);
        }
      } catch (err) {
        console.error("Failed to fetch system status", err);
      }
    };
    fetchStatus();
    // Refresh the status periodically
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const Sidebar = ({ mobile=false }) => (
    <div className={`h-full flex flex-col ${mobile?"":"overflow-hidden"}`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${collapsed&&!mobile?"justify-center":""}`}>
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
          <Bike className="w-4 h-4 text-white" />
        </div>
        {(!collapsed || mobile) && (
          <div>
            <span className="font-display font-bold text-white text-sm">Bike<span className="text-brand-400">Sense</span></span>
            <div className="text-xs text-slate-500">Admin Console</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map(item => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-item ${active?"active":""} ${collapsed&&!mobile?"justify-center px-2":""}`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {(!collapsed || mobile) && <span>{item.label}</span>}
              {(!collapsed || mobile) && active && <ChevronRight className="w-3 h-3 ml-auto text-brand-400" />}
            </Link>
          );
        })}
        {/* Developer Only Route */}
        {currentUser && DEVELOPER_EMAILS.some(e => e.toLowerCase() === currentUser.email.toLowerCase()) && (
          <Link href="/admin/users"
            onClick={() => setMobileOpen(false)}
            className={`sidebar-item ${pathname === "/admin/users" ? "active" : ""} ${collapsed && !mobile ? "justify-center px-2" : ""}`}>
            <Shield className="w-4 h-4 shrink-0 text-amber-400" />
            {(!collapsed || mobile) && <span className="text-amber-400/90 font-medium">User Management</span>}
            {(!collapsed || mobile) && pathname === "/admin/users" && <ChevronRight className="w-3 h-3 ml-auto text-amber-400" />}
          </Link>
        )}
      </nav>

      {/* Bottom */}
      {(!collapsed || mobile) && (
        <div className="p-4 border-t border-white/5">
          <div className="glass-light rounded-xl p-3 text-xs text-slate-500">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3 h-3 text-brand-400" />
              <span className="text-brand-400 font-medium">SARIMA Models Active</span>
            </div>
            <div>3 models running · Last trained {lastTrained}</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      {/* Desktop Sidebar */}
      <motion.aside animate={{width: collapsed ? 64 : 240}}
        className="hidden lg:flex flex-col glass border-r border-white/5 relative z-10 shrink-0">
        <Sidebar />
        <button onClick={()=>setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 glass rounded-full flex items-center justify-center border border-white/10 hover:border-brand-500/30 transition-colors">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <X className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={()=>setMobileOpen(false)} />
            <motion.aside initial={{x:-280}} animate={{x:0}} exit={{x:-280}} transition={{type:"spring",damping:25}}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 glass z-50">
              <Sidebar mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="glass border-b border-white/5 px-6 h-14 flex items-center gap-4 shrink-0">
          <button onClick={()=>setMobileOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Spacer to replace removed search bar */}
          <div className="flex-1"></div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 glass-light rounded-lg px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
                <User className="w-3 h-3 text-brand-400" />
              </div>
              <span className="text-xs text-slate-300 hidden sm:inline">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Admin"}
              </span>
            </div>
            <button onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-2 text-sm">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
