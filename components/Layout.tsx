
import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Calendar,
  Users,
  AlertCircle,
  Bell,
  ClipboardList,
  BarChart3,
  UserCircle,
  LogOut,
  Settings,
  ShieldCheck,
  Menu,
  Sun,
  Moon,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { UserRole, Notification } from '../types';
import { User as AdminUser } from '../services/userAuth';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { BRANDING } from '../config/branding';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  onLogout: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  /** Lista de notificações do morador para exibir no dropdown do sino (ocorrências e avisos) */
  notifications?: Notification[];
  /** Ao clicar em uma notificação no dropdown (morador) — redireciona para a página e marca como lida */
  onNotificationClick?: (n: Notification) => void;
  /** Excluir uma notificação do sino (morador); as notificações permanecem até o usuário excluir ou clicar para ver */
  onDeleteNotification?: (notificationId: string) => void;
  currentAdminUser?: AdminUser | null;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  role,
  setRole,
  onLogout,
  theme,
  toggleTheme,
  notificationCount = 0,
  onOpenNotifications,
  notifications,
  onNotificationClick,
  onDeleteNotification,
  currentAdminUser
}) => {
  const { config } = useAppConfig();
  const { userPermissions, isAdminPrincipal } = useAuth();
  const { isOnline, isSyncing } = useConnectivity();

  const hasPermission = (key: string) => isAdminPrincipal || userPermissions.includes(key);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNotificationDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(e.target as Node)) {
        setIsNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationDropdownOpen]);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    
    const screenWidth = window.innerWidth;
    const triggerThreshold = 60; 

    if (!isMobileMenuOpen) {
      const startedInLeftHalf = touchStartXRef.current < screenWidth / 2;
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
      if (startedInLeftHalf && isHorizontalSwipe && deltaX > triggerThreshold) {
        setIsMobileMenuOpen(true);
      }
    } else {
      if (deltaX < -triggerThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        setIsMobileMenuOpen(false);
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const allRoles: UserRole[] = ['PORTEIRO', 'SINDICO', 'ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'CABO_TURMA'];
  /** Navegação preservada (sem remoção). Ordem prioriza operação de portaria; financeiro/admin ficam abaixo. */
  const menuItems: { id: string; label: string; icon: typeof BarChart3; roles: UserRole[]; permission?: string; group?: 'ops' | 'base' | 'admin' | 'resident' }[] = [
    { id: 'dashboard', label: 'Operação', icon: BarChart3, roles: allRoles, permission: 'dashboard.view', group: 'ops' },
    { id: 'packages', label: 'Encomendas', icon: Package, roles: allRoles, permission: 'packages.view', group: 'ops' },
    { id: 'visitors', label: 'Visitantes', icon: UserCircle, roles: allRoles, permission: 'visitors.view', group: 'ops' },
    { id: 'occurrences', label: 'Ocorrências', icon: AlertCircle, roles: allRoles, permission: 'occurrences.view', group: 'ops' },
    { id: 'reservations', label: 'Reservas', icon: Calendar, roles: allRoles, permission: 'reservations.view', group: 'ops' },
    { id: 'sentinela', label: 'Sentinela', icon: ShieldCheck, roles: allRoles, permission: 'sentinela.view', group: 'ops' },
    { id: 'residents', label: 'Moradores', icon: Users, roles: allRoles, permission: 'residents.view', group: 'base' },
    { id: 'notices', label: 'Mural', icon: Bell, roles: allRoles, permission: 'notices.view', group: 'base' },
    { id: 'financeiro', label: 'Financeiro', icon: Receipt, roles: allRoles, permission: 'boletos.view', group: 'base' },
    { id: 'sindicoProfile', label: 'Meu Perfil', icon: UserCircle, roles: ['SINDICO', 'PORTEIRO', 'ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'CABO_TURMA'], group: 'admin' },
    { id: 'staff', label: 'Funcionários', icon: ClipboardList, roles: allRoles, permission: 'staff.view', group: 'admin' },
    { id: 'settings', label: 'Configurações', icon: Settings, roles: allRoles, permission: 'settings.view', group: 'admin' },
  ];

  const filteredMenu = menuItems.filter(
    (item) => item.roles.includes(role) && (!item.permission || hasPermission(item.permission))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className={`p-4 sm:p-6 lg:p-8 flex items-center transition-all duration-500 ${isDesktopCollapsed ? 'px-3 sm:px-4 justify-center' : 'justify-between'}`}>
        <div
          className={`flex items-center gap-3 cursor-pointer active:scale-95 transition-transform min-w-0 ${isDesktopCollapsed ? 'flex-col' : ''}`}
          onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
        >
          <img
            src={BRANDING.icon}
            alt=""
            aria-hidden="true"
            className={`rounded-xl object-cover shadow-lg ring-1 ring-[var(--sentinela-border)] transition-all duration-500 ${isDesktopCollapsed ? 'w-11 h-11' : 'w-11 h-11'}`}
          />
          {!isDesktopCollapsed && (
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-tight shimmer-text leading-none">{BRANDING.name}</h1>
              <p className="text-[8px] mt-1.5 uppercase tracking-[0.18em] font-black text-[var(--sentinela-text-muted)]">
                {BRANDING.tagline}
              </p>
              <p className="sentinela-tenant mt-3 pt-2 border-t text-[9px] font-bold uppercase tracking-[0.16em] truncate">
                {config.condominiumName}
              </p>
            </div>
          )}
        </div>
        <button 
          onClick={() => {
            if (isMobileMenuOpen) {
              setIsMobileMenuOpen(false);
            } else {
              setIsDesktopCollapsed(true);
            }
          }} 
          className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 hover:bg-white/10 rounded-xl flex items-center justify-center"
          title="Fechar menu"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5 text-[var(--text-primary)]" />
        </button>
      </div>

      <nav className="flex-1 px-3 sm:px-4 space-y-1 overflow-y-auto pb-4 min-h-0 custom-scrollbar">
        {filteredMenu.map((item, index) => {
          const prev = filteredMenu[index - 1];
          const showDivider =
            !!prev &&
            !!item.group &&
            !!prev.group &&
            item.group !== prev.group &&
            !isDesktopCollapsed;
          return (
            <React.Fragment key={item.id}>
              {showDivider && (
                <div className="pt-3 pb-1 px-2">
                  <div className="h-px bg-[var(--border-color)] opacity-60" />
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] opacity-30 mt-2">
                    {item.group === 'base' ? 'Consulta / base' : item.group === 'admin' ? 'Administração' : item.group === 'resident' ? 'Morador' : ''}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                title={isDesktopCollapsed ? item.label : ''}
                className={`w-full flex items-center transition-all duration-300 rounded-xl group ${
                  isDesktopCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-3'
                } ${
                  activeTab === item.id
                    ? 'bg-[var(--sentinela-primary)] text-white shadow-xl shadow-blue-950/20'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]'
                }`}
              >
                <item.icon className={`transition-all duration-300 ${isDesktopCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!isDesktopCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="px-3 sm:px-4 py-3 sm:py-4 flex justify-center shrink-0">
        <button 
          onClick={() => {
            setIsDesktopCollapsed(!isDesktopCollapsed);
            // No mobile, quando colapsar, manter o menu visível
            if (window.innerWidth < 1024 && !isDesktopCollapsed) {
              setIsMobileMenuOpen(true);
            }
          }}
          className="p-3 w-full border border-[var(--border-color)] rounded-2xl bg-[var(--glass-bg)] hover:bg-[var(--border-color)] transition-all flex items-center justify-center group"
          title={isDesktopCollapsed ? 'Expandir menu' : 'Colapsar menu'}
        >
          {isDesktopCollapsed ? <ChevronRight className="w-5 h-5 opacity-60 group-hover:opacity-100" /> : <ChevronLeft className="w-5 h-5 opacity-60 group-hover:opacity-100" />}
        </button>
      </div>

      <div className={`p-4 sm:p-6 border-t transition-all duration-500 shrink-0 ${isDesktopCollapsed ? 'p-2 sm:p-3' : ''}`} style={{ borderColor: 'var(--border-color)' }}>
        <div className={`flex items-center rounded-2xl border transition-all duration-500 overflow-hidden ${
          isDesktopCollapsed ? 'flex-col p-2 gap-2' : 'gap-3 p-3'
        }`} style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)' }}>
          <div className={`rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-color)] font-bold flex-shrink-0 transition-all duration-500 overflow-hidden ${
            isDesktopCollapsed ? 'w-8 h-8 text-xs' : 'w-10 h-10'
          }`}>
            {(() => {
              // Determinar se há avatar disponível
              let userAvatar: string | null = null;
              if (currentAdminUser) {
                userAvatar = localStorage.getItem(`admin_avatar_${currentAdminUser.id}`);
              }

              if (userAvatar) {
                return (
                  <img
                    src={userAvatar}
                    alt="Foto do usuário"
                    className="w-full h-full object-cover"
                  />
                );
              }

              // Fallback para inicial
              if (currentAdminUser) {
                return currentAdminUser.name?.substring(0, 1).toUpperCase() || role[0];
              }
              return role[0];
            })()}
          </div>
          {!isDesktopCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {(() => {
                  if (currentAdminUser?.name) {
                    return currentAdminUser.name;
                  }
                  if (role === 'SINDICO' || role === 'ADMIN' || role === 'ADMINISTRADOR') return 'Admin';
                  if (role === 'ADMINISTRADORA') return 'Administradora';
                  if (role === 'CABO_TURMA') return 'Cabo de Turma';
                  return 'Portaria';
                })()}
              </p>
            </div>
          )}
          <button
            onClick={onLogout}
            className={`opacity-50 hover:opacity-100 transition-colors rounded-xl ${isDesktopCollapsed ? 'p-1' : 'p-2'}`}
            style={{ color: 'var(--text-primary)' }}
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className={`flex h-screen overflow-hidden select-none min-h-[100dvh] ${theme === 'light' ? 'light-mode' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="aurora-bg">
        <div className="dot-grid"></div>
      </div>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[40] lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 lg:static flex flex-col border-r flex-shrink-0 z-[50] transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isDesktopCollapsed 
            ? 'w-20 sm:w-24 lg:w-24' 
            : 'w-[min(18rem,85vw)] sm:w-72 lg:w-72'
        }`} 
        style={{ 
          backgroundColor: 'var(--sidebar-bg)', 
          borderColor: 'var(--border-color)', 
          backdropFilter: 'blur(30px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
        aria-label="Menu principal"
      >
        <SidebarContent />
      </aside>

      <div 
        className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10"
        style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
      >
        <header className="sticky top-0 z-30 border-b px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-5 flex justify-between items-center shrink-0" style={{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--border-color)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="lg:hidden p-3 min-w-[44px] min-h-[44px] hover:bg-[var(--border-color)] rounded-2xl transition-all active:scale-90 flex items-center justify-center"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl border transition-all hover:bg-[var(--border-color)] active:scale-95 font-bold text-sm uppercase tracking-tight"
                style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                aria-label="Voltar ao dashboard"
              >
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span className="hidden sm:inline">Voltar</span>
              </button>
            )}
            <h2 
              onClick={() => setActiveTab('dashboard')}
              className="text-base sm:text-lg md:text-xl font-black tracking-tighter uppercase shimmer-text cursor-pointer hover:opacity-70 transition-all active:scale-95 truncate min-w-0 max-w-[50vw] sm:max-w-none"
            >
              {menuItems.find(m => m.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
             {(role === 'PORTEIRO' || role === 'SINDICO' || role === 'ADMIN' || role === 'ADMINISTRADOR' || role === 'ADMINISTRADORA' || role === 'CABO_TURMA') &&
               notifications !== undefined &&
               hasPermission('occurrences.view') && (
               <div className="flex items-center gap-2 relative" ref={notificationDropdownRef}>
                 <button 
                    onClick={() => setIsNotificationDropdownOpen(prev => !prev)}
                    className="relative p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 flex items-center justify-center group"
                    style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    aria-label="Notificações"
                 >
                    <Bell className={`w-5 h-5 transition-opacity ${notificationCount > 0 ? 'animate-soft-pulse' : 'opacity-40'}`} />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--text-primary)] text-[var(--bg-color)] text-[10px] font-black rounded-full flex items-center justify-center shadow-2xl border-2 border-[var(--bg-color)]">
                        {notificationCount}
                      </span>
                    )}
                 </button>
                 {isNotificationDropdownOpen && (
                   <div 
                     className="absolute top-full right-0 mt-2 w-[min(90vw,320px)] max-h-[70vh] overflow-y-auto rounded-2xl border shadow-2xl z-50 py-2"
                     style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)' }}
                   >
                     <p className="px-4 py-2 text-[10px] font-black uppercase tracking-wider opacity-60 border-b" style={{ borderColor: 'var(--border-color)' }}>
                       Ocorrências abertas
                     </p>
                     {notifications && notifications.length > 0 ? (
                       (notifications as Notification[]).slice(0, 30).map((n) => (
                         <div
                           key={n.id}
                           className="group flex items-start gap-2 px-4 py-3 hover:bg-white/5 transition-colors border-b last:border-b-0"
                           style={{ borderColor: 'var(--border-color)' }}
                         >
                           <button
                             type="button"
                             onClick={() => {
                               onNotificationClick?.(n);
                               setIsNotificationDropdownOpen(false);
                             }}
                             className="flex-1 min-w-0 text-left flex flex-col gap-0.5"
                           >
                             <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{n.title}</span>
                             <span className="text-[10px] opacity-70 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.message}</span>
                           </button>
                           {onDeleteNotification && n.type !== 'occurrence' && (
                             <button
                               type="button"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 onDeleteNotification(n.id);
                               }}
                               className="p-1.5 rounded-lg opacity-50 hover:opacity-100 hover:bg-red-500/20 text-red-500 shrink-0"
                               title="Excluir notificação"
                               aria-label="Excluir notificação"
                             >
                               <X className="w-3.5 h-3.5" />
                             </button>
                           )}
                         </div>
                       ))
                     ) : (
                       <p className="px-4 py-6 text-xs opacity-70 text-center" style={{ color: 'var(--text-secondary)' }}>
                         Nenhuma notificação no momento.
                       </p>
                     )}
                   </div>
                 )}
               </div>
             )}
             <button 
              onClick={toggleTheme}
              className="p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
              style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
             >
               {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
          </div>
        </header>

        {!isOnline && (
          <div className="z-20 px-4 sm:px-6 md:px-10 py-2.5 sm:py-3 text-[10px] sm:text-xs font-bold tracking-widest uppercase bg-amber-500/95 text-white text-center shadow-lg flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse shrink-0" />
            <span className="min-w-0">Sem conexão. Alterações serão sincronizadas quando a rede voltar.</span>
          </div>
        )}
        {isOnline && isSyncing && (
          <div className="z-20 px-4 sm:px-6 md:px-10 py-2 text-[10px] sm:text-xs font-bold tracking-widest uppercase bg-emerald-600/95 text-white text-center shadow-lg flex items-center justify-center gap-2">
            <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Sincronizando dados...</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10 scroll-smooth custom-scrollbar">
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
