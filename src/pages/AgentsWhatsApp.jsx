import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";

const agents = [
  { name: "proyectos_clientes", title: "📊 Análisis de Proyectos", description: "Estado, progreso y métricas de proyectos y clientes" },
  { name: "gestor_documentos", title: "📁 Gestor de Documentos", description: "Busca, organiza y gestiona documentos" }
];

export default function AgentsWhatsApp() {
  const [whatsappUrls, setWhatsappUrls] = useState({});

  useEffect(() => {
    const urls = {};
    agents.forEach(agent => {
      urls[agent.name] = base44.agents.getWhatsAppConnectURL(agent.name);
    });
    setWhatsappUrls(urls);
  }, []);

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-[#1B2731] mb-2">Agentes WhatsApp</h1>
        <p className="text-[#3E4C59]">Conecta con tus agentes por WhatsApp con voz</p>
      </div>

      <div className="grid gap-4">
        {agents.map((agent) => (
          <Card key={agent.name} className="border-[#B7CAC9]/30 hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">{agent.title}</CardTitle>
              <CardDescription>{agent.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {whatsappUrls[agent.name] && (
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={whatsappUrls[agent.name]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full bg-[#25D366] hover:bg-[#20BA5A] gap-2">
                      <MessageCircle className="w-5 h-5" />
                      Abrir en WhatsApp
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(whatsappUrls[agent.name])}
                    title="Copiar link"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-[#3E4C59] break-all bg-[#FFFAF3] p-2 rounded">
                {whatsappUrls[agent.name]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#E8F5F4] border-[#33A19A]/30">
        <CardHeader>
          <CardTitle className="text-sm text-[#33A19A]">💡 Cómo usar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[#3E4C59] space-y-2">
          <p>1. Haz clic en "Abrir en WhatsApp" o copia el link</p>
          <p>2. Se te pedirá autenticarte si no has iniciado sesión</p>
          <p>3. Elige entre chat de texto o llamada por voz</p>
          <p>4. El agente responderá según tu consulta</p>
        </CardContent>
      </Card>
    </div>
  );
}