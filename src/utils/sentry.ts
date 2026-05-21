const USER_HOME_PATH_PATTERN = /\/Users\/[^/\s]+/g;

export type SentryRuntimeMode = 'mcp' | 'cli-daemon' | 'cli';
export type SentryToolRuntime = 'cli' | 'daemon' | 'mcp';
export type SentryToolTransport = 'direct' | 'daemon' | 'xcode-ide-daemon';
export type SentryToolInvocationOutcome = 'completed' | 'infra_error';
export type SentryDaemonLifecycleEvent = 'start' | 'shutdown' | 'crash';
export type SentryMcpLifecycleEvent = 'start' | 'shutdown' | 'crash';

export interface SentryRuntimeContext {
  mode: SentryRuntimeMode;
  xcodeAvailable?: boolean;
  enabledWorkflows?: string[];
  disableSessionDefaults?: boolean;
  disableXcodeAutoSync?: boolean;
  incrementalBuildsEnabled?: boolean;
  debugEnabled?: boolean;
  uiDebuggerGuardMode?: string;
  xcodeIdeWorkflowEnabled?: boolean;
  axeAvailable?: boolean;
  axeSource?: 'env' | 'bundled' | 'path' | 'unavailable';
  axeVersion?: string;
  xcodeDeveloperDir?: string;
  xcodebuildPath?: string;
  xcodemakeAvailable?: boolean;
  xcodemakeEnabled?: boolean;
  xcodeVersion?: string;
  xcodeBuildVersion?: string;
}

export type FlushSentryOutcome = 'skipped' | 'flushed' | 'timed_out' | 'failed';

export interface McpShutdownSummaryEvent {
  reason: string;
  phase: string;
  exitCode: number;
  transportDisconnected: boolean;
  triggerError?: string;
  shutdownStepFailureCount: number;
  cleanupDiagnosticCount?: number;
  shutdownDurationMs: number;
  snapshot: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

interface XcodeVersionMetadata {
  version?: string;
  buildVersion?: string;
  developerDir?: string;
  xcodebuildPath?: string;
}

interface ToolInvocationMetric {
  toolName: string;
  runtime: SentryToolRuntime;
  transport: SentryToolTransport;
  outcome: SentryToolInvocationOutcome;
  durationMs: number;
}

interface InternalErrorMetric {
  component: string;
  runtime: SentryToolRuntime;
  errorKind: string;
}

type DaemonGaugeMetricName = 'inflight_requests' | 'active_sessions' | 'idle_timeout_ms';

interface McpLifecycleMetric {
  event: SentryMcpLifecycleEvent;
  phase: string;
  reason?: string;
  uptimeMs: number;
  rssBytes: number;
  matchingMcpProcessCount?: number | null;
  activeOperationCount: number;
  watcherRunning: boolean;
}

interface McpLifecycleAnomalyMetric {
  kind: string;
  phase: string;
  reason?: string;
}

function redactPathLikeData(value: string): string {
  return value.replace(USER_HOME_PATH_PATTERN, '/Users/<redacted>');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactPathLikeData(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item));
  }

  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = redactUnknown(nested);
    }
    return output;
  }

  return value;
}

function redactEvent<T>(event: T): T {
  const record = event as Record<string, unknown>;
  delete record.user;
  delete record.request;
  delete record.breadcrumbs;

  if (typeof record.message === 'string') {
    record.message = redactPathLikeData(record.message);
  }

  const exception = record.exception;
  if (isRecord(exception) && Array.isArray(exception.values)) {
    for (const exceptionValue of exception.values) {
      if (!isRecord(exceptionValue)) continue;
      if (typeof exceptionValue.value === 'string') {
        exceptionValue.value = redactPathLikeData(exceptionValue.value);
      }

      const stacktrace = exceptionValue.stacktrace;
      if (!isRecord(stacktrace) || !Array.isArray(stacktrace.frames)) continue;
      for (const frame of stacktrace.frames) {
        if (!isRecord(frame)) continue;
        if (typeof frame.abs_path === 'string') {
          frame.abs_path = redactPathLikeData(frame.abs_path);
        }
        if (typeof frame.filename === 'string') {
          frame.filename = redactPathLikeData(frame.filename);
        }
      }
    }
  }

  if (isRecord(record.extra)) {
    for (const [key, value] of Object.entries(record.extra)) {
      record.extra[key] = redactUnknown(value);
    }
  }

  return event;
}

