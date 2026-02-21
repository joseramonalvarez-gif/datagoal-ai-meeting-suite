import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';

export default function DeliveryAnalytics() {
  const [dateRange, setDateRange] = useState('7days');

  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => base44.entities.DeliveryRun.filter({}, '-created_date', 500)
  });

  // Filter deliveries by date range
  const getDateThreshold = () => {
    const now = new Date();
    const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 1;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  };

  const filteredDeliveries = deliveries.filter(d => 
    new Date(d.created_date) > getDateThreshold()
  );

  // Calculate metrics
  const metrics = {
    total: filteredDeliveries.length,
    successful: filteredDeliveries.filter(d => d.status === 'delivered' || d.status === 'success').length,
    failed: filteredDeliveries.filter(d => d.status === 'failed').length,
    pending: filteredDeliveries.filter(d => d.status === 'running' || d.status === 'review_pending').length,
    avgQuality: filteredDeliveries.length > 0 
      ? (filteredDeliveries.reduce((sum, d) => sum + (d.quality_score || 0), 0) / filteredDeliveries.length * 100).toFixed(1)
      : 0,
    avgTime: filteredDeliveries.length > 0
      ? Math.round(filteredDeliveries.reduce((sum, d) => sum + (d.total_time_ms || 0), 0) / filteredDeliveries.length / 1000)
      : 0
  };

  // Prepare chart data - daily breakdown
  const dailyData = {};
  filteredDeliveries.forEach(d => {
    const date = new Date(d.created_date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    if (!dailyData[date]) {
      dailyData[date] = { date, total: 0, success: 0, failed: 0, quality: 0, count: 0 };
    }
    dailyData[date].total++;
    if (d.status === 'delivered' || d.status === 'success') dailyData[date].success++;
    if (d.status === 'failed') dailyData[date].failed++;
    dailyData[date].quality += d.quality_score || 0;
    dailyData[date].count++;
  });

  const chartData = Object.values(dailyData).map(d => ({
    ...d,
    quality: Math.round((d.quality / d.count) * 100)
  }));

  // Quality score distribution
  const qualityBuckets = {
    excellent: filteredDeliveries.filter(d => (d.quality_score || 0) >= 0.9).length,
    good: filteredDeliveries.filter(d => (d.quality_score || 0) >= 0.75 && (d.quality_score || 0) < 0.9).length,
    fair: filteredDeliveries.filter(d => (d.quality_score || 0) >= 0.5 && (d.quality_score || 0) < 0.75).length,
    poor: filteredDeliveries.filter(d => (d.quality_score || 0) < 0.5).length
  };

  const successRate = metrics.total > 0 
    ? ((metrics.successful / metrics.total) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2731] font-heading">Analytics de Entregas</h1>
          <p className="text-[#3E4C59] mt-1">Métricas y tendencias de ejecución</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1day">Últimas 24h</SelectItem>
            <SelectItem value="7days">Últimos 7 días</SelectItem>
            <SelectItem value="30days">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#33A19A]">{metrics.total}</div>
              <p className="text-xs text-[#3E4C59] mt-1">Total</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{metrics.successful}</div>
              <p className="text-xs text-[#3E4C59] mt-1">Exitosas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{metrics.failed}</div>
              <p className="text-xs text-[#3E4C59] mt-1">Fallidas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{metrics.pending}</div>
              <p className="text-xs text-[#3E4C59] mt-1">Pendientes</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#33A19A]">{successRate}%</div>
              <p className="text-xs text-[#3E4C59] mt-1">Éxito</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{metrics.avgQuality}%</div>
              <p className="text-xs text-[#3E4C59] mt-1">Calidad Prom.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entregas por Día</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7CAC9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFAF3', borderColor: '#B7CAC9' }} />
                <Legend />
                <Bar dataKey="success" stackId="status" fill="#10b981" name="Exitosas" />
                <Bar dataKey="failed" stackId="status" fill="#ef4444" name="Fallidas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quality Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calidad por Día</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#B7CAC9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFAF3', borderColor: '#B7CAC9' }} />
                <Legend />
                <Line type="monotone" dataKey="quality" stroke="#33A19A" name="Calidad %" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quality Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribución de Calidad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{qualityBuckets.excellent}</div>
              <p className="text-xs text-green-700 mt-1">Excelente (90%+)</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{qualityBuckets.good}</div>
              <p className="text-xs text-blue-700 mt-1">Bueno (75-89%)</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{qualityBuckets.fair}</div>
              <p className="text-xs text-yellow-700 mt-1">Regular (50-74%)</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">{qualityBuckets.poor}</div>
              <p className="text-xs text-red-700 mt-1">Bajo (&lt;50%)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entregas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredDeliveries.slice(0, 10).map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-[#FFFAF3] rounded-lg border border-[#B7CAC9]/30">
                <div className="flex-1">
                  <p className="text-sm font-medium">{d.id.substring(0, 12)}</p>
                  <p className="text-xs text-[#3E4C59]">{new Date(d.created_date).toLocaleString('es-ES')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {d.quality_score && (
                    <span className="text-xs font-semibold text-[#33A19A]">
                      {(d.quality_score * 100).toFixed(0)}%
                    </span>
                  )}
                  <Badge className={
                    d.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    d.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }>
                    {d.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}