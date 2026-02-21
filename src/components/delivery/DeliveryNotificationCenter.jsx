import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info, Trash2, Bell } from 'lucide-react';

export default function DeliveryNotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const user = await base44.auth.me();
      const notifs = await base44.entities.Notification.filter(
        { user_email: user.email, is_read: false },
        '-created_date',
        50
      );
      setNotifications(notifs);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    await base44.entities.Notification.update(notificationId, { is_read: true });
    setNotifications(notifications.filter(n => n.id !== notificationId));
  };

  const handleClearAll = async () => {
    for (const notif of notifications) {
      await base44.entities.Notification.update(notif.id, { is_read: true });
    }
    setNotifications([]);
  };

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'delivery') return n.type?.includes('delivery');
    if (filter === 'error') return n.type?.includes('error') || n.type?.includes('failed');
    return true;
  });

  const getIcon = (type) => {
    if (type?.includes('success')) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (type?.includes('error') || type?.includes('failed')) return <AlertCircle className="w-4 h-4 text-red-600" />;
    return <Info className="w-4 h-4 text-blue-600" />;
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#33A19A]" />
            Centro de Notificaciones
          </CardTitle>
          <CardDescription>Alertas del pipeline de entregas</CardDescription>
        </div>
        {notifications.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleClearAll}>
            Marcar todo como leído
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {['all', 'delivery', 'error'].map(f => (
            <Badge
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilter(f)}
            >
              {f === 'all' && 'Todas'}
              {f === 'delivery' && 'Entregas'}
              {f === 'error' && 'Errores'}
            </Badge>
          ))}
        </div>

        {/* Notifications List */}
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[#3E4C59]">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin notificaciones</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map(notif => (
              <div
                key={notif.id}
                className="flex items-start gap-3 p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30 hover:border-[#33A19A]/50 transition-all"
              >
                {getIcon(notif.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[#1B2731]">{notif.title}</p>
                  <p className="text-xs text-[#3E4C59] mt-1">{notif.message}</p>
                  <p className="text-xs text-[#B7CAC9] mt-2">
                    {new Date(notif.created_date).toLocaleString('es-ES')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMarkAsRead(notif.id)}
                  className="text-[#B7CAC9] hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}