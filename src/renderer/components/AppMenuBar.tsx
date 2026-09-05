import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Database,
  GitBranch,
  History,
  Loader2,
  Maximize2,
  Minus,
  RefreshCw,
  Settings2,
  Square,
  X,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';

type AppShellInfo = {
  version: string;
  platform: string;
  serverPort: number;
  serverPortOptions: number[];
  development: boolean;
  maximized: boolean;
};

const navigationItems = [
  {
    label: '比赛记录',
    path: '/races',
    icon: BarChart3,
    matches: ['/races', '/race', '/race-stats'],
  },
  {
    label: 'LOH',
    path: '/loh',
    icon: Database,
    matches: ['/loh', '/leaderboard-analysis'],
  },
  {
    label: '自动育成',
    path: '/auto-research',
    icon: Bot,
    matches: ['/auto-research'],
  },
  {
    label: '继承规划',
    path: '/succession',
    icon: GitBranch,
    matches: ['/succession'],
  },
  {
    label: '养成记录',
    path: '/training-history',
    icon: History,
    matches: ['/training-history'],
  },
] as const;

export default function AppMenuBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [info, setInfo] = useState<AppShellInfo | null>(null);
  const [changingPort, setChangingPort] = useState<number | null>(null);

  useEffect(() => {
    window.electron.appShell
      .getInfo()
      .then((result) => setInfo(result as AppShellInfo))
      .catch(() => undefined);
  }, []);

  useEffect(
    () =>
      window.electron.appShell.onMaximizedChanged((maximized) => {
        setInfo((current) => (current ? { ...current, maximized } : current));
      }),
    [],
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const changeServerPort = async (port: number) => {
    if (!info || port === info.serverPort || changingPort !== null) return;
    setChangingPort(port);
    try {
      const serverPort = Number(
        await window.electron.appShell.setServerPort(port),
      );
      setInfo((current) => (current ? { ...current, serverPort } : current));
    } catch (error) {
      window.alert(
        `监听端口切换失败：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setChangingPort(null);
    }
  };

  const portStatusIcon = (port: number) => {
    if (changingPort === port) {
      return <Loader2 size={12} className="animate-spin" />;
    }
    if (port === info?.serverPort) {
      return <Check size={12} />;
    }
    return null;
  };

  return (
    <header className="app-drag-region sticky top-0 z-[100] flex h-9 items-center border-b border-slate-200 bg-white/95 px-2 shadow-sm backdrop-blur-xl">
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-current={location.pathname === '/' ? 'page' : undefined}
        className={`app-no-drag mr-2 flex h-7 flex-none items-center gap-1.5 rounded-md px-2 text-left transition-colors ${
          location.pathname === '/'
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-slate-800 hover:bg-slate-100'
        }`}
        title="UmaShow（概览）"
      >
        <AssetIcon
          path="icon.ico"
          alt="UmaShow"
          className="h-6 w-6 rounded object-contain"
          loading="eager"
        />
        <span className="hidden text-xs font-bold tracking-tight md:inline">
          UmaShow
        </span>
      </button>

      <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
        {navigationItems.map((item) => {
          const active = item.matches.some(
            (path) => path === location.pathname,
          );
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              aria-current={active ? 'page' : undefined}
              className={`app-no-drag flex h-7 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title={item.label}
            >
              <Icon size={15} className="flex-none" />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div ref={menuRef} className="app-no-drag relative ml-2 flex-none">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
            menuOpen
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Settings2 size={15} />
          <span className="hidden md:inline">应用</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2.5">
              <div className="text-xs font-semibold text-slate-800">
                监听端口
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(info?.serverPortOptions || []).map((port) => (
                  <button
                    key={port}
                    type="button"
                    onClick={() => changeServerPort(port)}
                    disabled={changingPort !== null}
                    className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                      port === info?.serverPort
                        ? 'border-indigo-200 bg-indigo-50 font-semibold text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {portStatusIcon(port)}
                    {port}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  window.electron.appShell.toggleFullScreen();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Maximize2 size={16} />
                切换全屏
              </button>
              <button
                type="button"
                onClick={() => {
                  window.electron.appShell.checkForUpdates();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <RefreshCw size={16} />
                检查更新
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400">
              <span>UmaShow {info?.version ? `v${info.version}` : ''}</span>
              <span>{info?.platform || ''}</span>
            </div>
          </div>
        ) : null}
      </div>

      {info?.platform === 'win32' ? (
        <div className="app-no-drag -mr-2 ml-1 flex h-9 flex-none items-stretch border-l border-slate-200">
          <button
            type="button"
            onClick={() => window.electron.appShell.minimize()}
            className="flex w-11 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="最小化"
            aria-label="最小化窗口"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={async () => {
              const maximized = Boolean(
                await window.electron.appShell.toggleMaximize(),
              );
              setInfo((current) =>
                current ? { ...current, maximized } : current,
              );
            }}
            className="flex w-11 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title={info.maximized ? '还原' : '最大化'}
            aria-label={info.maximized ? '还原窗口' : '最大化窗口'}
          >
            {info.maximized ? <Copy size={14} /> : <Square size={13} />}
          </button>
          <button
            type="button"
            onClick={() => window.electron.appShell.close()}
            className="flex w-12 items-center justify-center text-slate-500 hover:bg-red-500 hover:text-white"
            title="关闭"
            aria-label="关闭窗口"
          >
            <X size={17} />
          </button>
        </div>
      ) : null}
    </header>
  );
}
