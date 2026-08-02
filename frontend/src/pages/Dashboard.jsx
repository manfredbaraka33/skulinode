import { useState,useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  School, LayoutDashboard, GraduationCap, BookOpen, LayoutGrid,
  ClipboardList, Users, UserCheck, BarChart2, FileText,
  LogOut, Menu, Sun, Moon, X, Settings, Layers, BookCheck,
  SlidersHorizontal, ChevronLeft, ChevronRight, KeyRound,DollarSign,
  Phone, MessageSquarePlus,MessageSquare,FileIcon,
  User2,
  BadgeDollarSign,
  MegaphoneIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../hooks/useDarkMode';
import apiClient from '../api/axios';


const ROLE_BADGE = {
  ADMIN:   { label: 'School Admin',    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  TEACHER: { label: 'Teacher',         color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  BURSAR: { label: 'Bursar',         color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100' },
};

function SidebarLink({ to, icon: Icon, label, onClick, collapsed }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors
        ${collapsed ? 'justify-center px-0 py-2.5 w-10 mx-auto' : 'px-4 py-2.5'}
        ${isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'}`
      }
    >
      <Icon size={17} className="shrink-0" />
      {!collapsed && label}
    </NavLink>
  );
}

function SidebarSection({ label, collapsed }) {
  if (collapsed) return <div className="my-1 border-t border-slate-100 dark:border-slate-700/60" />;
  return (
    <p className="px-4 pt-4 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
      {label}
    </p>
  );
}

function ThemeToggle({ dark, toggle }) {
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition
        text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700
        hover:text-slate-800 dark:hover:text-slate-200"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/* ── Dashboard layout shell ───────────────────────────────────────────────── */
export default function Dashboard() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const isAdmin = auth?.role === 'ADMIN' || (auth?.roles ?? []).includes('ADMIN');
  const isBursar = auth?.role === 'BURSAR' || (auth?.roles ?? []).includes('BURSAR');
  const isTeacher = auth?.role === 'TEACHER' || (auth?.roles ?? []).includes('TEACHER');
  const slug = auth?.schoolSlug ?? '';
  const badge = ROLE_BADGE[auth?.role] ?? { label: auth?.role, color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };


  const [isClassMaster, setIsClassMaster] = useState(false);

  useEffect(() => {
  // 1. Guard clause: Exit early if the user is not a teacher
  if (!isTeacher) return;

  // 2. Make the API call directly using your existing apiClient
  apiClient.get('/academy/my-class-master-streams/')
    .then(r => {
      // Check if data exists and has at least one item
      const hasAssignments = Array.isArray(r.data) && r.data.length > 0;
      setIsClassMaster(hasAssignments);
    })
    .catch((error) => {
      console.error("Failed to fetch class master status:", error);
      setIsClassMaster(false); // Safe fallback on error
    });
    
}, [isTeacher]); // Runs whenever the isTeacher status changes

  function handleLogout() {
    logout();{(isAdmin || isTeacher) && (
  <SidebarLink to={`/${slug}/comments`} icon={MessageSquare} label="Comments" onClick={onClose} collapsed={isCollapsed} />
)}
    navigate('/login', { replace: true });
  }
  

  const SidebarContent = ({ onClose, forceExpanded = false }) => {
    const isCollapsed = !forceExpanded && collapsed;
    return (
      <aside className="flex flex-col h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-200">
        {/* Brand */}
        <div className={`flex items-center border-b border-slate-100 dark:border-slate-700 ${isCollapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 py-5'}`}>
          {isCollapsed ? (
            <div className="bg-blue-600 rounded-lg p-1.5 shrink-0">
              <School size={18} className="text-white" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-blue-600 rounded-lg p-1.5 shrink-0">
                  <School size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">SkuliNode</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{auth?.schoolName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle dark={dark} toggle={toggleDark} />
                {onClose && (
                  <button onClick={onClose} aria-label="Close sidebar"
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition
                      text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <X size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 overflow-y-auto space-y-0.5 ${isCollapsed ? 'px-1' : 'px-3'}`}>
          <SidebarLink to={`/${slug}/dashboard`} icon={LayoutDashboard} label="Dashboard" onClick={onClose} collapsed={isCollapsed} />

          {isAdmin && (
            <>
              <SidebarSection label="School Management" collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/classes`}         icon={LayoutGrid}        label="Classes"          onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/subjects`}        icon={BookOpen}          label="Subjects"         onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/assessments`}     icon={ClipboardList}     label="Assessments"      onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/students`}        icon={GraduationCap}     label="Students"         onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/users`}           icon={Users}             label="Staff"            onClick={onClose} collapsed={isCollapsed} />

              <SidebarSection label="Assignments" collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/assignments`}     icon={Layers}            label="Satff Subjects"      onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/student-subjects`} icon={BookCheck}        label="Student Subjects" onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/class-masters`} icon={Users}        label="Class Masters" onClick={onClose} collapsed={isCollapsed} />

              <SidebarSection label="Results" collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/results`}         icon={BarChart2}         label="Results"     onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/report-cards`}    icon={FileText}          label="Report Cards"     onClick={onClose} collapsed={isCollapsed} />
              <SidebarSection label="School" collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/settings`}        icon={Settings}          label="School Settings"  onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/grade-config`}    icon={SlidersHorizontal} label="Grade Ranges"     onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/circulars`}    icon={FileIcon}          label="Circulars"     onClick={onClose} collapsed={isCollapsed} />
            </>
          )}

          {isTeacher && (
            <>
              <SidebarSection label="Teaching" collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/marks`}         icon={UserCheck}  label="My Subjects"   onClick={onClose} collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/staff-results`} icon={BarChart2}   label="Class Results" onClick={onClose} collapsed={isCollapsed} />
            </>
          )}

          {(isAdmin || (isTeacher && isClassMaster)) && (
              <SidebarLink to={`/${slug}/comments`} icon={MessageSquare} label="Comments" onClick={onClose} collapsed={isCollapsed} />
            )}

          {isBursar && (
            <>
              <SidebarSection label="Finance" collapsed={isCollapsed} />
              <SidebarLink to={`/${slug}/finance`} icon={DollarSign}   label="Fedha" onClick={onClose} collapsed={isCollapsed} />
            </>
          )}

          <SidebarSection label="Account" collapsed={isCollapsed} />
          <SidebarLink to={`/${slug}/profile`}  icon={KeyRound}          label="My Account"  onClick={onClose} collapsed={isCollapsed} />
          <SidebarLink to={`/${slug}/feedback`} icon={MessageSquarePlus} label="Feedback"     onClick={onClose} collapsed={isCollapsed} />
          <SidebarLink to={`/${slug}/contact`}  icon={Phone}             label="Contact Us"  onClick={onClose} collapsed={isCollapsed} />
        </nav>

        {/* User footer */}
        <div className={`border-t border-slate-100 dark:border-slate-700 ${isCollapsed ? 'px-1 py-3' : 'px-3 py-4'}`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold"
                title={auth?.fullName}>
                {auth?.fullName?.charAt(0) ?? '?'}
              </div>
              <button onClick={handleLogout} title="Sign out"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {auth?.fullName?.charAt(0) ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{auth?.fullName}</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                  text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                <LogOut size={15} /> Sign out
              </button>
            </>
          )}
        </div>
      </aside>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Desktop sidebar */}
      <div className={`hidden md:flex shrink-0 flex-col h-full relative transition-all duration-200 ${collapsed ? 'w-14' : 'w-60'}`}>
        <SidebarContent />
        {/* Collapse toggle tab */}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-18 z-10 w-6 h-6 rounded-full bg-white dark:bg-slate-700
            border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center
            text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-600
            hover:text-blue-600 transition"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="w-60 flex-col h-full flex shadow-xl">
            <SidebarContent onClose={() => setSidebarOpen(false)} forceExpanded />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3
          bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">SkuliNode</span>
          </div>
          <ThemeToggle dark={dark} toggle={toggleDark} />
        </header>

        {/* Routed page */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ── Dashboard Home (index route) ─────────────────────────────────────────── */
export function DashboardHome() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const slug = auth?.schoolSlug ?? '';
  const isAdmin = auth?.role === 'ADMIN' || (auth?.roles ?? []).includes('ADMIN');
  const isBursar = auth?.role === 'BURSAR' || (auth?.roles ?? []).includes('BURSAR');
  const isTeacher = auth?.role === 'TEACHER' || (auth?.roles ?? []).includes('TEACHER');
  const badge = ROLE_BADGE[auth?.role] ?? { label: auth?.role, color: 'bg-slate-100 text-slate-600' };

  const adminCards = [
    { to: `/${slug}/subjects`,     icon: BookOpen,      label: 'Subjects',      desc: 'Add & assign subjects' },
    { to: `/${slug}/assessments`,  icon: ClipboardList, label: 'Assessments',   desc: 'Manage exams & tests' },
    { to: `/${slug}/students`,     icon: GraduationCap, label: 'Students',      desc: 'Register students' },
    { to: `/${slug}/results`,      icon: BarChart2,     label: 'Live Results',  desc: 'View standings' },
    { to: `/${slug}/report-cards`, icon: FileText,      label: 'Report Cards',  desc: 'Print report cards' },
    { to: `/${slug}/users`,        icon: Users,         label: 'Staff',         desc: 'Manage staff accounts' },
  ];
  const teacherCards = [
    { to: `/${slug}/marks`,         icon: UserCheck, label: 'My Subjects',   desc: 'Enter marks for your classes' },
    { to: `/${slug}/staff-results`, icon: BarChart2,  label: 'Class Results', desc: 'View published results' },
  ];
  const bursarCards = [
    { to: `/${slug}/finance`,         icon: DollarSign, label: 'Fedha',   desc: 'Manage Fees' },
    
  ];
 
  const cards = isAdmin ? adminCards : isBursar ? bursarCards : teacherCards;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Welcome banner */}
      <div className="bg-linear-to-r from-blue-600 to-indigo-600 rounded-2xl px-7 py-6 text-white shadow">
        <p className="text-blue-200 text-sm mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold mb-1">{auth?.fullName}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20">{badge.label}</span>
          <span className="text-blue-200 text-xs flex items-center gap-1">
            <School size={11} /> {auth?.schoolName}
          </span>
        </div>
      </div>

      {/* Quick-access grid */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cards.map(({ to, icon: Icon, label, desc }) => (
            <button key={to} onClick={() => navigate(to)}
              className="flex flex-col items-start gap-2 bg-white dark:bg-slate-800 rounded-xl
                border border-slate-200 dark:border-slate-700 px-4 py-4
                hover:border-blue-400 hover:shadow-sm transition text-left group">
              <div className="bg-blue-50 dark:bg-blue-900/30 group-hover:bg-blue-100 rounded-lg p-2 transition">
                <Icon size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
