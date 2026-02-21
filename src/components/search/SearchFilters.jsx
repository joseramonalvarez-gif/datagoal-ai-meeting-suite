import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown } from 'lucide-react';

export default function SearchFilters({ onFiltersChange, clients, projects }) {
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showParticipantFilter, setShowParticipantFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [participantInput, setParticipantInput] = useState('');

  const handleDateChange = () => {
    onFiltersChange({ dateFrom, dateTo, participants: selectedParticipants });
  };

  const addParticipant = () => {
    if (participantInput.trim() && !selectedParticipants.includes(participantInput.trim())) {
      const updated = [...selectedParticipants, participantInput.trim()];
      setSelectedParticipants(updated);
      setParticipantInput('');
      onFiltersChange({ dateFrom, dateTo, participants: updated });
    }
  };

  const removeParticipant = (email) => {
    const updated = selectedParticipants.filter(p => p !== email);
    setSelectedParticipants(updated);
    onFiltersChange({ dateFrom, dateTo, participants: updated });
  };

  return (
    <Card className="p-4 border-[#B7CAC9]/30 bg-white">
      <div className="space-y-4">
        {/* Date Range Filter */}
        <div>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="w-full flex items-center justify-between p-2 hover:bg-[#FFFAF3] rounded-lg transition-smooth"
          >
            <span className="text-sm font-medium text-[#1B2731]">Rango de fechas</span>
            <ChevronDown className={`w-4 h-4 text-[#B7CAC9] transition-transform ${showDateFilter ? 'rotate-180' : ''}`} />
          </button>
          
          {showDateFilter && (
            <div className="mt-2 space-y-2 pl-2">
              <div>
                <label className="text-xs text-[#3E4C59]">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    handleDateChange();
                  }}
                  className="text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-[#3E4C59]">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    handleDateChange();
                  }}
                  className="text-sm mt-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* Participant Filter */}
        <div>
          <button
            onClick={() => setShowParticipantFilter(!showParticipantFilter)}
            className="w-full flex items-center justify-between p-2 hover:bg-[#FFFAF3] rounded-lg transition-smooth"
          >
            <span className="text-sm font-medium text-[#1B2731]">Participantes ({selectedParticipants.length})</span>
            <ChevronDown className={`w-4 h-4 text-[#B7CAC9] transition-transform ${showParticipantFilter ? 'rotate-180' : ''}`} />
          </button>

          {showParticipantFilter && (
            <div className="mt-2 pl-2 space-y-2">
              <div className="flex gap-1">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={participantInput}
                  onChange={(e) => setParticipantInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addParticipant();
                    }
                  }}
                  className="text-sm flex-1"
                />
                <Button
                  onClick={addParticipant}
                  size="sm"
                  className="bg-[#33A19A] hover:bg-[#2A857F] text-white"
                >
                  Añadir
                </Button>
              </div>

              {selectedParticipants.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedParticipants.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1">
                      {email}
                      <button
                        onClick={() => removeParticipant(email)}
                        className="hover:opacity-70"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}