import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ExternalLink, Copy } from 'lucide-react';

export default function DeliveryWebhooksManager() {
  const [webhooks, setWebhooks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    webhook_url: '',
    events: {
      delivery_created: false,
      delivery_success: false,
      delivery_failed: false,
      delivery_review: false
    }
  });

  const handleCreate = async () => {
    if (!formData.webhook_url || !Object.values(formData.events).some(v => v)) {
      alert('URL y al menos un evento requeridos');
      return;
    }

    const response = await base44.functions.invoke('setupDeliveryWebhook', {
      webhook_url: formData.webhook_url,
      name: formData.name,
      event_types: Object.keys(formData.events).filter(k => formData.events[k])
    });

    if (response.data?.success) {
      setWebhooks([...webhooks, response.data.webhook]);
      setFormData({
        name: '',
        webhook_url: '',
        events: { delivery_created: false, delivery_success: false, delivery_failed: false, delivery_review: false }
      });
      setShowForm(false);
    }
  };

  const handleDelete = (index) => {
    setWebhooks(webhooks.filter((_, i) => i !== index));
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
          <ExternalLink className="w-8 h-8 text-[#33A19A]" />
          Gestión de Webhooks
        </h1>
        <p className="text-[#3E4C59] mt-1">Integra sistemas externos con webhooks</p>
      </div>

      {showForm && (
        <Card className="bg-[#E8F5F4] border-[#33A19A]">
          <CardHeader>
            <CardTitle className="text-base">Nuevo Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre (opcional)</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej: Slack Integration"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">URL del Webhook</label>
              <Input
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                placeholder="https://hooks.slack.com/..."
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Eventos a monitorear</label>
              <div className="space-y-2">
                {[
                  { key: 'delivery_created', label: 'Entrega creada' },
                  { key: 'delivery_success', label: 'Entrega exitosa' },
                  { key: 'delivery_failed', label: 'Entrega fallida' },
                  { key: 'delivery_review', label: 'Revisión pendiente' }
                ].map(evt => (
                  <label key={evt.key} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded">
                    <Checkbox
                      checked={formData.events[evt.key]}
                      onCheckedChange={(c) => setFormData({
                        ...formData,
                        events: { ...formData.events, [evt.key]: c }
                      })}
                    />
                    <span className="text-sm">{evt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} className="bg-[#33A19A] hover:bg-[#2A857F] flex-1">
                Crear Webhook
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]">
          <Plus className="w-4 h-4" />
          Nuevo Webhook
        </Button>
      </div>

      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-[#3E4C59]">
              <ExternalLink className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin webhooks configurados</p>
            </CardContent>
          </Card>
        ) : (
          webhooks.map((webhook, idx) => (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1B2731]">{webhook.name || 'Webhook sin nombre'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-[#FFFAF3] px-2 py-1 rounded text-[#3E4C59] truncate">
                        {webhook.webhook_url}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(webhook.webhook_url)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {webhook.event_types?.map(evt => (
                        <Badge key={evt} variant="outline" className="text-xs">
                          {evt}
                        </Badge>
                      ))}
                    </div>
                    {webhook.is_active && (
                      <p className="text-xs text-green-600 mt-2">✓ Activo</p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(idx)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payload de Ejemplo</CardTitle>
          <CardDescription>Estructura de datos enviada a tu webhook</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-[#1B2731] text-[#FFFAF3] p-3 rounded text-xs overflow-x-auto">
{`{
  "event": "delivery_success",
  "timestamp": "2026-02-21T10:30:00Z",
  "delivery": {
    "id": "del_123...",
    "status": "delivered",
    "quality_score": 0.95,
    "recipients": ["user@example.com"]
  },
  "meeting": {
    "id": "meet_456...",
    "title": "Strategy Meeting"
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}