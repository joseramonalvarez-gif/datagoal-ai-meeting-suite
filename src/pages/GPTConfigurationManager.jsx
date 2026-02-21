import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Loader, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { canManageGPT } from '../components/utils/roleUtils';
import RoleGuard from '../components/RoleGuard';
import GPTConfigForm from '../components/gpt/GPTConfigForm';
import GPTConfigList from '../components/gpt/GPTConfigList';

export default function GPTConfigurationManager() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (canManageGPT(me.role)) {
        loadConfigs();
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError('Error al cargar usuario');
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await base44.entities.GPTConfiguration.list('-sort_order', 100);
      setConfigs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      if (editingConfig) {
        await base44.entities.GPTConfiguration.update(editingConfig.id, formData);
        toast.success('Configuración actualizada');
      } else {
        await base44.entities.GPTConfiguration.create(formData);
        toast.success('Configuración creada');
      }
      setShowForm(false);
      setEditingConfig(null);
      await loadConfigs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.GPTConfiguration.delete(id);
      toast.success('Configuración eliminada');
      await loadConfigs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <RoleGuard user={user} requiredPermission={canManageGPT}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-[#1B2731]">Configuraciones GPT</h1>
          <p className="text-[#3E4C59] mt-2">Gestiona tus modelos GPT personalizados para el análisis</p>
        </div>
        {!showForm && (
          <Button
            onClick={() => {
              setEditingConfig(null);
              setShowForm(true);
            }}
            className="bg-[#33A19A] hover:bg-[#2A857F] gap-2"
          >
            <Plus className="w-4 h-4" /> Crear nuevo
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6">
          <GPTConfigForm
            config={editingConfig}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingConfig(null);
            }}
          />
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 animate-spin text-[#33A19A]" />
        </div>
      ) : (
        <GPTConfigList
          configs={configs}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
      </div>
    </RoleGuard>
  );
}