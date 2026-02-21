import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Download, Send, RefreshCw, Filter, Zap } from 'lucide-react';

export default function DeliveryCenter() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [filters, setFilters] = useState({ status: 'all' });
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const queryClient = useQueryClient();

  const { data: deliveryRuns = [] } = useQuery({
    queryKey: ['deliveryRuns', filters],
    queryFn: async () => {
      const query = filters.status !== 'all' ? { status: filters.status } : {};
      return await base44.entities.DeliveryRun.filter(query, '-created_date', 50);
    },
    initialData: []
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['deliveryTemplates'],
    queryFn: () => base44.entities.DeliveryTemplate.filter({ is_active: true }, 'name', 100),
    initialData: []
  });

  const generateDeliveryMutation = useMutation({
    mutationFn: async ({ meeting_id, template_id }) => {
      const { data } = await base44.functions.invoke('orchestrateMeetingDelivery', {
        meeting_id,
        template_id
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRuns'] });
    }
  });

  const validateQAMutation = useMutation({
    mutationFn: async (delivery_run_id) => {
      const { data } = await base44.functions.invoke('validateDeliveryQA', {
        delivery_run_id
      });
      return data;
    }
  });

  const statusConfig = {
    running: { icon: Clock, color: 'bg-blue-100 text-blue-800', label: 'En progreso' },
    success: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Listo' },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Error' },
    review_pending: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-800', label: 'Requiere revisión' },
    delivered: { icon: CheckCircle2, color: 'bg-green-100 text-green-800', label: 'Enviado' }
  };

  const qualityBadge = (score) => {
    if (!score) return null;
    if (score >= 0.9) return <Badge className="bg-green-100 text-green-800">Excelente ({(score * 100).toFixed(0)}%)</Badge>;
    if (score >= 0.75) return <Badge className="bg-yellow-100 text-yellow-800">Bueno ({(score * 100).toFixed(0)}%)</Badge>;
    return <Badge className="bg-red-100 text-red-800">Revisar ({(score * 100).toFixed(0)}%)</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2731]">Centro de Entregas</h1>
          <p className="text-[#3E4C59]">Generación y gestión de informes automáticos</p>
        </div>
        <Button className="bg-[#33A19A] hover:bg-[#2A857F]" disabled={generateDeliveryMutation.isPending}>
          <Zap className="w-4 h-4 mr-2" />
          {generateDeliveryMutation.isPending ? 'Generando...' : 'Nueva Entrega'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#33A19A]" />
            <h3 className="font-semibold">Filtros</h3>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="running">En progreso</SelectItem>
              <SelectItem value="success">Listo</SelectItem>
              <SelectItem value="delivered">Enviado</SelectItem>
              <SelectItem value="failed">Error</SelectItem>
              <SelectItem value="review_pending">Requiere revisión</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Deliveries Grid */}
      <div className="grid gap-4">
        {deliveryRuns.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center text-[#3E4C59]">
              <Clock className="w-12 h-12 mx-auto mb-4 text-[#B7CAC9]" />
              <p>No hay entregas aún. Crea una nueva para comenzar.</p>
            </CardContent>
          </Card>
        ) : (
          deliveryRuns.map(delivery => {
            const config = statusConfig[delivery.status];
            const StatusIcon = config?.icon;
            return (
              <Card
                key={delivery.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedDelivery(delivery)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {StatusIcon && <StatusIcon className={`w-5 h-5 ${config.color}`} />}
                        <CardTitle className="text-lg">{delivery.trigger_entity_type}</CardTitle>
                        <Badge className={config?.color}>{config?.label}</Badge>
                      </div>
                      <CardDescription>
                        Entidad: {delivery.trigger_entity_id}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      {qualityBadge(delivery.quality_score)}
                      <p className="text-xs text-[#3E4C59] mt-1">
                        {new Date(delivery.created_date).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Timeline of steps */}
                  <div className="space-y-2">
                    {delivery.steps_executed?.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {step.status === 'success' && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        {step.status === 'failed' && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        {step.status === 'pending' && (
                          <Clock className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="text-[#3E4C59]">{step.step_name}</span>
                        {step.error && <span className="text-red-600 text-xs">({step.error})</span>}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-[#B7CAC9]/30">
                    {delivery.status === 'success' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            validateQAMutation.mutate(delivery.id);
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Validar QA
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-1" />
                          Descargar
                        </Button>
                        <Button size="sm" className="bg-[#33A19A]">
                          <Send className="w-4 h-4 mr-1" />
                          Enviar
                        </Button>
                      </>
                    )}
                    {delivery.status === 'failed' && (
                      <Button size="sm" variant="outline">
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Reintentar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedDelivery(null)}>
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-start justify-between sticky top-0 bg-white border-b">
              <div>
                <CardTitle>Detalle de Entrega</CardTitle>
                <CardDescription>{selectedDelivery.id}</CardDescription>
              </div>
              <Button variant="ghost" onClick={() => setSelectedDelivery(null)}>×</Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Content Preview */}
              <div>
                <h4 className="font-semibold text-[#1B2731] mb-2">Contenido</h4>
                <div className="bg-[#FFFAF3] p-4 rounded-lg border border-[#B7CAC9]/30 max-h-64 overflow-y-auto text-sm text-[#3E4C59]">
                  {selectedDelivery.output_content ? (
                    selectedDelivery.output_content.substring(0, 500) + '...'
                  ) : (
                    'Sin contenido'
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#3E4C59] font-medium">Estado</p>
                  <Badge className={statusConfig[selectedDelivery.status]?.color}>
                    {statusConfig[selectedDelivery.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-[#3E4C59] font-medium">Tiempo total</p>
                  <p className="text-[#1B2731]">{selectedDelivery.total_time_ms}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}