import DashboardLayout from "@/components/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AnalysisPage, ArticlesPage, ProjectsPage, QuestionsPage, ReportsPage, ResponsesPage, ScoresPage, TasksPage } from "./pages/GeoPages";
import GeoPublicContentPage from "./pages/GeoPublicContent";

function PrivateRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={ProjectsPage} />
        <Route path="/questions" component={QuestionsPage} />
        <Route path="/responses" component={ResponsesPage} />
        <Route path="/analysis" component={AnalysisPage} />
        <Route path="/scores" component={ScoresPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/articles" component={ArticlesPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/geo/content/:projectId/:articleId" component={GeoPublicContentPage} />
      <Route component={PrivateRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
