import React from 'react';
import { X, Search, ChevronDown, AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, Plus, Check, Minus, Edit2, MessageCircle, Bell, Settings2, Clock, Save, Briefcase, User, Phone, Mail, Loader2, AlertCircle, Lock, Copy, Link2, Upload, FileText, Camera, Image as ImageIcon } from 'lucide-react';
import { Resident, PackageItem, Staff } from '../../types';
import { createStaffInvite, type StaffInviteRole } from '../../services/dataService';
import { useToast } from '../../contexts/ToastContext';

// --- MODAL NOVA RESERVA ---
export const NewReservationModal = ({
  isOpen, onClose, data, setData, areasStatus, searchQuery, setSearchQuery, 
  showSuggestions, setShowSuggestions, filteredResidents, hasConflict, onConfirm,
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-600 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-900/50 text-white rounded-[40px] shadow-2xl p-10 border border-white/5 animate-in zoom-in duration-300">
         <header className="flex justify-between items-center mb-10">
            <div>
               <h4 className="text-3xl font-black uppercase tracking-tight text-white">Nova Reserva</h4>
               <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Agendamento de Espaço</p>
            </div>
            <button onClick={onClose} className="p-4 bg-white/5 rounded-3xl hover:bg-white/10 transition-colors border border-white/5"><X className="w-5 h-5"/></button>
         </header>
         
         <div className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Área Comum</label>
               <div className="relative">
                  <select 
                    value={data.area}
                    onChange={(e) => {
                      const area = areasStatus.find((a: any) => a.name === e.target.value);
                      setData({ ...data, area: e.target.value, areaId: area ? area.id : '' });
                    }}
                    className="w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border-none focus:ring-1 focus:ring-white/30 appearance-none text-white transition-all shadow-inner"
                  >
                     <option value="" className="bg-zinc-900 text-white">Selecione a área</option>
                     {areasStatus.map((area: any) => (
                        <option key={area.id} value={area.name} className="bg-zinc-900 text-white">{area.name}</option>
                     ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Morador</label>
                  <div className="relative group">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                         <input 
                           type="text" 
                           placeholder="Buscar..."
                           value={searchQuery || data.resident}
                           onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setData({...data, resident: e.target.value});
                              setShowSuggestions(true);
                           }}
                           onFocus={() => setShowSuggestions(true)}
                           className="w-full pl-12 pr-4 p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border-none focus:ring-1 focus:ring-white/30 text-white placeholder:text-zinc-600 transition-all shadow-inner"
                           autoComplete="off"
                         />
                      </div>
                      {showSuggestions && searchQuery && filteredResidents.length > 0 && (
                         <div className="absolute top-full left-0 w-full mt-2 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                            {filteredResidents.map((r: Resident) => (
                               <div 
                                 key={r.id}
                                 onClick={() => {
                                    setData({ ...data, resident: r.name, unit: r.unit, residentId: r.id });
                                    setSearchQuery(r.name);
                                    setShowSuggestions(false);
                                 }}
                                 className="p-4 hover:bg-white/10 cursor-pointer flex justify-between items-center group transition-colors border-b border-white/5 last:border-0"
                               >
                                  <span className="text-xs font-bold uppercase text-white group-hover:text-blue-400">{r.name}</span>
                                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-white">UN {r.unit}</span>
                               </div>
                            ))}
                         </div>
                      )}
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Unidade</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 w-1 bg-white/10 rounded-l-2xl"></div>
                     <input 
                       type="text" 
                       readOnly
                       value={data.unit}
                       className="w-full p-5 bg-black/20 rounded-2xl outline-none font-black text-sm border border-transparent text-white/50 cursor-not-allowed text-center tracking-widest"
                       placeholder="---"
                     />
                  </div>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Data</label>
               <input 
                 type="date"
                 value={data.date}
                 onChange={(e) => setData({...data, date: e.target.value})}
                 className="w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border-none focus:ring-1 focus:ring-white/30 text-white uppercase tracking-widest shadow-inner cursor-pointer"
               />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ml-2 transition-colors ${hasConflict ? 'text-red-500' : 'text-zinc-500'}`}>Início</label>
                  <input 
                    type="time"
                    value={data.startTime}
                    onChange={(e) => setData({...data, startTime: e.target.value})}
                    className={`w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border border-transparent focus:ring-1 focus:ring-white/30 text-white shadow-inner transition-all ${hasConflict ? 'border-red-500/50 bg-red-500/10' : ''}`}
                  />
               </div>
               <div className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ml-2 transition-colors ${hasConflict ? 'text-red-500' : 'text-zinc-500'}`}>Fim</label>
                  <input 
                    type="time"
                    value={data.endTime}
                    onChange={(e) => setData({...data, endTime: e.target.value})}
                    className={`w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border border-transparent focus:ring-1 focus:ring-white/30 text-white shadow-inner transition-all ${hasConflict ? 'border-red-500/50 bg-red-500/10' : ''}`}
                  />
               </div>
            </div>

            {hasConflict && (
               <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wide">Horário Indisponível (Conflito)</span>
               </div>
            )}

            <button 
              onClick={onConfirm}
              disabled={!data.residentId || !data.date || hasConflict}
              className="w-full py-6 bg-white text-black rounded-[24px] font-black uppercase text-[11px] tracking-[0.2em] hover:bg-zinc-200 hover:scale-[1.02] active:scale-95 transition-all mt-6 shadow-xl disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
               {hasConflict ? 'Verifique o Horário' : 'Confirmar Agendamento'}
            </button>
         </div>
      </div>
    </div>
  );
};

