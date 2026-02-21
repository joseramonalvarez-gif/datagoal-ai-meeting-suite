import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Send, Trash2, RotateCcw } from 'lucide-react';

export default function BatchDeliveryActions({ deliveries = [] }) {
  const [selected, setSelected] = useState(new Set());
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async (deliveryIds) => {
      const results = [];
      for (const id of deliveryIds) {
        try {
          await base44.functions.invoke('sendDeliveryEmail', { delivery_run_id: id });
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRuns'] });
      setSelected(new Set());
    }
  });

  const retryMutation = useMutation({
    mutationFn: async (deliveryIds) => {
      const results = [];
      for (const id of deliveryIds) {
        try {
          await base44.functions.invoke('retryFailedDelivery', { delivery_run_id: id });
          results.push({ id, success: true });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryRuns'] });
      setSelected(new Set());
    }
  });

  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === deliveries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deliveries.map(d => d.id)));
    }
  };

  const selectableDeliveries = deliveries.filter(d => 
    (d.status === 'success' || d.status === 'review_pending') && d.status !== 'delivered'
  );

  const retryableDeliveries = deliveries.filter(d => d.status === 'failed');

  if (deliveries.length === 0) return null;

  return (
    <Card className="bg-[#FFFAF3] border-[#33A19A]/30">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Selection Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selected.size === deliveries.length && deliveries.length > 0}
                indeterminate={selected.size > 0 && selected.size < deliveries.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">
                {selected.size} de {deliveries.length} seleccionadas
              </span>
            </div>
          </div>

          {/* Delivery List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {deliveries.map(delivery => (
              <div
                key={delivery.id}
                className="flex items-center gap-3 p-2 rounded border border-[#B7CAC9]/30 hover:bg-white"
              >
                <Checkbox
                  checked={selected.has(delivery.id)}
                  onCheckedChange={() => toggleSelect(delivery.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{delivery.id.substring(0, 16)}</p>
                  <p className="text-xs text-[#3E4C59]">
                    {new Date(delivery.created_date).toLocaleString('es-ES', { 
                      year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                    })}
                  </p>
                </div>
                <Badge className={
                  delivery.status === 'success' ? 'bg-green-100 text-green-800' :
                  delivery.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }>
                  {delivery.status}
                </Badge>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {selectableDeliveries.length > 0 && (
              <Button
                size="sm"
                onClick={() => sendMutation.mutate(Array.from(selected))}
                disabled={selected.size === 0 || sendMutation.isPending}
                className="bg-[#33A19A] hover:bg-[#2A857F]"
              >
                <Send className="w-3 h-3 mr-1" />
                Enviar {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            )}

            {retryableDeliveries.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryMutation.mutate(
                  Array.from(selected).filter(id => 
                    deliveries.find(d => d.id === id && d.status === 'failed')
                  )
                )}
                disabled={selected.size === 0 || retryMutation.isPending}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reintentar {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            )}

            {selected.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Limpiar
              </Button>
            )}
          </div>

          {/* Info */}
          {selectableDeliveries.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200 text-xs text-blue-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{selectableDeliveries.length} entregas listas para enviar</p>
            </div>
          )}

          {retryableDeliveries.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-red-50 rounded border border-red-200 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{retryableDeliveries.length} entregas fallidas disponibles para reintentar</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}