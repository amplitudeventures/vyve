import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Analysis from "./pages/Analysis";
import ChatPage from "./pages/ChatPage";
import AppSelection from "./pages/AppSelection";
import { Toaster } from "@/components/ui/toaster";
import { ConfigProvider } from "./contexts/ConfigContext";
import VyveAnalysis2 from "./pages/VyveAnalysis2";

function App() {
  return (
    <ConfigProvider>
      <Router>
        <Routes>
          <Route path="/select-app" element={<AppSelection />} />
          <Route path="/" element={<Index />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/vyve-analysis2" element={<VyveAnalysis2 error={undefined} />} />
        </Routes>
        <Toaster />
      </Router>
    </ConfigProvider>
  );
}

export default App;