// --- MODAL NOVO VISITANTE ---
export const NewVisitorModal = ({
  isOpen, onClose, step, setStep, data, setData, searchResident, setSearchResident,
  filteredResidents, accessTypes, handleRemoveAccessType, isAddingAccessType, setIsAddingAccessType,
  newAccessTypeInput, setNewAccessTypeInput, handleAddAccessType, onConfirm
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white text-black rounded-[48px] shadow-2xl p-8 md:p-12 animate-in zoom-in duration-500">
         <header className="flex justify-between items-start mb-8">
            <div>
               <h4 className="text-3xl font-black uppercase tracking-tighter">Novo Acesso</h4>
               <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.3em]">Passo 0{step} de 03</p>
            </div>
            <button onClick={onClose} className="p-4 bg-zinc-50 rounded-3xl hover:bg-zinc-100 transition-all"><X className="w-6 h-6"/></button>
         </header>

         {step === 1 && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="relative">
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Vincular Morador</label>
                 <div className="relative">
                   <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30" />
                   <input 
                     autoFocus type="text" placeholder="Buscar por Nome ou Unidade..." 
                     value={searchResident}
                     onChange={e => { setSearchResident(e.target.value); setData({...data, unit: '', residentName: ''}); }}
                     className="w-full pl-14 pr-6 py-6 bg-zinc-50 rounded-[32px] font-bold text-lg outline-none border-2 border-transparent focus:border-black/5 placeholder:opacity-20"
                   />
                 </div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto custom-scrollbar space-y-2">
                 {filteredResidents.length > 0 ? (
                    filteredResidents.map((r: Resident) => (
                       <button 
                         key={r.id} 
                         onClick={() => { setData({ ...data, unit: r.unit, residentName: r.name }); setSearchResident(r.name); }}
                         className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${data.unit === r.unit ? 'bg-black text-white shadow-xl' : 'bg-zinc-50 hover:bg-zinc-100'}`}
                       >
                          <div className="text-left">
                             <h6 className="font-black text-sm uppercase">{r.name}</h6>
                             <p className={`text-[10px] font-bold uppercase tracking-widest ${data.unit === r.unit ? 'opacity-60' : 'opacity-40'}`}>Unidade {r.unit}</p>
                          </div>
                          {data.unit === r.unit && <CheckCircle2 className="w-5 h-5" />}
                       </button>
                    ))
                 ) : (
                    searchResident && <p className="text-center text-xs opacity-40 py-4 font-black uppercase">Nenhum morador encontrado</p>
                 )}
              </div>
              <button 
                onClick={() => setStep(2)} disabled={!data.unit}
                className="w-full py-6 bg-black text-white rounded-[32px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
           </div>
         )}

         {step === 2 && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between mb-4 border border-black/5">
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Vinculado a</p>
                    <h6 className="text-sm font-black uppercase">{data.residentName} <span className="opacity-40 ml-1">({data.unit})</span></h6>
                 </div>
                 <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Nome do Visitante</label>
                 <input 
                   autoFocus type="text" placeholder="Nome Completo" 
                   value={data.name}
                   onChange={e => setData({ ...data, name: e.target.value })}
                   className="w-full p-5 bg-zinc-50 rounded-[24px] font-bold text-lg outline-none border-2 border-transparent focus:border-black/5 placeholder:opacity-20"
                 />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Documento (Opcional)</label>
                 <input 
                   type="text" placeholder="RG ou CPF" 
                   value={data.doc}
                   onChange={e => setData({ ...data, doc: e.target.value })}
                   className="w-full p-5 bg-zinc-50 rounded-[24px] font-bold text-lg outline-none border-2 border-transparent focus:border-black/5 placeholder:opacity-20"
                 />
              </div>
              <div className="flex gap-4 mt-4">
                 <button onClick={() => setStep(1)} className="p-6 bg-zinc-50 rounded-[32px] hover:bg-zinc-100"><ChevronLeft className="w-6 h-6"/></button>
                 <button onClick={() => setStep(3)} disabled={!data.name} className="flex-1 py-6 bg-black text-white rounded-[32px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">Próximo</button>
              </div>
           </div>
         )}

         {step === 3 && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div>
                 <div className="flex justify-between items-center mb-2 px-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Tipo de Acesso</label>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {accessTypes.map((type: string) => (
                       <div key={type} className="relative group">
                          <button 
                            onClick={() => setData({ ...data, type })}
                            className={`py-3 px-5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${data.type === type ? 'bg-black text-white shadow-lg scale-105' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}
                          >
                             {type}
                          </button>
                          {accessTypes.length > 1 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemoveAccessType(type); }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:scale-110"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                       </div>
                    ))}
                    {isAddingAccessType ? (
                       <div className="flex items-center bg-zinc-50 rounded-[18px] border border-black/10 overflow-hidden animate-in fade-in zoom-in duration-200">
                          <input 
                            autoFocus type="text" value={newAccessTypeInput}
                            onChange={e => setNewAccessTypeInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddAccessType()}
                            placeholder="Novo Tipo..."
                            className="w-24 px-3 py-2 bg-transparent text-[10px] font-bold outline-none uppercase"
                          />
                          <button onClick={handleAddAccessType} className="p-2 hover:bg-black hover:text-white transition-colors"><Check className="w-3 h-3"/></button>
                       </div>
                    ) : (
                       <button onClick={() => setIsAddingAccessType(true)} className="py-3 px-4 rounded-[18px] border border-dashed border-zinc-200 text-zinc-300 hover:text-black hover:border-black/20 transition-all flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                    )}
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Veículo</label>
                    <input type="text" placeholder="Modelo/Cor" value={data.vehicle} onChange={e => setData({ ...data, vehicle: e.target.value })} className="w-full p-4 bg-zinc-50 rounded-[24px] font-bold text-sm outline-none border-transparent focus:border-black/5" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Placa</label>
                    <input type="text" placeholder="ABC-1234" value={data.plate} onChange={e => setData({ ...data, plate: e.target.value.toUpperCase() })} className="w-full p-4 bg-zinc-50 rounded-[24px] font-bold text-sm outline-none border-transparent focus:border-black/5 uppercase" />
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setStep(2)} className="p-6 bg-zinc-50 rounded-[32px] hover:bg-zinc-100"><ChevronLeft className="w-6 h-6"/></button>
                 <button onClick={onConfirm} className="flex-1 py-6 bg-green-600 text-white rounded-[32px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Liberar Acesso</button>
              </div>
           </div>
         )}
      </div>
    </div>
  );
};


