import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';

export default function PerformanceWidget() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const data = await base44.functions.invoke('generatePerformanceReport', { days: 7 });
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardContent className="pt-6 text-center text-[#3E4C59]">
          Cargando reportes...
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return null;
  }

  const dailyData = Object.entries(report.daily).map(([date, stats]) => ({
    date: date.substring(5),
    successRate: stats.successRate,
    total: stats.total,
    time: stats.avgTime
  }));

  return (
    <>
      {/* Summary Cards */}
      <div className="col-span-full grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#3E4C59]">Total Entregas</p>
                <p className="text-2xl font-bold text-[#1B2731] mt-2">{report.summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#3E4C59]">Tasa Éxito</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{report.summary.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#3E4C59]">Calidad Promedio</p>
                <p className="text-2xl font-bold text-[#33A19A] mt-2">{report.summary.avgQuality.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#3E4C59]">Tiempo Promedio</p>
                <p className="text-2xl font-bold text-[#1B2731] mt-2">{report.summary.avgTimeSeconds}s</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart */}
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Tasa de Éxito por Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#B7CAC9" />
              <XAxis dataKey="date" stroke="#3E4C59" />
              <YAxis stroke="#3E4C59" domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1B2731', border: '1px solid #33A19A', borderRadius: '6px' }}
                labelStyle={{ color: '#FFFAF3' }}
              />
              <Line type="monotone" dataKey="successRate" stroke="#33A19A" strokeWidth={2} dot={{ fill: '#33A19A' }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Volume Chart */}
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Volumen Diario</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#B7CAC9" />
              <XAxis dataKey="date" stroke="#3E4C59" />
              <YAxis stroke="#3E4C59" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1B2731', border: '1px solid #33A19A', borderRadius: '6px' }}
                labelStyle={{ color: '#FFFAF3' }}
              />
              <Bar dataKey="total" fill="#33A19A" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Templates */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-base">Desempeño por Template</CardTitle>
          <CardDescription>Métricas de cada template utilizado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(report.by_template).map(([name, stats]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
                <div className="flex-1">
                  <p className="font-medium text-sm text-[#1B2731]">{name}</p>
                  <p className="text-xs text-[#3E4C59]">
                    {stats.count} entregas • {stats.avgTime}s promedio
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {stats.successRate.toFixed(0)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}