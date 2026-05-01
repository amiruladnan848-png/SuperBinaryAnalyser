import React, { useState, useEffect, useCallback } from "react";
import { Users, ShieldCheck, ShieldX, Settings2, RefreshCw, ChevronDown, ChevronUp, Crown, ToggleLeft, ToggleRight, Hash, Loader2, Search, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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

interface AdminPanelProps {
  themeColor: string;
  isDark: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ themeColor, isDark }) => {
  const { logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [editLimits, setEditLimits] = useState<Record<string, number>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const tb = isDark ? "text-gray-200" : "text-gray-800";
  const ts = isDark ? "text-gray-500" : "text-gray-500";
  const border = isDark ? "border-gray-800/50" : "border-gray-200";
  const bg = isDark ? "bg-black/50" : "bg-white/80";
  const inputCls = isDark ? "bg-gray-900/60 border-gray-700/50 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-800";

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all user_profiles
      const { data: profiles, error: profilesErr } = await supabase
        .from("user_profiles")
        .select("id, email, username, created_at")
        .order("created_at", { ascending: false });

      if (profilesErr) throw profilesErr;

      // Fetch all access records (admin can see all via RLS policy)
      const { data: accessData } = await supabase
        .from("user_access")
        .select("*");

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

      // Init edit limits
      const limits: Record<string, number> = {};
      combined.forEach(u => { limits[u.id] = u.access?.signal_limit ?? 10; });
      setEditLimits(limits);
    } catch (err: any) {
      toast.error(`Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const totalAllowed = users.filter(u => u.access?.is_allowed).length;
  const totalBlocked = users.length - totalAllowed;

  return (
    <div className="space-y-4">
      {/* Admin Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ background: `${themeColor}15`, borderColor: `${themeColor}40` }}>
            <Crown size={18} style={{ color: themeColor }} />
          </div>
          <div>
            <h2 className={`text-lg font-black ${tb}`}>Admin Control Panel</h2>
            <p className={`text-[11px] ${ts}`}>{users.length} users • {totalAllowed} allowed • {totalBlocked} blocked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers} className={`p-2 rounded-lg border transition-all hover:scale-105 ${isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-700/40 bg-red-950/20 text-red-400 text-xs font-medium hover:bg-red-950/30 transition-all">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Users", value: users.length, color: themeColor, icon: Users },
          { label: "Allowed", value: totalAllowed, color: "#00d084", icon: ShieldCheck },
          { label: "Blocked", value: totalBlocked, color: "#ff4466", icon: ShieldX },
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

      {/* Search */}
      <div className={`relative`}>
        <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ts}`} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or username..."
          className={`w-full ${inputCls} border rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-700/50 transition-all`}
        />
      </div>

      {/* Users List */}
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
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border font-bold text-sm"
                      style={{ background: `${isAllowed ? "#00d084" : "#ff4466"}15`, borderColor: `${isAllowed ? "#00d084" : "#ff4466"}40`, color: isAllowed ? "#00d084" : "#ff4466" }}>
                      {(user.username?.[0] || user.email?.[0] || "U").toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${tb} truncate`}>{user.email}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold flex-shrink-0 ${isAllowed ? "text-emerald-400 border-emerald-700/40 bg-emerald-950/20" : "text-red-400 border-red-700/40 bg-red-950/20"}`}>
                          {isAllowed ? "ALLOWED" : "BLOCKED"}
                        </span>
                      </div>
                      <p className={`text-[10px] ${ts} truncate`}>
                        @{user.username} • {usedToday}/{limit} signals today • Joined {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => toggleAccess(user)}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 disabled:opacity-60"
                        style={isAllowed
                          ? { borderColor: "#ff446640", background: "#ff446612", color: "#ff4466" }
                          : { borderColor: `${themeColor}40`, background: `${themeColor}12`, color: themeColor }}
                      >
                        {isSaving ? <Loader2 size={11} className="animate-spin" /> : isAllowed ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                        {isAllowed ? "Block" : "Allow"}
                      </button>
                      <button
                        onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                        className={`p-1.5 rounded-lg border transition-all hover:scale-105 ${isDark ? "border-gray-800/40 bg-gray-900/20 text-gray-500 hover:text-gray-300" : "border-gray-200 bg-gray-50 text-gray-400 hover:text-gray-600"}`}
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded controls */}
                  {isExpanded && (
                    <div className={`px-4 pb-4 pt-1 border-t space-y-3 ${isDark ? "border-gray-800/30 bg-gray-900/10" : "border-gray-100 bg-gray-50/50"}`}>
                      {/* Signal Limit Control */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Hash size={12} style={{ color: themeColor }} />
                          <span className={`text-[11px] font-semibold ${ts}`}>Daily Signal Limit</span>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={editLimit}
                            onChange={e => setEditLimits(prev => ({ ...prev, [user.id]: parseInt(e.target.value) || 10 }))}
                            className={`w-24 ${inputCls} border rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-emerald-700/50 transition-all`}
                          />
                          <button
                            onClick={() => updateLimit(user, editLimit)}
                            disabled={isSaving || editLimit === limit}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-black disabled:opacity-50 transition-all hover:scale-105"
                            style={{ background: themeColor }}
                          >
                            {isSaving ? "..." : "Save"}
                          </button>
                          <div className={`text-[10px] ${ts}`}>Used today: <span style={{ color: usedToday >= limit ? "#ff4466" : themeColor }}>{usedToday}</span>/{limit}</div>
                        </div>
                      </div>

                      {/* Usage Progress */}
                      <div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "#1f2937" : "#e5e7eb" }}>
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${Math.min(100, (usedToday / Math.max(limit, 1)) * 100)}%`,
                            background: usedToday >= limit ? "#ff4466" : themeColor,
                          }} />
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] ${ts} flex-shrink-0`}>Admin notes:</span>
                        <input
                          type="text"
                          defaultValue={user.access?.notes || ""}
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

      <p className={`text-[10px] text-center ${ts}`}>
        ⚡ Admin Panel • Info.amirulhoque@gmail.com has full control
      </p>
    </div>
  );
};

export default AdminPanel;
