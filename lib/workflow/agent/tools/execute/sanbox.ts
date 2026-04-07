import {
  readFile as readLocalFile,
  rm as removeLocalFile,
} from 'node:fs/promises';

import { serializeToolMessage } from '@/lib/chat/message-utils';
import { put } from '@/lib/core/blob';
import {
  getSession,
  updateSession,
  upsertPersistedMessage,
} from '@/lib/core/db/chat';
import { createFileRecord } from '@/lib/core/db/files';
import {
  downloadSandboxFileAction,
  readSandboxFileAction,
  resolveSandboxPublicPortAction,
  runSandboxCommandAction,
  writeSandboxFileAction,
} from '@/lib/core/sandbox';
import {
  SANDBOX_MAX_OUTPUT_LENGTH,
  SANDBOX_PUBLIC_PORTS,
  SANDBOX_TIMEOUT_MS,
  nowIso,
  patchSandboxRuntime,
  truncateStreamOutput,
} from '@/lib/core/sandbox/runtime';
import { approvalHookBuilder } from '@/lib/workflow/agent/hooks';
import { sendApprovalRequestReminderStep } from '@/lib/workflow/agent/sender/bots';
import {
  writeRuntimeEvent,
  writeToolApprovalRequest,
  writeToolOutputDenied,
} from '@/lib/workflow/agent/sender/writers';
import {
  getChatSourceFromSessionMetadata,
  isImChatSource,
} from '@/types/workflow';
import { tool } from 'ai';
import { z } from 'zod';
import { defineBuildInTool } from '../define';

const execInputSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  sudo: z.boolean().optional(),
});

const readFileInputSchema = z.object({
  path: z.string().min(1),
  cwd: z.string().optional(),
});

const writeFileInputSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  cwd: z.string().optional(),
});

const publicPortInputSchema = z.object({
  port: z.number().int().min(1).max(65535),
});

const exportFileInputSchema = z.object({
  path: z.string().min(1),
  cwd: z.string().optional(),
});

type ExecInput = z.infer<typeof execInputSchema>;
type ReadFileInput = z.infer<typeof readFileInputSchema>;
type WriteFileInput = z.infer<typeof writeFileInputSchema>;
type PublicPortInput = z.infer<typeof publicPortInputSchema>;
type ExportFileInput = z.infer<typeof exportFileInputSchema>;
type SandboxApprovalResponse = {
  approved: boolean;
  comment?: string;
};

type SandboxDeniedOutput = {
  approved: false;
  denied: true;
  reason?: string;
};

function buildApprovalToken(runId: string, toolCallId: string): string {
  return `${runId}:${toolCallId}`;
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'artifact';
}

function detectMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.zip')) {
    return 'application/zip';
  }

  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    return 'application/gzip';
  }

  return 'application/octet-stream';
}

async function persistSandboxExportedFile(input: {
  sessionId: string;
  runId: string;
  sandboxId: string;
  sourcePath: string;
  fileName: string;
  fileBuffer: Buffer;
}) {
  const resolvedFileName = sanitizeFileName(input.fileName);
  const blobPath = `files/${input.sessionId}/${Date.now()}-${resolvedFileName}`;
  const mimeType = detectMimeType(input.fileName);
  const blob = await put(
    blobPath,
    new Blob([new Uint8Array(input.fileBuffer)]),
    {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mimeType,
    },
  );

  const record = await createFileRecord({
    sessionId: input.sessionId,
    runId: input.runId,
    sandboxId: input.sandboxId,
    sourcePath: input.sourcePath,
    fileName: input.fileName,
    mimeType,
    size: input.fileBuffer.byteLength,
    blobPath,
    blobUrl: blob.url,
    metadata: {
      archived: false,
      archiveFormat: 'none',
      source: 'sandbox.downloadFile',
    },
  });

  return {
    blob,
    record,
  };
}

