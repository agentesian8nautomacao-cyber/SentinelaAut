
import React from 'react';
import { Package, UserCircle, AlertCircle, Calendar, Edit3, Bell } from 'lucide-react';
import { QuickViewCategory } from '../types';

interface RecentEventsBarProps {
  eventStates: {
    hasNewPackage: boolean;
    hasActiveVisitor: boolean;
    hasOpenOccurrences: boolean;
    hasUpcomingReservation: boolean;
    hasNewNotice: boolean;
  };
  onOpenQuickView: (cat: QuickViewCategory) => void;
  /** Alinhado ao menu: permission `occurrences.view` */
  showOccurrences?: boolean;
}

const RecentEventsBar: React.FC<RecentEventsBarProps> = ({
  eventStates,
  onOpenQuickView,
  showOccurrences = true
}) => {
  return (
    <div 
      className="w-full flex items-center justify-between p-1 bg-white/5 dark:bg-black/30 backdrop-blur-xl border border-white/10 rounded-xl mb-3 animate-in slide-in-from-top-4 duration-700 overflow-hidden"
      style={{ boxShadow: '0 10px 30px -10px rgba(0,0,0,0.4)' }}
    >
      <div className="flex-1 flex items-center">
        {/* Slot Encomendas */}
        <button 
          onClick={() => onOpenQuickView('packages')}
          className={`flex-1 flex items-center justify-center py-4 px-2 transition-all group relative border-r border-white/5 ${eventStates.hasNewPackage ? 'text-blue-400' : 'text-white/40 hover:text-white'}`}
          title="Ver Encomendas Pendentes"
        >
          <Package className={`w-5 h-5 ${eventStates.hasNewPackage ? 'animate-pulse' : ''}`} />
          <span className="hidden lg:block ml-2 text-[10px] font-black uppercase tracking-widest">Encomendas</span>
        </button>

        {/* Slot Visitantes */}
        <button 
          onClick={() => onOpenQuickView('visitors')}
          className={`flex-1 flex items-center justify-center py-4 px-2 transition-all group relative border-r border-white/5 ${eventStates.hasActiveVisitor ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.6)]' : 'text-white/40 hover:text-white'}`}
          title="Ver Visitantes Ativos"
        >
          <UserCircle className="w-5 h-5" />
          <span className="hidden lg:block ml-2 text-[10px] font-black uppercase tracking-widest">Acessos</span>
        </button>

        {showOccurrences && (
          <button
            onClick={() => onOpenQuickView('occurrences')}
            className={`flex-1 flex items-center justify-center py-4 px-2 transition-all group relative border-r border-white/5 ${eventStates.hasOpenOccurrences ? 'text-red-500' : 'text-white/40 hover:text-white'}`}
            title="Ver Ocorrências Abertas"
          >
            <div className="relative">
              <AlertCircle className={`w-5 h-5 ${eventStates.hasOpenOccurrences ? 'animate-pulse' : ''}`} />
            </div>
            <span className="hidden lg:block ml-2 text-[10px] font-black uppercase tracking-widest">Segurança</span>
          </button>
        )}

        {/* Slot Reservas (Agenda) */}
        <button 
          onClick={() => onOpenQuickView('reservations')}
          className={`flex-1 flex items-center justify-center py-4 px-2 transition-all group relative border-r border-white/5 ${eventStates.hasUpcomingReservation ? 'text-amber-400' : 'text-white/40 hover:text-white'}`}
          title="Ver Agenda"
        >
          <Calendar className={`w-5 h-5 ${eventStates.hasUpcomingReservation ? 'animate-pulse' : ''}`} />
          <span className="hidden lg:block ml-2 text-[10px] font-black uppercase tracking-widest">Agenda</span>
        </button>


        {/* Slot Mural */}
        <button 
          onClick={() => onOpenQuickView('notices')}
          className={`flex-1 flex items-center justify-center py-4 px-2 transition-all group relative ${eventStates.hasNewNotice ? 'text-green-400' : 'text-white/40 hover:text-white'}`}
          title="Ver Mural de Avisos"
        >
          <Bell className="w-5 h-5" />
          <span className="hidden lg:block ml-2 text-[10px] font-black uppercase tracking-widest">Mural</span>
        </button>
      </div>
    </div>
  );
};

export default RecentEventsBar;
