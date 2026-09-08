import { AliveScope } from 'react-activation';
import { App as CapacitorApp } from '@capacitor/app';
import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import AutoResearch from 'renderer/ui/AutoResearch';
import TrainingHistory from 'renderer/ui/TrainingHistory';
import WebAutoUma from './WebAutoUma';

function WebAutoUmaRoute() {
  return <WebAutoUma />;
}

export default function AutoUmaApp() {
  useEffect(() => {
    if (!__AUTOUMA_ANDROID__) return undefined;
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const backEvent = new Event('autouma:back', { cancelable: true });
      if (!window.dispatchEvent(backEvent)) return;
      if (
        canGoBack &&
        window.location.hash.startsWith('#/training-history')
      ) {
        window.history.back();
        return;
      }
      void CapacitorApp.exitApp();
    }).then((listener) => {
      if (!active) {
        void listener.remove();
        return;
      }
      removeListener = () => listener.remove();
    });
    return () => {
      active = false;
      if (removeListener) void removeListener();
    };
  }, []);

  return (
    <div className="autouma-shell flex min-h-0 flex-col overflow-hidden bg-slate-50 font-sans">
      <style>
        {`
          html[data-autouma] {
            --autouma-safe-top: max(env(safe-area-inset-top, 0px), var(--autouma-native-safe-top, 0px));
            --autouma-safe-right: max(env(safe-area-inset-right, 0px), var(--autouma-native-safe-right, 0px));
            --autouma-safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--autouma-native-safe-bottom, 0px));
            --autouma-safe-left: max(env(safe-area-inset-left, 0px), var(--autouma-native-safe-left, 0px));
          }
          html, body, #root { height: 100%; min-height: 0; overflow: hidden; }
          body { margin: 0; background: #f8fafc; }
          img { -webkit-user-drag: none; }
          input, select, textarea, [contenteditable='true'] {
            pointer-events: auto;
            user-select: text !important;
            -webkit-user-select: text !important;
          }
          .autouma-shell { width: 100%; height: 100vh; height: 100dvh; }
          .autouma-header {
            height: calc(2.5rem + var(--autouma-safe-top));
            padding-top: var(--autouma-safe-top);
            padding-right: calc(.75rem + var(--autouma-safe-right));
            padding-left: calc(.75rem + var(--autouma-safe-left));
          }
          .autouma-content {
            padding-right: var(--autouma-safe-right);
            padding-bottom: var(--autouma-safe-bottom);
            padding-left: var(--autouma-safe-left);
          }
          .autouma-content .min-h-screen {
            min-height: calc(100dvh - 2.5rem - var(--autouma-safe-top) - var(--autouma-safe-bottom));
          }
          .autouma-content .h-screen {
            height: calc(100dvh - 2.5rem - var(--autouma-safe-top) - var(--autouma-safe-bottom));
          }

          @media (max-width: 639px) {
            .autouma-header {
              height: calc(3.25rem + var(--autouma-safe-top));
              padding-right: calc(.5rem + var(--autouma-safe-right));
              padding-left: calc(.75rem + var(--autouma-safe-left));
            }
            .autouma-brand {
              font-size: 0.9375rem;
              letter-spacing: -0.01em;
            }
            .autouma-actions {
              gap: 0.25rem;
              overflow: hidden;
            }
            .autouma-content .min-h-screen {
              min-height: calc(100dvh - 3.25rem - var(--autouma-safe-top) - var(--autouma-safe-bottom));
            }
            .autouma-content .h-screen {
              height: calc(100dvh - 3.25rem - var(--autouma-safe-top) - var(--autouma-safe-bottom));
            }
          }
        `}
      </style>
      <HashRouter>
        <AliveScope>
          <header className="autouma-header relative z-30 flex h-10 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3">
            <div
              className="autouma-brand flex shrink-0 items-center"
              title="AutoUma"
            >
              <img
                src="./app-icons/favicon-32.png"
                alt="AutoUma"
                className="h-8 w-8 rounded-lg object-contain"
              />
            </div>
            <div
              id="app-page-actions"
              className="autouma-actions flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto"
            />
            <div
              id="app-page-secondary-tabs"
              className="pointer-events-none absolute left-0 top-[calc(100%-1px)] z-20"
            />
            <div
              id="app-page-tabs"
              className="pointer-events-none absolute left-1/2 top-[calc(100%-1px)] z-20 -translate-x-1/2"
            />
            <div
              id="app-page-context-actions"
              className="pointer-events-none absolute right-0 top-[calc(100%-1px)] z-20"
            />
          </header>
          <main className="autouma-content min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
            <Routes>
              <Route
                path="/"
                element={
                  __AUTOUMA_ANDROID__ ? <AutoResearch /> : <WebAutoUmaRoute />
                }
              />
              <Route
                path="/auto-research"
                element={
                  __AUTOUMA_ANDROID__ ? <AutoResearch /> : <WebAutoUmaRoute />
                }
              />
              <Route
                path="/training-history"
                element={
                  __AUTOUMA_ANDROID__ ? (
                    <TrainingHistory />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </AliveScope>
      </HashRouter>
    </div>
  );
}
