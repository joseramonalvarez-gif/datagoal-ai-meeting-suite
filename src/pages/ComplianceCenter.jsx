import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Download, AlertCircle, Clock, Filter } from 'lucide-react';

export default function ComplianceCenter() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.asServiceRole.entities.AuditLog.filter({}, '-timestamp', 1000)
  });

  const exportMutation = useMutation({
    mutationFn: (params) => base44.functions.invoke('exportAuditTrail', params),
    onSuccess: (response) => {
      const blob = new Blob(
        [response.data.content],
        { type: exportFormat === 'csv' ? 'text/csv' : 'application/json' }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      setExporting(false);
    }
  });

  const handleExport = async () => {
    setExporting(true);
    await exportMutation.mutateAsync({
      date_from: dateFrom,
      date_to: dateTo,
      action_filter: actionFilter,
      format: exportFormat
    });
  };

  const criticalLogs = logs.filter(l => l.severity === 'critical' || l.alert_triggered);
  const byAction = {};
  logs.forEach(l => {
    byAction[l.action] = (byAction[l.action] || 0) + 1;
  });

  const filteredLogs = logs.filter(l => {
    if (dateFrom && new Date(l.timestamp) < new Date(dateFrom)) return false;
    if (dateTo && new Date(l.timestamp) > new Date(dateTo)) return false;
    if (actionFilter && !l.action.includes(actionFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
          <Shield className="w-8 h-8 text-[#33A19A]" />
          Centro de Compliance
        </h1>
        <p className="text-[#3E4C59] mt-1">Auditoría, trazabilidad y reportes de compliance</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="logs">Logs de Auditoría</TabsTrigger>
          <TabsTrigger value="alerts">Alertas Críticas</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total de Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#33A19A]">{logs.length}</div>
                <p className="text-xs text-[#3E4C59] mt-1">últimos 30 días</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Alertas Críticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{criticalLogs.length}</div>
                <p className="text-xs text-[#3E4C59] mt-1">requieren atención</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Actores Únicos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#33A19A]">
                  {new Set(logs.map(l => l.actor_email)).size}
                </div>
                <p className="text-xs text-[#3E4C59] mt-1">usuarios activos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Último Evento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium text-[#1B2731]">
                  {logs.length > 0
                    ? new Date(logs[0].timestamp).toLocaleTimeString('es-ES')
                    : '-'}
                </div>
                <p className="text-xs text-[#3E4C59] mt-1">hace {logs.length > 0 ? 'poco' : 'nunca'}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Acciones Más Frecuentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(byAction)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([action, count]) => (
                  <div key={action} className="flex items-center justify-between p-2 bg-[#FFFAF3] rounded">
                    <span className="text-sm font-medium">{action}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros y Exportación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-3">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="Desde"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="Hasta"
                />
                <Input
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  placeholder="Filtrar acción..."
                />
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.map((log) => (
              <Card key={log.id} className={log.alert_triggered ? 'border-red-300 bg-red-50' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#1B2731]">{log.action}</p>
                        {log.alert_triggered && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <Badge
                          variant="outline"
                          className={
                            log.severity === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {log.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-[#3E4C59] mt-1">
                        {log.actor_email} · {log.entity_type}/{log.entity_id}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-[#B7CAC9] mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleString('es-ES')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Critical Alerts */}
        <TabsContent value="alerts" className="space-y-4">
          {criticalLogs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-[#3E4C59]">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Sin alertas críticas</p>
              </CardContent>
            </Card>
          ) : (
            criticalLogs.map((log) => (
              <Card key={log.id} className="border-red-300 bg-red-50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {log.action}
                    </CardTitle>
                    <Badge className="bg-red-600 text-white">{log.severity}</Badge>
                  </div>
                  <CardDescription className="text-red-700">
                    {new Date(log.timestamp).toLocaleString('es-ES')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    <strong>Actor:</strong> {log.actor_email}
                  </p>
                  <p className="text-sm">
                    <strong>Entity:</strong> {log.entity_type}/{log.entity_id}
                  </p>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="text-sm p-2 bg-white rounded border border-red-200">
                      <strong>Cambios:</strong>
                      <pre className="text-xs mt-1 overflow-x-auto">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}