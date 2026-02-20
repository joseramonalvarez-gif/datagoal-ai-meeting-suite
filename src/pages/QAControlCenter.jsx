import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Shield, Settings, Play, History, AlertTriangle } from "lucide-react";
import QaSetupTab from "../components/qa/QaSetupTab";
import QaRunTab from "../components/qa/QaRunTab";
import QaHistoryTab from "../components/qa/QaHistoryTab";

export default function QAControlCenter({ selectedClient, user }) {
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {
    const check = async () => {
      const me = await base44.auth.me();
      setAuthorized(me.role === "admin");
    };
    check();
  }, []);

  if (authorized === null) return (
    <div className="flex justify-center items-center h-40">
      <div className="animate-spin w-6 h-6 border-2 border-[#33A19A] border-t-transparent rounded-full" />
    </div>
  );

  if (!authorized) return (
    <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="font-heading text-xl font-bold text-[#1B2731]">Acceso restringido</h2>
      <p className="text-sm text-[#3E4C59]">El módulo QA / Control Center es exclusivo para administradores.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B2731] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#1B2731]">QA / Control Center</h1>
            <p className="text-sm text-[#3E4C59]">Smoke tests y validación end-to-end · Solo Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#33A19A]/10 text-[#33A19A] border-0">
            {selectedClient?.name || "Global"}
          </Badge>
          <Badge className="bg-[#1B2731]/10 text-[#1B2731] border-0 text-xs">
            {user?.email}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="setup" className="space-y-4">
        <TabsList className="bg-white border border-[#B7CAC9]/20 p-1 h-auto">
          <TabsTrigger value="setup" className="gap-2 data-[state=active]:bg-[#33A19A] data-[state=active]:text-white">
            <Settings className="w-4 h-4" /> Setup
          </TabsTrigger>
          <TabsTrigger value="run" className="gap-2 data-[state=active]:bg-[#33A19A] data-[state=active]:text-white">
            <Play className="w-4 h-4" /> Ejecutar
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-[#33A19A] data-[state=active]:text-white">
            <History className="w-4 h-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <QaSetupTab selectedClient={selectedClient} />
        </TabsContent>

        <TabsContent value="run">
          <QaRunTab selectedClient={selectedClient} user={user} />
        </TabsContent>

        <TabsContent value="history">
          <QaHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}