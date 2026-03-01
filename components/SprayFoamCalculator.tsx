
import React, { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { 
  CalculationMode, 
  EstimateRecord,
  CustomerProfile,
  CalculatorState
} from '../types';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { useSync } from '../hooks/useSync';
import { useEstimates } from '../hooks/useEstimates';
import { calculateResults } from '../utils/calculatorHelpers';
import { generateEstimatePDF, generateDocumentPDF, generateWorkOrderPDF } from '../utils/pdfGenerator';
import { logoutUser } from '../services/supabaseApi';

import LoginPage from './LoginPage';
import { Layout } from './Layout';
import { Calculator } from './Calculator';
import { Dashboard } from './Dashboard';
import { Warehouse } from './Warehouse';
import { Customers } from './Customers';
import { Settings } from './Settings';
import { Profile } from './Profile';
import { WorkOrderStage } from './WorkOrderStage';
import { CrewDashboard } from './CrewDashboard';
import { MaterialReport } from './MaterialReport';

const SprayFoamCalculator: React.FC = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;
  const { handleManualSync } = useSync(); 
  const { loadEstimateForEditing, saveEstimate, handleDeleteEstimate, saveCustomer, confirmWorkOrder } = useEstimates();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [autoTriggerCustomerModal, setAutoTriggerCustomerModal] = useState(false);
  const [initialDashboardFilter, setInitialDashboardFilter] = useState<'all' | 'work_orders'>('all');

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const results = useMemo(() => calculateResults(appData), [appData]);

  const handleLogout = async () => {
    await logoutUser();
    dispatch({ type: 'LOGOUT' });
  };

  const resetCalculator = () => {
    dispatch({ type: 'RESET_CALCULATOR' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (field: keyof CalculatorState, value: any) => {
    dispatch({ type: 'UPDATE_DATA', payload: { [field]: value } });
  };

  const handleSettingsChange = (category: 'wallSettings' | 'roofSettings', field: string, value: any) => {
    dispatch({ type: 'UPDATE_NESTED_DATA', category, field, value });
  };

  const handleProfileChange = (field: keyof typeof appData.companyProfile, value: string) => {
    dispatch({ 
        type: 'UPDATE_DATA', 
        payload: { companyProfile: { ...appData.companyProfile, [field]: value } } 
    });
  };

  const handleWarehouseStockChange = (field: 'openCellSets' | 'closedCellSets', value: number) => {
    dispatch({ 
        type: 'UPDATE_DATA', 
        payload: { warehouse: { ...appData.warehouse, [field]: Math.max(0, value) } } 
    });
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    if (custId === 'new') {
        dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: { ...DEFAULT_STATE.customerProfile } } });
    } else {
        const selected = appData.customers.find(c => c.id === custId);
        if (selected) dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: { ...selected } } });
    }
  };

  const archiveCustomer = (id: string) => {
    if (confirm("Archive this customer?")) {
        const updated = appData.customers.map(c => c.id === id ? { ...c, status: 'Archived' as const } : c);
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updated } });
    }
  };

  const updateInventoryItem = (id: string, field: string, value: any) => { 
    const updatedInv = appData.inventory.map(i => i.id === id ? { ...i, [field]: value } : i);
    dispatch({ type: 'UPDATE_DATA', payload: { inventory: updatedInv } });
  };

  const addInventoryItem = () => {
      const newItem = { id: Math.random().toString(36).substr(2,9), name: '', quantity: 1, unit: 'pcs' };
      dispatch({ type: 'UPDATE_DATA', payload: { inventory: [...appData.inventory, newItem] } });
  };

  const removeInventoryItem = (id: string) => {
      dispatch({ type: 'UPDATE_DATA', payload: { inventory: appData.inventory.filter(i => i.id !== id) } });
  };

  const updateWarehouseItem = (id: string, field: string, value: any) => {
     const updatedItems = appData.warehouse.items.map(i => i.id === id ? { ...i, [field]: value } : i);
     dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: updatedItems } } });
  };

  const handleQuickAction = (action: 'new_estimate' | 'new_customer') => {
    switch(action) {
      case 'new_customer':
        dispatch({ type: 'SET_VIEW', payload: 'customers' });
        setAutoTriggerCustomerModal(true);
        break;
      case 'new_estimate':
        resetCalculator();
        dispatch({ type: 'SET_VIEW', payload: 'calculator' });
        break;
    }
  };

  const handleStageWorkOrder = () => {
    if (!appData.customerProfile.name) {
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Please select or create a customer first.' } });
      return;
    }
    dispatch({ type: 'SET_VIEW', payload: 'work_order_stage' });
  };

  if (!session) {
      return <LoginPage 
          onLoginSuccess={(s) => { 
              dispatch({ type: 'SET_SESSION', payload: s }); 
          }} 
          installPrompt={deferredPrompt}
          onInstall={handleInstallApp}
      />;
  }

  if (ui.isLoading) return <div className="flex h-screen items-center justify-center text-slate-400 bg-slate-900"><Loader2 className="animate-spin mr-2"/> Initializing Workspace...</div>;

  if (session.role === 'crew') {
      return (
          <CrewDashboard 
            state={appData} 
            onLogout={handleLogout} 
            syncStatus={ui.syncStatus}
            onSync={handleManualSync}
            installPrompt={deferredPrompt}
            onInstall={handleInstallApp}
          />
      );
  }

  return (
    <Layout 
      userSession={session} 
      view={ui.view} 
      setView={(v) => dispatch({ type: 'SET_VIEW', payload: v })} 
      syncStatus={ui.syncStatus}
      onLogout={handleLogout}
      onReset={resetCalculator}
      notification={ui.notification}
      clearNotification={() => dispatch({ type: 'SET_NOTIFICATION', payload: null })}
      onQuickAction={handleQuickAction}
      installPrompt={deferredPrompt}
      onInstall={handleInstallApp}
    >
        {ui.view === 'dashboard' && (
            <Dashboard 
                state={appData} 
                onEditEstimate={loadEstimateForEditing}
                onDeleteEstimate={handleDeleteEstimate}
                onNewEstimate={() => { resetCalculator(); dispatch({ type: 'SET_VIEW', payload: 'calculator' }); }}
                initialFilter={initialDashboardFilter}
                onGoToWarehouse={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
            />
        )}

        {ui.view === 'calculator' && (
            <Calculator 
                state={appData}
                results={results}
                editingEstimateId={ui.editingEstimateId}
                onInputChange={handleInputChange}
                onSettingsChange={handleSettingsChange}
                onCustomerSelect={handleCustomerSelect}
                onInventoryUpdate={updateInventoryItem}
                onAddInventory={addInventoryItem}
                onRemoveInventory={removeInventoryItem}
                onSaveEstimate={(status) => saveEstimate(results, status)}
                onGeneratePDF={() => generateEstimatePDF(appData, results)}
                onStageWorkOrder={handleStageWorkOrder}
                onAddNewCustomer={() => { dispatch({ type: 'SET_VIEW', payload: 'customers' }); setAutoTriggerCustomerModal(true); }}
            />
        )}

        {ui.view === 'work_order_stage' && (
            <WorkOrderStage 
                state={appData}
                results={results}
                onUpdateState={handleInputChange}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'calculator' })}
                onConfirm={() => confirmWorkOrder(results)}
            />
        )}

        {ui.view === 'warehouse' && (
            <Warehouse 
                state={appData}
                onStockChange={handleWarehouseStockChange}
                onAddItem={() => dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: [...appData.warehouse.items, { id: Math.random().toString(36).substr(2,9), name: '', quantity: 0, unit: 'pcs' }] } } })}
                onRemoveItem={(id) => dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: appData.warehouse.items.filter(i => i.id !== id) } } })}
                onUpdateItem={updateWarehouseItem}
                onFinishSetup={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
                onViewReport={() => dispatch({ type: 'SET_VIEW', payload: 'material_report' })}
            />
        )}

        {ui.view === 'material_report' && (
            <MaterialReport 
                state={appData}
                onBack={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
            />
        )}

        {(ui.view === 'customers' || ui.view === 'customer_detail') && (
            <Customers 
                state={appData}
                viewingCustomerId={ui.view === 'customer_detail' ? ui.viewingCustomerId : null}
                onSelectCustomer={(id) => { 
                    dispatch({ type: 'SET_VIEWING_CUSTOMER', payload: id }); 
                    dispatch({ type: 'SET_VIEW', payload: id ? 'customer_detail' : 'customers' }); 
                }}
                onSaveCustomer={saveCustomer}
                onArchiveCustomer={archiveCustomer}
                onStartEstimate={(customer) => { 
                    resetCalculator(); 
                    dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: customer } }); 
                    dispatch({ type: 'SET_VIEW', payload: 'calculator' }); 
                }}
                onLoadEstimate={loadEstimateForEditing}
                autoOpen={autoTriggerCustomerModal}
                onAutoOpenComplete={() => setAutoTriggerCustomerModal(false)}
            />
        )}

        {ui.view === 'settings' && (
            <Settings 
                state={appData}
                onUpdateState={(partial) => dispatch({ type: 'UPDATE_DATA', payload: partial })}
                onManualSync={handleManualSync}
                syncStatus={ui.syncStatus}
                onNext={() => {
                   dispatch({ type: 'SET_VIEW', payload: 'warehouse' });
                   dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Settings Saved. Now update your inventory.' } });
                }}
                username={session?.email}
            />
        )}

        {ui.view === 'profile' && (
            <Profile 
                state={appData}
                onUpdateProfile={handleProfileChange}
                onUpdateCrews={(crews) => dispatch({ type: 'UPDATE_DATA', payload: { crews } })}
                onManualSync={handleManualSync}
                syncStatus={ui.syncStatus}
                username={session?.email} 
            />
        )}
    </Layout>
  );
};

export default SprayFoamCalculator;
