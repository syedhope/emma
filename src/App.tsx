
import React from 'react';
import { CaseProvider, useCaseContext } from './context/CaseContext';
import { Layout } from './components/Layout';
import { Home } from './views/Home';
import { MiraUpload } from './views/MiraUpload';
import { NoraDashboard } from './views/NoraDashboard';
import { LumaExplainer } from './views/LumaExplainer';
import { HelpView } from './views/HelpView';
import { AppView } from './types';

const AppContent: React.FC = () => {
  const { activeView } = useCaseContext();

  const renderView = () => {
    switch (activeView) {
      case AppView.HOME:
        return <Home />;
      case AppView.MIRA:
        return <MiraUpload />;
      case AppView.NORA:
        return <NoraDashboard />;
      case AppView.LUMA:
        return <LumaExplainer />;
      case AppView.HELP:
        return <HelpView />;
      default:
        return <Home />;
    }
  };

  return (
    <Layout>
      {renderView()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <CaseProvider>
      <AppContent />
    </CaseProvider>
  );
};

export default App;