function buildApprovalMetadata(input: {
  toolCallId: string;
  approved?: boolean;
  comment?: string;
}) {
  if (input.approved === undefined) {
    return {
      id: input.toolCallId,
    } as const;
  }

  return {
    id: input.toolCallId,
    approved: input.approved,
    reason: input.comment,
  } as const;
}

async function patchLatestApproval(input: {
  sessionId: string;
  toolCallId: string;
  hookToken?: string;
  toolName: string;
  status: 'pending' | 'approved' | 'rejected';
  input: unknown;
  comment?: string;
}) {
  'use step';

  const session = await getSession(input.sessionId);
  const existingApproval =
    (session?.metadata?.latestApproval as
      | {
          requestedAt?: string;
          hookToken?: string;
          notifiedAt?: string | null;
        }
      | undefined) ?? undefined;

  await updateSession(input.sessionId, {
    metadata: {
      ...(session?.metadata ?? {}),
      latestApproval: {
        toolCallId: input.toolCallId,
        hookToken: input.hookToken ?? existingApproval?.hookToken ?? null,
        toolName: input.toolName,
        status: input.status,
        input: input.input,
        comment: input.comment ?? null,
        requestedAt: existingApproval?.requestedAt ?? nowIso(),
        respondedAt: input.status === 'pending' ? null : nowIso(),
        notifiedAt: existingApproval?.notifiedAt ?? null,
      },
    },
  });
}

async function persistApprovalToolState(input: {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  toolState: 'approval-requested' | 'approval-responded' | 'output-denied';
  toolInput: unknown;
  comment?: string;
  approved?: boolean;
}) {
  'use step';

  await upsertPersistedMessage(
    serializeToolMessage({
      sessionId: input.sessionId,
      uiMessageId: `tool:${input.toolCallId}`,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      toolState: input.toolState,
      toolApproval: buildApprovalMetadata({
        toolCallId: input.toolCallId,
        approved: input.approved,
        comment: input.comment,
      }),
      toolInput: input.toolInput,
      toolOutput:
        input.toolState === 'output-denied'
          ? input.comment || 'Execution denied by approval policy.'
          : undefined,
      createdAt: new Date(),
    }),
  );
}

async function notifyApprovalRequestSourceStep(input: {
  sessionId: string;
  toolCallId: string;
  toolName: string;
}) {
  'use step';

  const session = await getSession(input.sessionId);
  if (!session || session.channel === 'web') {
    return false;
  }

  // TODO
  const source = getChatSourceFromSessionMetadata(session.metadata);
  if (!isImChatSource(source)) {
    return false;
  }

  const latestApproval =
    (session.metadata?.latestApproval as
      | {
          toolCallId?: string;
          notifiedAt?: string | null;
        }
      | undefined) ?? undefined;

  if (
    latestApproval?.toolCallId === input.toolCallId &&
    latestApproval?.notifiedAt
  ) {
    return true;
  }

  const sent = await sendApprovalRequestReminderStep({
    source,
    toolName: input.toolName,
    toolCallId: input.toolCallId,
  });

  if (!sent) {
    return false;
  }

  await updateSession(input.sessionId, {
    metadata: {
      ...(session.metadata ?? {}),
      latestApproval: {
        ...(latestApproval ?? {}),
        toolCallId: input.toolCallId,
        notifiedAt: nowIso(),
      },
    },
  });

  return true;
}

