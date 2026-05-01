import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { TaskStore, TaskWatcher, nodeFs, type Task } from '@cowork-tasks/core';

let activePanel: BoardPanel | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const home = process.env.TASKS_HOME ?? path.join(os.homedir(), '.cowork-tasks');
  await fs.mkdir(home, { recursive: true });

  const store = new TaskStore({ rootPath: home, fs: nodeFs });
  await store.initialize();

  const watcher = new TaskWatcher({ root: home });
  watcher.onChange(async () => {
    await store.scan();
    activePanel?.refresh(store);
  });
  watcher.start();

  context.subscriptions.push({
    dispose: async () => {
      await watcher.stop();
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('coworkTasks.openBoard', () => {
      activePanel = BoardPanel.show(context.extensionUri, store);
    }),
    vscode.commands.registerCommand('coworkTasks.refresh', async () => {
      await store.scan();
      activePanel?.refresh(store);
    }),
    vscode.commands.registerCommand('coworkTasks.newTask', async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Task title',
        placeHolder: 'Action-verb form, e.g. "Review Q3 plan"',
      });
      if (!title) return;
      await store.createTask({ title });
      activePanel?.refresh(store);
      vscode.window.showInformationMessage(`Created: ${title}`);
    }),
  );
}

export function deactivate(): void {
  activePanel?.dispose();
}

class BoardPanel {
  static current?: BoardPanel;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly store: TaskStore,
  ) {
    this.panel.onDidDispose(() => {
      BoardPanel.current = undefined;
      activePanel = undefined;
    });
    this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
    void this.render();
  }

  static show(extensionUri: vscode.Uri, store: TaskStore): BoardPanel {
    if (BoardPanel.current) {
      BoardPanel.current.panel.reveal();
      return BoardPanel.current;
    }
    const webviewPanel = vscode.window.createWebviewPanel(
      'coworkTasksBoard',
      'Cowork Tasks',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
      },
    );
    BoardPanel.current = new BoardPanel(webviewPanel, extensionUri, store);
    return BoardPanel.current;
  }

  refresh(store: TaskStore): void {
    void this.panel.webview.postMessage({
      type: 'tasks',
      version: store.version,
      tasks: store.getAllTasks(),
      config: store.getConfig(),
    });
  }

  dispose(): void {
    this.panel.dispose();
  }

  private async render(): Promise<void> {
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'artifact.html');
    let html: string;
    try {
      const buf = await fs.readFile(htmlPath.fsPath, 'utf-8');
      html = injectVscodeBridge(buf);
    } catch {
      html = fallbackHtml();
    }
    this.panel.webview.html = html;
    this.refresh(this.store);
  }

  private async onMessage(msg: { type: string; payload?: Record<string, unknown> }): Promise<void> {
    try {
      switch (msg.type) {
        case 'create_task':
          await this.store.createTask(msg.payload as Partial<Task>);
          break;
        case 'update_task':
          await this.store.updateTask(
            String(msg.payload?.id),
            (msg.payload?.patch ?? {}) as Partial<Task>,
          );
          break;
        case 'move_task':
          await this.store.moveTask(
            String(msg.payload?.id),
            String(msg.payload?.column),
            Number(msg.payload?.position ?? 0),
          );
          break;
        case 'archive_task':
          await this.store.archiveTask(String(msg.payload?.id));
          break;
        case 'delete_task':
          await this.store.deleteTask(String(msg.payload?.id));
          break;
        case 'open_link':
          if (typeof msg.payload?.url === 'string') {
            void vscode.env.openExternal(vscode.Uri.parse(msg.payload.url));
          }
          break;
      }
      this.refresh(this.store);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Cowork Tasks: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

function injectVscodeBridge(html: string): string {
  // Replace `window.claude.callTool` with a bridge that posts to the
  // extension host. The artifact's `api.ts` uses `window.claude.callTool`
  // as the primary path, so we synthesize one.
  const shim = `
<script>
(function () {
  const vscode = acquireVsCodeApi();
  let version = 0;
  let tasks = [];
  let config = { defaultBoard: 'main', boards: [], labels: [] };
  const pending = new Map();
  let nextId = 0;

  window.claude = window.claude || {};
  window.claude.callTool = function (server, tool, args) {
    return new Promise(function (resolve) {
      switch (tool) {
        case 'list_tasks': {
          const since = args && args.since;
          const added = since ? [] : tasks;
          resolve({ version: version, added: added, updated: [], removed: [] });
          break;
        }
        case 'list_config':
          resolve(config);
          break;
        case 'create_task':
        case 'update_task':
        case 'move_task':
        case 'archive_task':
        case 'delete_task': {
          vscode.postMessage({
            type: tool === 'create_task' ? 'create_task' :
                  tool === 'update_task' ? 'update_task' :
                  tool === 'move_task' ? 'move_task' :
                  tool === 'archive_task' ? 'archive_task' : 'delete_task',
            payload: args,
          });
          resolve({ ok: true, version: version });
          break;
        }
        default:
          resolve(null);
      }
    });
  };
  window.claude.complete = function () { return Promise.resolve(''); };
  window.claude.sendToChat = function () { return Promise.resolve(); };

  window.addEventListener('message', function (event) {
    const msg = event.data;
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'tasks') {
      version = msg.version;
      tasks = msg.tasks;
      config = msg.config;
    }
  });
})();
</script>`;
  return html.replace('</head>', `${shim}</head>`);
}

function fallbackHtml(): string {
  return `<!doctype html><html><body style="font-family: system-ui; padding: 32px;"><h2>Cowork Tasks</h2><p>The artifact bundle is missing. Build the artifact package first:</p><pre>pnpm --filter @cowork-tasks/artifact build</pre></body></html>`;
}
