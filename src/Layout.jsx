import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import { canManageGPT } from "./components/utils/roleUtils";
import {
              LayoutDashboard, Calendar, Clock, FolderTree, Shield, Users,
              FileText, CheckSquare, MessageSquare, Flag,
              Search, Bell, ChevronDown, Menu, X, LogOut, FlaskConical, Zap, MessageCircle, Activity, TrendingUp
            } from "lucide-react";
import { Activity as ActivityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { name: "Búsqueda", icon: Search, page: "Search" },
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Clientes", icon: FolderTree, page: "Clients" },
  { name: "Proyectos", icon: FolderTree, page: "Projects" },
  { name: "Tareas", icon: CheckSquare, page: "Tasks" },
  { name: "Hitos", icon: Flag, page: "Milestones" },
  { name: "Calendario", icon: Calendar, page: "CalendarView" },
  { name: "Reuniones", icon: Users, page: "Meetings" },
  { name: "Documentos", icon: FileText, page: "Documents" },
  { name: "Chat", icon: MessageSquare, page: "Chat" },
  { name: "Agentes WhatsApp", icon: MessageCircle, page: "AgentsHub" },
  { name: "Conocimiento", icon: Zap, page: "KnowledgeHub" },
  { name: "Registro Horas", icon: Clock, page: "TimeTracking" },
  { name: "Notificaciones", icon: Bell, page: "Notifications" },
  { name: "Monitoreo", icon: Activity, page: "MonitoringDashboard" },
  { name: "Administración", icon: Shield, page: "AdminPanel" },
  { name: "Compliance", icon: Shield, page: "ComplianceCenter" },
  { name: "Auditoría", icon: Shield, page: "AuditLog" },
  { name: "Delivery Alerts", icon: Bell, page: "DeliveryAlertsManager" },
  { name: "QA Center", icon: FlaskConical, page: "QAControlCenter" },
  { name: "Notif. Config", icon: Bell, page: "NotificationSettings" },
  { name: "Automatizaciones", icon: Zap, page: "WorkflowRules" },
  { name: "Historial Auto.", icon: Zap, page: "AutomationRuns" },
  { name: "GPT Config", icon: Zap, page: "GPTConfigurationManager" },
  { name: "Prompts", icon: FileText, page: "PromptTemplateManager" },
  { name: "Templates", icon: FileText, page: "ReportTemplateManager" },
  { name: "Executive Dashboard", icon: TrendingUp, page: "ExecutiveDashboard" },
  { name: "Delivery Analytics", icon: TrendingUp, page: "DeliveryAnalytics" },
  { name: "Delivery Activity", icon: Activity, page: "DeliveryActivityLog" },
  { name: "Delivery Webhooks", icon: Zap, page: "DeliveryWebhooksManager" },
  { name: "Delivery Settings", icon: Shield, page: "DeliverySettings" },
  { name: "BigQuery Custom", icon: TrendingUp, page: "BigQueryCustom" },
  { name: "Consultas Guardadas", icon: Zap, page: "SavedQueriesManager" },
  { name: "Reportes Personalizados", icon: TrendingUp, page: "CustomReportsBuilder" },
  { name: "Gestión Permisos", icon: Shield, page: "PermissionManager" },
  ];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [me, clientList] = await Promise.all([
      base44.auth.me(),
      base44.entities.Client.list()
    ]);
    setUser(me);
    setClients(clientList);
    if (clientList.length > 0 && !selectedClient) {
      setSelectedClient(clientList[0]);
    }
    const notifs = await base44.entities.Notification.filter({ user_email: me.email, is_read: false }, '-created_date', 10);
    setNotifications(notifs);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#FFFAF3]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} hidden lg:flex flex-col bg-[#1B2731] text-white transition-all duration-300 flex-shrink-0`}>
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-[#33A19A] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm font-heading">DG</span>
          </div>
          {sidebarOpen && (
            <span className="font-heading font-semibold text-lg tracking-tight">DATA GOAL</span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            // Hide GPT Config if user is not admin
            if (item.page === 'GPTConfigurationManager' && user && !canManageGPT(user.role)) {
              return null;
            }

            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-smooth text-sm font-medium
                  ${isActive
                    ? 'bg-[#33A19A] text-white shadow-lg shadow-[#33A19A]/20'
                    : 'text-[#B7CAC9] hover:bg-white/8 hover:text-white'
                  }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center py-2 text-[#B7CAC9] hover:text-white transition-smooth rounded-lg hover:bg-white/8"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#1B2731] text-white p-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#33A19A] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">DG</span>
                </div>
                <span className="font-heading font-semibold">DATA GOAL</span>
              </div>
              <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                // Hide GPT Config if user is not admin
                if (item.page === 'GPTConfigurationManager' && user && !canManageGPT(user.role)) {
                  return null;
                }

                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      ${isActive ? 'bg-[#33A19A] text-white' : 'text-[#B7CAC9] hover:bg-white/8 hover:text-white'}`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-[#B7CAC9]/30 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="w-6 h-6 text-[#3E4C59]" />
          </button>

          {/* Client selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-[#B7CAC9]/40 text-[#1B2731] font-medium gap-2 min-w-[160px]">
                <FolderTree className="w-4 h-4 text-[#33A19A]" />
                <span className="truncate">{selectedClient?.name || "Seleccionar cliente"}</span>
                <ChevronDown className="w-4 h-4 text-[#3E4C59] ml-auto" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {clients.map(c => (
                <DropdownMenuItem key={c.id} onClick={() => setSelectedClient(c)}>
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B7CAC9]" />
              <Input
                placeholder="Buscar en todo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#FFFAF3] border-[#B7CAC9]/30 focus:border-[#33A19A] text-sm"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-[#3E4C59]" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3 border-b">
                  <h4 className="font-heading font-semibold text-sm">Notificaciones</h4>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[#3E4C59]">Sin notificaciones</div>
                ) : (
                  notifications.slice(0, 5).map(n => (
                    <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3">
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="text-xs text-[#3E4C59]">{n.message}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <div className="w-8 h-8 rounded-full bg-[#33A19A] flex items-center justify-center text-white text-sm font-semibold">
                    {user?.full_name?.[0] || "U"}
                  </div>
                  <span className="hidden md:block text-sm font-medium text-[#1B2731]">{user?.full_name || "Usuario"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs text-[#3E4C59]">{user?.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {React.cloneElement(children, { selectedClient, user, clients })}
        </main>
      </div>
    </div>
  );
}