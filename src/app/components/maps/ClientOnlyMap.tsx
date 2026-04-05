import { useEffect, useState, type ReactNode } from 'react';

/** Avoids Leaflet touching `window` before client hydration. */
export function ClientOnlyMap({ children, className }: { children: ReactNode; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) {
    return <div className={className ?? 'h-56 w-full rounded-xl bg-slate-100/90 animate-pulse'} />;
  }
  return <>{children}</>;
}
