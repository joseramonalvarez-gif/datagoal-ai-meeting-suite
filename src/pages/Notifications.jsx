import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, CheckSquare, Users, FileText, Flag, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_CONFIG = {
  task_assigned: { icon: CheckSquare, color: "bg-blue-50 text-blue-700" },
  task_due_soon: { icon: CheckSquare, color: "bg-amber-50 text-amber-700" },
  task_overdue: { icon: CheckSquare, color: "bg-red-50 text-red-700" },
  mention: { icon: MessageSquare, color: "bg-purple-50 text-purple-700" },
  approval_requested: { icon: FileText, color: "bg-[#33A19A]/10 text-[#33A19A]" },
  approval_decision: { icon: FileText, color: "bg-green-50 text-green-700" },
  milestone_completed: { icon: Flag, color: "bg-amber-50 text-amber-700" },
  report_generated: { icon: FileText, color: "bg-[#1B2731]/10 text-[#1B2731]" },
  meeting_scheduled: { icon: Users, color: "bg-blue-50 text-blue-700" },
};

export default function Notifications({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => { loadNotifications(); }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.email) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.data?.user_email === user.email && event.type === "create") {
        setNotifications(prev => [event.data, ...prev]);
      }
    });
    return unsubscribe;
  }, [user]);

  const loadNotifications = async () => {
    if (!user?.email) return;
    setLoading(true);
    const data = await base44.entities.Notification.filter({ user_email: user.email }, '-created_date', 100);
    setNotifications(data);
    setLoading(false);
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const filtered = filter === "unread" ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Notificaciones</h1>
          <p className="text-sm text-[#3E4C59] mt-1">
            {notifications.filter(n => !n.is_read).length} sin leer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilter(filter === "all" ? "unread" : "all")} className="text-xs">
            {filter === "all" ? "Ver no leídas" : "Ver todas"}
          </Button>
          {notifications.some(n => !n.is_read) && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs gap-1">
              <CheckCheck className="w-3 h-3" /> Marcar todas leídas
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(notif => {
            const cfg = TYPE_CONFIG[notif.type] || { icon: Bell, color: "bg-gray-100 text-gray-600" };
            const Icon = cfg.icon;
            return (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markRead(notif.id)}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer
                  ${notif.is_read
                    ? 'bg-white border-[#B7CAC9]/20 opacity-70'
                    : 'bg-white border-[#33A19A]/30 shadow-sm hover:shadow-md'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-sm font-semibold ${notif.is_read ? 'text-[#3E4C59]' : 'text-[#1B2731]'}`}>{notif.title}</h4>
                    {!notif.is_read && <div className="w-2 h-2 rounded-full bg-[#33A19A] flex-shrink-0" />}
                  </div>
                  {notif.message && <p className="text-xs text-[#3E4C59] mt-0.5">{notif.message}</p>}
                  <p className="text-[10px] text-[#B7CAC9] mt-1">
                    {notif.created_date ? format(new Date(notif.created_date), "dd MMM yyyy, HH:mm", { locale: es }) : ""}
                  </p>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#B7CAC9]">
              <Bell className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm">{filter === "unread" ? "No hay notificaciones sin leer" : "Sin notificaciones"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}