function redactLog<T>(log: T): T | null {
  if (!log) return null;
  const record = log as Record<string, unknown>;
  if (typeof record.message === 'string') {
    record.message = redactPathLikeData(record.message);
  }
  if (record.attributes !== undefined) {
    record.attributes = redactUnknown(record.attributes);
  }
  return log;
}

function parseXcodeVersionOutput(output: string): {
  version?: string;
  buildVersion?: string;
} {
  const versionMatch = output.match(/^Xcode\s+(.+)$/m);
  const buildMatch = output.match(/^Build version\s+(.+)$/m);
  return {
    version: versionMatch?.[1]?.trim(),
    buildVersion: buildMatch?.[1]?.trim(),
  };
}

export function __redactEventForTests<T>(event: T): T {
  return redactEvent(structuredClone(event));
}

export function __redactLogForTests<T>(log: T): T | null {
  return redactLog(structuredClone(log));
}

export function __parseXcodeVersionForTests(output: string): {
  version?: string;
  buildVersion?: string;
} {
  return parseXcodeVersionOutput(output);
}

export async function getXcodeVersionMetadata(
  runCommand: (command: string[]) => Promise<{ success: boolean; output: string }>,
): Promise<XcodeVersionMetadata> {
  const metadata: XcodeVersionMetadata = {};

  try {
    const result = await runCommand(['xcodebuild', '-version']);
    if (result.success) {
      const parsed = parseXcodeVersionOutput(result.output);
      metadata.version = parsed.version;
      metadata.buildVersion = parsed.buildVersion;
    }
  } catch {
    // ignore
  }

  try {
    const result = await runCommand(['xcode-select', '-p']);
    if (result.success) {
      metadata.developerDir = result.output.trim();
    }
  } catch {
    // ignore
  }

  try {
    const result = await runCommand(['xcrun', '--find', 'xcodebuild']);
    if (result.success) {
      metadata.xcodebuildPath = result.output.trim();
    }
  } catch {
    // ignore
  }

  return metadata;
}

export async function getAxeVersionMetadata(
  runCommand: (command: string[]) => Promise<{ success: boolean; output: string }>,
  axePath: string | undefined,
): Promise<string | undefined> {
  if (!axePath) return undefined;

  try {
    const result = await runCommand([axePath, '--version']);
    if (!result.success) return undefined;
    const versionLine = result.output.trim().split('\n')[0]?.trim();
    return versionLine || undefined;
  } catch {
    return undefined;
  }
}

export function initSentry(_context?: Pick<SentryRuntimeContext, 'mode'>): void {}

export function enrichSentryContext(): void {}

export async function flushAndCloseSentry(_timeoutMs = 2000): Promise<void> {}

export async function flushSentry(_timeoutMs = 2000): Promise<FlushSentryOutcome> {
  return 'skipped';
}

export function captureMcpShutdownSummary(_summary: McpShutdownSummaryEvent): void {}

export function setSentryRuntimeContext(_context: SentryRuntimeContext): void {}

export function recordToolInvocationMetric(_metric: ToolInvocationMetric): void {}

export function recordInternalErrorMetric(_metric: InternalErrorMetric): void {}

export function recordDaemonLifecycleMetric(_event: SentryDaemonLifecycleEvent): void {}

export function recordBootstrapDurationMetric(_runtime: SentryRuntimeMode, _durationMs: number): void {}

export function recordDaemonGaugeMetric(_metricName: DaemonGaugeMetricName, _value: number): void {}

export function recordMcpLifecycleMetric(_metric: McpLifecycleMetric): void {}

export function recordMcpLifecycleAnomalyMetric(_metric: McpLifecycleAnomalyMetric): void {}
