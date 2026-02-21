import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus, Trash2, Edit2 } from 'lucide-react';

export default function DeliveryAlertsManager() {
  const [alerts, setAlerts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    rule_name: '',
    rule_type: 'quality_below',
    threshold: 0.75,
    emails: ''
  });

  const handleCreate = async () => {
    if (!formData.rule_name) {
      alert('Nombre de regla requerido');
      return;
    }

    const response = await base44.functions.invoke('createDeliveryAlertRule', {
      rule_name: formData.rule_name,
      rule_type: formData.rule_type,
      condition: { metric: 'quality_score', operator: 'lt', value: formData.threshold },
      action: { type: 'notify', emails: formData.emails.split(',').map(e => e.trim()) }
    });

    if (response.data?.success) {
      setAlerts([...alerts, response.data.rule]);
      setFormData({ rule_name: '', rule_type: 'quality_below', threshold: 0.75, emails: '' });
      setShowForm(false);
    }
  };

  const handleDelete = (index) => {
    setAlerts(alerts.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
          <Bell className="w-8 h-8 text-[#33A19A]" />
          Gestión de Alertas
        </h1>
        <p className="text-[#3E4C59] mt-1">Configura reglas automáticas para monitoreo</p>
      </div>

      {showForm && (
        <Card className="bg-[#E8F5F4] border-[#33A19A]">
          <CardHeader>
            <CardTitle className="text-base">Nueva Regla de Alerta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre de la regla</label>
              <Input
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                placeholder="ej: Calidad baja"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo de regla</label>
                <Select value={formData.rule_type} onValueChange={(v) => setFormData({ ...formData, rule_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quality_below">Calidad por debajo de</SelectItem>
                    <SelectItem value="time_exceeded">Tiempo excedido</SelectItem>
                    <SelectItem value="failure_rate">Tasa de fallos</SelectItem>
                    <SelectItem value="consecutive_failures">Fallos consecutivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Umbral</label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Emails (separados por comas)</label>
              <Input
                value={formData.emails}
                onChange={(e) => setFormData({ ...formData, emails: e.target.value })}
                placeholder="admin@example.com, team@example.com"
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} className="bg-[#33A19A] hover:bg-[#2A857F] flex-1">
                Crear Regla
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
          Nueva Regla
        </Button>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-[#3E4C59]">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin reglas configuradas</p>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert, idx) => (
            <Card key={idx}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-[#1B2731]">{alert.rule_name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{alert.rule_type}</Badge>
                      {alert.is_active && <Badge className="bg-green-100 text-green-800">Activo</Badge>}
                    </div>
                    <p className="text-xs text-[#3E4C59] mt-2">
                      Umbral: {alert.threshold || alert.condition?.value}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(idx)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}