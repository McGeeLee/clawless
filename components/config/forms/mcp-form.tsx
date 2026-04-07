'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfigSection } from '@/hooks/use-config-section';
import type { MCPRemoteServersConfig } from '@/types/config/mcp';

import { createStableId } from './models/models-dev';
import {
  EditableObjectKeyInput,
  Field,
  KeyValueEditor,
  SectionIssues,
  compactRecord,
  createKeyValueEntries,
} from './shared';

export function McpForm() {
  const { issues, value, updateValue } = useConfigSection('mcp');
  const servers = (value ?? {}) as MCPRemoteServersConfig;
  const entries = Object.entries(servers);
  const [serverRowIds, setServerRowIds] = useState<Record<string, string>>({});

  useEffect(() => {
    setServerRowIds((current) => {
      const next: Record<string, string> = {};

      for (const [serverKey] of entries) {
        next[serverKey] = current[serverKey] ?? createStableId('server');
      }

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      const unchanged =
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key]);

      return unchanged ? current : next;
    });
  }, [entries]);

  return (
    <div className="space-y-6">
      <SectionIssues issues={issues} />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Remote servers</CardTitle>
          <CardDescription>
            Configure HTTP or SSE endpoints plus optional request headers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.map(([serverKey, serverValue]) => (
            <div
              key={serverRowIds[serverKey] ?? serverKey}
              className="rounded-2xl border p-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Server name">
                  <EditableObjectKeyInput
                    currentKey={serverKey}
                    onCommit={(nextKey) => {
                      if (nextKey === serverKey) {
                        return;
                      }

                      const rowId =
                        serverRowIds[serverKey] ?? createStableId('server');

                      setServerRowIds((current) => {
                        const next = { ...current };
                        delete next[serverKey];
                        next[nextKey] = rowId;
                        return next;
                      });

                      const nextServers = { ...servers };
                      delete nextServers[serverKey];
                      nextServers[nextKey] = serverValue;
                      updateValue(nextServers);
                    }}
                  />
                </Field>
                <Field label="Type">
                  <Select
                    value={serverValue.type}
                    onValueChange={(nextValue) =>
                      updateValue({
                        ...servers,
                        [serverKey]: {
                          ...serverValue,
                          type: nextValue as 'http' | 'sse',
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a transport" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">http</SelectItem>
                      <SelectItem value="sse">sse</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="URL">
                  <Input
                    placeholder="https://mcp.example.com"
                    value={serverValue.url}
                    onChange={(event) =>
                      updateValue({
                        ...servers,
                        [serverKey]: {
                          ...serverValue,
                          url: event.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Headers">
                  <KeyValueEditor
                    addLabel="Add header"
                    entries={createKeyValueEntries(serverValue.headers)}
                    keyLabel="Header key"
                    onChange={(entries) =>
                      updateValue({
                        ...servers,
                        [serverKey]: {
                          ...serverValue,
                          headers: compactRecord(entries),
                        },
                      })
                    }
                    valueLabel="Header value"
                  />
                </Field>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const nextServers = { ...servers };
                    delete nextServers[serverKey];
                    updateValue(nextServers);
                  }}
                >
                  <Trash2 className="size-4" />
                  Remove server
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              updateValue({
                ...servers,
                [`server-${entries.length + 1}`]: {
                  type: 'http',
                  url: '',
                },
              })
            }
          >
            <Plus className="size-4" />
            Add server
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
