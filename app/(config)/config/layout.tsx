import { cookies } from 'next/headers';

import { AppSidebar } from '@/components/app-sidebar';
import { ConfigProvider } from '@/components/config/config-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function ConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar />
      <SidebarInset>
        <ConfigProvider>{children}</ConfigProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
