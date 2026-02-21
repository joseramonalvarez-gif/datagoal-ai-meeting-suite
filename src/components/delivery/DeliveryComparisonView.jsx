import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, GitCompare } from 'lucide-react';

export default function DeliveryComparisonView() {
  const [delivery1Id, setDelivery1Id] = useState('');
  const [delivery2Id, setDelivery2Id] = useState('');
  const [comparison, setComparison] = useState(null);

  const handleCompare = async () => {
    if (!delivery1Id || !delivery2Id) {
      alert('Selecciona dos entregas');
      return;
    }

    const [d1, d2] = await Promise.all([
      base44.entities.DeliveryRun.get(delivery1Id),
      base44.entities.DeliveryRun.get(delivery2Id)
    ]);

    setComparison({
      delivery1: d1,
      delivery2: d2,
      metrics: {
        status: { label: 'Estado', match: d1.status === d2.status },
        quality: { label: 'Calidad', d1: d1.quality_score, d2: d2.quality_score },
        time: { label: 'Tiempo (s)', d1: Math.round(d1.total_time_ms / 1000), d2: Math.round(d2.total_time_ms / 1000) },
        recipients: { label: 'Destinatarios', d1: d1.recipients?.length || 0, d2: d2.recipients?.length || 0 }
      }
    });
  };

  if (!comparison) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            Comparar Entregas
          </CardTitle>
          <CardDescription>Compara dos entregas lado a lado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Primera Entrega</label>
              <input
                type="text"
                placeholder="ID o nombre..."
                value={delivery1Id}
                onChange={(e) => setDelivery1Id(e.target.value)}
                className="w-full px-3 py-2 border border-[#B7CAC9]/30 rounded"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Segunda Entrega</label>
              <input
                type="text"
                placeholder="ID o nombre..."
                value={delivery2Id}
                onChange={(e) => setDelivery2Id(e.target.value)}
                className="w-full px-3 py-2 border border-[#B7CAC9]/30 rounded"
              />
            </div>
          </div>
          <Button onClick={handleCompare} className="w-full bg-[#33A19A] hover:bg-[#2A857F]">
            Comparar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          Comparación de Entregas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
            <p className="font-medium text-sm mb-2">{comparison.delivery1.id.substring(0, 16)}</p>
            <Badge variant="outline">{comparison.delivery1.status}</Badge>
          </div>
          <div className="p-3 bg-[#FFFAF3] rounded border border-[#B7CAC9]/30">
            <p className="font-medium text-sm mb-2">{comparison.delivery2.id.substring(0, 16)}</p>
            <Badge variant="outline">{comparison.delivery2.status}</Badge>
          </div>
        </div>

        <div className="space-y-2">
          {Object.entries(comparison.metrics).map(([key, metric]) => (
            <div key={key} className="grid grid-cols-3 gap-4 p-2 bg-[#FFFAF3] rounded">
              <div className="text-sm font-medium text-[#1B2731]">{metric.label}</div>
              <div className="text-sm text-[#3E4C59] flex items-center gap-2">
                {metric.match !== undefined ? (
                  metric.match ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-red-600" />
                  )
                ) : (
                  <>
                    {metric.d1 ? `${(metric.d1 * 100).toFixed(1)}%` : metric.d1}
                  </>
                )}
              </div>
              <div className="text-sm text-[#3E4C59]">
                {metric.d2 ? `${(metric.d2 * 100).toFixed(1)}%` : metric.d2}
              </div>
            </div>
          ))}
        </div>

        <Button onClick={() => setComparison(null)} variant="outline" className="w-full">
          Nueva Comparación
        </Button>
      </CardContent>
    </Card>
  );
}