/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AgentsHub from './pages/AgentsHub';
import AgentsWhatsApp from './pages/AgentsWhatsApp';
import AuditLog from './pages/AuditLog';
import AutomationRuns from './pages/AutomationRuns';
import CalendarView from './pages/CalendarView';
import Chat from './pages/Chat';
import Clients from './pages/Clients';
import Dashboard from './pages/Dashboard';
import DeliveryCenter from './pages/DeliveryCenter';
import Documents from './pages/Documents';
import GPTConfigurationManager from './pages/GPTConfigurationManager';
import KnowledgeHub from './pages/KnowledgeHub';
import Meetings from './pages/Meetings';
import Milestones from './pages/Milestones';
import MonitoringDashboard from './pages/MonitoringDashboard';
import NotificationSettings from './pages/NotificationSettings';
import Notifications from './pages/Notifications';
import Projects from './pages/Projects';
import QAControlCenter from './pages/QAControlCenter';
import Search from './pages/Search';
import Tasks from './pages/Tasks';
import TimeTracking from './pages/TimeTracking';
import WorkflowRules from './pages/WorkflowRules';
import PromptTemplateManager from './pages/PromptTemplateManager';
import ReportTemplateManager from './pages/ReportTemplateManager';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AgentsHub": AgentsHub,
    "AgentsWhatsApp": AgentsWhatsApp,
    "AuditLog": AuditLog,
    "AutomationRuns": AutomationRuns,
    "CalendarView": CalendarView,
    "Chat": Chat,
    "Clients": Clients,
    "Dashboard": Dashboard,
    "DeliveryCenter": DeliveryCenter,
    "Documents": Documents,
    "GPTConfigurationManager": GPTConfigurationManager,
    "KnowledgeHub": KnowledgeHub,
    "Meetings": Meetings,
    "Milestones": Milestones,
    "MonitoringDashboard": MonitoringDashboard,
    "NotificationSettings": NotificationSettings,
    "Notifications": Notifications,
    "Projects": Projects,
    "QAControlCenter": QAControlCenter,
    "Search": Search,
    "Tasks": Tasks,
    "TimeTracking": TimeTracking,
    "WorkflowRules": WorkflowRules,
    "PromptTemplateManager": PromptTemplateManager,
    "ReportTemplateManager": ReportTemplateManager,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};