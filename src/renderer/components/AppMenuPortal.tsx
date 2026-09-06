import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useActivate, useUnactivate } from 'react-activation';

type AppMenuPortalProps = {
  children: ReactNode;
  targetId?: string;
};

export default function AppMenuPortal({
  children,
  targetId = 'app-page-actions',
}: AppMenuPortalProps) {
  const [active, setActive] = useState(true);
  const [target, setTarget] = useState<HTMLElement | null>(() =>
    document.getElementById(targetId),
  );

  useActivate(() => setActive(true));
  useUnactivate(() => setActive(false));

  useEffect(() => {
    setTarget(document.getElementById(targetId));
  }, [targetId]);

  return active && target ? createPortal(children, target) : null;
}
