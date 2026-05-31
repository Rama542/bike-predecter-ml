"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Bike, Gift, BookOpen,
  User, Menu, X, ChevronRight, Zap, LogOut
} from "lucide-react";
import { getUser, signOut as authSignOut, type AuthUser } from "@/lib/auth";


const navItems = [
  { href:"/consumer/home",        label:"Home",           icon:Home },
  { href:"/consumer/marketplace", label:"Browse Bikes",   icon:Bike },
  { href:"/consumer/bookings",    label:"My Bookings",    icon:BookOpen },
  { href:"/consumer/predict",     label:"Price Predictor",icon:Zap },
  { href:"/consumer/loyalty",     label:"Rewards",        icon:Gift },
];

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();
  const router   = useRouter();

  // ── Auth guard ──────────────────────────────────────────────────
  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (user.role !== "consumer") {
      router.replace("/admin/dashboard");
      return;
    }
    setCurrentUser(user);
  }, [router]);

  const handleSignOut = () => {
    authSignOut();
    router.push("/auth/login");
  };


  const Sidebar = ({ mobile=false }) => (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
          <Bike className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-display font-bold text-white text-sm">Bike<span className="text-emerald-400">Sense</span></span>
          <div className="text-xs text-slate-500">Rider Dashboard</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href+"/");
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-item ${active?"bg-emerald-500/10 text-emerald-300 border-r-2 border-emerald-500":""}` }>
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-emerald-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Points display */}
      <div className="p-4 border-t border-white/5">
        <div className="glass-light rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Your Points</span>
            <Gift className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-xl font-display font-bold text-emerald-400">1,240 pts</div>
          <div className="text-xs text-slate-600">≈ 3 free rides</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 glass border-r border-white/5 shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={()=>setMobileOpen(false)} />
            <motion.aside initial={{x:-250}} animate={{x:0}} exit={{x:-250}} transition={{type:"spring",damping:25}}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 glass z-50">
              <Sidebar mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="glass border-b border-white/5 px-6 h-14 flex items-center gap-4 shrink-0">
          <button onClick={()=>setMobileOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1"></div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 glass-light rounded-lg px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <User className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-xs text-slate-300 hidden sm:inline">
                {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Rider"}
              </span>
            </div>
            <button onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-2 text-sm">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
