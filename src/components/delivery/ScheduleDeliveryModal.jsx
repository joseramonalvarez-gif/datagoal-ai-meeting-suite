import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock } from 'lucide-react';

export default function ScheduleDeliveryModal({ open, onOpenChange, meeting, template }) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [recipients, setRecipients] = useState([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [notifyMe, setNotifyMe] = useState(true);
  const queryClient = useQueryClient();

  const scheduleMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('scheduleDelivery', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setScheduledDate('');
    setScheduledTime('09:00');
    setRecipients([]);
    setNewRecipient('');
    setNotifyMe(true);
  };

  const handleAddRecipient = () => {
    if (newRecipient && !recipients.includes(newRecipient)) {
      setRecipients([...recipients, newRecipient]);
      setNewRecipient('');
    }
  };

  const handleRemoveRecipient = (email) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleSchedule = async () => {
    if (!scheduledDate || !scheduledTime) {
      alert('Por favor completa fecha y hora');
      return;
    }

    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);

    await scheduleMutation.mutateAsync({
      meeting_id: meeting.id,
      template_id: template.id,
      scheduled_time: scheduledDateTime.toISOString(),
      recipients: [...recipients, notifyMe ? '' : null].filter(Boolean)
    });
  };

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getMinDate = () => new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Programar Entrega</DialogTitle>
          <DialogDescription>
            Programa cuándo se ejecutará la entrega de {meeting?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & Time */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Fecha
            </label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={getMinDate()}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Hora
            </label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Destinatarios (opcional)</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
              />
              <Button size="sm" variant="outline" onClick={handleAddRecipient}>
                Añadir
              </Button>
            </div>

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipients.map(r => (
                  <Badge key={r} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveRecipient(r)}>
                    {r} ✕
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notification */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={notifyMe} onCheckedChange={setNotifyMe} />
            <span className="text-sm">Notificarme cuando se ejecute</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSchedule} disabled={!scheduledDate} className="flex-1 bg-[#33A19A] hover:bg-[#2A857F]">
              {scheduleMutation.isPending ? 'Programando...' : 'Programar Entrega'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}