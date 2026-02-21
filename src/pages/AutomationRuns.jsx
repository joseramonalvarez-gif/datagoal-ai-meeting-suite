import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertCircle, Loader2, Zap, Clock, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_STYLES = {
  running: { icon: Loader2, color: 'text-amber-600', bg: 'bg-amber-50', label: 'En ejecución' },
  success: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', label: 'Exitosa' },
  partial: { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Parcial' },
  failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Fallida' }
};

const AUTOMATION_TYPES = {
  post_transcription: 'Post-transcripción',
  post_insights: 'Post-análisis',
  post_report: 'Post-informe',
  proposal_generation: 'Generación de propuesta',
  follow_up: 'Follow-up'
};

export default function AutomationRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);

  useEffect(() => {
    loadRuns();
    // Poll every 5 seconds
    const interval = setInterval(loadRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRuns = async () => {
    try {
      const data = await base44.entities.AutomationRun.list('-executed_at', 50);
      setRuns(data);
    } catch (err) {
      console.error('Error loading runs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (selectedRun) {
    const StyleInfo = STATUS_STYLES[selectedRun.status];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-[#3E4C59]">
          <button onClick={() => setSelectedRun(null)} className="hover:text-[#33A19A] transition-colors">
            Automatizaciones
          </button>
          <span>/</span>
          <span className="text-[#1B2731] font-medium">{AUTOMATION_TYPES[selectedRun.automation_type]}</span>
        </div>

        <Card className={`border-l-4 ${StyleInfo.color.replace('text-', 'border-')}`}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${StyleInfo.bg} flex items-center justify-center`}>
                  <StyleInfo.icon className={`w-6 h-6 ${StyleInfo.color}`} />
                </div>
                <div>
                  <CardTitle>{AUTOMATION_TYPES[selectedRun.automation_type]}</CardTitle>
                  <CardDescription>{selectedRun.summary}</CardDescription>
                </div>
              </div>
              <Badge className={`${StyleInfo.bg} ${StyleInfo.color} border-0`}>
                {StyleInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide">Tipo</p>
                <p className="text-sm text-[#1B2731]">{AUTOMATION_TYPES[selectedRun.automation_type]}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide">Evento</p>
                <p className="text-sm text-[#1B2731]">{selectedRun.trigger_event}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide">Ejecutado</p>
                <p className="text-sm text-[#1B2731]">
                  {selectedRun.executed_at ? format(new Date(selectedRun.executed_at), 'HH:mm:ss', { locale: es }) : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide">ID</p>
                <p className="text-xs font-mono text-[#B7CAC9]">{selectedRun.id.substring(0, 8)}...</p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="actions" className="border border-[#B7CAC9]/20 rounded-lg">
              <TabsList className="w-full border-b border-[#B7CAC9]/20 bg-transparent p-0 h-auto">
                <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#33A19A] px-4 py-3">
                  <Zap className="w-4 h-4 mr-2" />
                  Acciones ({selectedRun.actions_executed?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="results" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#33A19A] px-4 py-3">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Resultados
                </TabsTrigger>
              </TabsList>

              <TabsContent value="actions" className="p-4 space-y-2">
                {selectedRun.actions_executed?.length === 0 ? (
                  <p className="text-sm text-[#3E4C59] py-4">Sin acciones ejecutadas</p>
                ) : (
                  selectedRun.actions_executed.map((action, i) => {
                    const isSuccess = action.status === 'success';
                    return (
                      <div key={i} className={`p-3 rounded-lg border ${isSuccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start gap-2">
                          {isSuccess ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isSuccess ? 'text-green-900' : 'text-red-900'}`}>
                              {action.action_name}
                            </p>
                            {action.error && (
                              <p className="text-xs text-red-600 mt-1">{action.error}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="results" className="p-4 space-y-4">
                {[
                  { key: 'tasks_created', label: 'Tareas creadas', icon: CheckSquare },
                  { key: 'notifications_sent', label: 'Notificaciones', icon: Clock },
                  { key: 'follow_ups_created', label: 'Follow-ups', icon: Zap }
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-[#33A19A]" />
                      <p className="font-semibold text-sm text-[#1B2731]">{label}</p>
                      <Badge className="ml-auto bg-[#33A19A]/10 text-[#33A19A] border-0">
                        {(selectedRun[key]?.length || 0)}
                      </Badge>
                    </div>
                    {selectedRun[key]?.length === 0 ? (
                      <p className="text-xs text-[#3E4C59]">—</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedRun[key].map((id, i) => (
                          <code key={i} className="text-xs bg-[#FFFAF3] p-2 rounded block font-mono text-[#3E4C59]">
                            {id}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-[#1B2731]">Historial de Automatizaciones</h1>
        <p className="text-sm text-[#3E4C59] mt-2">
          Ejecutiones automáticas de workflows, post-transcripción y generación de activos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', count: runs.length, icon: Zap },
          { label: 'Exitosas', count: runs.filter(r => r.status === 'success').length, icon: CheckCircle2 },
          { label: 'En ejecución', count: runs.filter(r => r.status === 'running').length, icon: Loader2 },
          { label: 'Fallidas', count: runs.filter(r => r.status === 'failed').length, icon: AlertCircle }
        ].map(({ label, count, icon: Icon }) => (
          <Card key={label} className="border-[#B7CAC9]/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-[#1B2731] mt-1">{count}</p>
                </div>
                <Icon className="w-8 h-8 text-[#B7CAC9]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {runs.length === 0 ? (
          <Card className="border-dashed border-2 border-[#B7CAC9]/30">
            <CardContent className="py-12 text-center">
              <Zap className="w-12 h-12 mx-auto mb-3 text-[#B7CAC9]" />
              <p className="text-[#3E4C59]">Sin automatizaciones ejecutadas aún</p>
            </CardContent>
          </Card>
        ) : (
          runs.map(run => {
            const StyleInfo = STATUS_STYLES[run.status];
            return (
              <Card
                key={run.id}
                className="hover:shadow-md transition-all cursor-pointer border-[#B7CAC9]/20"
                onClick={() => setSelectedRun(run)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg ${StyleInfo.bg} flex items-center justify-center flex-shrink-0`}>
                        <StyleInfo.icon className={`w-5 h-5 ${StyleInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#1B2731]">{AUTOMATION_TYPES[run.automation_type]}</h3>
                        <p className="text-xs text-[#3E4C59] mt-0.5 line-clamp-1">{run.summary}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-[#3E4C59]">
                          {run.executed_at ? format(new Date(run.executed_at), 'HH:mm', { locale: es }) : '—'}
                        </p>
                        <div className="flex gap-1 mt-1 justify-end">
                          {run.tasks_created?.length > 0 && (
                            <Badge className="text-xs bg-blue-50 text-blue-700 border-0">
                              {run.tasks_created.length} tarea{run.tasks_created.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {run.follow_ups_created?.length > 0 && (
                            <Badge className="text-xs bg-purple-50 text-purple-700 border-0">
                              {run.follow_ups_created.length} follow-up
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge className={`${StyleInfo.bg} ${StyleInfo.color} border-0 flex-shrink-0`}>
                        {StyleInfo.label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}