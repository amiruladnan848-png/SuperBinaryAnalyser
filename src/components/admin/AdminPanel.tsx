import React, { useState, useEffect, useCallback } from "react";
import {
  Users, ShieldCheck, ShieldX, RefreshCw, ChevronDown, ChevronUp,
  Crown, ToggleLeft, ToggleRight, Hash, Loader2, Search, LogOut,
  Megaphone, Plus, Trash2, Eye, EyeOff, Lock, AlertTriangle,
  CheckCircle, Info, Bell, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth.tsx";
import { toast } from "sonner";

// ── Admin PIN ──────────────────────────────────────────────────────────────────
const ADMIN_PIN = "909098";
const ADMIN_PIN_KEY = "sba_admin_pin_unlocked";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  created_at: string;
  access: {
    id: string;
    is_allowed: boolean;
    signal_limit: number;
    signals_used_today: number;
    last_reset_date: string;
    notes: string | null;
  } | null;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "danger";
  is_active: boolean;
  created_at: string;
}

interface AdminPanelProps {
  themeColor: string;
  isDark: boolean;
}

// ── PIN Lock Screen ────────────────────────────────────────────────────────────
const AdminPinLock: React.FC<{ themeColor: string; isDark: boolean; onUnlock: () => void }> = ({ themeColor, isDark, onUnlock }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 6) {
      if (next === ADMIN_PIN) {
        sessionStorage.setItem(ADMIN_PIN_KEY, "1");
        onUnlock();
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => { setPin(""); setShake(false); }, 600);
      }
    }
  };
  const handleBack = () => setPin(p => p.slice(0, -1));

  const digits = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center border mb-5"
        style={{ background: `${themeColor}15`, borderColor: `${themeColor}40` }}>
        <Lock size={24} style={{ color: themeColor }} />
      </div>
      <h2 className={`text-xl font-black ${tb} mb-1`}>Admin Panel Locked</h2>
      <p className={`text-sm ${ts} mb-8 text-center`}>Enter the 6-digit admin PIN to access controls</p>

      {/* PIN dots */}
      <div className={`flex gap-3 mb-6 transition-all ${shake ? "animate-bounce" : ""}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-4 h-4 rounded-full border-2 transition-all duration-200"
            style={{
              borderColor: error ? "#ff4466" : i < pin.length ? themeColor : isDark ? "#374151" : "#d1d5db",
              background: i < pin.length ? (error ? "#ff446640" : `${themeColor}40`) : "transparent",
              boxShadow: i < pin.length && !error ? `0 0 8px ${themeColor}60` : "none",
            }} />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
          <AlertTriangle size={14} /> Wrong PIN. Try again.
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[220px]">
        {digits.map((d, i) => (
          <button key={i}
            onClick={() => d === "⌫" ? handleBack() : d !== "" ? handleDigit(d) : undefined}
            disabled={d === ""}
            className={`h-14 rounded-xl font-bold text-lg transition-all duration-150 active:scale-90 ${d === "" ? "invisible" : ""}`}
            style={d !== "" ? {
              background: d === "⌫" ? (isDark ? "#1f2937" : "#f3f4f6") : isDark ? "#111827" : "#f9fafb",
              border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
              color: d === "⌫" ? "#9ca3af" : isDark ? "#e5e7eb" : "#1f2937",
            } : {}}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Main Admin Panel ──────────────────────────────────────────────────────────
const AdminPanel: React.FC<AdminPanelProps> = ({ themeColor, isDark }) => {
  const { logout } = useAuth();
  const [pinUnlocked, setPinUnlocked] = useState(() => sessionStorage.getItem(ADMIN_PIN_KEY) === "1");
  const [activeTab, setActiveTab] = useState<"users" | "announcements">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [editLimits, setEditLimits] = useState<Record<string, number>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // New announcement form
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newType, setNewType] = useState<Announcement["type"]>("info");
  const [addingAnn, setAddingAnn] = useState(false);

  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const border = isDark ? "border-gray-800/50" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const inputCls = isDark ? "bg-gray-900/60 border-gray-700/50 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-800";

  // ── Fetch Users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesErr } = await supabase
        .from("user_profiles")
        .select("id, email, username, created_at")
        .order("created_at", { ascending: false });

      if (profilesErr) throw profilesErr;

      const { data: accessData } = await supabase.from("user_access").select("*");
      const accessMap: Record<string, AdminUser["access"]> = {};
      (accessData || []).forEach((a: any) => { accessMap[a.user_id] = a; });

      const combined: AdminUser[] = (profiles || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        username: p.username || p.email?.split("@")[0] || "unknown",
        created_at: p.created_at,
        access: accessMap[p.id] || null,
      }));

      setUsers(combined);
      const limits: Record<string, number> = {};
      combined.forEach(u => { limits[u.id] = u.access?.signal_limit ?? 10; });
      setEditLimits(limits);
    } catch (err: any) {
      toast.error(`Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch Announcements ────────────────────────────────────────────────────
  const fetchAnnouncements = useCallback(async () => {
    setAnnouncementLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      toast.error(`Failed to load announcements: ${err.message}`);
    } finally {
      setAnnouncementLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pinUnlocked) {
      fetchUsers();
      fetchAnnouncements();
    }
  }, [pinUnlocked, fetchUsers, fetchAnnouncements]);

  // ── User Access Controls ──────────────────────────────────────────────────
  const toggleAccess = async (user: AdminUser) => {
    setSaving(user.id);
    const newAllowed = !(user.access?.is_allowed ?? false);
    try {
      if (user.access) {
        const { error } = await supabase.from("user_access").update({ is_allowed: newAllowed, updated_at: new Date().toISOString() }).eq("id", user.access.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_access").insert({ user_id: user.id, is_allowed: newAllowed, signal_limit: editLimits[user.id] ?? 10 });
        if (error) throw error;
      }
      toast.success(`${user.email} access ${newAllowed ? "granted ✅" : "revoked ❌"}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const updateLimit = async (user: AdminUser, limit: number) => {
    if (limit < 1 || limit > 1000) { toast.error("Limit must be 1–1000"); return; }
    setSaving(user.id);
    try {
      if (user.access) {
        const { error } = await supabase.from("user_access").update({ signal_limit: limit, updated_at: new Date().toISOString() }).eq("id", user.access.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_access").insert({ user_id: user.id, is_allowed: false, signal_limit: limit });
        if (error) throw error;
      }
      toast.success(`Signal limit updated to ${limit}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const updateNotes = async (user: AdminUser, notes: string) => {
    if (!user.access) return;
    await supabase.from("user_access").update({ notes, updated_at: new Date().toISOString() }).eq("id", user.access.id);
  };

  // ── Announcement Controls ─────────────────────────────────────────────────
  const createAnnouncement = async () => {
    if (!newTitle.trim() || !newMessage.trim()) { toast.error("Title and message are required"); return; }
    setAddingAnn(true);
    try {
      const { error } = await supabase.from("announcements").insert({
        title: newTitle.trim(),
        message: newMessage.trim(),
        type: newType,
        is_active: true,
      });
      if (error) throw error;
      toast.success("📢 Announcement broadcast live!");
      setNewTitle(""); setNewMessage(""); setNewType("info");
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingAnn(false);
    }
  };

  const toggleAnnouncementActive = async (ann: Announcement) => {
    const { error } = await supabase.from("announcements").update({ is_active: !ann.is_active, updated_at: new Date().toISOString() }).eq("id", ann.id);
    if (error) { toast.error(error.message); return; }
    toast.success(ann.is_active ? "Announcement hidden" : "Announcement shown");
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement deleted");
    fetchAnnouncements();
  };

  const annTypeConfig = {
    info: { color: "#00d4ff", icon: Info, label: "Info" },
    warning: { color: "#FFD700", icon: AlertTriangle, label: "Warning" },
    success: { color: "#00ff88", icon: CheckCircle, label: "Success" },
    danger: { color: "#ff4466", icon: AlertTriangle, label: "Alert" },
  };

  // ── PIN Locked ─────────────────────────────────────────────────────────────
  if (!pinUnlocked) {
    return <AdminPinLock themeColor={themeColor} isDark={isDark} onUnlock={() => setPinUnlocked(true)} />;
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );
  const totalAllowed = users.filter(u => u.access?.is_allowed).length;
  const totalBlocked = users.length - totalAllowed;
  const activeAnnouncements = announcements.filter(a => a.is_active).length;

  return (
    <div className="space-y-4">
      {/* Admin Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
            style={{ background: `${themeColor}15`, borderColor: `${themeColor}40` }}>
            <Crown size={18} style={{ color: themeColor }} />
          </div>
          <div>
            <h2 className={`text-lg font-black ${tb}`}>Admin Control Panel</h2>
            <p className={`text-[11px] ${ts}`}>{users.length} users • {activeAnnouncements} live broadcasts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchUsers(); fetchAnnouncements(); }}
            className={`p-2 rounded-lg border transition-all hover:scale-105 ${isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { sessionStorage.removeItem(ADMIN_PIN_KEY); setPinUnlocked(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-yellow-700/40 bg-yellow-950/20 text-yellow-400 text-xs font-medium hover:bg-yellow-950/30 transition-all">
            <Lock size={13} /> Lock Panel
          </button>
          <button onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-700/40 bg-red-950/20 text-red-400 text-xs font-medium hover:bg-red-950/30 transition-all">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, color: themeColor, icon: Users },
          { label: "Allowed", value: totalAllowed, color: "#00d084", icon: ShieldCheck },
          { label: "Blocked", value: totalBlocked, color: "#ff4466", icon: ShieldX },
          { label: "Live Broadcasts", value: activeAnnouncements, color: "#FFD700", icon: Megaphone },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className={`p-3 rounded-xl border ${border} ${bg} backdrop-blur-xl`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={13} style={{ color }} />
              <span className={`text-[10px] ${ts}`}>{label}</span>
            </div>
            <p className="text-2xl font-black" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border" style={{ background: isDark ? "#0a0a0a80" : "#f9fafb", borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
        <button onClick={() => setActiveTab("users")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
          style={activeTab === "users" ? { background: `${themeColor}18`, color: themeColor, boxShadow: `0 0 12px ${themeColor}15` } : { color: isDark ? "#6b7280" : "#9ca3af" }}>
          <Users size={13} /> Users ({users.length})
        </button>
        <button onClick={() => setActiveTab("announcements")}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
          style={activeTab === "announcements" ? { background: "#FFD70018", color: "#FFD700", boxShadow: "0 0 12px #FFD70015" } : { color: isDark ? "#6b7280" : "#9ca3af" }}>
          <Megaphone size={13} /> Broadcast {activeAnnouncements > 0 && <span className="bg-yellow-500 text-black text-[9px] px-1.5 rounded-full font-black">{activeAnnouncements}</span>}
        </button>
      </div>

      {/* ── USERS TAB ────────────────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <>
          <div className="relative">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ts}`} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by email or username..."
              className={`w-full ${inputCls} border rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-700/50 transition-all`}
            />
          </div>

          <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb", background: isDark ? "#0a0a0a50" : "#f9fafb80" }}>
              <Users size={14} style={{ color: themeColor }} />
              <span className={`text-sm font-bold ${tb}`}>Registered Users</span>
              <span className={`text-xs ${ts} ml-auto`}>{filtered.length} shown</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin" style={{ color: themeColor }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users size={32} className="mx-auto mb-3 opacity-20" style={{ color: themeColor }} />
                <p className={`text-sm ${ts}`}>{search ? "No users match your search" : "No users registered yet"}</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
                {filtered.map(user => {
                  const isAllowed = user.access?.is_allowed ?? false;
                  const isSaving = saving === user.id;
                  const isExpanded = expandedUser === user.id;
                  const usedToday = user.access?.signals_used_today ?? 0;
                  const limit = user.access?.signal_limit ?? 10;
                  const editLimit = editLimits[user.id] ?? limit;

                  return (
                    <div key={user.id} className="transition-all">
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border font-bold text-sm"
                          style={{ background: `${isAllowed ? "#00d084" : "#ff4466"}15`, borderColor: `${isAllowed ? "#00d084" : "#ff4466"}40`, color: isAllowed ? "#00d084" : "#ff4466" }}>
                          {(user.username?.[0] || user.email?.[0] || "U").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-bold ${tb} truncate`}>{user.email}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold flex-shrink-0 ${isAllowed ? "text-emerald-400 border-emerald-700/40 bg-emerald-950/20" : "text-red-400 border-red-700/40 bg-red-950/20"}`}>
                              {isAllowed ? "ALLOWED" : "BLOCKED"}
                            </span>
                          </div>
                          <p className={`text-[10px] ${ts} truncate`}>
                            @{user.username} • {usedToday}/{limit} signals today • Joined {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => toggleAccess(user)}
                            disabled={isSaving}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
                            style={isAllowed
                              ? { borderColor: "#ff446640", background: "#ff446612", color: "#ff4466" }
                              : { borderColor: `${themeColor}40`, background: `${themeColor}12`, color: themeColor }}>
                            {isSaving ? <Loader2 size={11} className="animate-spin" /> : isAllowed ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            {isAllowed ? "Block" : "Allow"}
                          </button>
                          <button
                            onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                            className={`p-1.5 rounded-lg border transition-all hover:scale-105 ${isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500 hover:text-gray-300" : "border-gray-200 bg-gray-50 text-gray-400 hover:text-gray-600"}`}>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className={`px-4 pb-4 pt-1 border-t space-y-3 ${isDark ? "border-gray-800/30 bg-gray-900/10" : "border-gray-100 bg-gray-50/50"}`}>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Hash size={12} style={{ color: themeColor }} />
                              <span className={`text-[11px] font-semibold ${ts}`}>Daily Signal Limit</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="number" min={1} max={1000} value={editLimit}
                                onChange={e => setEditLimits(prev => ({ ...prev, [user.id]: parseInt(e.target.value) || 10 }))}
                                className={`w-24 ${inputCls} border rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-700/50 transition-all`}
                              />
                              <button
                                onClick={() => updateLimit(user, editLimit)}
                                disabled={isSaving || editLimit === limit}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-black disabled:opacity-50 transition-all hover:scale-105"
                                style={{ background: themeColor }}>
                                {isSaving ? "..." : "Save"}
                              </button>
                              <div className={`text-[10px] ${ts}`}>Used: <span style={{ color: usedToday >= limit ? "#ff4466" : themeColor }}>{usedToday}</span>/{limit}</div>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "#1f2937" : "#e5e7eb" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (usedToday / Math.max(limit, 1)) * 100)}%`, background: usedToday >= limit ? "#ff4466" : themeColor }} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] ${ts} flex-shrink-0`}>Admin notes:</span>
                            <input
                              type="text" defaultValue={user.access?.notes || ""}
                              onBlur={e => updateNotes(user, e.target.value)}
                              placeholder="Optional notes about this user..."
                              className={`flex-1 ${inputCls} border rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-700/50 transition-all`}
                            />
                          </div>
                          <div className={`text-[10px] ${ts}`}>User ID: <span className="font-mono">{user.id}</span></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ANNOUNCEMENTS TAB ─────────────────────────────────────────────── */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          {/* Create Announcement */}
          <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb", background: isDark ? "#0a0a0a50" : "#f9fafb80" }}>
              <Plus size={14} className="text-yellow-400" />
              <span className={`text-sm font-bold ${tb}`}>New Broadcast Announcement</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Type selector */}
              <div className="flex gap-2">
                {(Object.entries(annTypeConfig) as [Announcement["type"], typeof annTypeConfig.info][]).map(([type, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button key={type} onClick={() => setNewType(type)}
                      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all hover:scale-[1.03]"
                      style={newType === type
                        ? { background: `${cfg.color}18`, borderColor: `${cfg.color}50`, color: cfg.color }
                        : { background: isDark ? "#111827" : "#f9fafb", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#6b7280" : "#9ca3af" }}>
                      <Icon size={13} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className={`text-xs ${ts} font-medium`}>Announcement Title</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. System Maintenance Tonight"
                  className={`w-full ${inputCls} border rounded-xl px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-700/50 transition-all`}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-xs ${ts} font-medium`}>Message</label>
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Write your announcement message here..."
                  rows={3}
                  className={`w-full ${inputCls} border rounded-xl px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-700/50 transition-all resize-none`}
                />
              </div>

              <button
                onClick={createAnnouncement}
                disabled={addingAnn || !newTitle.trim() || !newMessage.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-black transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{ background: "#FFD700", boxShadow: addingAnn ? "none" : "0 4px 20px #FFD70040" }}>
                {addingAnn ? <Loader2 size={15} className="animate-spin text-black" /> : <><Megaphone size={15} /> Broadcast Now</>}
              </button>
            </div>
          </div>

          {/* Announcements List */}
          <div className={`rounded-2xl border ${border} ${bg} backdrop-blur-xl overflow-hidden`}>
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb", background: isDark ? "#0a0a0a50" : "#f9fafb80" }}>
              <Bell size={14} className="text-yellow-400" />
              <span className={`text-sm font-bold ${tb}`}>All Announcements</span>
              <span className={`text-xs ${ts} ml-auto`}>{announcements.length} total</span>
            </div>

            {announcementLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-yellow-400" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-10">
                <Megaphone size={28} className="mx-auto mb-3 opacity-20 text-yellow-400" />
                <p className={`text-sm ${ts}`}>No announcements yet. Create your first broadcast above.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
                {announcements.map(ann => {
                  const cfg = annTypeConfig[ann.type] || annTypeConfig.info;
                  const Icon = cfg.icon;
                  return (
                    <div key={ann.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}>
                        <Icon size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-bold ${tb}`}>{ann.title}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${ann.is_active ? "text-emerald-400 border-emerald-700/40 bg-emerald-950/20" : "text-gray-500 border-gray-700/40 bg-gray-900/20"}`}>
                            {ann.is_active ? "LIVE" : "HIDDEN"}
                          </span>
                        </div>
                        <p className={`text-xs ${ts} mt-0.5 line-clamp-2`}>{ann.message}</p>
                        <p className={`text-[10px] ${ts} mt-1`}>{new Date(ann.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => toggleAnnouncementActive(ann)}
                          className={`p-1.5 rounded-lg border transition-all hover:scale-105 ${ann.is_active ? "border-emerald-700/40 bg-emerald-950/20 text-emerald-400" : isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500" : "border-gray-200 bg-gray-50 text-gray-400"}`}
                          title={ann.is_active ? "Hide" : "Show"}>
                          {ann.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-1.5 rounded-lg border border-red-700/40 bg-red-950/20 text-red-400 transition-all hover:scale-105 hover:bg-red-950/40"
                          title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <p className={`text-[10px] text-center ${ts}`}>
        ⚡ Admin Panel • info.amirulhoque@gmail.com • Full Control
      </p>
    </div>
  );
};

export default AdminPanel;
