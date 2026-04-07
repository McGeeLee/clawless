'use client';

import packageJson from '@/package.json';
import {
  BookOpen,
  Brain,
  Clock3,
  FolderArchive,
  Globe,
  Loader2,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Plus,
  Puzzle,
  Settings,
  Sun,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ofetch } from 'ofetch';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  SESSION_LIST_INVALIDATED_EVENT,
  SESSION_LIST_UPSERTED_EVENT,
  type SessionListItemEventDetail,
  invalidateSessionList,
} from '@/lib/chat/session-events';
import { Logo } from './logo';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const navItems = [
  { label: 'Chat', icon: MessageSquare, href: '/' },
  { label: 'Files', icon: FolderArchive, href: '/files' },
  { label: 'Memory', icon: Brain, href: '/memory' },
  { label: 'Schedule', icon: Clock3, href: '/schedule' },
  { label: 'Skills', icon: Puzzle, href: '/skills' },
  { label: 'Config', icon: Settings, href: '/config' },
];

type ThemeMode = 'light' | 'dark' | 'system';

const docsUrl = 'https://niapya.github.io/clawless';
const siteUrl = 'https://github.com/niapya/clawless';

interface SessionItem {
  id: string;
  title: string | null;
  channel: string;
  createdAt: string;
}

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { theme = 'system', setTheme } = useTheme();
  const isChatPage = pathname === '/' || pathname.startsWith('/chat');
  const chatPagePath = isChatPage ? pathname : null;

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null,
  );
  const [loggingOut, setLoggingOut] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await ofetch<{ sessions?: SessionItem[] }>(
        '/api/sessions?limit=30',
      );
      setSessions(data.sessions ?? []);
    } catch {
      // silent fail for sidebar
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (!chatPagePath) {
      setSessions([]);
      setLoadingSessions(false);
      return;
    }

    void loadSessions();
  }, [chatPagePath, loadSessions]);

  useEffect(() => {
    if (!isChatPage) {
      return;
    }

    const handleSessionsInvalidated = () => {
      void loadSessions();
    };
    const handleSessionUpserted = (event: Event) => {
      const detail = (event as CustomEvent<SessionListItemEventDetail>).detail;
      if (!detail) {
        return;
      }

      setSessions((current) => {
        const next = [
          detail,
          ...current.filter((session) => session.id !== detail.id),
        ];

        return next.slice(0, 30);
      });
    };

    window.addEventListener(
      SESSION_LIST_INVALIDATED_EVENT,
      handleSessionsInvalidated,
    );
    window.addEventListener(SESSION_LIST_UPSERTED_EVENT, handleSessionUpserted);

    return () => {
      window.removeEventListener(
        SESSION_LIST_INVALIDATED_EVENT,
        handleSessionsInvalidated,
      );
      window.removeEventListener(
        SESSION_LIST_UPSERTED_EVENT,
        handleSessionUpserted,
      );
    };
  }, [isChatPage, loadSessions]);

  const handleDeleteSession = useCallback(
    async (session: SessionItem) => {
      setDeletingSessionId(session.id);

      try {
        const response = await ofetch.raw<{ error?: string }>(
          `/api/sessions/${session.id}`,
          {
            method: 'DELETE',
          },
        );
        const payload = response._data ?? {};

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to delete session.');
        }

        setSessions((current) =>
          current.filter((item) => item.id !== session.id),
        );
        invalidateSessionList();

        if (pathname === `/chat/${session.id}`) {
          setOpenMobile(false);
          router.push('/');
          router.refresh();
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to delete session.',
        );
      } finally {
        setDeletingSessionId((current) =>
          current === session.id ? null : current,
        );
      }
    },
    [pathname, router, setOpenMobile],
  );

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await ofetch('/api/auth/logout', {
        method: 'POST',
      });
      setOpenMobile(false);
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }, [router, setOpenMobile]);

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => setOpenMobile(false)}
              className="flex flex-row gap-1 items-center"
            >
              <Logo width={24} height={24} />
              <span className="text-lg font-semibold hover:bg-muted rounded-md cursor-pointer">
                ClawLess
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === '/'
                        ? pathname === '/' || pathname.startsWith('/chat')
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isChatPage ? (
          <>
            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupLabel>Recent Sessions</SidebarGroupLabel>
              <SidebarGroupContent>
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2">
                    No sessions yet
                  </p>
                ) : (
                  <SidebarMenu>
                    {sessions.map((session) => (
                      <SidebarMenuItem key={session.id}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction
                              showOnHover
                              aria-label={`Delete ${session.title ?? 'Untitled'}`}
                              disabled={deletingSessionId === session.id}
                            >
                              {deletingSessionId === session.id ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side="right"
                            align="start"
                            className="w-56"
                          >
                            <DropdownMenuLabel className="text-xs leading-5 text-muted-foreground">
                              Delete this session and all of its messages?
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={deletingSessionId === session.id}
                              onSelect={() => {
                                void handleDeleteSession(session);
                              }}
                            >
                              {deletingSessionId === session.id ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                              Confirm Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `/chat/${session.id}`}
                        >
                          <Link
                            href={`/chat/${session.id}`}
                            onClick={() => setOpenMobile(false)}
                            title={session.title ?? 'Untitled'}
                          >
                            <MessageSquare className="size-4 shrink-0" />
                            <span className="truncate">
                              {session.title ?? 'Untitled'}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>
              <Wrench className="size-4" />
              <span>More</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as ThemeMode)}
            >
              <DropdownMenuRadioItem value="light">
                <Sun className="size-4 mx-2" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="size-4 mx-2" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="size-4 mx-2" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={docsUrl} target="_blank" rel="noreferrer">
                <BookOpen className="size-4" />
                Official Docs
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={siteUrl} target="_blank" rel="noreferrer">
                <Globe className="size-4" />
                Official Website
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={loggingOut}
              onSelect={() => void handleLogout()}
            >
              <LogOut className="size-4" />
              {loggingOut ? 'Signing out...' : 'Sign out'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Version {packageJson.version}
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
