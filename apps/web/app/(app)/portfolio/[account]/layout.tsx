import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PortfolioPageShell, getPortfolioStaticParams } from '../portfolio-page-content';
import { NO_ADMITTED_ACCOUNT_PARAM, buildPortfolioViewModel } from '../portfolio-view-model';

type Props = {
  children: ReactNode;
  params: Promise<{ account: string }>;
};

export function generateStaticParams() {
  return getPortfolioStaticParams();
}

export default async function PortfolioAccountLayout({ children, params }: Props) {
  const { account } = await params;
  const valid = getPortfolioStaticParams().some((row) => row.account === account);
  if (!valid) notFound();
  if (account === NO_ADMITTED_ACCOUNT_PARAM) return <>{children}</>;
  const model = buildPortfolioViewModel(account);
  return <PortfolioPageShell model={model}>{children}</PortfolioPageShell>;
}
