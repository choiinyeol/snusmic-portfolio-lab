'use client';

import type { ReactNode } from 'react';
import type { PortfolioViewModel } from './types';

export function PortfolioAccountFrame({ children }: { children: ReactNode; model: PortfolioViewModel }) {
  return <div className="min-w-0">{children}</div>;
}