async function waitForSandboxApproval(input: {
  sessionId: string;
  runId: string;
  toolCallId: string;
  toolName: string;
  toolInput: unknown;
}): Promise<SandboxApprovalResponse> {
  const hookToken = buildApprovalToken(input.runId, input.toolCallId);
  const hook = approvalHookBuilder.create({
    token: hookToken,
  });

  try {
    await patchLatestApproval({
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      hookToken,
      toolName: input.toolName,
      status: 'pending',
      input: input.toolInput,
    });
    await persistApprovalToolState({
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      toolState: 'approval-requested',
      toolInput: input.toolInput,
    });
    await writeToolApprovalRequest({
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      toolInput: input.toolInput,
      approvalId: input.toolCallId,
    });
    await notifyApprovalRequestSourceStep({
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to persist pending approval state: ${error.message}`
        : `Failed to persist pending approval state: ${String(error)}`;

    await writeRuntimeEvent({
      event: 'runtime-error',
      sessionId: input.sessionId,
      runId: input.runId,
      command: `approval:${input.toolName}`,
      message,
    });
    throw error;
  }

  const approval = await hook;

  try {
    await patchLatestApproval({
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      hookToken,
      toolName: input.toolName,
      status: approval.approved ? 'approved' : 'rejected',
      input: input.toolInput,
      comment: approval.comment,
    });

    if (!approval.approved) {
      await persistApprovalToolState({
        sessionId: input.sessionId,
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        toolState: 'output-denied',
        toolInput: input.toolInput,
        approved: false,
        comment: approval.comment,
      });
      await writeToolOutputDenied({
        toolCallId: input.toolCallId,
      });

      return approval;
    }

    await persistApprovalToolState({
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      toolState: 'approval-responded',
      toolInput: input.toolInput,
      approved: true,
      comment: approval.comment,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Failed to persist resolved approval state: ${error.message}`
        : `Failed to persist resolved approval state: ${String(error)}`;

    await writeRuntimeEvent({
      event: 'runtime-error',
      sessionId: input.sessionId,
      runId: input.runId,
      command: `approval:${input.toolName}`,
      message,
    });
    throw error;
  }

  return approval;
}

async function executeSandboxCommandStep(
  input: ExecInput & {
    sessionId: string;
    runId: string;
  },
) {
  'use step';

  const { sessionId, runId, command, args, cwd, env, sudo } = input;
  const shellCommand =
    args && args.length > 0 ? [command, ...args].join(' ') : command;

  await patchSandboxRuntime(sessionId, {
    status: 'running',
    lastActiveAt: nowIso(),
    timeoutMs: SANDBOX_TIMEOUT_MS,
    lastCommand: shellCommand,
    lastExitCode: null,
    lastError: null,
  });

  try {
    const result = await runSandboxCommandAction({
      sessionId,
      command,
      args,
      cwd,
      env,
      sudo,
    });

    if (result.kind === 'running') {
      await writeRuntimeEvent({
        event: result.created ? 'sandbox-created' : 'sandbox-reused',
        sessionId,
        runId,
        sandboxId: result.sandboxId,
        status: result.sandboxStatus,
      });
      await writeRuntimeEvent({
        event: 'sandbox-command-start',
        sessionId,
        runId,
        sandboxId: result.sandboxId,
        command: result.shellCommand,
        status: result.sandboxStatus,
      });

      await patchSandboxRuntime(sessionId, {
        status: 'running',
        lastActiveAt: nowIso(),
        timeoutMs: SANDBOX_TIMEOUT_MS,
        lastCommand: result.shellCommand,
        lastExitCode: null,
        lastError: null,
      });
      await writeRuntimeEvent({
        event: 'sandbox-command-running',
        sessionId,
        runId,
        sandboxId: result.sandboxId,
        command: result.shellCommand,
        status: result.sandboxStatus,
        message: result.message,
      });

      return {
        running: true,
        shellCommand: result.shellCommand,
        cmdId: result.cmdId,
        startedAt: result.startedAt,
        waitTimeoutMs: result.waitTimeoutMs,
        message: result.message,
      };
    }

    const finalResult = {
      running: false,
      exitCode: result.exitCode,
      stdout: truncateStreamOutput(
        result.stdout,
        SANDBOX_MAX_OUTPUT_LENGTH,
        'stdout',
      ),
      stderr: truncateStreamOutput(
        result.stderr,
        SANDBOX_MAX_OUTPUT_LENGTH,
        'stderr',
      ),
    };

    await writeRuntimeEvent({
      event: result.created ? 'sandbox-created' : 'sandbox-reused',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      status: result.sandboxStatus,
    });
    await writeRuntimeEvent({
      event: 'sandbox-command-start',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      command: result.shellCommand,
      status: result.sandboxStatus,
    });

    await patchSandboxRuntime(sessionId, {
      status: 'running',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: result.shellCommand,
      lastExitCode: result.exitCode,
      lastError: finalResult.stderr || null,
    });
    await writeRuntimeEvent({
      event: 'sandbox-command-finish',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      command: result.shellCommand,
      exitCode: result.exitCode,
      status: result.sandboxStatus,
    });

    return finalResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchSandboxRuntime(sessionId, {
      status: 'error',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: shellCommand,
      lastError: message,
    });
    await writeRuntimeEvent({
      event: 'runtime-error',
      sessionId,
      runId,
      command: shellCommand,
      message,
    });
    throw error;
  }
}

async function readSandboxFileStep(
  input: ReadFileInput & {
    sessionId: string;
    runId: string;
  },
) {
  'use step';

  const { sessionId, runId, path, cwd } = input;
  const commandLabel = `read:${path}`;

  await patchSandboxRuntime(sessionId, {
    status: 'running',
    lastActiveAt: nowIso(),
    timeoutMs: SANDBOX_TIMEOUT_MS,
    lastCommand: commandLabel,
    lastExitCode: 0,
    lastError: null,
  });

  try {
    const result = await readSandboxFileAction({
      sessionId,
      path,
      cwd,
    });

    await writeRuntimeEvent({
      event: result.created ? 'sandbox-created' : 'sandbox-reused',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      status: result.sandboxStatus,
    });
    await writeRuntimeEvent({
      event: 'sandbox-command-start',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      command: `read:${result.path}`,
      status: result.sandboxStatus,
    });
    await writeRuntimeEvent({
      event: 'sandbox-command-finish',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      command: `read:${result.path}`,
      exitCode: 0,
      status: result.sandboxStatus,
    });

    return {
      path: result.path,
      content: result.content,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchSandboxRuntime(sessionId, {
      status: 'error',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: commandLabel,
      lastExitCode: 1,
      lastError: message,
    });
    await writeRuntimeEvent({
      event: 'runtime-error',
      sessionId,
      runId,
      command: commandLabel,
      message,
    });
    throw error;
  }
}

async function writeSandboxFileStep(
  input: WriteFileInput & {
    sessionId: string;
    runId: string;
  },
) {
  'use step';

  const { sessionId, runId, path, content, cwd } = input;
  const commandLabel = `write:${path}`;

  await patchSandboxRuntime(sessionId, {
    status: 'running',
    lastActiveAt: nowIso(),
    timeoutMs: SANDBOX_TIMEOUT_MS,
    lastCommand: commandLabel,
    lastExitCode: 0,
    lastError: null,
  });

  try {
    const result = await writeSandboxFileAction({
      sessionId,
      path,
      content,
      cwd,
    });

    await writeRuntimeEvent({
      event: result.created ? 'sandbox-created' : 'sandbox-reused',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      status: result.sandboxStatus,
    });
    await writeRuntimeEvent({
      event: 'sandbox-command-start',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      command: `write:${result.path}`,
      status: result.sandboxStatus,
    });
    await writeRuntimeEvent({
      event: 'sandbox-command-finish',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      command: `write:${result.path}`,
      exitCode: 0,
      status: result.sandboxStatus,
    });

    return {
      path: result.path,
      bytes: result.bytes,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchSandboxRuntime(sessionId, {
      status: 'error',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: commandLabel,
      lastExitCode: 1,
      lastError: message,
    });
    await writeRuntimeEvent({
      event: 'runtime-error',
      sessionId,
      runId,
      command: commandLabel,
      message,
    });
    throw error;
  }
}

async function resolveSandboxPublicPortStep(
  input: PublicPortInput & {
    sessionId: string;
    runId: string;
  },
) {
  'use step';

  const { sessionId, runId, port } = input;
  const commandLabel = `port:${port}`;

  try {
    const result = await resolveSandboxPublicPortAction({
      sessionId,
      port,
    });

    await writeRuntimeEvent({
      event: result.created ? 'sandbox-created' : 'sandbox-reused',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      status: result.sandboxStatus,
    });

    await patchSandboxRuntime(sessionId, {
      status: 'running',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: commandLabel,
      lastExitCode: 0,
      lastError: null,
    });
    await writeRuntimeEvent({
      event: 'sandbox-port-url',
      sessionId,
      runId,
      sandboxId: result.sandboxId,
      command: commandLabel,
      status: result.sandboxStatus,
      message: result.url,
    });

    return {
      port: result.port,
      url: result.url,
      publicPorts: result.publicPorts,
      sandboxId: result.sandboxId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchSandboxRuntime(sessionId, {
      status: 'error',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: commandLabel,
      lastExitCode: 1,
      lastError: message,
    });
    await writeRuntimeEvent({
      event: 'runtime-error',
      sessionId,
      runId,
      command: commandLabel,
      message,
    });
    throw error;
  }
}

async function exportSandboxFileStep(
  input: ExportFileInput & {
    sessionId: string;
    runId: string;
  },
) {
  'use step';

  const { sessionId, runId, path: targetPath, cwd } = input;

  const commandLabel = `export:${targetPath}`;
  let localDownloadPath: string | null = null;

  await patchSandboxRuntime(sessionId, {
    status: 'running',
    lastActiveAt: nowIso(),
    timeoutMs: SANDBOX_TIMEOUT_MS,
    lastCommand: commandLabel,
    lastExitCode: null,
    lastError: null,
  });

  try {
    const exported = await downloadSandboxFileAction({
      sessionId,
      path: targetPath,
      cwd,
    });
    localDownloadPath = exported.localPath;

    await writeRuntimeEvent({
      event: exported.created ? 'sandbox-created' : 'sandbox-reused',
      sessionId,
      runId,
      sandboxId: exported.sandboxId,
      status: exported.sandboxStatus,
    });
    await writeRuntimeEvent({
      event: 'sandbox-export-start',
      sessionId,
      runId,
      sandboxId: exported.sandboxId,
      command: `export:${exported.sourcePath}`,
      status: exported.sandboxStatus,
    });

    const fileBuffer = await readLocalFile(localDownloadPath);
    const { blob, record } = await persistSandboxExportedFile({
      sessionId,
      runId,
      sandboxId: exported.sandboxId,
      sourcePath: exported.sourcePath,
      fileName: exported.fileName,
      fileBuffer,
    });

    await patchSandboxRuntime(sessionId, {
      status: 'running',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: `export:${exported.sourcePath}`,
      lastExitCode: 0,
      lastError: null,
    });
    await writeRuntimeEvent({
      event: 'sandbox-export-finish',
      sessionId,
      runId,
      sandboxId: exported.sandboxId,
      command: `export:${exported.sourcePath}`,
      status: exported.sandboxStatus,
      message: blob.url,
    });

    return {
      id: record.id,
      fileName: record.fileName,
      size: record.size,
      mimeType: record.mimeType,
      sessionId: record.sessionId,
      runId: record.runId,
      sourcePath: record.sourcePath,
      url: record.blobUrl,
      storedInFilesDb: true as const,
      archived: false,
      archiveFormat: 'none' as const,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await patchSandboxRuntime(sessionId, {
      status: 'error',
      lastActiveAt: nowIso(),
      timeoutMs: SANDBOX_TIMEOUT_MS,
      lastCommand: commandLabel,
      lastExitCode: 1,
      lastError: message,
    });
    await writeRuntimeEvent({
      event: 'sandbox-export-failed',
      sessionId,
      runId,
      command: commandLabel,
      message,
    });
    throw error;
  } finally {
    if (localDownloadPath) {
      await removeLocalFile(localDownloadPath, {
        force: true,
        recursive: false,
      }).catch(() => undefined);
    }
  }
}

export default defineBuildInTool({
  id: 'sandbox',
  description: `Run shell commands and read/write files inside a session-scoped Vercel Sandbox.`,
  factory: async (_config, { sessionId, runId, appConfig }) => {
    const requiresApproval = appConfig.autonomy?.level === 'supervised';

    return {
      exec: tool({
        title: 'Execute Shell Command in Sandbox',
        description: `Execute a shell command in the current session sandbox.`,
        inputSchema: execInputSchema,
        execute: async (input, { toolCallId }) => {
          const toolName = 'exec';

          if (requiresApproval) {
            const approval = await waitForSandboxApproval({
              sessionId,
              runId,
              toolCallId,
              toolName,
              toolInput: input,
            });

            if (!approval.approved) {
              return {
                approved: false,
                denied: true,
                reason: approval.comment,
              } satisfies SandboxDeniedOutput;
            }
          }

          return executeSandboxCommandStep({
            sessionId,
            runId,
            ...input,
          });
        },
      }),
      readFile: tool({
        title: 'Read File',
        description: `Read a file from the current session sandbox.`,
        inputSchema: readFileInputSchema,
        execute: async (input, { toolCallId }) => {
          const toolName = 'readFile';

          if (requiresApproval) {
            const approval = await waitForSandboxApproval({
              sessionId,
              runId,
              toolCallId,
              toolName,
              toolInput: input,
            });

            if (!approval.approved) {
              return {
                approved: false,
                denied: true,
                reason: approval.comment,
              } satisfies SandboxDeniedOutput;
            }
          }

          return readSandboxFileStep({
            sessionId,
            runId,
            ...input,
          });
        },
      }),
      writeFile: tool({
        title: 'Write File',
        description: `Write a file into the current session sandbox.`,
        inputSchema: writeFileInputSchema,
        execute: async (input, { toolCallId }) => {
          const toolName = 'writeFile';

          if (requiresApproval) {
            const approval = await waitForSandboxApproval({
              sessionId,
              runId,
              toolCallId,
              toolName,
              toolInput: input,
            });

            if (!approval.approved) {
              return {
                approved: false,
                denied: true,
                reason: approval.comment,
              } satisfies SandboxDeniedOutput;
            }
          }

          return writeSandboxFileStep({
            sessionId,
            runId,
            ...input,
          });
        },
      }),
      openPort: tool({
        title: 'Resolve Public Sandbox Port URL',
        description: `Resolve a public URL from sandbox.domain(port) for a port exposed when the sandbox was created. Only configured ports are supported (currently: ${SANDBOX_PUBLIC_PORTS.join(', ')}), and new ports cannot be exposed at runtime. Docs: https://vercel.com/docs/vercel-sandbox/sdk-reference#sandbox.domain`,
        inputSchema: publicPortInputSchema,
        execute: async (input, { toolCallId }) => {
          const toolName = 'openPort';

          if (requiresApproval) {
            const approval = await waitForSandboxApproval({
              sessionId,
              runId,
              toolCallId,
              toolName,
              toolInput: input,
            });

            if (!approval.approved) {
              return {
                approved: false,
                denied: true,
                reason: approval.comment,
              } satisfies SandboxDeniedOutput;
            }
          }

          return resolveSandboxPublicPortStep({
            sessionId,
            runId,
            ...input,
          });
        },
      }),
      downloadFile: tool({
        title: 'Export Single Sandbox File',
        description: `Export exactly one file from sandbox and return a public download URL. Directory export is not supported. If you need multiple files, first use exec to compress them into a single archive (for example zip/tar.gz), then export that archive file.`,
        inputSchema: exportFileInputSchema,
        execute: async (input, { toolCallId }) => {
          const toolName = 'downloadFile';

          if (requiresApproval) {
            const approval = await waitForSandboxApproval({
              sessionId,
              runId,
              toolCallId,
              toolName,
              toolInput: input,
            });

            if (!approval.approved) {
              return {
                approved: false,
                denied: true,
                reason: approval.comment,
              } satisfies SandboxDeniedOutput;
            }
          }

          return exportSandboxFileStep({
            sessionId,
            runId,
            ...input,
          });
        },
      }),
    };
  },
});
