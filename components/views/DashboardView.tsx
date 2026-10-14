import React, { useEffect, useState } from 'react';
import {
  SearchCode,
  Search,
  Package as PackageIcon,
  ArrowRight,
  Users,
  ShieldAlert,
  ChevronRight,
  Home,
  Calendar,
  Camera,
  Mic,
  Activity,
  Circle,
  AlertTriangle
} from 'lucide-react';
import RecentEventsBar from '../RecentEventsBar';
import { QuickViewCategory, Package, Occurrence, VisitorLog } from '../../types';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConnectivity } from '../../contexts/ConnectivityContext';
import { formatUnit } from '../../utils/unitFormatter';
import { BRANDING } from '../../config/branding';
import {
  getRecentDomainEvents,
  subscribeDomainEvents,
  type DomainEvent
} from '../../sentinela/core';

export interface OperationalCounts {
  packagesPending: number;
  packagesReceivedToday: number;
  packagesPickedUp: number;
  occurrencesOpen: number;
  visitorsActive: number;
  reservationsToday: number;
}

interface DashboardViewProps {
  globalSearchQuery: string;
  setGlobalSearchQuery: (val: string) => void;
  hasAnyGlobalResult: boolean;
  globalResults: any;
  setActiveTab: (tab: string) => void;
  setResidentSearch: (val: string) => void;
  eventStates: any;
  setQuickViewCategory: (cat: QuickViewCategory) => void;
  setIsNewPackageModalOpen: () => void;
  setPackageSearch?: (val: string) => void;
  setOccurrenceSearch?: (val: string) => void;
  setVisitorSearch?: (val: string) => void;
  setSelectedPackageForDetail?: (pkg: any) => void;
  setSelectedVisitorForDetail?: (v: any) => void;
  setSelectedOccurrenceForDetail?: (o: any) => void;
  setReservationFilter?: (f: 'all' | 'today' | 'pending') => void;
  /** Contagens operacionais (derivadas dos dados já carregados) */
  operationalCounts?: OperationalCounts;
  pendingPackages?: Package[];
  openOccurrences?: Occurrence[];
  activeVisitors?: VisitorLog[];
  onOpenCameraScan?: () => void;
  onOpenOccurrenceModal?: () => void;
  onOpenSentinela?: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  'package.created': 'Encomenda registrada',
  'package.picked_up': 'Encomenda retirada',
  'occurrence.created': 'Ocorrência criada',
  'occurrence.updated': 'Ocorrência atualizada',
  'reservation.created': 'Reserva criada',
  'reservation.cancelled': 'Reserva cancelada'
};

