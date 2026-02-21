import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';

export default function DeliveryActivityLog() {
  const [filter, setFilter] = useState('all');
  const [days, setDays] = useState(7);

  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveryActivity', days],
    queryFn: async () => {
      const all = await base44.entities.DeliveryRun.filter({}, '-created_date', 500);
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - days);
      return all.filter(d => new Date(d.created_date) > threshold);
    }
  });

  const { data: automationRuns = [] } = useQuery({
    queryKey: ['automationActivity', days],
    queryFn: async () => {
      const all = await base44.entities.AutomationRun.filter({}, '-executed_at', 500);
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - days);
      return all.filter(a => new Date(a.executed_at) > threshold);
    }
  });

  const activities = [
    ...deliveries.map(d => ({
      type: 'delivery',
      id: d.id,
      title: `Entrega: ${d.id.substring(0, 12)}`,
      status: d.status,
      timestamp: d.created_date,
      quality: d.quality_score,
      time_ms: d.total_time_ms
    })),
    ...automationRuns.map(a => ({
      type: 'automation',
      id: a.id,
      title: `Automatización: ${a.automation_type}`,
      status: a.status,
      timestamp: a.executed_at,
      actions: a.actions_executed?.length || 0
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const filtered = activities.filter(a => {
    if (filter === 'all') return true;
    return a.type === filter;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
      case 'delivered':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'running':
      case 'partial':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeIcon = (type) => {
    return type === 'delivery' ? '📋' : '⚙️';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
          <Activity className="w-8 h-8 text-[#33A19A]" />
          Registro de Actividad
        </h1>
        <p className="text-[#3E4C59] mt-1">Historial de entregas y automatizaciones</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>Últimas operaciones del sistema</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="delivery">Entregas</SelectItem>
                  <SelectItem value="automation">Automatizaciones</SelectItem>
                </SelectContent>
              </Select>

              <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Último día</SelectItem>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-[#3E4C59]">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin actividad</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filtered.map((activity, idx) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30 hover:border-[#33A19A]/50 transition-all"
                >
                  <div className="text-lg mt-1">{getTypeIcon(activity.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(activity.status)}
                      <span className="font-medium text-sm text-[#1B2731]">{activity.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-[#3E4C59]">
                      <span>
                        {new Date(activity.timestamp).toLocaleString('es-ES')}
                      </span>

                      {activity.quality !== undefined && (
                        <span className="text-[#33A19A] font-semibold">
                          Calidad: {(activity.quality * 100).toFixed(0)}%
                        </span>
                      )}

                      {activity.time_ms !== undefined && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(activity.time_ms / 1000).toFixed(1)}s
                        </span>
                      )}

                      {activity.actions !== undefined && (
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {activity.actions} acciones
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#1B2731]">{filtered.length}</div>
            <p className="text-xs text-[#3E4C59]">Total de actividades</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {filtered.filter(a => a.status === 'success' || a.status === 'delivered').length}
            </div>
            <p className="text-xs text-[#3E4C59]">Exitosas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">
              {filtered.filter(a => a.status === 'failed').length}
            </div>
            <p className="text-xs text-[#3E4C59]">Fallidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {filtered.filter(a => a.status === 'running').length}
            </div>
            <p className="text-xs text-[#3E4C59]">En proceso</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}