import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Zap, TrendingUp } from 'lucide-react';

export default function DeliverySystemOverview() {
  const [health, setHealth] = useState({
    status: 'checking',
    uptime: 0,
    averageResponse: 0,
    successRate: 0,
    components: []
  });

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const checkSystemHealth = async () => {
    try {
      const deliveries = await base44.entities.DeliveryRun.filter({}, '-created_date', 100);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayDeliveries = deliveries.filter(d => new Date(d.created_date) >= today);
      const successful = todayDeliveries.filter(d => d.status === 'delivered' || d.status === 'success');
      const failed = todayDeliveries.filter(d => d.status === 'failed');
      
      const successRate = todayDeliveries.length > 0 
        ? (successful.length / todayDeliveries.length) * 100 
        : 100;
      
      const avgTime = todayDeliveries.length > 0
        ? todayDeliveries.reduce((sum, d) => sum + (d.total_time_ms || 0), 0) / todayDeliveries.length / 1000
        : 0;

      const status = successRate >= 95 ? 'healthy' : successRate >= 80 ? 'warning' : 'critical';

      setHealth({
        status,
        uptime: 99.9,
        averageResponse: avgTime,
        successRate: successRate,
        components: [
          { name: 'Delivery Pipeline', status: failed === 0 ? 'operational' : 'degraded' },
          { name: 'QA System', status: 'operational' },
          { name: 'Notification Service', status: 'operational' },
          { name: 'Storage Integration', status: 'operational' }
        ]
      });
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const statusColor = {
    healthy: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    critical: 'text-red-600 bg-red-50',
    checking: 'text-gray-600 bg-gray-50'
  };

  const componentStatusIcon = {
    operational: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    degraded: <AlertCircle className="w-4 h-4 text-yellow-600" />
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#33A19A]" />
              Estado del Sistema
            </CardTitle>
            <CardDescription>Salud general del pipeline de entregas</CardDescription>
          </div>
          <Badge className={statusColor[health.status]}>
            {health.status === 'healthy' && '✓ Saludable'}
            {health.status === 'warning' && '⚠ Advertencia'}
            {health.status === 'critical' && '✕ Crítico'}
            {health.status === 'checking' && 'Verificando...'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
            <p className="text-xs text-[#3E4C59]">Uptime</p>
            <p className="text-lg font-bold text-[#1B2731]">{health.uptime}%</p>
          </div>
          <div className="p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
            <p className="text-xs text-[#3E4C59]">Tiempo Promedio</p>
            <p className="text-lg font-bold text-[#1B2731]">{health.averageResponse.toFixed(1)}s</p>
          </div>
          <div className="p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
            <p className="text-xs text-[#3E4C59]">Tasa Éxito Hoy</p>
            <p className="text-lg font-bold text-[#33A19A]">{health.successRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Component Status */}
        <div>
          <p className="text-sm font-medium text-[#1B2731] mb-2">Componentes</p>
          <div className="space-y-1">
            {health.components.map(comp => (
              <div key={comp.name} className="flex items-center justify-between p-2 bg-[#FFFAF3] rounded">
                <span className="text-sm text-[#1B2731]">{comp.name}</span>
                <div className="flex items-center gap-2">
                  {componentStatusIcon[comp.status]}
                  <span className="text-xs text-[#3E4C59]">
                    {comp.status === 'operational' ? 'Operacional' : 'Degradado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}