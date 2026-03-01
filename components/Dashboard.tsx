
import React, { useMemo, useState, useEffect } from 'react';
import { DollarSign, HardHat, Receipt, Filter, Plus, Trash, CheckCircle2, AlertCircle, Clock, TrendingUp, TrendingDown, Wallet, PieChart, Fuel, ArrowRight, AlertTriangle, BarChart3 } from 'lucide-react';
import { CalculatorState, EstimateRecord } from '../types';

interface DashboardProps {
  state: CalculatorState;
  onEditEstimate: (record: EstimateRecord) => void;
  onDeleteEstimate: (id: string, e?: React.MouseEvent) => void;
  onNewEstimate: () => void;
  initialFilter?: 'all' | 'work_orders';
  onGoToWarehouse: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  state, 
  onEditEstimate, 
  onDeleteEstimate, 
  onNewEstimate,
  initialFilter = 'all',
  onGoToWarehouse
}) => {
  const [dashboardFilter, setDashboardFilter] = useState<'all' | 'review' | 'work_orders'>('all');

  // React to prop changes
  useEffect(() => {
    if (initialFilter) setDashboardFilter(initialFilter === 'work_orders' ? 'work_orders' : 'all');
  }, [initialFilter]);

  const dashboardStats = useMemo(() => {
    if (!state.savedEstimates) return { reviewNeeded: 0 };
    return state.savedEstimates.reduce((acc, est) => {
      if (est.status === 'Work Order' && est.executionStatus === 'Completed') {
          acc.reviewNeeded++;
      }
      return acc;
    }, { reviewNeeded: 0 });
  }, [state.savedEstimates]);

  // Inventory Health & Pipeline Demand
  const inventoryHealth = useMemo(() => {
      const ocStock = state.warehouse.openCellSets;
      const ccStock = state.warehouse.closedCellSets;
      
      const ocShortage = ocStock < 0 ? Math.abs(ocStock) : 0;
      const ccShortage = ccStock < 0 ? Math.abs(ccStock) : 0;
      const hasShortage = ocShortage > 0 || ccShortage > 0;

      // Calculate Pipeline Demand (Draft Estimates)
      let pipelineOc = 0;
      let pipelineCc = 0;
      state.savedEstimates.forEach(est => {
          if (est.status === 'Draft') {
              pipelineOc += est.results.openCellSets || 0;
              pipelineCc += est.results.closedCellSets || 0;
          }
      });

      return { ocStock, ccStock, ocShortage, ccShortage, hasShortage, pipelineOc, pipelineCc };
  }, [state.warehouse, state.savedEstimates]);

  const filteredEstimates = useMemo(() => {
    let filtered = (state.savedEstimates || []).filter(e => e && e.status !== 'Archived');
    
    if (dashboardFilter === 'review') {
        return filtered.filter(e => e.status === 'Work Order' && e.executionStatus === 'Completed');
    }
    if (dashboardFilter === 'work_orders') {
        return filtered.filter(e => e.status === 'Work Order' && e.executionStatus !== 'Completed');
    }
    return filtered;
  }, [state.savedEstimates, dashboardFilter]);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-200">
        
        {/* INVENTORY HEALTH BANNER */}
        <div 
            onClick={onGoToWarehouse}
            className={`p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between cursor-pointer relative overflow-hidden group hover:scale-[1.01] transition-all ${
                inventoryHealth.hasShortage 
                ? 'bg-red-600 text-white shadow-red-200' 
                : 'bg-slate-900 text-white shadow-slate-200'
            }`}
        >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-15 transition-opacity">
                <Fuel className="w-32 h-32 -rotate-12 translate-x-8 -translate-y-8" />
            </div>

            <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
                <div className={`p-3 rounded-xl shadow-lg transition-transform ${
                    inventoryHealth.hasShortage ? 'bg-white text-red-600' : 'bg-brand text-white shadow-red-900/20'
                }`}>
                    {inventoryHealth.hasShortage ? <AlertTriangle className="w-6 h-6 animate-pulse" /> : <Fuel className="w-6 h-6" />}
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1 flex items-center gap-2">
                        {inventoryHealth.hasShortage ? 'CRITICAL SHORTAGE DETECTED' : 'WAREHOUSE STOCK'}
                    </div>
                    <div className="flex items-baseline gap-6">
                        <div>
                            <span className="text-2xl font-black">{inventoryHealth.ocStock.toFixed(2)}</span>
                            <span className="text-xs font-bold opacity-70 ml-1">OC Sets</span>
                            {inventoryHealth.ocShortage > 0 && (
                                <div className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded mt-1">SHORT: {inventoryHealth.ocShortage.toFixed(2)}</div>
                            )}
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div>
                            <span className="text-2xl font-black">{inventoryHealth.ccStock.toFixed(2)}</span>
                            <span className="text-xs font-bold opacity-70 ml-1">CC Sets</span>
                            {inventoryHealth.ccShortage > 0 && (
                                <div className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded mt-1">SHORT: {inventoryHealth.ccShortage.toFixed(2)}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Pipeline Context (Desktop) */}
            <div className="hidden md:flex flex-col items-end relative z-10 border-r border-white/10 pr-6 mr-6 h-full justify-center">
                <div className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Pipeline Demand (Drafts)</div>
                <div className="flex gap-4 text-xs font-bold opacity-90">
                    <span>OC: {inventoryHealth.pipelineOc.toFixed(1)} Needed</span>
                    <span>CC: {inventoryHealth.pipelineCc.toFixed(1)} Needed</span>
                </div>
            </div>
            
            <div className="relative z-10 flex items-center gap-2 mt-4 md:mt-0">
                <span className="text-xs font-bold uppercase tracking-widest hidden md:block opacity-80 group-hover:opacity-100 transition-colors">
                    {inventoryHealth.hasShortage ? 'Resolve Shortages' : 'Manage Inventory'}
                </span>
                <div className={`p-2 rounded-full transition-colors ${inventoryHealth.hasShortage ? 'bg-white text-red-600' : 'bg-slate-800 group-hover:bg-brand'}`}>
                    <ArrowRight className="w-4 h-4" />
                </div>
            </div>
        </div>

        {/* OPERATIONS VIEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => setDashboardFilter('all')} className={`text-left p-6 rounded-2xl shadow-lg relative overflow-hidden transition-all transform hover:scale-[1.01] ring-2 ${dashboardFilter === 'all' ? 'ring-brand bg-slate-900 text-white' : 'ring-transparent bg-white text-slate-900 border border-slate-200'}`}>
                {dashboardFilter === 'all' && <div className="absolute top-0 right-0 p-4 opacity-10 text-white"><HardHat className="w-24 h-24" /></div>}
                <p className={`font-medium text-xs uppercase tracking-wider mb-2 ${dashboardFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>Active Pipeline</p>
                <p className={`text-xs mt-2 ${dashboardFilter === 'all' ? 'text-slate-500' : 'text-slate-400'}`}>{state.savedEstimates.filter(e => e.status !== 'Archived').length} Active Jobs</p>
            </button>
            
            <button onClick={() => setDashboardFilter('review')} className={`text-left p-6 rounded-2xl relative overflow-hidden border transition-all transform hover:scale-[1.01] ring-2 ${dashboardFilter === 'review' ? 'ring-emerald-500 bg-emerald-50 border-emerald-200' : dashboardStats.reviewNeeded > 0 ? 'ring-emerald-300 bg-emerald-50/50 border-emerald-200' : 'ring-transparent bg-white border-slate-200'}`}>
                <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600"><CheckCircle2 className="w-24 h-24" /></div>
                <div className="flex items-center gap-2 mb-2">
                    <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">Ready for Review</p>
                    {dashboardStats.reviewNeeded > 0 && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                    )}
                </div>
                <p className="text-3xl font-bold text-slate-800">{dashboardStats.reviewNeeded}</p>
                <p className="text-xs text-emerald-600 font-bold mt-2">Jobs Completed by Crew</p>
            </button>

            <button onClick={() => setDashboardFilter('work_orders')} className={`text-left p-6 rounded-2xl relative overflow-hidden border transition-all transform hover:scale-[1.01] ring-2 ${dashboardFilter === 'work_orders' ? 'ring-brand bg-red-50 border-red-200' : 'ring-transparent bg-white border-slate-200'}`}>
                <div className="absolute top-0 right-0 p-4 opacity-5 text-brand"><HardHat className="w-24 h-24" /></div>
                <p className="text-slate-500 font-medium text-xs uppercase tracking-wider mb-2">In Progress</p>
                <p className="text-3xl font-bold text-slate-800">{state.savedEstimates.filter(e => e.status === 'Work Order' && e.executionStatus !== 'Completed').length}</p>
            </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-lg font-bold text-slate-800">
                    {dashboardFilter === 'all' ? 'All Active Jobs' : 
                    dashboardFilter === 'review' ? 'Ready for Review' : 
                    'Crew In Progress'}
                </h2>
                <div className="flex gap-2">
                    {dashboardFilter !== 'all' && ( <button onClick={() => setDashboardFilter('all')} className="px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"> <Filter className="w-4 h-4 inline mr-1" /> Clear </button> )}
                    <button onClick={onNewEstimate} className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md shadow-red-200"> <Plus className="w-4 h-4" /> New Estimate </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                        <tr><th className="px-6 py-4">Customer</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredEstimates.length === 0 ? (
                            <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No matching records found.</td></tr>
                        ) : (
                            filteredEstimates.map(est => (
                                <tr key={est.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onEditEstimate(est)}>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 flex items-center gap-2">
                                            {est.customer?.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium">{new Date(est.date).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {/* Dynamic Status Badges */}
                                        {est.status === 'Work Order' && est.executionStatus === 'Completed' ? (
                                            <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit">
                                                <CheckCircle2 className="w-3 h-3" /> Review Needed
                                            </span>
                                        ) : est.status === 'Work Order' ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit">
                                                    <Clock className="w-3 h-3" /> In Progress
                                                </span>
                                                {est.assignedCrewId && (
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                        Crew: {state.crews?.find(c => c.id === est.assignedCrewId)?.name || 'Unknown'}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit block ${
                                                est.status === 'Draft' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {est.status}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end items-center gap-2">
                                            <button 
                                                onClick={(e) => onDeleteEstimate(est.id, e)} 
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            > 
                                                <Trash className="w-4 h-4" /> 
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};
