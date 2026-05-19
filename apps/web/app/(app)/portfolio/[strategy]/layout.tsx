import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PortfolioPageShell, getPortfolioStaticParams } from '../portfolio-page-content';
import { buildPortfolioViewModel } from '../portfolio-view-model';

type Props = {
  children: ReactNode;
  params: Promise<{ strategy: string }>;
};

export function generateStaticParams() {
  return getPortfolioStaticParams();
}

export default async function PortfolioStrategyLayout({ children, params }: Props) {
  const { strategy } = await params;
  const valid = getPortfolioStaticParams().some((row) => row.strategy === strategy);
  if (!valid) notFound();
  const model = buildPortfolioViewModel(strategy);
  return <PortfolioPageShell model={model}>{children}</PortfolioPageShell>;
}