// --- MODAL NOVO PACOTE (WIZARD) ---
const stepTitles = ['Quem recebe?', 'O que chegou?', 'Notificação'] as const;
const stepLabels = ['Passo 01: Identificação', 'Passo 02: Detalhamento', 'Passo 03: Notificação'] as const;

export const NewPackageModal = ({
  isOpen, onClose, step, setStep, searchResident, setSearchResident, selectedResident, setSelectedResident,
  filteredResidents, allResidents = [], residentsLoading = false, residentsError = null, onRetryResidents,
  packageSaving = false, pendingImage, pendingQrData, packageType, setPackageType, packageCategories, isAddingPkgCategory, setIsAddingPkgCategory,
  newPkgCatName, setNewPkgCatName, handleAddPkgCategory, numItems, packageItems, handleAddItemRow,
  handleRemoveItemRow, updateItem, packageMessage, setPackageMessage, onConfirm,
  onOpenCameraScan,
  onOpenGalleryPick,
}: any) => {
  const fromCamera = Boolean(pendingImage || pendingQrData);
  const displayResidents = (filteredResidents || []).slice(0, 200);

  const inputBase = 'w-full rounded-xl border bg-(--glass-bg) px-4 py-3 text-sm font-semibold outline-none transition-all placeholder:opacity-50 focus:ring-2 focus:ring-(--text-primary)/20 focus:border-(--text-primary)/50 border-(--border-color)';
  const cardBase = 'rounded-2xl border border-(--border-color) bg-(--glass-bg) p-4';
  const btnSecondary = 'p-2.5 rounded-xl border border-(--border-color) bg-(--glass-bg) transition-all hover:bg-(--border-color) focus:ring-2 focus:ring-(--text-primary)/20 focus:border-(--text-primary)/50';

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-2 sm:p-4 overflow-auto">
      <div className={`absolute inset-0 bg-black/80 backdrop-blur-xl ${packageSaving ? 'pointer-events-none' : ''}`} onClick={onClose} />
      <div
        className="relative w-full max-w-full sm:max-w-2xl max-h-[95vh] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border border-(--border-color)"
        style={{ backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-primary)' }}
      >
        {/* Stepper + close  —  sempre visível */}
        <header className="shrink-0 flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-(--border-color)">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {([1, 2, 3] as const).map((s) => (
              <React.Fragment key={s}>
                <div
                  aria-current={step === s ? 'step' : undefined}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border transition-all ${
                    step === s
                      ? 'bg-(--text-primary) border-(--text-primary)'
                      : 'border-(--border-color) opacity-60'
                  }`}
                  style={step === s ? { color: 'var(--bg-color)' } : undefined}
                >
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                    {stepLabels[s - 1].replace(/^Passo \d+:\s*/, '')}
                  </span>
                </div>
                {s < 3 && <div className="w-4 h-px bg-(--border-color) opacity-60" aria-hidden />}
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={onClose}
            disabled={packageSaving}
            className={btnSecondary + ' shrink-0 disabled:opacity-50 disabled:cursor-not-allowed'}
            style={{ color: 'var(--text-primary)' }}
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className={`flex flex-1 min-h-0 overflow-hidden transition-all duration-500 ease-out ${step === 2 ? '-translate-x-[33.333%]' : step === 3 ? '-translate-x-[66.666%]' : 'translate-x-0'}`} style={{ width: '300%' }}>
          {/* STEP 1: RESIDENT */}
          <div className="w-1/3 shrink-0 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5" style={{ color: 'var(--text-secondary)' }}>Passo 1 de 3</p>
                  <h2 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stepTitles[0]}</h2>
                  <p className="text-xs font-medium mt-0.5 opacity-60" style={{ color: 'var(--text-secondary)' }}>{stepLabels[0]}</p>
                </div>

                {(typeof onOpenCameraScan === 'function' || typeof onOpenGalleryPick === 'function') && (
                  <section className={cardBase}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-2" style={{ color: 'var(--text-secondary)' }}>Registrar por câmera ou foto</p>
                    <div className="flex flex-wrap gap-2">
                      {typeof onOpenCameraScan === 'function' && (
                        <button
                          type="button"
                          onClick={() => onOpenCameraScan('camera')}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-(--border-color) bg-(--glass-bg) hover:bg-(--border-color)/40 transition-all text-xs font-semibold uppercase tracking-wider focus:ring-2 focus:ring-(--text-primary)/20"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          <Camera className="w-4 h-4" /> Câmera
                        </button>
                      )}
                      {typeof onOpenGalleryPick === 'function' && (
                        <button
                          type="button"
                          onClick={() => onOpenGalleryPick()}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-(--border-color) bg-(--glass-bg) hover:bg-(--border-color)/40 transition-all text-xs font-semibold uppercase tracking-wider focus:ring-2 focus:ring-(--text-primary)/20"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          <ImageIcon className="w-4 h-4" /> Galeria
                        </button>
                      )}
                    </div>
                    {typeof onOpenCameraScan === 'function' && (
                      <p className="text-[10px] font-medium opacity-60 mt-2" style={{ color: 'var(--text-secondary)' }}>No computador, use a webcam, ou faça o registro manual.</p>
                    )}
                  </section>
                )}

                {pendingImage && (
                  <div className={cardBase + ' overflow-hidden'}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-2" style={{ color: 'var(--text-secondary)' }}>Foto da encomenda  —  relate ao morador</p>
                    <img src={pendingImage} alt="Encomenda" className="w-full h-auto max-h-40 object-contain rounded-xl" />
                  </div>
                )}

                <section className={cardBase}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    Buscar morador
                  </label>
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 group-focus-within:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      placeholder="Nome ou unidade..."
                      value={searchResident}
                      onChange={e => { setSearchResident(e.target.value); setSelectedResident(null); }}
                      className={inputBase + ' pl-10'}
                    />
                  </div>
                </section>

                {fromCamera && !selectedResident && (
                  <p className="text-xs font-medium opacity-70" style={{ color: 'var(--text-secondary)' }}>Selecione o morador que recebe esta encomenda.</p>
                )}

                {!selectedResident && residentsLoading && (
                  <section className={cardBase + ' flex flex-col items-center justify-center py-10 gap-3'}>
                    <Loader2 className="w-8 h-8 animate-spin opacity-60" style={{ color: 'var(--text-secondary)' }} />
                    <p className="text-xs font-medium opacity-70" style={{ color: 'var(--text-secondary)' }}>Carregando moradores⬦</p>
                  </section>
                )}

                {!selectedResident && !residentsLoading && residentsError && (
                  <section className={cardBase + ' flex flex-col items-center justify-center py-6 gap-3'}>
                    <AlertCircle className="w-10 h-10 opacity-70" style={{ color: 'var(--text-secondary)' }} />
                    <p className="text-xs font-medium text-center opacity-90" style={{ color: 'var(--text-secondary)' }}>Erro ao carregar moradores.</p>
                    <p className="text-[10px] font-medium text-center opacity-60 max-w-[240px]" style={{ color: 'var(--text-secondary)' }}>{residentsError}</p>
                    {typeof onRetryResidents === 'function' && (
                      <button
                        type="button"
                        onClick={onRetryResidents}
                        className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all focus:ring-2 focus:ring-(--text-primary)/20"
                        style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                      >
                        Tentar novamente
                      </button>
                    )}
                  </section>
                )}

                {!selectedResident && !residentsLoading && !residentsError && displayResidents.length > 0 && (
                  <section className={cardBase + ' space-y-2 max-h-56 overflow-y-auto custom-scrollbar'}>
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-70 block" style={{ color: 'var(--text-secondary)' }}>Moradores</span>
                    {displayResidents.map((r: Resident) => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedResident(r); setSearchResident(r.name); }}
                        className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-(--border-color) bg-(--glass-bg) hover:border-(--text-primary)/40 hover:bg-(--border-color)/30 transition-all text-left group"
                      >
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                          <p className="text-[10px] font-medium uppercase tracking-wider opacity-60" style={{ color: 'var(--text-secondary)' }}>Unidade {r.unit}</p>
                        </div>
                        <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100 shrink-0" style={{ color: 'var(--text-primary)' }} />
                      </button>
                    ))}
                  </section>
                )}
                {!selectedResident && !residentsLoading && !residentsError && displayResidents.length === 0 && (allResidents || []).length === 0 && (
                  <p className="text-xs font-medium opacity-60" style={{ color: 'var(--text-secondary)' }}>Nenhum morador cadastrado. Cadastre em Moradores primeiro.</p>
                )}
                {!selectedResident && !residentsLoading && !residentsError && (searchResident || '').trim() && displayResidents.length === 0 && (
                  <p className="text-xs font-medium opacity-60" style={{ color: 'var(--text-secondary)' }}>Nenhum morador encontrado.</p>
                )}

                {selectedResident && (
                  <div className={cardBase + ' flex flex-col items-center text-center py-6'} style={{ backgroundColor: 'var(--secondary-card-bg)', borderColor: 'var(--border-color)' }}>
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold mb-3" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                      {selectedResident.name.charAt(0)}
                    </div>
                    <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{selectedResident.name}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>Unidade {selectedResident.unit}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 p-4 sm:p-5 pt-0 flex flex-col sm:flex-row gap-2">
              <button
                disabled={!selectedResident || packageSaving}
                onClick={() => setStep(2)}
                className="flex-1 py-3.5 sm:py-4 rounded-xl font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-(--text-primary)/20 focus:border-(--text-primary)/50"
                style={selectedResident && !packageSaving ? { backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' } : { backgroundColor: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                Próximo: Inventário <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* STEP 2: DETAILS */}
          <div className="w-1/3 shrink-0 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5" style={{ color: 'var(--text-secondary)' }}>Passo 2 de 3</p>
                  <h2 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stepTitles[1]}</h2>
                  <p className="text-xs font-medium mt-0.5 opacity-60" style={{ color: 'var(--text-secondary)' }}>{stepLabels[1]}</p>
                </div>

                <section className={cardBase}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-80" style={{ color: 'var(--text-secondary)' }}>Categoria</label>
                  <div className="flex flex-wrap gap-2">
                    {packageCategories.map((cat: string) => (
                      <button
                        key={cat}
                        onClick={() => setPackageType(cat)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all focus:ring-2 focus:ring-(--text-primary)/20 ${
                          packageType === cat
                            ? 'border-(--text-primary)'
                            : 'border-(--border-color) hover:bg-(--border-color)/30'
                        }`}
                        style={packageType === cat ? { backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' } : { color: 'var(--text-primary)' }}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      onClick={() => setIsAddingPkgCategory(!isAddingPkgCategory)}
                      className={'px-4 py-2.5 rounded-xl border border-dashed ' + btnSecondary}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Plus className="w-4 h-4 inline mr-1 align-middle" /> Nova
                    </button>
                  </div>
                  {isAddingPkgCategory && (
                    <div className="flex gap-2 mt-3">
                      <input
                        value={newPkgCatName}
                        onChange={e => setNewPkgCatName(e.target.value)}
                        placeholder="Nova categoria..."
                        className={inputBase + ' flex-1'}
                      />
                      <button onClick={handleAddPkgCategory} className="p-3 rounded-xl font-semibold transition-all focus:ring-2 focus:ring-(--text-primary)/20" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}>
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </section>

                <section className={cardBase}>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-semibold uppercase tracking-wider opacity-80" style={{ color: 'var(--text-secondary)' }}>Inventário</label>
                    <div className="flex items-center gap-1 rounded-lg border border-(--border-color) p-1">
                      <button onClick={() => { if (numItems > 1) handleRemoveItemRow(packageItems[packageItems.length - 1].id); }} className="p-2 rounded-md hover:bg-(--border-color)/50 transition-all disabled:opacity-40" disabled={numItems <= 1} style={{ color: 'var(--text-primary)' }}><Minus className="w-4 h-4" /></button>
                      <span className="w-8 text-center text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{numItems}</span>
                      <button onClick={handleAddItemRow} className="p-2 rounded-md hover:bg-(--border-color)/50 transition-all" style={{ color: 'var(--text-primary)' }}><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {packageItems.map((item: PackageItem) => (
                      <div key={item.id} className="p-4 rounded-xl border border-(--border-color) bg-(--glass-bg) space-y-3">
                        <input
                          placeholder="Nome do produto"
                          value={item.name}
                          onChange={e => updateItem(item.id, 'name', e.target.value)}
                          className={inputBase}
                        />
                        <textarea
                          placeholder="Observações"
                          value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          className={inputBase + ' resize-none h-20'}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
            <div className="shrink-0 p-4 sm:p-5 pt-0 flex flex-col sm:flex-row gap-2">
              <button
                disabled={packageSaving}
                onClick={() => setStep(1)}
                className={btnSecondary + ' order-2 sm:order-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'}
                style={{ color: 'var(--text-primary)' }}
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
              <button
                disabled={packageSaving}
                onClick={() => setStep(3)}
                className="flex-1 py-3.5 sm:py-4 rounded-xl font-semibold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-(--text-primary)/20"
                style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}
              >
                Próximo: Notificação <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* STEP 3: NOTIFY */}
          <div className="w-1/3 shrink-0 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5" style={{ color: 'var(--text-secondary)' }}>Passo 3 de 3</p>
                    <h2 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stepTitles[2]}</h2>
                    <p className="text-xs font-medium mt-0.5 opacity-60" style={{ color: 'var(--text-secondary)' }}>{stepLabels[2]}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={packageSaving}
                      onClick={() => setStep(2)}
                      className={btnSecondary + ' flex items-center gap-1.5 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed'}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <ChevronLeft className="w-4 h-4" /> Voltar
                    </button>
                    <button
                      disabled={!selectedResident || packageSaving}
                      onClick={() => onConfirm(false)}
                      className="text-sm font-semibold uppercase tracking-wider opacity-80 hover:opacity-100 transition-opacity focus:ring-2 focus:ring-(--text-primary)/20 rounded-lg px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {packageSaving ? 'Salvando⬦' : 'Salvar sem notificar'}
                    </button>
                  </div>
                </div>

                <section className={cardBase}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--highlight-card)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--highlight-card)' }}>WhatsApp Business</span>
                  </div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-80" style={{ color: 'var(--text-secondary)' }}>Mensagem para o morador</label>
                  <textarea
                    value={packageMessage}
                    onChange={e => setPackageMessage(e.target.value)}
                    placeholder="Edite a mensagem de notificação..."
                    disabled={packageSaving}
                    className={inputBase + ' resize-none min-h-[180px] disabled:opacity-60 disabled:cursor-not-allowed'}
                  />
                </section>

                <div className={cardBase + ' flex items-start gap-3'} style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)' }}>
                  <Bell className="w-5 h-5 opacity-50 shrink-0 mt-0.5" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-xs font-medium leading-relaxed opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    O registro será salvo permanentemente. O morador pode ser alertado por WhatsApp.
                  </p>
                </div>
              </div>
            </div>
            <div className="shrink-0 p-4 sm:p-5 pt-0 grid grid-cols-2 gap-2">
              <button
                disabled={!selectedResident || packageSaving}
                onClick={() => onConfirm(false)}
                className={'py-3.5 sm:py-4 rounded-xl font-semibold text-xs uppercase tracking-wider border transition-all focus:ring-2 focus:ring-(--text-primary)/20 disabled:opacity-40 disabled:cursor-not-allowed ' + btnSecondary}
                style={{ color: 'var(--text-primary)' }}
              >
                {packageSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Salvando⬦
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
              <button
                disabled={!selectedResident || packageSaving}
                onClick={() => onConfirm(true)}
                className="py-3.5 sm:py-4 rounded-xl font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-500 transition-all focus:ring-2 focus:ring-green-400/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {packageSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Salvando⬦</span>
                    <span className="sm:hidden">Salvando⬦</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Notificar</span>
                    <span className="sm:hidden">Notif.</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MODAL STAFF (FUNCIONÁRIOS) ---
export type StaffFormData = Partial<Staff> & { passwordPlain?: string; passwordConfirm?: string };
// Modal para criar usuários administrativos (Porteiro/Síndico)
export const AdminUserModal = ({ isOpen, onClose, data, setData, onSave, currentRole }: {
  isOpen: boolean,
  onClose: () => void,
  data: { name: string, email: string, role: string, password: string, confirmPassword: string },
  setData: (d: any) => void,
  onSave: () => void,
  currentRole: string
}) => {
  if (!isOpen) return null;

  const currentRoleUpper = String(currentRole || '').toUpperCase();
  const canCreateAdminUsers = ['SINDICO', 'SÍNDICO', 'ADMIN', 'ADMINISTRADOR'].includes(currentRoleUpper);

  // Apenas síndico/admin pode criar outros usuários administrativos
  if (!canCreateAdminUsers) {
    return null;
  }

  const isValid = data.name && data.email && data.role && data.password && data.password === data.confirmPassword && data.password.length >= 6;

  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white text-black rounded-[32px] sm:rounded-[48px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-10 animate-in duration-300">
        <header className="flex justify-between items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div>
            <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Novo Usuário Administrativo</h4>
            <p className="text-[9px] sm:text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Criação de Administrador</p>
          </div>
          <button onClick={onClose} className="p-2 sm:p-3 bg-zinc-100 rounded-xl sm:rounded-2xl hover:bg-zinc-200 transition-all shrink-0">
            <X className="w-4 h-4 sm:w-5 sm:h-5"/>
          </button>
        </header>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Nome Completo</label>
            <input
              type="text"
              value={data.name}
              onChange={e => setData({...data, name: e.target.value})}
              className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10"
              placeholder="Nome do administrador"
            />
          </div>

          <div>
            <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">E-mail (Obrigatório)</label>
            <input
              type="email"
              value={data.email}
              onChange={e => setData({...data, email: e.target.value})}
              className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Função</label>
            <select
              value={data.role}
              onChange={e => setData({...data, role: e.target.value})}
              className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10"
            >
              <option value="">Selecione a função</option>
              <option value="PORTEIRO">Porteiro</option>
              <option value="SINDICO">Síndico</option>
              <option value="ADMINISTRADORA">Administradora</option>
              <option value="CABO_TURMA">Cabo de Turma</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Senha (Mínimo 6 caracteres)</label>
            <input
              type="password"
              value={data.password}
              onChange={e => setData({...data, password: e.target.value})}
              className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10"
              placeholder="Digite a senha"
            />
          </div>

          <div>
            <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Confirmar Senha</label>
            <input
              type="password"
              value={data.confirmPassword}
              onChange={e => setData({...data, confirmPassword: e.target.value})}
              className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10"
              placeholder="Confirme a senha"
            />
            {data.password && data.confirmPassword && data.password !== data.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">Senhas não coincidem</p>
            )}
          </div>

          <button
            onClick={onSave}
            disabled={!isValid}
            className="w-full py-3 sm:py-4 bg-black text-white rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] shadow-xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Criar Usuário Administrativo
          </button>
        </div>
      </div>
    </div>
  );
};

export const StaffFormModal = ({ isOpen, onClose, data, setData, onSave }: { isOpen: boolean, onClose: () => void, data: StaffFormData, setData: (d: StaffFormData) => void, onSave: () => void }) => {
  if (!isOpen) return null;
  const isNewStaff = !data.id || String(data.id).startsWith('temp-');
  const isPorteiro = (data.role || '').toLowerCase() === 'porteiro';
  const needsPassword = isPorteiro && isNewStaff;
  const passwordMatch = !data.passwordPlain || data.passwordPlain === data.passwordConfirm;
  const passwordOk = !needsPassword || (!!(data.passwordPlain && data.passwordPlain.length >= 6) && passwordMatch);
  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-3 sm:p-4 overflow-y-auto min-h-full">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl min-h-full" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[min(90vh,820px)] my-auto flex flex-col bg-white text-black rounded-2xl sm:rounded-3xl md:rounded-[48px] shadow-2xl p-5 sm:p-8 md:p-12 animate-in zoom-in duration-300 overflow-y-auto">
         <header className="flex justify-between items-center mb-6 sm:mb-10 shrink-0">
            <div>
               <h4 className="text-3xl font-black uppercase tracking-tight">{data.id ? 'Editar Cadastro' : 'Novo Colaborador'}</h4>
               <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Gestão de Recursos Humanos</p>
            </div>
            <button onClick={onClose} className="p-3 bg-zinc-100 rounded-2xl hover:bg-zinc-200 transition-all"><X className="w-5 h-5"/></button>
         </header>
         
         <div className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Nome Completo</label>
               <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                 <input 
                    type="text" 
                    value={data.name || ''} 
                    onChange={e => setData({...data, name: e.target.value})} 
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10" 
                    placeholder="Nome do Funcionário" 
                 />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Cargo</label>
                  <div className="relative">
                     <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                     <select 
                        value={data.role || ''} 
                        onChange={e => setData({...data, role: e.target.value})}
                        className="w-full pl-12 pr-8 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10 appearance-none"
                     >
                        <option value="">Selecione...</option>
                        <option value="Porteiro">Porteiro</option>
                        <option value="Zelador">Zelador</option>
                        <option value="Faxineira">Faxineira</option>
                        <option value="Segurança">Segurança</option>
                        <option value="Manutenção">Manutenção</option>
                        <option value="Jardineiro">Jardineiro</option>
                        <option value="Rondista">Rondista</option>
                        <option value="Cabo de Turma">Cabo de Turma</option>
                     </select>
                     <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Turno</label>
                  <select 
                     value={data.shift || ''} 
                     onChange={e => setData({...data, shift: e.target.value as any})}
                     className="w-full px-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10 appearance-none"
                  >
                     <option value="Comercial">Comercial</option>
                     <option value="Manhã">Manhã</option>
                     <option value="Tarde">Tarde</option>
                     <option value="Noite">Noite</option>
                     <option value="Madrugada">Madrugada</option>
                     <option value="Diurno">Diurno</option>
                     <option value="Noturno">Noturno</option>
                  </select>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Status Operacional</label>
               <div className="flex gap-2">
                  {['Ativo', 'Férias', 'Licença'].map(status => (
                     <button 
                        key={status}
                        onClick={() => setData({...data, status: status as any})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${data.status === status ? (status === 'Ativo' ? 'bg-green-500 text-white border-green-500' : status === 'Férias' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500') : 'bg-zinc-50 border-transparent text-zinc-400 hover:bg-zinc-100'}`}
                     >
                        {status}
                     </button>
                  ))}
               </div>
            </div>

            {isPorteiro && (
              <div className="pt-4 border-t border-zinc-100 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 ml-2">
                  {isNewStaff ? 'Porteiros acessam o sistema com login próprio  —  defina uma senha pessoal.' : 'Senha de acesso do porteiro (o síndico pode ver e alterar). Padrão: 123456 até o primeiro acesso.'}
                </p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">
                    {isNewStaff ? 'Senha de acesso' : 'Senha atual / nova senha'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={data.passwordPlain || ''}
                      onChange={e => setData({ ...data, passwordPlain: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10"
                      placeholder={isNewStaff ? 'Mín. 6 caracteres' : '123456 ou a senha já definida'}
                      autoComplete={isNewStaff ? 'new-password' : 'off'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      value={data.passwordConfirm || ''}
                      onChange={e => setData({ ...data, passwordConfirm: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10"
                      placeholder="Repita a senha"
                      autoComplete="off"
                    />
                  </div>
                </div>
                {data.passwordConfirm && !passwordMatch && (
                  <p className="text-xs text-red-600 font-medium ml-2">As senhas não coincidem.</p>
                )}
                {data.passwordPlain && data.passwordPlain.length > 0 && data.passwordPlain.length < 6 && (
                  <p className="text-xs text-amber-600 font-medium ml-2">A senha deve ter no mínimo 6 caracteres.</p>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-zinc-100 space-y-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Telefone</label>
                  <div className="relative">
                     <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                     <input type="text" value={data.phone || ''} onChange={e => setData({...data, phone: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10" placeholder="(11) 99999-9999" />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Email</label>
                  <div className="relative">
                     <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                     <input type="email" value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10" placeholder="func@condominio.com" />
                  </div>
               </div>
            </div>

            <div className="pt-6">
               <button onClick={onSave} disabled={!data.name || !data.role || !passwordOk} className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Save className="w-4 h-4" /> Salvar Colaborador
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

// --- MODAL CONVITE POR LINK (Portaria / ADM) ---
export const StaffInviteModal = ({
  isOpen,
  onClose,
  createdByName,
}: {
  isOpen: boolean;
  onClose: () => void;
  createdByName?: string | null;
}) => {
  const toast = useToast();
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<StaffInviteRole>('PORTEIRO');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [emailSent, setEmailSent] = React.useState<boolean | null>(null);
  const [emailSendError, setEmailSendError] = React.useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setRole('PORTEIRO');
    setError(null);
    setInviteLink(null);
    setEmailSent(null);
    setEmailSendError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError('Informe um e-mail válido.');
      return;
    }
    setError(null);
    setEmailSent(null);
    setEmailSendError(null);
    setLoading(true);
    const result = await createStaffInvite(emailTrim, role, createdByName ?? undefined);
    setLoading(false);
    if (result.success && result.inviteLink) {
      setInviteLink(result.inviteLink);
      const apiBase =
        (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
        (typeof window !== 'undefined' ? window.location.origin : '');
      const url = `${String(apiBase).replace(/\/$/, '')}/api/send-invite-email`;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrim, inviteLink: result.inviteLink, role }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (data.sent === true) {
            setEmailSent(true);
            setEmailSendError(null);
            toast.success(`E-mail enviado para ${emailTrim}`);
          } else {
            const serverError = typeof data.error === 'string' ? data.error : null;
            setEmailSent(false);
            setEmailSendError(serverError || (res.ok ? null : `Erro do servidor (${res.status})`));
            const msg =
              serverError ||
              (res.status === 503
                ? 'Envio de e-mail não configurado no servidor (RESEND_API_KEY).'
                : res.status === 404
                  ? 'Rota de e-mail não encontrada. Faça o deploy com a pasta api/ na Vercel.'
                  : 'E-mail não enviado. Copie o link abaixo e envie ao convidado.');
            toast.error(msg);
          }
        })
        .catch(() => {
          setEmailSent(false);
          setEmailSendError('Não foi possível contactar o servidor. Verifique a conexão ou, em desenvolvimento, configure VITE_API_BASE_URL ou rode npm run dev:api.');
          toast.error('Falha ao enviar e-mail. Verifique a conexão.');
        });
    } else {
      setError(result.error || 'Erro ao gerar convite.');
    }
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      toast.success('Link copiado!');
    }).catch(() => {
      toast.error('Não foi possível copiar.');
    });
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-500 flex items-center justify-center p-3 sm:p-4 overflow-y-auto min-h-full">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl min-h-full" onClick={handleClose} />
      <div className="relative w-full max-w-lg max-h-[min(90vh,640px)] my-auto flex flex-col bg-white text-black rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 animate-in zoom-in duration-300 overflow-y-auto">
        <header className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h4 className="text-2xl font-black uppercase tracking-tight">Convidar por link</h4>
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Portaria ou ADM  —  link único por e-mail</p>
          </div>
          <button onClick={handleClose} className="p-3 bg-zinc-100 rounded-2xl hover:bg-zinc-200 transition-all"><X className="w-5 h-5"/></button>
        </header>

        {!inviteLink ? (
          <form onSubmit={handleGenerate} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">E-mail do convidado</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Perfil</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as StaffInviteRole)}
                className="w-full px-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10"
              >
                <option value="PORTEIRO">Perfil A  —  Portaria</option>
                <option value="SINDICO">Perfil B  —  ADM</option>
                <option value="CABO_TURMA">Perfil C  —  Cabo de Turma</option>
                <option value="RONDISTA">Perfil D  —  Rondista</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-[11px] tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {loading ? 'Gerando link...' : 'Gerar link de convite'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {emailSent === true && (
              <p className="text-sm font-medium text-green-600">E-mail enviado para <strong>{email}</strong>. O convidado receberá o link por e-mail.</p>
            )}
            {emailSent === false && (
              <div className="space-y-1">
                <p className="text-xs text-amber-600">O link foi gerado, mas o e-mail não pôde ser enviado. Copie o link abaixo e envie por e-mail ou WhatsApp ao convidado.</p>
                {emailSendError && (
                  <p className="text-xs text-red-600 font-medium mt-1" title="Erro retornado pelo servidor">
                    Erro: {emailSendError}
                  </p>
                )}
              </div>
            )}
            {emailSent === null && (
              <p className="text-xs text-zinc-500">Enviando e-mail...</p>
            )}
            <p className="text-xs text-zinc-600">O convite expira em 7 dias. O convidado definirá a senha ao acessar o link.</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-4 py-3 bg-zinc-100 rounded-xl text-sm font-mono truncate"
              />
              <button
                type="button"
                onClick={copyLink}
                className="p-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-900 flex items-center justify-center gap-2 shrink-0"
              >
                <Copy className="w-4 h-4" /> Copiar
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setInviteLink(null); setEmail(''); }}
              className="w-full py-3 border border-zinc-200 rounded-xl text-sm font-bold uppercase text-zinc-600 hover:bg-zinc-50"
            >
              Gerar outro link
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

