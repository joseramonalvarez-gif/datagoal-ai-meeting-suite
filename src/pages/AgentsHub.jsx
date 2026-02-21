import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Zap, BookOpen, Brain, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const AGENTS = [
  {
    id: 'admin_assistant',
    name: 'Asistente Admin',
    description: 'Gestión de entidades, documentos y tareas vía WhatsApp',
    icon: Zap,
    color: 'from-blue-500 to-blue-600',
    features: [
      'Crear clientes, proyectos y tareas',
      'Subir y descargar documentos',
      'Ver tareas pendientes',
      'Gestionar reuniones'
    ]
  },
  {
    id: 'knowledge_consultant',
    name: 'Consultor de Conocimiento',
    description: 'Búsqueda de activos y propuestas previas',
    icon: BookOpen,
    color: 'from-amber-500 to-amber-600',
    features: [
      'Buscar metodologías',
      'Encontrar casos similares',
      'Acceder a propuestas previas',
      'Consultar best practices'
    ]
  },
  {
    id: 'strategy_inference',
    name: 'Asistente Estratégico',
    description: 'Análisis de riesgos e insights proactivos',
    icon: Brain,
    color: 'from-purple-500 to-purple-600',
    features: [
      'Analizar riesgos y oportunidades',
      'Sugerir tareas críticas',
      'Alertar sobre escaladas',
      'Generar estrategias'
    ]
  }
];

export default function AgentsHub() {
  const [copied, setCopied] = useState(null);

  const handleWhatsAppConnect = async (agentId) => {
    try {
      const whatsappUrl = base44.agents.getWhatsAppConnectURL(agentId);
      window.open(whatsappUrl, '_blank');
    } catch (err) {
      toast.error('Error al conectar: ' + err.message);
    }
  };

  const handleCopyCommand = (command) => {
    navigator.clipboard.writeText(command);
    setCopied(command);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-[#1B2731]">Centro de Agentes</h1>
        <p className="text-sm text-[#3E4C59] mt-2">
          Accede a tus agentes IA vía WhatsApp para gestión automática y análisis inteligente
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-[#E8F5F4] to-[#F0F9F8] border border-[#33A19A]/20 rounded-xl p-4">
        <div className="flex gap-3">
          <MessageCircle className="w-5 h-5 text-[#33A19A] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#1B2731]">
            <p className="font-semibold mb-1">💬 Conecta vía WhatsApp</p>
            <p className="text-[#3E4C59]">
              Cada agente te pedirá que te logues. Después podrás usarlo 24/7 directamente en WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.id} className="hover:shadow-lg transition-all duration-300 border-[#B7CAC9]/20">
              <CardHeader>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="font-heading text-lg">{agent.name}</CardTitle>
                <CardDescription>{agent.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-[#3E4C59] uppercase tracking-wider">Funcionalidades</h4>
                  <ul className="space-y-1">
                    {agent.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#3E4C59]">
                        <span className="text-[#33A19A] mt-1">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* WhatsApp Button */}
                <Button
                  onClick={() => handleWhatsAppConnect(agent.id)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Conectar en WhatsApp
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Commands Reference */}
      <div className="space-y-4">
        <h2 className="font-heading text-xl font-bold text-[#1B2731]">Comandos Disponibles</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Admin Assistant Commands */}
          <Card className="border-[#B7CAC9]/20">
            <CardHeader>
              <CardTitle className="text-base">Admin Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { cmd: 'crear cliente ACME', desc: 'Crear nuevo cliente' },
                { cmd: 'crear proyecto [cliente]', desc: 'Crear proyecto' },
                { cmd: 'mis tareas', desc: 'Ver tareas pendientes' },
                { cmd: 'crear tarea [titulo]', desc: 'Crear tarea rápida' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    onClick={() => handleCopyCommand(item.cmd)}
                    className="flex-1 text-left p-2 rounded bg-[#FFFAF3] hover:bg-[#E8F5F4] border border-[#B7CAC9]/20 transition-colors"
                  >
                    <code className="text-xs font-mono text-[#1B2731]">{item.cmd}</code>
                    <p className="text-xs text-[#3E4C59] mt-0.5">{item.desc}</p>
                  </button>
                  <button
                    onClick={() => handleCopyCommand(item.cmd)}
                    className="mt-1 p-1.5 hover:bg-[#E8F5F4] rounded transition-colors"
                  >
                    {copied === item.cmd ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#B7CAC9]" />
                    )}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Knowledge Consultant Commands */}
          <Card className="border-[#B7CAC9]/20">
            <CardHeader>
              <CardTitle className="text-base">Knowledge Consultant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { cmd: 'busca metodología DX', desc: 'Buscar activos' },
                { cmd: 'casos similares [tema]', desc: 'Encontrar casos' },
                { cmd: 'propuestas previas', desc: 'Ver propuestas históricas' },
                { cmd: 'best practices [tema]', desc: 'Obtener referencias' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    onClick={() => handleCopyCommand(item.cmd)}
                    className="flex-1 text-left p-2 rounded bg-[#FFFAF3] hover:bg-[#E8F5F4] border border-[#B7CAC9]/20 transition-colors"
                  >
                    <code className="text-xs font-mono text-[#1B2731]">{item.cmd}</code>
                    <p className="text-xs text-[#3E4C59] mt-0.5">{item.desc}</p>
                  </button>
                  <button
                    onClick={() => handleCopyCommand(item.cmd)}
                    className="mt-1 p-1.5 hover:bg-[#E8F5F4] rounded transition-colors"
                  >
                    {copied === item.cmd ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#B7CAC9]" />
                    )}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Strategy Assistant Commands */}
          <Card className="border-[#B7CAC9]/20 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Strategy Inference</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { cmd: 'analiza riesgos [proyecto]', desc: 'Análisis de riesgos' },
                { cmd: 'tareas críticas', desc: 'Ver tareas urgentes' },
                { cmd: 'oportunidades [cliente]', desc: 'Identificar oportunidades' },
                { cmd: 'escaladas pendientes', desc: 'Ver escalaciones' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    onClick={() => handleCopyCommand(item.cmd)}
                    className="flex-1 text-left p-2 rounded bg-[#FFFAF3] hover:bg-[#E8F5F4] border border-[#B7CAC9]/20 transition-colors"
                  >
                    <code className="text-xs font-mono text-[#1B2731]">{item.cmd}</code>
                    <p className="text-xs text-[#3E4C59] mt-0.5">{item.desc}</p>
                  </button>
                  <button
                    onClick={() => handleCopyCommand(item.cmd)}
                    className="mt-1 p-1.5 hover:bg-[#E8F5F4] rounded transition-colors"
                  >
                    {copied === item.cmd ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#B7CAC9]" />
                    )}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}