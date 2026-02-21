import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Zap, TrendingUp } from 'lucide-react';

export default function DeliveryLiveMonitor() {
  const [runningDeliveries, setRunningDeliveries] = useState([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, rate: 0 });

  useEffect(() => {
    loadData();
    const unsubscribe = base44.entities.DeliveryRun.subscribe((event) => {
      if (event.type === 'update' && (event.data.status === 'running' || event.data.status === 'success' || event.data.status === 'failed')) {
        loadData();
      }
    });

    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deliveries = await base44.entities.DeliveryRun.filter({}, '-created_date', 100);
    const todayDeliveries = deliveries.filter(d => new Date(d.created_date) >= today);

    const running = todayDeliveries.filter(d => d.status === 'running');
    setRunningDeliveries(running);

    const successful = todayDeliveries.filter(d => d.status === 'delivered' || d.status === 'success');
    const failed = todayDeliveries.filter(d => d.status === 'failed');
    const successRate = todayDeliveries.length > 0 ? (successful.length / todayDeliveries.length) * 100 : 0;

    setStats({
      total: todayDeliveries.length,
      success: successful.length,
      failed: failed.length,
      rate: successRate
    });
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#33A19A] animate-pulse" />
          Monitor en Vivo
        </CardTitle>
        <CardDescription>Estado actual del pipeline de entregas</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Live Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
            <div className="text-sm text-[#3E4C59]">Hoy</div>
            <div className="text-2xl font-bold text-[#1B2731]">{stats.total}</div>
          </div>
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <div className="text-sm text-green-600">Exitosas</div>
            <div className="text-2xl font-bold text-green-700">{stats.success}</div>
          </div>
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <div className="text-sm text-red-600">Fallidas</div>
            <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
          </div>
          <div className="p-3 bg-[#E8F5F4] rounded border border-[#33A19A]/30">
            <div className="text-sm text-[#2A857F]">Tasa Éxito</div>
            <div className="text-2xl font-bold text-[#33A19A]">{stats.rate.toFixed(0)}%</div>
          </div>
        </div>

        {/* Success Rate Progress */}
        <div>
          <label className="text-sm font-medium text-[#1B2731]">Tasa de éxito del día</label>
          <Progress value={stats.rate} className="mt-2 h-2" />
        </div>

        {/* Running Deliveries */}
        {runningDeliveries.length > 0 && (
          <div className="space-y-2 p-3 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
              <Zap className="w-4 h-4 animate-spin" />
              {runningDeliveries.length} Entrega{runningDeliveries.length !== 1 ? 's' : ''} en proceso
            </div>
            <div className="space-y-1 text-xs text-blue-700">
              {runningDeliveries.slice(0, 3).map(d => (
                <div key={d.id} className="flex items-center justify-between p-1 bg-white rounded">
                  <span className="truncate">{d.id.substring(0, 16)}...</span>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round((d.total_time_ms || 0) / 1000)}s
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {runningDeliveries.length === 0 && stats.total === 0 && (
          <div className="text-center py-6 text-[#3E4C59]">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin actividad hoy</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}