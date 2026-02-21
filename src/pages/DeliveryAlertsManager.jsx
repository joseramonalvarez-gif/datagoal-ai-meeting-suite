import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, Plus, Edit2, Trash2, Bell } from 'lucide-react';

export default function DeliveryAlertsManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    alert_type: 'delivery_failed',
    trigger_condition: { metric: '', operator: 'equals', value: '' },
    severity: 'medium',
    recipient_emails: [],
    notify_via: ['in_app'],
    check_interval_minutes: 5,
    is_active: true
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['alertRules'],
    queryFn: () => base44.asServiceRole.entities.AlertRule.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.asServiceRole.entities.AlertRule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertRules'] });
      resetForm();
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.asServiceRole.entities.AlertRule.update(editingRule.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertRules'] });
      resetForm();
      setEditingRule(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.asServiceRole.entities.AlertRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertRules'] });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      alert_type: 'delivery_failed',
      trigger_condition: { metric: '', operator: 'equals', value: '' },
      severity: 'medium',
      recipient_emails: [],
      notify_via: ['in_app'],
      check_interval_minutes: 5,
      is_active: true
    });
  };

  const handleSave = async () => {
    const payload = {
      ...formData,
      recipient_emails: formData.recipient_emails.filter(e => e),
      check_interval_minutes: parseInt(formData.check_interval_minutes)
    };

    if (editingRule) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData(rule);
    setShowForm(false);
  };

  const alertTypeLabels = {
    automation_failed: '❌ Automatización falló',
    task_overdue: '⏰ Tarea vencida',
    meeting_no_followup: '📋 Reunión sin seguimiento',
    client_risk: '⚠️ Riesgo de cliente',
    proposal_pending: '📄 Propuesta pendiente',
    high_priority_task_stuck: '🔴 Tarea bloqueada',
    delivery_failed: '📦 Entrega fallida',
    custom: '🎯 Personalizada'
  };

  const severityColors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2731] font-heading flex items-center gap-2">
            <Bell className="w-8 h-8 text-[#33A19A]" />
            Reglas de Alertas de Entrega
          </h1>
          <p className="text-[#3E4C59] mt-1">Configura alertas automáticas por eventos críticos</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditingRule(null);
            setShowForm(true);
          }}
          className="bg-[#33A19A] hover:bg-[#2A857F] gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva Regla
        </Button>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Regla' : 'Nueva Regla de Alerta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Nombre</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre descriptivo"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Descripción</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Qué dispara esta alerta"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Tipo de Alerta</label>
                <Select value={formData.alert_type} onValueChange={(v) => setFormData({ ...formData, alert_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(alertTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Severidad</label>
                <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Destinatarios</label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {users.map(user => (
                  <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-[#FFFAF3] rounded cursor-pointer">
                    <Checkbox
                      checked={formData.recipient_emails.includes(user.email)}
                      onCheckedChange={(c) => {
                        if (c) {
                          setFormData({
                            ...formData,
                            recipient_emails: [...formData.recipient_emails, user.email]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            recipient_emails: formData.recipient_emails.filter(e => e !== user.email)
                          });
                        }
                      }}
                    />
                    <span className="text-sm">{user.full_name} ({user.email})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Canales</label>
                <div className="space-y-1">
                  {['in_app', 'email', 'whatsapp'].map(channel => (
                    <label key={channel} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={formData.notify_via.includes(channel)}
                        onCheckedChange={(c) => {
                          if (c) {
                            setFormData({
                              ...formData,
                              notify_via: [...formData.notify_via, channel]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              notify_via: formData.notify_via.filter(ch => ch !== channel)
                            });
                          }
                        }}
                      />
                      <span className="text-sm capitalize">{channel === 'in_app' ? 'En la app' : channel}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Revisar cada (minutos)</label>
                <Input
                  type="number"
                  value={formData.check_interval_minutes}
                  onChange={(e) => setFormData({ ...formData, check_interval_minutes: parseInt(e.target.value) })}
                  min={5}
                  step={5}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.is_active}
                onCheckedChange={(c) => setFormData({ ...formData, is_active: c })}
              />
              <span className="text-sm">Regla activa</span>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setShowForm(false);
                setEditingRule(null);
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-[#33A19A] hover:bg-[#2A857F]"
              >
                {editingRule ? 'Actualizar' : 'Crear'} Regla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rules List */}
      <div className="grid gap-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-[#3E4C59]">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Sin reglas de alerta configuradas</p>
            </CardContent>
          </Card>
        ) : (
          rules.map(rule => (
            <Card key={rule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <Badge className={severityColors[rule.severity]}>
                        {rule.severity}
                      </Badge>
                      {!rule.is_active && (
                        <Badge variant="outline" className="bg-gray-100">Inactiva</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">{rule.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(rule)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(rule.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-[#3E4C59]">Tipo:</span>
                    <p className="font-medium">{alertTypeLabels[rule.alert_type]}</p>
                  </div>
                  <div>
                    <span className="text-[#3E4C59]">Destinatarios:</span>
                    <p className="font-medium">{rule.recipient_emails.length} usuarios</p>
                  </div>
                  <div>
                    <span className="text-[#3E4C59]">Canales:</span>
                    <p className="font-medium">{rule.notify_via.join(', ')}</p>
                  </div>
                  <div>
                    <span className="text-[#3E4C59]">Revisar:</span>
                    <p className="font-medium">c/{rule.check_interval_minutes}m</p>
                  </div>
                </div>
                {rule.trigger_count > 0 && (
                  <div className="bg-[#E8F5F4] rounded p-2 text-sm">
                    <p className="text-[#33A19A]">
                      ✓ Disparada {rule.trigger_count} veces
                      {rule.last_triggered && ` (últimamente: ${new Date(rule.last_triggered).toLocaleString('es-ES')})`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}