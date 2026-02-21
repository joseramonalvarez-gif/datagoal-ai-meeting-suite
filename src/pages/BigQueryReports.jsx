import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, RefreshCw, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function BigQueryReports({ selectedClient, user }) {
  const [clientId, setClientId] = useState(selectedClient?.id);
  const [dateRange, setDateRange] = useState('30days');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const dateRanges = {
    '7days': { label: 'Últimos 7 días', days: 7 },
    '30days': { label: 'Últimos 30 días', days: 30 },
    '90days': { label: 'Últimos 90 días', days: 90 },
    'year': { label: 'Último año', days: 365 }
  };

  const generateReport = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      const range = dateRanges[dateRange];
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(new Date().setDate(new Date().getDate() - range.days)).toISOString().split('T')[0];

      const response = await base44.functions.invoke('generateClientBigQueryReport', {
        client_id: clientId,
        start_date: startDate,
        end_date: endDate
      });

      setReportData(response.data.summary);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      generateReport();
    }
  }, [clientId, dateRange]);

  if (!clientId && clients && clients.length > 0) {
    setClientId(clients[0].id);
  }

  const currentClient = clients?.find(c => c.id === clientId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2731] font-heading">Reportes BigQuery</h1>
          <p className="text-[#3E4C59] mt-2">Análisis de datos del cliente con BigQuery</p>
        </div>
        <Button
          onClick={generateReport}
          disabled={loading || !clientId}
          className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]"
        >
          <RefreshCw className="w-4 h-4" />
          {loading ? 'Generando...' : 'Actualizar'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium text-[#1B2731] block mb-2">Cliente</label>
          <Select value={clientId || ''} onValueChange={setClientId}>
            <SelectTrigger className="border-[#B7CAC9]/40">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-[#1B2731] block mb-2">Período</label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="border-[#B7CAC9]/40">
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(dateRanges).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white border-[#B7CAC9]/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-[#3E4C59]">Reuniones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#33A19A]">{reportData.meetings}</div>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#B7CAC9]/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-[#3E4C59]">Tareas Completadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#33A19A]">{reportData.completed_tasks}/{reportData.total_tasks}</div>
                <p className="text-xs text-[#B7CAC9] mt-1">{reportData.task_completion_rate}% completitud</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#B7CAC9]/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-[#3E4C59]">Horas Facturables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#33A19A]">{reportData.total_billable_hours.toFixed(1)}h</div>
                <p className="text-xs text-[#B7CAC9] mt-1">Total: {reportData.total_hours_tracked.toFixed(1)}h</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#B7CAC9]/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-[#3E4C59]">Calidad Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#33A19A]">{reportData.avg_quality_score}%</div>
                <p className="text-xs text-[#B7CAC9] mt-1">{reportData.completed_deliveries} entregas</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          {reportData.bigquery_metrics && reportData.bigquery_metrics.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-white border-[#B7CAC9]/30">
                <CardHeader>
                  <CardTitle className="text-[#1B2731]">Horas por Día</CardTitle>
                  <CardDescription>Horas totales y facturables</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reportData.bigquery_metrics}>
                      <CartesianGrid stroke="#E8F5F4" />
                      <XAxis dataKey="date" stroke="#3E4C59" />
                      <YAxis stroke="#3E4C59" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#FFFAF3', border: '1px solid #B7CAC9' }}
                        labelStyle={{ color: '#1B2731' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="total_hours" stroke="#33A19A" name="Total" />
                      <Line type="monotone" dataKey="billable_hours" stroke="#2A857F" name="Facturables" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#B7CAC9]/30">
                <CardHeader>
                  <CardTitle className="text-[#1B2731]">Registros por Día</CardTitle>
                  <CardDescription>Actividades completadas vs fallidas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reportData.bigquery_metrics}>
                      <CartesianGrid stroke="#E8F5F4" />
                      <XAxis dataKey="date" stroke="#3E4C59" />
                      <YAxis stroke="#3E4C59" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#FFFAF3', border: '1px solid #B7CAC9' }}
                        labelStyle={{ color: '#1B2731' }}
                      />
                      <Legend />
                      <Bar dataKey="completed" fill="#33A19A" name="Completadas" />
                      <Bar dataKey="failed" fill="#E53E3E" name="Fallidas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Projects and Deliveries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white border-[#B7CAC9]/30">
              <CardHeader>
                <CardTitle className="text-[#1B2731]">Proyectos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-[#33A19A]">{reportData.projects}</div>
                <p className="text-sm text-[#B7CAC9] mt-2">Proyectos activos del cliente</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#B7CAC9]/30">
              <CardHeader>
                <CardTitle className="text-[#1B2731]">Entregas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-[#33A19A]">{reportData.completed_deliveries}/{reportData.deliveries}</div>
                <p className="text-sm text-[#B7CAC9] mt-2">Entregas completadas</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}