
import React, { useState } from 'react';
import { Upload, Save, Loader2, Users, ShieldCheck, Copy, Plus, Trash, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CalculatorState, CrewProfile } from '../types';
import { inviteCrewMember } from '../services/supabaseApi';

interface ProfileProps {
  state: CalculatorState;
  onUpdateProfile: (field: string, value: string) => void;
  onUpdateCrews: (crews: CrewProfile[]) => void;
  onManualSync: () => void;
  syncStatus: string;
  username?: string;
}

const BLANK_INVITE = { email: '', password: '', name: '', leadName: '', phone: '', truckInfo: '' };

export const Profile: React.FC<ProfileProps> = ({ state, onUpdateProfile, onUpdateCrews, onManualSync, syncStatus, username }) => {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState(BLANK_INVITE);

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const handleInviteCrew = async () => {
    if (!inviteForm.email || !inviteForm.password || !inviteForm.name) {
      setInviteError('Crew name, email, and password are all required.');
      return;
    }
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await inviteCrewMember(inviteForm.email, inviteForm.password, {
        name: inviteForm.name,
        leadName: inviteForm.leadName,
        phone: inviteForm.phone,
        truckInfo: inviteForm.truckInfo,
        status: 'Active',
      });
      setInviteSuccess(`${inviteForm.name} created — syncing...`);
      setInviteForm(BLANK_INVITE);
      setShowInviteForm(false);
      onManualSync(); // reload so new crew appears
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create crew account.');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
     <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-20">
         <div className="flex justify-between items-end mb-2">
             <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Organization Profile</h2>
                <p className="text-slate-500 font-medium text-sm">Manage company branding and crew access credentials.</p>
             </div>
         </div>

         {/* MAIN PROFILE CARD */}
         <div className="bg-white p-8 md:p-10 rounded-3xl border shadow-sm space-y-10">

             {/* 1. BRANDING SECTION */}
             <div className="flex flex-col md:flex-row gap-12">
                 <div className="flex flex-col items-center gap-6">
                     <div className="w-40 h-40 bg-slate-50 rounded-3xl flex items-center justify-center border-4 border-dashed border-slate-100 overflow-hidden relative group shadow-inner">
                         {state.companyProfile.logoUrl ? <img src={state.companyProfile.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" /> : <Upload className="w-10 h-10 text-slate-200" />}
                         <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => onUpdateProfile('logoUrl', r.result as string); r.readAsDataURL(f); } }} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                         <div className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black uppercase tracking-widest z-10 pointer-events-none">Upload Logo</div>
                     </div>
                     <div className="text-center"> <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branding</p> <p className="text-xs font-medium text-slate-400 mt-1 italic">Used on PDF Estimates</p> </div>
                 </div>
                 <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="md:col-span-2"> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Company Name</label> <input type="text" value={state.companyProfile.companyName} onChange={(e) => onUpdateProfile('companyName', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div className="md:col-span-2"> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Business Address</label> <input type="text" value={state.companyProfile.addressLine1} onChange={(e) => onUpdateProfile('addressLine1', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone</label> <input type="text" value={state.companyProfile.phone} onChange={(e) => onUpdateProfile('phone', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label> <input type="email" value={state.companyProfile.email} onChange={(e) => onUpdateProfile('email', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                 </div>
             </div>

             {/* 2. CREW ACCESS SECTION */}
             <div className="border-t border-slate-100 pt-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Crew / Rig Logins</h3>
                            <p className="text-xs text-slate-500 font-medium">Each crew logs in with email + password on the Crew Login tab.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setShowInviteForm(true); setInviteError(null); setInviteSuccess(null); }}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Crew
                    </button>
                </div>

                {/* Admin account email display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            <ShieldCheck className="w-3 h-3"/> Admin Account Email
                        </label>
                        <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-base text-slate-700">{username || "Loading..."}</span>
                            <button onClick={() => username && copyToClipboard(username)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-brand transition-colors" title="Copy">
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Success banner */}
                {inviteSuccess && (
                    <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-xl flex items-center gap-2 border border-emerald-100">
                        <CheckCircle2 className="w-4 h-4 shrink-0" /> {inviteSuccess}
                    </div>
                )}

                {/* Invite Form */}
                {showInviteForm && (
                    <div className="mb-6 bg-slate-50 border-2 border-brand/20 p-6 rounded-2xl space-y-4">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">New Crew Account</h4>

                        {inviteError && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2 border border-red-100">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {inviteError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Crew / Rig Name *</label>
                                <input
                                    type="text"
                                    value={inviteForm.name}
                                    onChange={e => setInviteForm({...inviteForm, name: e.target.value})}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                    placeholder="e.g. Rig 1"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                                    <Mail className="w-3 h-3"/> Login Email *
                                </label>
                                <input
                                    type="email"
                                    value={inviteForm.email}
                                    onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                    placeholder="rig1@yourcompany.com"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                                    <Lock className="w-3 h-3"/> Password *
                                </label>
                                <input
                                    type="text"
                                    value={inviteForm.password}
                                    onChange={e => setInviteForm({...inviteForm, password: e.target.value})}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-mono font-bold focus:ring-2 focus:ring-brand outline-none"
                                    placeholder="Min 6 characters"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Lead Name</label>
                                <input
                                    type="text"
                                    value={inviteForm.leadName}
                                    onChange={e => setInviteForm({...inviteForm, leadName: e.target.value})}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
                                <input
                                    type="text"
                                    value={inviteForm.phone}
                                    onChange={e => setInviteForm({...inviteForm, phone: e.target.value})}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                    placeholder="555-1234"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Truck / Rig Info</label>
                                <input
                                    type="text"
                                    value={inviteForm.truckInfo}
                                    onChange={e => setInviteForm({...inviteForm, truckInfo: e.target.value})}
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                    placeholder="F-350 / License Plate"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => { setShowInviteForm(false); setInviteError(null); setInviteForm(BLANK_INVITE); }}
                                disabled={inviteLoading}
                                className="flex-1 p-3 border-2 border-slate-100 rounded-xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInviteCrew}
                                disabled={inviteLoading}
                                className="flex-1 p-3 bg-brand hover:bg-brand-hover text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                            >
                                {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Create Crew Login'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Existing crew list */}
                <div className="space-y-4">
                    {(state.crews || []).length === 0 && !showInviteForm && (
                        <div className="text-center py-8 text-slate-400 text-sm font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                            No crew accounts yet. Click <strong>Add Crew</strong> to create the first login.
                        </div>
                    )}

                    {(state.crews || []).map((crew, index) => (
                        <div key={crew.id} className="flex flex-col gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 relative">
                            <div className="absolute top-4 right-4">
                                <button
                                    onClick={() => onUpdateCrews((state.crews || []).filter((_, i) => i !== index))}
                                    className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                    title="Remove from list"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Login email badge */}
                            {crew.email && (
                                <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg w-fit">
                                    <Mail className="w-3 h-3 text-blue-500" />
                                    <span className="font-mono text-xs font-bold text-blue-700">{crew.email}</span>
                                    <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">login</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-12">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Crew / Rig Name</label>
                                    <input
                                        type="text"
                                        value={crew.name}
                                        onChange={(e) => {
                                            const updated = [...(state.crews || [])];
                                            updated[index] = { ...updated[index], name: e.target.value };
                                            onUpdateCrews(updated);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="e.g. Rig 1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Lead Name</label>
                                    <input
                                        type="text"
                                        value={crew.leadName || ''}
                                        onChange={(e) => {
                                            const updated = [...(state.crews || [])];
                                            updated[index] = { ...updated[index], leadName: e.target.value };
                                            onUpdateCrews(updated);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
                                    <input
                                        type="text"
                                        value={crew.phone || ''}
                                        onChange={(e) => {
                                            const updated = [...(state.crews || [])];
                                            updated[index] = { ...updated[index], phone: e.target.value };
                                            onUpdateCrews(updated);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="555-1234"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Truck / Rig Info</label>
                                    <input
                                        type="text"
                                        value={crew.truckInfo || ''}
                                        onChange={(e) => {
                                            const updated = [...(state.crews || [])];
                                            updated[index] = { ...updated[index], truckInfo: e.target.value };
                                            onUpdateCrews(updated);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="F-350 / License Plate"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                                    <select
                                        value={crew.status || 'Active'}
                                        onChange={(e) => {
                                            const updated = [...(state.crews || [])];
                                            updated[index] = { ...updated[index], status: e.target.value as 'Active' | 'Inactive' };
                                            onUpdateCrews(updated);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none appearance-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="mt-4 text-[10px] text-slate-400 font-medium italic">
                    * Crew accounts are real Supabase logins. Crew members log in with their email + password on the Crew Login tab.
                    Editing name/metadata requires "Save &amp; Sync" to take effect.
                </p>
             </div>

             {/* SAVE BUTTON */}
             <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-slate-400 font-medium italic">Changes are saved automatically locally, but you must sync to update the cloud.</p>
                <button
                    onClick={onManualSync}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-10 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-200"
                >
                    {syncStatus === 'syncing' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                    Save & Sync Profile
                </button>
             </div>
         </div>
     </div>
  );
};
