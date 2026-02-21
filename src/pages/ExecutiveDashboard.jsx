import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Download, FileText } from 'lucide-react';

export default function ExecutiveDashboard({ selectedClient }) {
  const [exportType, setExportType] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['snapshots', selectedClient?.id],
    queryFn: () => selectedClient 
      ? base44.entities.AnalyticsSnapshot.filter({ client_id: selectedClient.id, period_type: 'daily' }, '-snapshot_date', 30)
      : Promise.resolve([]),
    enabled: !!selectedClient
  });

  const handleExport = async (type) => {
    if (!selectedClient) return;
    setExporting(true);

    try {
      const response = type === 'pdf'
        ? await base44.functions.invoke('exportDashboardPDF', { client_id: selectedClient.id })
        : await base44.functions.invoke('exportDashboardCSV', {
            client_id: selectedClient.id,
            data_type: exportType || 'tasks'
          });

      if (response.data?.success) {
        const blob = new Blob(
          [response.data.csv || response.data.content],
          { type: type === 'pdf' ? 'application/pdf' : 'text/csv' }
        );
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  if (!selectedClient) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-[#3E4C59]">
          <p>Selecciona un cliente para ver el dashboard ejecutivo</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <div className="text-center py-8">Cargando...</div>;

  const latest = snapshots?.[0];
  const previous = snapshots?.[7];

  const lineData = snapshots?.slice(0, 30).reverse().map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    completion: (s.kpis.task_completion_rate * 100).toFixed(1),
    quality: (s.kpis.quality_score * 100).toFixed(1),
    billable: (s.kpis.billable_ratio * 100).toFixed(1)
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-[#33A19A]" />
            Executive Dashboard
          </h1>
          <p className="text-[#3E4C59] mt-1">{selectedClient.name}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]"
          >
            <Download className="w-4 h-4" />
            PDF Ejecutivo
          </Button>
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Exportar CSV..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tasks">Tasks CSV</SelectItem>
              <SelectItem value="time">Horas CSV</SelectItem>
              <SelectItem value="deliveries">Entregas CSV</SelectItem>
              <SelectItem value="meetings">Reuniones CSV</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => handleExport('csv')}
            disabled={exporting || !exportType}
            variant="outline"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {latest && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tasa Finalización</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#33A19A]">
                {(latest.kpis.task_completion_rate * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-[#3E4C59] mt-1">
                {latest.metrics.tasks_closed}/{latest.metrics.total_tasks} tareas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Calidad Promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#33A19A]">
                {(latest.kpis.quality_score * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-[#3E4C59] mt-1">Score QA</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ratio Facturable</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#33A19A]">
                {(latest.kpis.billable_ratio * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-[#3E4C59] mt-1">
                {latest.metrics.billable_hours.toFixed(1)}h de {latest.metrics.total_hours.toFixed(1)}h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Entregas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#33A19A]">
                {latest.metrics.deliveries_completed}
              </div>
              <p className="text-xs text-[#3E4C59] mt-1">
                {latest.metrics.deliveries_failed} fallidas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">En Plazo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#33A19A]">
                {(latest.kpis.ontime_delivery_rate * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-[#3E4C59] mt-1">Entregas puntuales</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trends Chart */}
      {lineData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendencias (30 días)</CardTitle>
            <CardDescription>Evolución de métricas clave</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7CAC9/30" />
                <XAxis dataKey="date" stroke="#3E4C59" />
                <YAxis stroke="#3E4C59" />
                <Tooltip contentStyle={{ backgroundColor: '#FFFAF3', border: '1px solid #B7CAC9' }} />
                <Legend />
                <Line type="monotone" dataKey="completion" stroke="#33A19A" dot={false} name="Finalización %" />
                <Line type="monotone" dataKey="quality" stroke="#2A857F" dot={false} name="Calidad %" />
                <Line type="monotone" dataKey="billable" stroke="#B7CAC9" dot={false} name="Facturable %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Comparison */}
      {previous && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativa Semanal</CardTitle>
            <CardDescription>Esta semana vs hace 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Finalización', current: latest.kpis.task_completion_rate, prev: previous.kpis.task_completion_rate, format: 'pct' },
                { label: 'Calidad', current: latest.kpis.quality_score, prev: previous.kpis.quality_score, format: 'pct' },
                { label: 'Billable Ratio', current: latest.kpis.billable_ratio, prev: previous.kpis.billable_ratio, format: 'pct' }
              ].map(item => {
                const change = ((item.current - item.prev) / item.prev) * 100;
                const isUp = change > 0;
                return (
                  <div key={item.label} className="flex items-center justify-between p-2 bg-[#FFFAF3] rounded">
                    <span className="text-sm font-medium">{item.label}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1B2731]">
                        {item.format === 'pct' ? `${(item.current * 100).toFixed(1)}%` : item.current}
                      </p>
                      <Badge variant="outline" className={isUp ? 'bg-green-50' : 'bg-red-50'}>
                        {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}