const DashboardView: React.FC<DashboardViewProps> = ({
  globalSearchQuery,
  setGlobalSearchQuery,
  hasAnyGlobalResult,
  globalResults,
  setActiveTab,
  setResidentSearch,
  eventStates,
  setQuickViewCategory,
  setIsNewPackageModalOpen,
  setPackageSearch,
  setOccurrenceSearch,
  setVisitorSearch,
  setSelectedPackageForDetail,
  setSelectedVisitorForDetail,
  setSelectedOccurrenceForDetail,
  setReservationFilter,
  operationalCounts,
  pendingPackages = [],
  openOccurrences = [],
  activeVisitors = [],
  onOpenCameraScan,
  onOpenOccurrenceModal,
  onOpenSentinela
}) => {
  const { config } = useAppConfig();
  const { userPermissions, isAdminPrincipal } = useAuth();
  const { isOnline, isSyncing } = useConnectivity();
  const hasPermission = (key: string) => isAdminPrincipal || userPermissions.includes(key);
  const canViewOccurrences = hasPermission('occurrences.view');
  const canCreateOccurrence = hasPermission('occurrences.create');
  const [coreEvents, setCoreEvents] = useState<DomainEvent[]>(() => [...getRecentDomainEvents()].reverse().slice(0, 12));

  useEffect(() => {
    setCoreEvents([...getRecentDomainEvents()].reverse().slice(0, 12));
    return subscribeDomainEvents(() => {
      setCoreEvents([...getRecentDomainEvents()].reverse().slice(0, 12));
    });
  }, []);

  const counts: OperationalCounts = operationalCounts ?? {
    packagesPending: pendingPackages.length,
    packagesReceivedToday: 0,
    packagesPickedUp: 0,
    occurrencesOpen: openOccurrences.length,
    visitorsActive: activeVisitors.length,
    reservationsToday: 0
  };

  const attentionItems =
    counts.packagesPending +
    (canViewOccurrences ? counts.occurrencesOpen : 0) +
    (eventStates.hasActiveVisitor ? counts.visitorsActive : 0);

  return (
    <div className="space-y-5 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 relative max-w-[1600px] mx-auto">
      <header className="px-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.35em] opacity-40">
            {BRANDING.name} · {BRANDING.tagline}
          </p>
          <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter text-contrast-high leading-tight uppercase mt-1">
            Central de Operações
          </h3>
          <p className="text-[9px] sm:text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low mt-1">
            {config.condominiumName} · o que está acontecendo agora
          </p>
        </div>
        {attentionItems > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {attentionItems} item(ns) pedem atenção
            </span>
          </div>
        )}
      </header>

      {/* Status Sentinela / Core / Canais */}
      <section className="px-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          <StatusChip label="Sentinela" ok detail="Operacional" />
          <StatusChip label="Core" ok detail="Operacional" />
          <StatusChip label="Banco" ok={isOnline} detail={isOnline ? (isSyncing ? 'Sincronizando' : 'Conectado') : 'Offline'} />
          <StatusChip label="Realtime" ok={isOnline} detail={isOnline ? 'Ativo' : 'Pausado'} />
          <StatusChip label="WhatsApp" ok={false} detail="Não configurado" />
          <StatusChip label="n8n" ok={false} detail="Não configurado" />
        </div>
      </section>

      {/* KPIs operacionais */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-1">
        <KpiCard
          label="Encomendas pendentes"
          value={counts.packagesPending}
          accent={counts.packagesPending > 0}
          onClick={() => setQuickViewCategory('packages')}
        />
        {canViewOccurrences && (
          <KpiCard
            label="Ocorrências abertas"
            value={counts.occurrencesOpen}
            accent={counts.occurrencesOpen > 0}
            onClick={() => setQuickViewCategory('occurrences')}
          />
        )}
        <KpiCard
          label="Visitantes ativos"
          value={counts.visitorsActive}
          accent={counts.visitorsActive > 0}
          onClick={() => setQuickViewCategory('visitors')}
        />
        <KpiCard
          label="Reservas hoje"
          value={counts.reservationsToday}
          accent={false}
          onClick={() => {
            setReservationFilter?.('today');
            setActiveTab('reservations');
          }}
        />
      </section>

      {/* Ações rápidas — reutilizam modais/views existentes */}
      <section className="px-1">
        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] opacity-40 mb-3 px-1">Ações rápidas</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
          <QuickAction
            icon={PackageIcon}
            label="Registrar encomenda"
            onClick={() => setIsNewPackageModalOpen()}
          />
          <QuickAction
            icon={Camera}
            label="QR / Foto"
            onClick={() => (onOpenCameraScan ? onOpenCameraScan() : setIsNewPackageModalOpen())}
          />
          {canCreateOccurrence && (
            <QuickAction
              icon={ShieldAlert}
              label="Nova ocorrência"
              onClick={() => (onOpenOccurrenceModal ? onOpenOccurrenceModal() : setActiveTab('occurrences'))}
            />
          )}
          <QuickAction icon={Users} label="Visitantes" onClick={() => setActiveTab('visitors')} />
          <QuickAction
            icon={Calendar}
            label="Reservas"
            onClick={() => {
              setReservationFilter?.('today');
              setActiveTab('reservations');
            }}
          />
        </div>
        {onOpenSentinela && (
          <button
            type="button"
            onClick={onOpenSentinela}
            className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <Mic className="w-4 h-4 opacity-60" />
            Sentinela (voz / chat)
          </button>
        )}
      </section>

      {/* Busca global preservada */}
      <div className="relative group z-[100] px-1">
        <SearchCode className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 opacity-40 group-hover:text-[var(--text-primary)] transition-all" />
        <input
          type="text"
          placeholder="Busca operacional: nome, unidade, status..."
          value={globalSearchQuery}
          onChange={(e) => setGlobalSearchQuery(e.target.value)}
          className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-4 sm:py-5 text-base sm:text-lg bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-[24px] sm:rounded-[28px] outline-none font-black tracking-tight focus:ring-4 focus:ring-[var(--text-primary)]/10 transition-all placeholder:opacity-20 shadow-lg"
        />

        {globalSearchQuery.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-3 p-4 premium-glass rounded-[32px] shadow-2xl animate-in slide-in-from-top-4 duration-300 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {hasAnyGlobalResult ? (
              <div className="space-y-6 p-2">
                {globalResults?.residents?.length > 0 && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <Users className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Moradores</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.residents.map((r: any) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setActiveTab('residents');
                            setGlobalSearchQuery('');
                            setResidentSearch(r.name);
                          }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">{r.name}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">{formatUnit(r.unit)}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {globalResults?.packages?.length > 0 && setPackageSearch && setSelectedPackageForDetail && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <PackageIcon className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Encomendas</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.packages.map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveTab('packages');
                            setGlobalSearchQuery('');
                            setPackageSearch(p.recipient || '');
                            setSelectedPackageForDetail(p);
                          }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">{p.recipient}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">
                              {formatUnit(p.unit)} • {p.type} • {p.status}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {globalResults?.visitors?.length > 0 && setVisitorSearch && setSelectedVisitorForDetail && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <Users className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Visitantes</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.visitors.map((v: any) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setActiveTab('visitors');
                            setGlobalSearchQuery('');
                            setVisitorSearch?.(v.visitorNames || v.residentName || '');
                            setSelectedVisitorForDetail(v);
                          }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">
                              {v.visitorNames || v.residentName || '—'}
                            </h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">
                              {formatUnit(v.unit)} • {v.residentName}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {canViewOccurrences &&
                  globalResults?.occurrences?.length > 0 &&
                  setOccurrenceSearch &&
                  setSelectedOccurrenceForDetail && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <ShieldAlert className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Ocorrências</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.occurrences.map((o: any) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setActiveTab('occurrences');
                            setGlobalSearchQuery('');
                            setOccurrenceSearch?.(o.description?.slice(0, 30) || '');
                            setSelectedOccurrenceForDetail(o);
                          }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div className="min-w-0 flex-1">
                            <h6 className="text-sm font-black uppercase tracking-tight truncate">{o.description}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">
                              {formatUnit(o.unit)} • {o.status}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {globalResults?.reservations?.length > 0 && setReservationFilter && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <Calendar className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Reservas</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.reservations.map((r: any) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setActiveTab('reservations');
                            setGlobalSearchQuery('');
                            setReservationFilter('all');
                          }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">
                              {r.resident} • {r.area}
                            </h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">
                              {formatUnit(r.unit)} • {r.date} • {r.time}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Search className="w-8 h-8 opacity-10 mx-auto mb-4" />
                <p className="text-xs font-black uppercase tracking-widest opacity-20">
                  Nenhum resultado para "{globalSearchQuery}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 px-1">
        <RecentEventsBar
          eventStates={eventStates}
          onOpenQuickView={(cat) => setQuickViewCategory(cat)}
          showOccurrences={canViewOccurrences}
        />

        {/* CTA principal: encomendas */}
        <div
          onClick={() => setIsNewPackageModalOpen()}
          className="w-full contrast-card rounded-[28px] sm:rounded-[36px] p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center justify-between transition-all shadow-2xl relative overflow-hidden group cursor-pointer border-none"
        >
          <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative z-10 w-full">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[24px] sm:rounded-[28px] bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-500 shadow-xl flex-shrink-0">
              <PackageIcon className="w-8 h-8 sm:w-9 sm:h-9" />
            </div>
            <div className="text-center md:text-left flex-1 min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
                Fluxo principal · Core create_package
              </span>
              <h4 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter leading-none uppercase mt-2">
                Registrar encomenda
              </h4>
              <p className="text-xs sm:text-sm font-medium opacity-60 mt-2 max-w-lg">
                Manual, foto, QR ou voz — mesma operação do Sentinela Core.
                {counts.packagesPending > 0
                  ? ` ${counts.packagesPending} aguardando retirada.`
                  : ' Nenhuma pendente no momento.'}
              </p>
            </div>
            <div className="md:ml-auto flex-shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-black/10 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all active:scale-90">
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pendências + atividade Core */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-1">
        <div className="secondary-card rounded-[28px] p-5 sm:p-6 shadow-xl min-h-[220px]">
          <header className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Precisa de intervenção</h4>
            <button
              type="button"
              className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-80"
              onClick={() => setActiveTab('packages')}
            >
              Ver tudo
            </button>
          </header>
          <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
            {pendingPackages.slice(0, 5).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveTab('packages');
                  setSelectedPackageForDetail?.(p);
                }}
                className="w-full text-left p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all"
              >
                <div className="text-xs font-black uppercase tracking-tight">{p.recipient}</div>
                <div className="text-[10px] opacity-40 uppercase font-bold mt-0.5">
                  {formatUnit(p.unit)} · {p.type} · aguardando retirada
                </div>
              </button>
            ))}
            {canViewOccurrences &&
              openOccurrences.slice(0, 3).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setActiveTab('occurrences');
                    setSelectedOccurrenceForDetail?.(o);
                  }}
                  className="w-full text-left p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/10 transition-all"
                >
                  <div className="text-xs font-black uppercase tracking-tight truncate">{o.description}</div>
                  <div className="text-[10px] opacity-50 uppercase font-bold mt-0.5">
                    {formatUnit(o.unit)} · {o.status}
                  </div>
                </button>
              ))}
            {pendingPackages.length === 0 && (!canViewOccurrences || openOccurrences.length === 0) && (
              <p className="text-xs opacity-30 font-bold uppercase tracking-widest py-8 text-center">
                Nenhuma pendência imediata
              </p>
            )}
          </div>
        </div>

        <div className="secondary-card rounded-[28px] p-5 sm:p-6 shadow-xl min-h-[220px]">
          <header className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 opacity-40" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Atividade do Core</h4>
          </header>
          <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
            {coreEvents.length === 0 && (
              <p className="text-xs opacity-30 font-bold uppercase tracking-widest py-8 text-center">
                Sem eventos locais nesta sessão
              </p>
            )}
            {coreEvents.map((e, idx) => (
              <div key={`${e.type}-${e.at}-${idx}`} className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-xs font-black uppercase tracking-tight">
                  {EVENT_LABELS[e.type] || e.type}
                </div>
                <div className="text-[10px] opacity-40 font-bold mt-0.5">
                  {new Date(e.at).toLocaleString('pt-BR')}
                  {typeof e.payload?.channel === 'string' ? ` · ${e.payload.channel}` : ''}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] opacity-25 mt-3 uppercase tracking-widest font-bold">
            Eventos em memória (Etapa 1) · sem Event Store
          </p>
        </div>
      </section>

      {/* Atalhos secundários — operação primeiro; cadastro/base depois */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 px-1">
        <NavCard title="Encomendas" subtitle="Pendentes e histórico" icon={PackageIcon} onClick={() => setActiveTab('packages')} />
        {canViewOccurrences && (
          <NavCard
            title="Ocorrências"
            subtitle="Abertas e recentes"
            icon={ShieldAlert}
            onClick={() => setActiveTab('occurrences')}
          />
        )}
        <NavCard title="Visitantes" subtitle="Controle de acesso" icon={Users} onClick={() => setActiveTab('visitors')} />
        <NavCard title="Reservas" subtitle="Agenda do dia" icon={Calendar} onClick={() => setActiveTab('reservations')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 px-1 opacity-80">
        <NavCard
          title="Moradores"
          subtitle="Base de unidades (consulta operacional)"
          icon={Home}
          onClick={() => setActiveTab('residents')}
        />
        <NavCard
          title="Mural"
          subtitle="Avisos do condomínio"
          icon={Activity}
          onClick={() => setActiveTab('notices')}
        />
      </div>
    </div>
  );
};

function StatusChip({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex items-start gap-2">
      <Circle
        className={`w-2.5 h-2.5 mt-1 flex-shrink-0 ${ok ? 'fill-emerald-400 text-emerald-400' : 'fill-white/20 text-white/20'}`}
      />
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-widest opacity-50">{label}</div>
        <div className="text-[10px] font-bold uppercase tracking-tight truncate mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  onClick
}: {
  label: string;
  value: number;
  accent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-[24px] p-4 sm:p-5 border transition-all shadow-lg ${
        accent
          ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
    >
      <div className="text-3xl sm:text-4xl font-black tracking-tighter tabular-nums">{value}</div>
      <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-50 mt-2">{label}</div>
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof PackageIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 p-4 rounded-[22px] border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left min-h-[88px]"
    >
      <Icon className="w-5 h-5 opacity-50" />
      <span className="text-[10px] font-black uppercase tracking-widest leading-tight">{label}</span>
    </button>
  );
}

function NavCard({
  title,
  subtitle,
  icon: Icon,
  onClick
}: {
  title: string;
  subtitle: string;
  icon: typeof PackageIcon;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group secondary-card p-5 sm:p-6 h-auto sm:h-[160px] rounded-[28px] flex flex-col justify-between cursor-pointer shadow-xl transition-all"
    >
      <Icon className="w-6 h-6 opacity-20" />
      <div className="mt-auto">
        <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight leading-none">{title}</h3>
        <p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest mt-2">{subtitle}</p>
      </div>
      <div className="flex justify-end mt-2">
        <ChevronRight className="w-5 h-5 opacity-20 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}

export default DashboardView;
