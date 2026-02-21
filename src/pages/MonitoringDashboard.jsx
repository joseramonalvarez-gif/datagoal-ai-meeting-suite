import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Activity, Plus, Settings, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const SEVERITY_STYLES = {
  critical: { color: 'bg-red-50 text-red-700 border-red-200', icon: '🔴' },
  high: { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '🟠' },
  medium: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '🟡' },
  low: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🔵' }
};

export default function MonitoringDashboard() {
  const [notifications, setNotifications] = useState([]);
  const [automationStats, setAutomationStats] = useState(null);
  const [alertRules, setAlertRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [notifs, rules, runs] = await Promise.all([
        base44.entities.Notification.filter({ is_read: false }, '-created_date', 20),
        base44.entities.AlertRule.filter({ is_active: true }),
        base44.entities.AutomationRun.list('-executed_at', 100)
      ]);

      setNotifications(notifs);
      setAlertRules(rules);

      // Calculate stats
      const stats = {
        total_runs: runs.length,
        success: runs.filter(r => r.status === 'success').length,
        failed: runs.filter(r => r.status === 'failed').length,
        running: runs.filter(r => r.status === 'running').length,
        success_rate: runs.length > 0 ? Math.round((runs.filter(r => r.status === 'success').length / runs.length) * 100) : 0
      };
      setAutomationStats(stats);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('checkAutomationAlerts', {});
      await loadData();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAsRead = async (notifId) => {
    await base44.entities.Notification.update(notifId, { is_read: true });
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#1B2731]">Monitoreo en Tiempo Real</h1>
          <p className="text-sm text-[#3E4C59] mt-2">Estado de automatizaciones, alertas y salud del sistema</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      {/* Stats Cards */}
      {automationStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Ejecutadas', value: automationStats.total_runs, icon: Activity, color: 'text-blue-600' },
            { label: 'Exitosas', value: automationStats.success, icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Fallidas', value: automationStats.failed, icon: AlertCircle, color: 'text-red-600' },
            { label: 'En Ejecución', value: automationStats.running, icon: Clock, color: 'text-amber-600' },
            { label: 'Tasa Éxito', value: `${automationStats.success_rate}%`, icon: TrendingUp, color: 'text-[#33A19A]' }
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border-[#B7CAC9]/20">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-bold ${color} mt-1`}>{value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${color}/30`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="alerts" className="bg-white rounded-xl border border-[#B7CAC9]/20">
        <TabsList className="w-full border-b border-[#B7CAC9]/20 bg-transparent p-0 h-auto">
          <TabsTrigger value="alerts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#33A19A] px-6 py-3">
            <AlertCircle className="w-4 h-4 mr-2" />
            Alertas Activas ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="rules" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#33A19A] px-6 py-3">
            <Settings className="w-4 h-4 mr-2" />
            Reglas ({alertRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="p-6 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
              <p className="text-[#3E4C59]">✨ Todo está bajo control</p>
              <p className="text-sm text-[#B7CAC9] mt-1">No hay alertas activas</p>
            </div>
          ) : (
            notifications.map(notif => {
              const style = SEVERITY_STYLES[notif.severity] || SEVERITY_STYLES.medium;
              return (
                <Card key={notif.id} className={`border-l-4 border-current ${style.color}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{style.icon}</span>
                          <h3 className="font-semibold text-[#1B2731]">{notif.title}</h3>
                          <Badge className={`ml-auto text-xs border-0 capitalize`}>
                            {notif.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#3E4C59]">{notif.message}</p>
                        <p className="text-xs text-[#B7CAC9] mt-2">
                          {format(new Date(notif.created_date), 'HH:mm:ss', { locale: es })}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-xs flex-shrink-0"
                      >
                        Marcar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="rules" className="p-6 space-y-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#3E4C59]">{alertRules.length} reglas configuradas</p>
            <Button size="sm" className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]">
              <Plus className="w-4 h-4" />
              Nueva Regla
            </Button>
          </div>

          {alertRules.length === 0 ? (
            <Card className="border-dashed border-2 border-[#B7CAC9]/30">
              <CardContent className="py-8 text-center">
                <Settings className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
                <p className="text-[#3E4C59]">Sin reglas configuradas</p>
                <p className="text-sm text-[#B7CAC9] mt-1">Crea reglas para monitorear eventos críticos</p>
              </CardContent>
            </Card>
          ) : (
            alertRules.map(rule => (
              <Card key={rule.id} className="border-[#B7CAC9]/20 hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#1B2731]">{rule.name}</h3>
                        <Badge className="text-xs bg-[#33A19A]/10 text-[#33A19A] border-0">
                          {rule.alert_type.replace('_', ' ')}
                        </Badge>
                        {rule.trigger_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Disparada {rule.trigger_count}x
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[#3E4C59]">{rule.description}</p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        <Badge className="text-xs bg-[#FFFAF3] text-[#3E4C59] border border-[#B7CAC9]/20">
                          Severidad: {rule.severity}
                        </Badge>
                        <Badge className="text-xs bg-[#FFFAF3] text-[#3E4C59] border border-[#B7CAC9]/20">
                          Cada {rule.check_interval_minutes} min
                        </Badge>
                        {rule.last_triggered && (
                          <Badge className="text-xs bg-amber-50 text-amber-700 border border-amber-200">
                            Última: {format(new Date(rule.last_triggered), 'HH:mm', { locale: es })}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs flex-shrink-0">
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}