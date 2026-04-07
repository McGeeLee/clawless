import { notFound } from 'next/navigation';

import { ConfigSectionPage } from '@/components/config/config-section-page';
import { isConfigSectionKey } from '@/components/config/config-sections';

export default async function ConfigSectionRoute({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!isConfigSectionKey(section)) {
    notFound();
  }

  return <ConfigSectionPage section={section} />;
}
