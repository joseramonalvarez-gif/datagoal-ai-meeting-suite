import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TemplateList from "../components/notifications/TemplateList";
import TemplateEditor from "../components/notifications/TemplateEditor";
import RuleList from "../components/notifications/RuleList";
import RuleEditor from "../components/notifications/RuleEditor";

export default function NotificationSettings() {
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null); // null=list, {}=new, obj=edit
  const [editingRule, setEditingRule] = useState(null);
  const [activeTab, setActiveTab] = useState("rules");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [t, r] = await Promise.all([
      base44.entities.EmailTemplate.list('-created_date'),
      base44.entities.NotificationRule.list('-created_date'),
    ]);
    setTemplates(t);
    setRules(r);
    setLoading(false);
  };

  const handleSaveTemplate = async (data) => {
    if (data.id) {
      await base44.entities.EmailTemplate.update(data.id, data);
    } else {
      await base44.entities.EmailTemplate.create(data);
    }
    setEditingTemplate(null);
    loadData();
  };

  const handleDeleteTemplate = async (id) => {
    await base44.entities.EmailTemplate.delete(id);
    loadData();
  };

  const handleSaveRule = async (data) => {
    if (data.id) {
      await base44.entities.NotificationRule.update(data.id, data);
    } else {
      await base44.entities.NotificationRule.create(data);
    }
    setEditingRule(null);
    loadData();
  };

  const handleDeleteRule = async (id) => {
    await base44.entities.NotificationRule.delete(id);
    loadData();
  };

  const handleToggleRule = async (rule) => {
    await base44.entities.NotificationRule.update(rule.id, { is_active: !rule.is_active });
    loadData();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#1B2731]">Configuración de Notificaciones</h1>
        <p className="text-sm text-[#3E4C59] mt-1">
          Define plantillas de email y reglas de notificación automática basadas en eventos del sistema.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-[#B7CAC9]/30">
          <TabsTrigger value="rules" className="gap-2 data-[state=active]:bg-[#33A19A] data-[state=active]:text-white">
            <Bell className="w-4 h-4" /> Reglas de notificación
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-[#33A19A] data-[state=active]:text-white">
            <Mail className="w-4 h-4" /> Plantillas de email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {editingRule ? (
            <RuleEditor
              rule={editingRule.id ? editingRule : null}
              templates={templates}
              onSave={handleSaveRule}
              onCancel={() => setEditingRule(null)}
            />
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Button onClick={() => setEditingRule({})} className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]">
                  <Plus className="w-4 h-4" /> Nueva regla
                </Button>
              </div>
              <RuleList
                rules={rules}
                templates={templates}
                loading={loading}
                onEdit={setEditingRule}
                onDelete={handleDeleteRule}
                onToggle={handleToggleRule}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          {editingTemplate ? (
            <TemplateEditor
              template={editingTemplate.id ? editingTemplate : null}
              onSave={handleSaveTemplate}
              onCancel={() => setEditingTemplate(null)}
            />
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Button onClick={() => setEditingTemplate({})} className="gap-2 bg-[#33A19A] hover:bg-[#2A857F]">
                  <Plus className="w-4 h-4" /> Nueva plantilla
                </Button>
              </div>
              <TemplateList
                templates={templates}
                loading={loading}
                onEdit={setEditingTemplate}
                onDelete={handleDeleteTemplate}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}