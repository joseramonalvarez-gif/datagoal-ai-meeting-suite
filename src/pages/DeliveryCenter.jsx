import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Download, Send, RefreshCw, Filter, Zap } from 'lucide-react';
import DeliveryCard from '@/components/delivery/DeliveryCard';
import DeliveryModal from '@/components/delivery/DeliveryModal';

export default function DeliveryCenter() {
  const [filters, setFilters] = useState({ status: 'all' });
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState(null);
  const queryClient = useQueryClient();
  const [loadingDeliveryId, setLoadingDeliveryId] = useState(null);

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
    },
    onSuccess: (data) => {
      setSelectedCheckpoints(data.checkpoints);
      queryClient.invalidateQueries({ queryKey: ['deliveryRuns'] });
    }
  });

  const sendDeliveryMutation = useMutation({
    mutationFn: async ({ delivery_run_id, recipients }) => {
      const { data } = await base44.functions.invoke('sendDeliveryEmail', {
        delivery_run_id,
        recipients
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRuns'] });
      setSelectedDelivery(null);
    }
  });

  const handleValidateQA = async (deliveryId) => {
    setLoadingDeliveryId(deliveryId);
    await validateQAMutation.mutateAsync(deliveryId);
    setLoadingDeliveryId(null);
  };

  const handleSendDelivery = async (deliveryId) => {
    setLoadingDeliveryId(deliveryId);
    const delivery = deliveryRuns.find(d => d.id === deliveryId);
    if (delivery) {
      // Get recipients from meeting
      const meeting = delivery.trigger_entity_id; // This is simplified
      await sendDeliveryMutation.mutateAsync({
        delivery_run_id: deliveryId,
        recipients: ['placeholder@example.com'] // TODO: Get from meeting
      });
    }
    setLoadingDeliveryId(null);
  };

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
          deliveryRuns.map(delivery => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onValidate={handleValidateQA}
              onDownload={() => {}}
              onSend={handleSendDelivery}
              onRetry={() => {}}
              isLoading={loadingDeliveryId === delivery.id}
            />
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedDelivery && (
        <DeliveryModal
          delivery={selectedDelivery}
          checkpoints={selectedCheckpoints}
          onClose={() => {
            setSelectedDelivery(null);
            setSelectedCheckpoints(null);
          }}
          onSend={handleSendDelivery}
          onValidate={handleValidateQA}
          isLoading={loadingDeliveryId === selectedDelivery.id}
        />
      )}
    </div>
  );
}