import DashboardLayout from "@/components/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AnalysisPage, ProjectsPage, QuestionsPage, ResponsesPage, ScoresPage, TasksPage } from "./pages/GeoPages";
import Home from "./pages/Home";
import GeoPublicContentPage from "./pages/GeoPublicContent";
import GeoFlowWizardPage from "./pages/GeoFlowWizard";
import AssetCenterPage from "./pages/AssetCenter";
import DemoGeoPage from "./pages/DemoGeo";
import { AiDiagnosisFlowPage, ContentGenerationFlowPage, ContentPublishingFlowPage, DeliveryReportsFlowPage, InclusionMonitoringFlowPage } from "./pages/V12FlowPages";

function PrivateRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/flow" component={GeoFlowWizardPage} />
        <Route path="/enterprise-profile" component={AssetCenterPage} />
        <Route path="/ai-diagnosis" component={AiDiagnosisFlowPage} />
        <Route path="/content-generation" component={ContentGenerationFlowPage} />
        <Route path="/content-publishing" component={ContentPublishingFlowPage} />
        <Route path="/inclusion-monitoring" component={InclusionMonitoringFlowPage} />
        <Route path="/delivery-reports" component={DeliveryReportsFlowPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/assets" component={AssetCenterPage} />
        <Route path="/diagnosis" component={AiDiagnosisFlowPage} />
        <Route path="/questions" component={QuestionsPage} />
        <Route path="/responses" component={ResponsesPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/scores" component={ScoresPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/reports" component={DeliveryReportsFlowPage} />
        <Route path="/articles" component={ContentGenerationFlowPage} />
        <Route path="/publish" component={ContentPublishingFlowPage} />
        <Route path="/monitoring" component={InclusionMonitoringFlowPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/demo" component={DemoGeoPage} />
      <Route path="/demo/geo" component={DemoGeoPage} />
      <Route path="/geo/content/:projectId/:articleId" component={GeoPublicContentPage} />
      <Route component={PrivateRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
