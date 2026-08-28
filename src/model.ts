import { resolveDef } from "./catalog.js";
import {
  deleteStoredDocument,
  documentKey,
  isSafeDocumentId,
  migrateLegacyDocument,
  persistDocument,
  readDocumentResult,
  readRegistry,
  reserveDocumentId,
  setActiveDocument,
  type DocumentSummary,
  type StorageLike,
} from "./document-storage.js";
import {
  createEmptyDiagramFile,
  DEFAULT_DIAGRAM_TITLE,
  FORMAT_LIMITS,
  hasDiagramCapacity,
  insertIntoDiagram,
  isSafeDiagramId,
  normalize,
  normalizeDiagramCoordinate,
  normalizeDiagramEdgeLine,
  normalizeDiagramEdgeSide,
  normalizeDiagramLabel,
  normalizeDiagramNodeColor,
  normalizeDiagramNodeSize,
  normalizeDiagramTitle,
  prepareDiagramFile,
} from "./format.js";
import { edgeRoute, nodeHeight, nodeWidth, polylineMidpoint } from "./geometry.js";
import type { MarkupSelection, MarkupVisualState } from "./markup.js";
import type { DiagramFile, DiagNode, EdgeLineStyle, PortSide } from "./types.js";

export const MODEL_HISTORY_LIMIT = 100;
export const MODEL_SAVE_DELAY_MS = 500;

export interface DiagramTemplate {
  id: string;
  label: string;
  url: string;
}

export const DIAGRAM_TEMPLATES: readonly DiagramTemplate[] = Object.freeze([
  { id: "aula-1-viagem-pagina", label: "Aula 1 — Fluxo básico", url: "templates/aula-1-viagem-pagina.json" },
  { id: "aula-2-organizacao", label: "Aula 2 — Monólito e pedaços", url: "templates/aula-2-organizacao.json" },
  { id: "aula-3-dados-regras-login", label: "Aula 3 — Integrações", url: "templates/aula-3-dados-regras-login.json" },
  { id: "aula-4-mundo-real", label: "Aula 4 — Servidores", url: "templates/aula-4-mundo-real.json" },
  { id: "anatomia-completa", label: "Anatomia completa de um app", url: "templates/anatomia-completa.json" },
  { id: "caminho-de-um-clique", label: "O caminho de um clique", url: "templates/caminho-de-um-clique.json" },
  { id: "comecar-do-zero", label: "Começar do zero", url: "templates/comecar-do-zero.json" },
  { id: "login-seguro", label: "Login seguro", url: "templates/login-seguro.json" },
]);

export const COURSE_TEMPLATES: readonly DiagramTemplate[] = Object.freeze(
  DIAGRAM_TEMPLATES.filter(({ id }) => id.startsWith("aula-")),
);

export const RETIRED_DOCUMENT_TITLES = Object.freeze([
  "Anatomia 1",
  "Aula 1",
  "Aula 2",
  "Aula 3",
  "Aula 4",
  "Aula 1 — A viagem até uma página",
  "Aula 2 — Como as partes são organizadas",
  "Aula 3 — Dados, regras, login e permissões",
  "Aula 4 — Colocando o app no mundo real",
  "Aula 1.2",
  "Aula 2.2",
  "Aula 3.2",
  "Aula 4.2",
]);

/** Bump when official lesson diagrams change so existing aula documents are replaced. */
export const COURSE_LESSON_REVISION = 11;
export const COURSE_REVISION_KEY = "app-anatomy:course-revision";

export interface TemplateLoadResult {
  ok: boolean;
  file?: DiagramFile;
  message?: string;
}

export interface TemplateResponse {
  ok: boolean;
  text(): Promise<string>;
}

export async function loadDiagramTemplate(
  template: DiagramTemplate,
  request: (url: string) => Promise<TemplateResponse> = (url) => fetch(url),
): Promise<TemplateLoadResult> {
  try {
    const response = await request(template.url);
    if (!response.ok) throw new Error("template request failed");
    const normalized = normalize(await response.text());
    if (!normalized.ok) throw new Error("template normalization failed");
    return { ok: true, file: normalized.file };
  } catch {
    return {
      ok: false,
      message: `Não foi possível carregar o modelo “${template.label}”. O diagrama atual foi preservado.`,
    };
  }
}

export type UpdateMode = "transient" | "commit" | "ui-only";

export type DeepReadonly<Value> = Value extends (...args: never[]) => unknown
  ? Value
  : Value extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

export interface ModelState<UiState> {
  doc: DiagramFile;
  ui: UiState;
}

export interface UpdateOptions {
  mode: UpdateMode;
}

export interface ModelPersistence {
  persist(doc: DiagramFile): void;
  delayMs?: number;
  schedule?(callback: () => void, delayMs: number): unknown;
  cancel?(handle: unknown): void;
  onError?(error: unknown): void;
}

export interface ModelOptions<UiState> {
  persistence?: ModelPersistence;
  initialDirty?: boolean;
  onChange?(state: DeepReadonly<ModelState<UiState>>, mode: UpdateMode): void;
  onDirtyChange?(dirty: boolean): void;
}

export interface ModelStore<UiState> {
  readonly state: DeepReadonly<ModelState<UiState>>;
  readonly nodeIndex: ReadonlyMap<string, DeepReadonly<DiagNode>>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly dirty: boolean;
  readonly historyDepth: Readonly<{ undo: number; redo: number }>;
  nodeById(id: string): DeepReadonly<DiagNode> | undefined;
  update(
    mutator: (state: ModelState<UiState>) => void,
    options: { mode: Exclude<UpdateMode, "ui-only"> },
  ): boolean;
  update(mutator: (ui: UiState) => void, options: { mode: "ui-only" }): boolean;
  undo(): boolean;
  redo(): boolean;
  flush(): boolean;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function deserialize<T>(snapshot: string): T {
  return JSON.parse(snapshot) as T;
}

function clone<T>(value: T): T {
  return deserialize<T>(serialize(value));
}

function cappedPush(stack: string[], snapshot: string): void {
  stack.push(snapshot);
  if (stack.length > MODEL_HISTORY_LIMIT) stack.shift();
}

export function createModel<UiState>(
  initialState: ModelState<UiState>,
  options: ModelOptions<UiState> = {},
): ModelStore<UiState> {
  const normalizedInitial = normalize(initialState.doc);
  if (!normalizedInitial.ok) throw new TypeError("initial document is invalid");
  let state = clone({ ...initialState, doc: normalizedInitial.file });
  let nodeIndex = new Map<string, DiagNode>();
  const undoStack: string[] = [];
  const redoStack: string[] = [];
  let transientBefore: string | null = null;
  let saveHandle: unknown | null = null;
  let dirty = options.initialDirty ?? false;

  const persistence = options.persistence;
  const schedule =
    persistence?.schedule ??
    ((callback: () => void, delayMs: number): unknown => globalThis.setTimeout(callback, delayMs));
  const cancel =
    persistence?.cancel ??
    ((handle: unknown): void => globalThis.clearTimeout(handle as number));

  function refreshNodeIndex(): void {
    nodeIndex = new Map(state.doc.nodes.map((node) => [node.id, node]));
  }

  function readonlyState(): DeepReadonly<ModelState<UiState>> {
    return clone(state) as DeepReadonly<ModelState<UiState>>;
  }

  function notify(mode: UpdateMode): void {
    options.onChange?.(readonlyState(), mode);
  }

  function schedulePersistence(): void {
    if (!persistence) return;
    if (!dirty) {
      dirty = true;
      options.onDirtyChange?.(true);
    }
    if (saveHandle !== null) cancel(saveHandle);
    saveHandle = schedule(() => {
      saveHandle = null;
      flush();
    }, persistence.delayMs ?? MODEL_SAVE_DELAY_MS);
  }

  function restoreDoc(snapshot: string): void {
    state.doc = deserialize<DiagramFile>(snapshot);
    refreshNodeIndex();
  }

  function update(
    mutator: ((next: ModelState<UiState>) => void) | ((ui: UiState) => void),
    { mode }: UpdateOptions,
  ): boolean {
    const beforeDoc = serialize(state.doc);
    const beforeState = serialize(state);

    if (mode === "ui-only") {
      const nextUi = clone(state.ui);
      (mutator as (ui: UiState) => void)(nextUi);
      const afterUi = serialize(nextUi);
      transientBefore = null;
      if (afterUi === serialize(state.ui)) return false;
      state.ui = nextUi;
      notify(mode);
      return true;
    }

    (mutator as (next: ModelState<UiState>) => void)(state);
    const mutatedDoc = serialize(state.doc);
    if (mutatedDoc !== beforeDoc) {
      const normalized = normalize(state.doc);
      state.doc = normalized.ok ? normalized.file : deserialize<DiagramFile>(beforeDoc);
    }
    refreshNodeIndex();
    const afterDoc = serialize(state.doc);
    const afterState = serialize(state);

    if (mode === "transient") {
      if (afterState === beforeState) return false;
      if (afterDoc !== beforeDoc && transientBefore === null) transientBefore = beforeDoc;
      if (transientBefore === afterDoc) transientBefore = null;
      notify(mode);
      return true;
    }

    const historyBefore = transientBefore ?? beforeDoc;
    transientBefore = null;
    const docChanged = historyBefore !== afterDoc;
    const stateChanged = beforeState !== afterState;
    if (!docChanged && !stateChanged) return false;

    if (docChanged) {
      cappedPush(undoStack, historyBefore);
      redoStack.length = 0;
      schedulePersistence();
    }
    notify(mode);
    return true;
  }

  function undo(): boolean {
    transientBefore = null;
    const previous = undoStack.pop();
    if (previous === undefined) return false;
    cappedPush(redoStack, serialize(state.doc));
    restoreDoc(previous);
    schedulePersistence();
    notify("ui-only");
    return true;
  }

  function redo(): boolean {
    transientBefore = null;
    const next = redoStack.pop();
    if (next === undefined) return false;
    cappedPush(undoStack, serialize(state.doc));
    restoreDoc(next);
    schedulePersistence();
    notify("ui-only");
    return true;
  }

  function flush(): boolean {
    if (saveHandle !== null) {
      cancel(saveHandle);
      saveHandle = null;
    }
    if (!persistence || !dirty) return true;
    try {
      persistence.persist(clone(state.doc));
      dirty = false;
      options.onDirtyChange?.(false);
      return true;
    } catch (error) {
      persistence.onError?.(error);
      return false;
    }
  }

  refreshNodeIndex();

  return {
    get state() {
      return readonlyState();
    },
    get nodeIndex() {
      return new Map(
        [...nodeIndex].map(([id, node]) => [id, clone(node) as DeepReadonly<DiagNode>]),
      );
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    get dirty() {
      return dirty;
    },
    get historyDepth() {
      return { undo: undoStack.length, redo: redoStack.length };
    },
    nodeById(id: string) {
      const node = nodeIndex.get(id);
      return node ? clone(node) : undefined;
    },
    update,
    undo,
    redo,
    flush,
  };
}

export interface EditorUiState extends MarkupVisualState {
  tool: "select" | "connect";
}

export interface EditorTarget {
  kind: "node" | "edge";
  id: string;
  x: number;
  y: number;
  value: string;
}

export interface ApplicationModelCallbacks {
  onChange?(mode: UpdateMode): void;
  onStatus?(message: string, isError?: boolean): void;
  onDocuments?(): void;
  onReady?(ready: boolean): void;
  onDirtyChange?(dirty: boolean): void;
  onStorageWarning?(warning: ModelStorageWarning): void;
  onExternalConflict?(documentId: string): void;
}

export interface ModelStorageWarning {
  source: "read" | "migration" | "persistence" | "external";
  documentId: string | null;
  warnings: readonly string[];
  errors: readonly string[];
}

export type ExternalStorageResult = "ignored" | "reloaded" | "conflict" | "missing";

export interface ApplicationModel {
  readonly file: DiagramFile;
  readonly ui: EditorUiState;
  readonly nodeIndex: ReadonlyMap<string, DiagNode>;
  readonly currentDocumentId: string | null;
  readonly documents: readonly DocumentSummary[];
  readonly ready: boolean;
  readonly dirty: boolean;
  initialize(initialTemplate?: unknown): void;
  initializeFromTemplate(template: DiagramTemplate): Promise<void>;
  createDocument(file?: DiagramFile): boolean;
  createDocumentFromTemplate(input: unknown): boolean;
  insertTemplate(input: unknown): boolean;
  applyTemplate(templateId: string, insert: boolean): Promise<boolean>;
  installCourseDocuments(
    request?: (url: string) => Promise<TemplateResponse>,
  ): Promise<boolean>;
  switchDocument(id: string): boolean;
  deleteCurrentDocument(): void;
  flush(): boolean;
  addNode(definitionId: string, x: number, y: number): string | null;
  addConnectedNode(fromId: string, definitionId: string, x: number, y: number): string | null;
  duplicateNode(id: string, x: number, y: number): string | null;
  /**
   * Cria uma conexão; portas fixas opcionais por face. Aceita loop
   * (fromId === toId) e múltiplas arestas entre o mesmo par desde que a
   * combinação de portas seja diferente.
   */
  connectNodes(fromId: string, toId: string, anchors?: { fromSide?: PortSide; toSide?: PortSide }): boolean;
  /** Estilo do trajeto da conexão (reto, ortogonal ou curvo). */
  setEdgeLine(id: string, line: EdgeLineStyle): void;
  /** Insere um ponto de passagem na posição `index` (transiente até finishTransient). */
  insertEdgePoint(id: string, index: number, x: number, y: number): boolean;
  moveEdgePoint(id: string, index: number, x: number, y: number): void;
  removeEdgePoint(id: string, index: number): void;
  clearEdgePoints(id: string): void;
  moveNode(id: string, x: number, y: number): void;
  resizeNode(id: string, x: number, y: number, width: number, height: number): void;
  /** Tinge o vidro do bloco; null volta ao vidro transparente. */
  setNodeColor(id: string, color: string | null, mode?: "transient" | "commit"): void;
  /**
   * Muda a ordem de desenho (z-order) do nó: a posição no array de nós é a
   * ordem de pintura no SVG — o último fica na frente. Persiste com o documento.
   */
  reorderNode(id: string, direction: "front" | "forward" | "backward" | "back"): void;
  finishTransient(): void;
  select(selection: MarkupSelection | null): void;
  setTool(tool: EditorUiState["tool"]): void;
  connectNode(id: string): void;
  cancelConnection(): void;
  setConnectCursor(point: { x: number; y: number }): void;
  deleteSelection(): void;
  rename(target: MarkupSelection, value: string): void;
  editorTarget(target: MarkupSelection): EditorTarget | null;
  clear(): void;
  setTitle(title: string): void;
  undo(): void;
  redo(): void;
  exportFile(): DiagramFile;
  handleExternalStorageChange(documentId: string): ExternalStorageResult;
}

export interface FrameCoalescer<Value> {
  schedule(value: Value): void;
  flush(): void;
  cancel(): void;
}

export function createFrameCoalescer<Value>(
  apply: (value: Value) => void,
  scheduleFrame: (callback: () => void) => number,
  cancelFrame: (handle: number) => void,
): FrameCoalescer<Value> {
  let pending: Value | null = null;
  let handle: number | null = null;
  const flush = (): void => {
    if (handle !== null) cancelFrame(handle);
    handle = null;
    const value = pending;
    pending = null;
    if (value !== null) apply(value);
  };
  return {
    schedule(value) {
      pending = value;
      if (handle !== null) return;
      handle = scheduleFrame(flush);
    },
    flush,
    cancel() {
      if (handle !== null) cancelFrame(handle);
      handle = null;
      pending = null;
    },
  };
}

export function createApplicationModel(
  storageSource: StorageLike | (() => StorageLike),
  createId: () => string,
  callbacks: ApplicationModelCallbacks = {},
): ApplicationModel {
  let storage: StorageLike;
  try {
    storage = typeof storageSource === "function" ? storageSource() : storageSource;
  } catch {
    const values = new Map<string, string>();
    storage = {
      get length() { return values.size; },
      getItem(key) { return values.get(key) ?? null; },
      key(index) { return [...values.keys()][index] ?? null; },
      setItem(key, value) { values.set(key, value); },
      removeItem(key) { values.delete(key); },
    };
    callbacks.onStatus?.("Armazenamento local indisponível", true);
  }
  let activeId: string | null = null;
  let summaries: DocumentSummary[] = [];
  const stores = new Map<string, ModelStore<EditorUiState>>();
  const recoverableClaims = new Map<string, "reserved" | "unreserved">();
  let lastReservationFailure: string | null = null;
  let editor: ModelStore<EditorUiState> | null = null;
  let ready = false;

  const status = (message: string, isError = false): void => callbacks.onStatus?.(message, isError);
  const storageWarning = (
    source: ModelStorageWarning["source"],
    documentId: string | null,
    warnings: readonly string[] = [],
    errors: readonly string[] = [],
  ): void => {
    if (warnings.length === 0 && errors.length === 0) return;
    callbacks.onStorageWarning?.({ source, documentId, warnings, errors });
    status(
      errors.length > 0
        ? "O diagrama armazenado não pôde ser recuperado por completo."
        : "O diagrama foi recuperado com ajustes de compatibilidade.",
      errors.length > 0,
    );
  };
  const currentStore = (): ModelStore<EditorUiState> => {
    if (!editor) throw new Error("modelo ainda não inicializado");
    return editor;
  };
  const currentFile = (): DiagramFile => currentStore().state.doc as DiagramFile;
  const currentUi = (): EditorUiState => currentStore().state.ui as EditorUiState;

  function updateSummary(id: string, file: DiagramFile): void {
    const summary = { id, title: file.meta.title, updatedAt: file.meta.savedAt ?? "" };
    const index = summaries.findIndex((entry) => entry.id === id);
    if (index < 0) summaries.push(summary);
    else summaries[index] = summary;
  }

  function notifyDirty(): void {
    callbacks.onDirtyChange?.(editor?.dirty ?? false);
  }

  function reserveUniqueDocumentId(): string | null {
    lastReservationFailure = null;
    const known = new Set([...summaries.map(({ id }) => id), ...stores.keys()]);
    let seed = "document";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = createId();
      if (!isSafeDocumentId(candidate)) continue;
      seed = candidate;
      if (known.has(candidate)) continue;
      try {
        if (reserveDocumentId(storage, candidate)) return candidate;
      } catch {
        lastReservationFailure = candidate;
        storageWarning("persistence", candidate, [], ["document ID reservation failed"]);
        return null;
      }
    }
    for (let suffix = 2; suffix < 1_000; suffix += 1) {
      const marker = `-${suffix}`;
      const candidate = `${seed.slice(0, 64 - marker.length)}${marker}`;
      if (known.has(candidate)) continue;
      try {
        if (reserveDocumentId(storage, candidate)) return candidate;
      } catch {
        lastReservationFailure = candidate;
        storageWarning("persistence", candidate, [], ["document ID reservation failed"]);
        return null;
      }
    }
    status("Não foi possível criar um identificador único para o diagrama", true);
    return null;
  }

  function uniqueItemId(store: ModelStore<EditorUiState>): string | null {
    const state = store.state;
    const used = new Set([
      ...state.doc.nodes.map(({ id }) => id),
      ...state.doc.edges.map(({ id }) => id),
    ]);
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      const candidate = createId();
      if (isSafeDiagramId(candidate) && !used.has(candidate)) return candidate;
    }
    status("Não foi possível criar um identificador único", true);
    return null;
  }

  function uniqueInMemoryDocumentId(): string | null {
    const known = new Set([...summaries.map(({ id }) => id), ...stores.keys()]);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = createId();
      if (!isSafeDocumentId(candidate) || known.has(candidate)) continue;
      try {
        if (storage.getItem(documentKey(candidate)) !== null) continue;
      } catch {
        // Collision safety is checked again before this unreserved ID is persisted.
      }
      return candidate;
    }
    status("Não foi possível criar um identificador único para o diagrama", true);
    return null;
  }

  function makeStore(
    id: string,
    file: DiagramFile,
    initialDirty = false,
  ): ModelStore<EditorUiState> {
    return createModel(
      {
        doc: file,
        ui: { selection: null, tool: "select", connectFrom: null, connectCursor: null },
      },
      {
        initialDirty,
        persistence: {
          persist(doc) {
            if (recoverableClaims.get(id) === "unreserved") {
              if (
                storage.getItem(documentKey(id)) !== null
                || !reserveDocumentId(storage, id)
              ) {
                throw new Error("recoverable document ID is no longer available");
              }
              recoverableClaims.set(id, "reserved");
            }
            const saved = prepareDiagramFile(doc);
            updateSummary(id, saved);
            persistDocument(storage, id, saved);
            setActiveDocument(storage, id);
            recoverableClaims.delete(id);
            if (id === activeId) status("Salvo");
            callbacks.onDocuments?.();
          },
          onError() {
            status("Não foi possível salvar neste navegador", true);
            storageWarning("persistence", id, [], ["document flush failed"]);
          },
        },
        onChange(_state, mode) {
          if (id === activeId) {
            if (mode === "commit") status("Salvando…");
            callbacks.onChange?.(mode);
          }
        },
        onDirtyChange() {
          if (id === activeId) notifyDirty();
        },
      },
    );
  }

  function activate(id: string, file?: DiagramFile): void {
    activeId = id;
    editor = stores.get(id) ?? (file ? makeStore(id, file) : null);
    if (!editor) throw new Error("document store is unavailable");
    stores.set(id, editor);
    updateSummary(id, editor.state.doc as DiagramFile);
    callbacks.onDocuments?.();
    notifyDirty();
  }

  function flush(): boolean {
    return editor?.flush() ?? true;
  }

  function cleanupFailedCreation(id: string, previousActiveId: string | null): void {
    try {
      deleteStoredDocument(storage, id);
    } catch {
      try {
        storage.removeItem(documentKey(id));
      } catch {
        // An abandoned reservation is deliberately invalid and ignored by recovery.
      }
    }
    if (previousActiveId) {
      try {
        setActiveDocument(storage, previousActiveId);
      } catch {
        // The in-memory active store remains authoritative for this session.
      }
    }
  }

  function createDocument(
    file = createEmptyDiagramFile(),
    retainOnPersistenceFailure = false,
  ): boolean {
    const normalized = normalize(file);
    if (!normalized.ok) {
      status("Não foi possível criar esse diagrama. O diagrama atual foi preservado.", true);
      return false;
    }
    if (!flush()) return false;
    const id = reserveUniqueDocumentId();
    if (!id) return false;
    const saved = prepareDiagramFile(normalized.file);
    const previousActiveId = activeId;
    try {
      persistDocument(storage, id, saved);
      setActiveDocument(storage, id);
    } catch {
      if (retainOnPersistenceFailure) {
        recoverableClaims.set(id, "reserved");
        const recoverable = makeStore(id, normalized.file, true);
        stores.set(id, recoverable);
        activate(id);
        status("Não foi possível salvar neste navegador; o diagrama foi preservado para nova tentativa.", true);
        storageWarning("persistence", id, [], ["initial document persist failed"]);
        return false;
      }
      cleanupFailedCreation(id, previousActiveId);
      status("Não foi possível salvar neste navegador", true);
      storageWarning("persistence", id, [], ["initial document persist failed"]);
      return false;
    }
    activate(id, saved);
    status("Salvo");
    return true;
  }

  function initialize(initialTemplate?: unknown): void {
    if (ready) return;
    try {
      const registry = readRegistry(storage);
      summaries = registry.documents;
      if (registry.activeDocumentId) {
        const result = readDocumentResult(storage, registry.activeDocumentId);
        storageWarning("read", registry.activeDocumentId, result.warnings, result.errors);
        if (result.file) {
          activate(registry.activeDocumentId, result.file);
          ready = true;
          callbacks.onReady?.(true);
          return;
        }
      }
      const migrationId = reserveUniqueDocumentId();
      const migrated = migrationId
        ? migrateLegacyDocument(storage, migrationId, DEFAULT_DIAGRAM_TITLE)
        : { file: null, id: null, backupFailed: false, persistenceFailed: true };
      if (migrationId && !migrated.file) storage.removeItem(documentKey(migrationId));
      if (migrated.file && migrated.id) {
        activate(migrated.id, migrated.file);
        if (migrated.persistenceFailed) status("Diagrama aberto, mas não foi possível salvar neste navegador", true);
        else if (migrated.backupFailed) status("Diagrama aberto, mas o backup local falhou", true);
        if (migrated.persistenceFailed || migrated.backupFailed) {
          storageWarning(
            "migration",
            migrated.id,
            migrated.backupFailed ? ["legacy backup failed"] : [],
            migrated.persistenceFailed ? ["legacy persistence failed"] : [],
          );
        }
        ready = true;
        callbacks.onReady?.(true);
        return;
      }
    } catch {
      status("Armazenamento local indisponível", true);
    }
    const normalized = initialTemplate === undefined ? null : normalize(initialTemplate);
    if (normalized?.ok) createDocument(normalized.file);
    else {
      const created = createDocument();
      if (created) {
        if (initialTemplate !== undefined) {
          status("Não foi possível carregar o modelo inicial. Começamos com um diagrama vazio.", true);
        } else {
          status("Diagrama vazio pronto.");
        }
      }
    }
    ready = editor !== null;
    callbacks.onReady?.(ready);
  }

  function switchDocument(id: string): boolean {
    if (id === activeId) return true;
    if (!flush()) return false;
    const existing = stores.get(id);
    if (existing) {
      activate(id);
      try {
        setActiveDocument(storage, id);
      } catch {
        status("Diagrama aberto, mas não foi possível lembrar a seleção", true);
      }
      callbacks.onChange?.("ui-only");
      return true;
    }
    let file: DiagramFile | null = null;
    try {
      const result = readDocumentResult(storage, id);
      file = result.file;
      storageWarning("read", id, result.warnings, result.errors);
    } catch {
      status("Armazenamento local indisponível", true);
    }
    if (!file) {
      status("Não foi possível abrir esse diagrama", true);
      callbacks.onDocuments?.();
      return false;
    }
    activate(id, file);
    try {
      setActiveDocument(storage, id);
    } catch {
      status("Diagrama aberto, mas não foi possível lembrar a seleção", true);
    }
    callbacks.onChange?.("ui-only");
    return true;
  }

  function replaceDocumentFile(id: string, file: DiagramFile): boolean {
    const normalized = normalize(file);
    if (!normalized.ok) {
      status("Não foi possível atualizar essa aula. O diagrama atual foi preservado.", true);
      return false;
    }
    if (!flush()) return false;
    const saved = prepareDiagramFile(normalized.file);
    const store = stores.get(id);
    if (store) {
      store.update((state) => {
        state.doc = saved;
      }, { mode: "commit" });
      return store.flush();
    }
    try {
      persistDocument(storage, id, saved);
      updateSummary(id, saved);
      return true;
    } catch {
      status("Não foi possível salvar neste navegador", true);
      storageWarning("persistence", id, [], ["course document replace failed"]);
      return false;
    }
  }

  function deleteDocumentById(deletedId: string, fallbackId?: string | null): boolean {
    if (!flush()) return false;
    const wasActive = activeId === deletedId;
    try {
      deleteStoredDocument(storage, deletedId);
    } catch {
      status("Não foi possível excluir o diagrama do armazenamento local", true);
      storageWarning("persistence", deletedId, [], ["document delete failed"]);
      return false;
    }
    summaries = summaries.filter(({ id }) => id !== deletedId);
    stores.delete(deletedId);
    if (!wasActive) {
      callbacks.onDocuments?.();
      return true;
    }
    activeId = null;
    editor = null;
    const next = (fallbackId && summaries.some(({ id }) => id === fallbackId) ? fallbackId : null)
      ?? summaries[0]?.id;
    if (next) switchDocument(next);
    else createDocument();
    return true;
  }

  function deleteCurrentDocument(): void {
    if (!activeId) return;
    deleteDocumentById(activeId);
  }

  function update(
    mutator: (state: ModelState<EditorUiState>) => void,
    mode: Exclude<UpdateMode, "ui-only">,
  ): boolean {
    return currentStore().update(mutator, { mode });
  }

  function reportLimited(field: string): void {
    status(`${field} foi ajustado ao limite suportado pelo formato.`);
  }

  function insertTemplateInto(documentId: string, input: unknown): boolean {
    const store = stores.get(documentId);
    if (!store) return false;
    const result = insertIntoDiagram(
      store.state.doc as DiagramFile,
      input,
      () => uniqueItemId(store) ?? "",
    );
    if (!result.ok) {
      status("Não foi possível inserir esse modelo. O diagrama atual foi preservado.", true);
      return false;
    }
    if (result.inserted.nodes.length === 0 && result.inserted.edges.length === 0) {
      status("O diagrama já atingiu a capacidade máxima do formato.", true);
      return false;
    }
    if (result.warningDetails.length > 0) {
      callbacks.onStorageWarning?.({
        source: "read",
        documentId,
        warnings: result.warnings,
        errors: result.errors,
      });
      status("O modelo foi inserido com ajustes aos limites do formato.");
    }
    return store.update((state) => {
      state.doc.nodes = result.diagram.nodes;
      state.doc.edges = result.diagram.edges;
      state.ui.selection = null;
    }, { mode: "commit" });
  }

  function validSelection(
    selection: MarkupSelection | null,
    store = currentStore(),
  ): MarkupSelection | null {
    if (!selection) return null;
    if (selection.kind === "node") return store.nodeById(selection.id) ? selection : null;
    return store.state.doc.edges.some(({ id }) => id === selection.id) ? selection : null;
  }

  const api: ApplicationModel = {
    get file() { return clone(currentFile()); },
    get ui() { return clone(currentUi()); },
    get nodeIndex() {
      return new Map(
        [...currentStore().nodeIndex].map(([id, node]) => [id, clone(node) as DiagNode]),
      );
    },
    get currentDocumentId() { return activeId; },
    get documents() { return summaries.map((summary) => ({ ...summary })); },
    get ready() { return ready; },
    get dirty() { return editor?.dirty ?? false; },
    initialize,
    async initializeFromTemplate(template) {
      const loaded = await loadDiagramTemplate(template);
      initialize(loaded.file ?? null);
    },
    createDocument,
    createDocumentFromTemplate(input) {
      const normalized = normalize(input);
      if (!normalized.ok) {
        status("Não foi possível abrir esse modelo. O diagrama atual foi preservado.", true);
        return false;
      }
      if (normalized.warningDetails.length > 0) {
        callbacks.onStorageWarning?.({
          source: "read",
          documentId: null,
          warnings: normalized.warnings,
          errors: normalized.errors,
        });
      }
      return createDocument(normalized.file);
    },
    insertTemplate(input) {
      return activeId ? insertTemplateInto(activeId, input) : false;
    },
    async applyTemplate(templateId, insert) {
      const template = DIAGRAM_TEMPLATES.find(({ id }) => id === templateId);
      if (!template) return false;
      const originId = activeId;
      status("Carregando modelo…");
      const loaded = await loadDiagramTemplate(template);
      if (!loaded.ok || !loaded.file) {
        status(loaded.message ?? "Não foi possível carregar esse modelo.", true);
        return false;
      }
      return insert
        ? originId !== null && insertTemplateInto(originId, loaded.file)
        : api.createDocumentFromTemplate(loaded.file);
    },
    async installCourseDocuments(request) {
      if (!ready) return false;
      const preferredId = RETIRED_DOCUMENT_TITLES.includes(currentFile().meta.title)
        ? null
        : activeId;
      const installedRevision = Number.parseInt(storage.getItem(COURSE_REVISION_KEY) ?? "0", 10) || 0;
      const replaceExisting = installedRevision < COURSE_LESSON_REVISION;
      for (const template of COURSE_TEMPLATES) {
        const loaded = await loadDiagramTemplate(template, request);
        if (!loaded.ok || !loaded.file) {
          status(loaded.message ?? "Não foi possível instalar as aulas no navegador.", true);
          return false;
        }
        const existing = summaries.find(({ title }) => title === template.label);
        if (!existing) {
          if (!createDocument(loaded.file)) return false;
          continue;
        }
        if (replaceExisting && !replaceDocumentFile(existing.id, loaded.file)) return false;
      }
      const fallbackId = summaries.find(({ title }) => title === COURSE_TEMPLATES[0]?.label)?.id
        ?? preferredId;
      for (const retired of summaries.filter(({ title }) => RETIRED_DOCUMENT_TITLES.includes(title))) {
        if (!deleteDocumentById(retired.id, fallbackId)) return false;
      }
      try {
        storage.setItem(COURSE_REVISION_KEY, String(COURSE_LESSON_REVISION));
      } catch {
        storageWarning("persistence", null, [], ["course revision persist failed"]);
      }
      if (preferredId && preferredId !== activeId) switchDocument(preferredId);
      else if (!preferredId && fallbackId && fallbackId !== activeId) switchDocument(fallbackId);
      callbacks.onDocuments?.();
      return true;
    },
    switchDocument,
    deleteCurrentDocument,
    flush,
    addNode(definitionId, x, y) {
      const resolved = resolveDef(definitionId);
      if (!resolved) return null;
      if (!hasDiagramCapacity(currentFile(), "nodes")) {
        status("O limite de nós deste diagrama foi atingido.", true);
        return null;
      }
      const id = uniqueItemId(currentStore());
      if (!id) return null;
      const nextX = normalizeDiagramCoordinate(x);
      const nextY = normalizeDiagramCoordinate(y);
      if (nextX !== x || nextY !== y) reportLimited("A posição");
      const size = resolved.def.defaultSize;
      update((state) => {
        const node: DiagNode = {
          id,
          def: definitionId,
          x: nextX,
          y: nextY,
          label: normalizeDiagramLabel(resolved.def.nome),
        };
        if (size) {
          node.w = normalizeDiagramNodeSize(size.w, "width");
          node.h = normalizeDiagramNodeSize(size.h, "height");
        }
        state.doc.nodes.push(node);
        state.ui.selection = { kind: "node", id: node.id };
      }, "commit");
      return id;
    },
    addConnectedNode(fromId, definitionId, x, y) {
      const resolved = resolveDef(definitionId);
      const source = currentStore().nodeById(fromId);
      if (!resolved || !source) {
        status("Não foi possível criar conectado: origem ou bloco inválido.", true);
        return null;
      }
      if (!hasDiagramCapacity(currentFile(), "nodes") || !hasDiagramCapacity(currentFile(), "edges")) {
        status("O diagrama atingiu o limite de nós ou conexões.", true);
        return null;
      }
      const nodeId = uniqueItemId(currentStore());
      if (!nodeId) return null;
      let edgeId = uniqueItemId(currentStore());
      for (let attempts = 0; edgeId === nodeId && attempts < 10; attempts += 1) {
        edgeId = uniqueItemId(currentStore());
      }
      if (!edgeId || edgeId === nodeId) {
        status("Não foi possível criar identificadores únicos.", true);
        return null;
      }
      const nextX = normalizeDiagramCoordinate(x);
      const nextY = normalizeDiagramCoordinate(y);
      update((state) => {
        state.doc.nodes.push({
          id: nodeId,
          def: definitionId,
          x: nextX,
          y: nextY,
          label: normalizeDiagramLabel(resolved.def.nome),
        });
        state.doc.edges.push({ id: edgeId!, from: fromId, to: nodeId, label: "" });
        state.ui.selection = { kind: "node", id: nodeId };
        state.ui.connectFrom = null;
        state.ui.connectCursor = null;
      }, "commit");
      status("Bloco criado e conectado.");
      return nodeId;
    },
    duplicateNode(id, x, y) {
      const original = currentStore().nodeById(id);
      if (!original || !hasDiagramCapacity(currentFile(), "nodes")) {
        status("Não foi possível duplicar o bloco.", true);
        return null;
      }
      const nextId = uniqueItemId(currentStore());
      if (!nextId) return null;
      update((state) => {
        state.doc.nodes.push({
          ...original,
          id: nextId,
          x: normalizeDiagramCoordinate(x),
          y: normalizeDiagramCoordinate(y),
        });
        state.ui.selection = { kind: "node", id: nextId };
      }, "commit");
      status("Bloco duplicado.");
      return nextId;
    },
    connectNodes(fromId, toId, anchors) {
      if (!currentStore().nodeById(fromId) || !currentStore().nodeById(toId)) {
        status("Não foi possível conectar: um dos nós não existe.", true);
        return false;
      }
      const fromSide = anchors?.fromSide ? normalizeDiagramEdgeSide(anchors.fromSide) : null;
      const toSide = anchors?.toSide ? normalizeDiagramEdgeSide(anchors.toSide) : null;
      // Permite múltiplas arestas entre o mesmo par (e loops) desde que a
      // combinação de portas seja diferente — evita só a duplicata exata.
      const duplicate = currentFile().edges.some((edge) =>
        edge.from === fromId && edge.to === toId &&
        (edge.fromSide ?? null) === fromSide && (edge.toSide ?? null) === toSide);
      if (duplicate) {
        status("Já existe uma conexão idêntica entre esses pontos.", true);
        return false;
      }
      if (!hasDiagramCapacity(currentFile(), "edges")) {
        status("O limite de conexões deste diagrama foi atingido.", true);
        return false;
      }
      const edgeId = uniqueItemId(currentStore());
      if (!edgeId) return false;
      update((state) => {
        const edge: DiagramFile["edges"][number] = { id: edgeId, from: fromId, to: toId, label: "" };
        if (fromSide) edge.fromSide = fromSide;
        if (toSide) edge.toSide = toSide;
        state.doc.edges.push(edge);
        state.ui.selection = { kind: "edge", id: edgeId };
        state.ui.connectFrom = null;
        state.ui.connectCursor = null;
      }, "commit");
      status(fromId === toId ? "Loop criado." : "Blocos conectados.");
      return true;
    },
    setEdgeLine(id, line) {
      const normalized = normalizeDiagramEdgeLine(line);
      if (!normalized) return;
      update((state) => {
        const edge = state.doc.edges.find((item) => item.id === id);
        if (!edge) return;
        if (normalized === "straight") delete edge.line;
        else edge.line = normalized;
      }, "commit");
    },
    insertEdgePoint(id, index, x, y) {
      const edge = currentFile().edges.find((item) => item.id === id);
      if (!edge) return false;
      const count = edge.points?.length ?? 0;
      if (count >= FORMAT_LIMITS.edgePoints) {
        status("O limite de pontos de passagem desta conexão foi atingido.", true);
        return false;
      }
      const at = Math.max(0, Math.min(count, index));
      update((state) => {
        const item = state.doc.edges.find((candidate) => candidate.id === id);
        if (!item) return;
        const points = item.points ?? [];
        points.splice(at, 0, { x: normalizeDiagramCoordinate(x), y: normalizeDiagramCoordinate(y) });
        item.points = points;
      }, "transient");
      return true;
    },
    moveEdgePoint(id, index, x, y) {
      update((state) => {
        const edge = state.doc.edges.find((item) => item.id === id);
        const point = edge?.points?.[index];
        if (!point) return;
        point.x = normalizeDiagramCoordinate(x);
        point.y = normalizeDiagramCoordinate(y);
      }, "transient");
    },
    removeEdgePoint(id, index) {
      update((state) => {
        const edge = state.doc.edges.find((item) => item.id === id);
        if (!edge?.points || index < 0 || index >= edge.points.length) return;
        edge.points.splice(index, 1);
        if (edge.points.length === 0) delete edge.points;
      }, "commit");
    },
    clearEdgePoints(id) {
      const edge = currentFile().edges.find((item) => item.id === id);
      if (!edge?.points?.length) return;
      update((state) => {
        const item = state.doc.edges.find((candidate) => candidate.id === id);
        if (item) delete item.points;
      }, "commit");
    },
    moveNode(id, x, y) {
      const nextX = normalizeDiagramCoordinate(x);
      const nextY = normalizeDiagramCoordinate(y);
      if (nextX !== x || nextY !== y) reportLimited("A posição");
      update((state) => {
        const node = state.doc.nodes.find((item) => item.id === id);
        if (node) [node.x, node.y] = [nextX, nextY];
      }, "transient");
    },
    resizeNode(id, x, y, width, height) {
      const nextX = normalizeDiagramCoordinate(x);
      const nextY = normalizeDiagramCoordinate(y);
      const nextWidth = normalizeDiagramNodeSize(width, "width");
      const nextHeight = normalizeDiagramNodeSize(height, "height");
      update((state) => {
        const node = state.doc.nodes.find((item) => item.id === id);
        if (!node) return;
        [node.x, node.y] = [nextX, nextY];
        [node.w, node.h] = [nextWidth, nextHeight];
      }, "transient");
    },
    setNodeColor(id, color, mode = "commit") {
      const normalized = color === null ? null : normalizeDiagramNodeColor(color);
      if (color !== null && !normalized) return;
      update((state) => {
        const node = state.doc.nodes.find((item) => item.id === id);
        if (!node) return;
        if (normalized) node.color = normalized;
        else delete node.color;
      }, mode);
    },
    reorderNode(id, direction) {
      const nodes = currentFile().nodes;
      const index = nodes.findIndex((node) => node.id === id);
      if (index < 0) return;
      const target = direction === "front"
        ? nodes.length - 1
        : direction === "back"
          ? 0
          : direction === "forward"
            ? Math.min(nodes.length - 1, index + 1)
            : Math.max(0, index - 1);
      if (target === index) return;
      update((state) => {
        const [node] = state.doc.nodes.splice(index, 1);
        if (node) state.doc.nodes.splice(target, 0, node);
      }, "commit");
    },
    finishTransient() {
      update(() => {}, "commit");
    },
    select(selection) {
      update((state) => { state.ui.selection = selection; }, "transient");
    },
    setTool(tool) {
      update((state) => {
        state.ui.tool = tool;
        state.ui.connectFrom = null;
        state.ui.connectCursor = null;
      }, "transient");
    },
    connectNode(id) {
      const from = currentUi().connectFrom;
      if (!currentStore().nodeById(id)) {
        status("Não foi possível conectar: o nó não existe.", true);
        return void update((state) => {
          state.ui.connectFrom = null;
          state.ui.connectCursor = null;
        }, "transient");
      }
      if (!from) return void update((state) => { state.ui.connectFrom = id; }, "transient");
      if (from === id) return api.cancelConnection();
      if (!currentStore().nodeById(from) || !currentStore().nodeById(id)) {
        status("Não foi possível conectar: um dos nós não existe.", true);
        return api.cancelConnection();
      }
      const exists = currentFile().edges.some((edge) => edge.from === from && edge.to === id);
      if (!exists && !hasDiagramCapacity(currentFile(), "edges")) {
        status("O limite de conexões deste diagrama foi atingido.", true);
        return api.cancelConnection();
      }
      const edgeId = exists ? null : uniqueItemId(currentStore());
      if (!exists && !edgeId) return api.cancelConnection();
      update((state) => {
        if (!exists && edgeId) state.doc.edges.push({ id: edgeId, from, to: id, label: "" });
        state.ui.connectFrom = null;
        state.ui.connectCursor = null;
      }, exists ? "transient" : "commit");
    },
    cancelConnection() {
      update((state) => {
        state.ui.connectFrom = null;
        state.ui.connectCursor = null;
      }, "transient");
    },
    setConnectCursor(point) {
      update((state) => { state.ui.connectCursor = point; }, "transient");
    },
    deleteSelection() {
      const selected = currentUi().selection;
      if (!selected) return;
      update((state) => {
        if (selected.kind === "node") {
          state.doc.nodes = state.doc.nodes.filter((node) => node.id !== selected.id);
          state.doc.edges = state.doc.edges.filter((edge) => edge.from !== selected.id && edge.to !== selected.id);
        } else {
          state.doc.edges = state.doc.edges.filter((edge) => edge.id !== selected.id);
        }
        state.ui.selection = null;
      }, "commit");
    },
    rename(target, value) {
      const normalized = normalizeDiagramLabel(value);
      if (normalized !== value) reportLimited("O rótulo");
      update((state) => {
        if (target.kind === "node") {
          const node = state.doc.nodes.find((item) => item.id === target.id);
          if (node && normalized) node.label = normalized;
        } else {
          const edge = state.doc.edges.find((item) => item.id === target.id);
          if (edge) edge.label = normalized;
        }
      }, "commit");
    },
    editorTarget(target) {
      if (target.kind === "node") {
        const node = currentStore().nodeById(target.id);
        return node
          ? {
            ...target,
            x: node.x + nodeWidth(node) / 2,
            y: node.y + nodeHeight(node) - 24,
            value: node.label,
          }
          : null;
      }
      const edge = currentFile().edges.find((item) => item.id === target.id);
      if (!edge) return null;
      const route = edgeRoute(edge, new Map(currentFile().nodes.map((node) => [node.id, node])), currentFile().edges);
      if (!route) return null;
      const middle = polylineMidpoint(route.pts);
      return { ...target, x: middle.x, y: middle.y, value: edge.label };
    },
    clear() {
      update((state) => {
        state.doc.nodes = [];
        state.doc.edges = [];
        state.ui.selection = null;
      }, "commit");
    },
    setTitle(title) {
      const normalized = normalizeDiagramTitle(title.trim() || DEFAULT_DIAGRAM_TITLE);
      if (normalized.length !== (title.trim() || DEFAULT_DIAGRAM_TITLE).length) reportLimited("O título");
      update((state) => { state.doc.meta.title = normalized; }, "commit");
    },
    undo() {
      const selection = currentUi().selection;
      if (currentStore().undo()) {
        const nextSelection = validSelection(selection);
        if (serialize(nextSelection) !== serialize(currentUi().selection)) {
          currentStore().update((ui) => { ui.selection = nextSelection; }, { mode: "ui-only" });
        }
        status("Salvando…");
      }
    },
    redo() {
      const selection = currentUi().selection;
      if (currentStore().redo()) {
        const nextSelection = validSelection(selection);
        if (serialize(nextSelection) !== serialize(currentUi().selection)) {
          currentStore().update((ui) => { ui.selection = nextSelection; }, { mode: "ui-only" });
        }
        status("Salvando…");
      }
    },
    exportFile() {
      return prepareDiagramFile(currentFile());
    },
    handleExternalStorageChange(documentId) {
      const store = stores.get(documentId);
      const isActive = documentId === activeId;
      if (isActive && !store) return "ignored";
      if (store?.dirty) {
        callbacks.onExternalConflict?.(documentId);
        storageWarning("external", documentId, ["external update conflicts with local edits"]);
        return "conflict";
      }
      try {
        const result = readDocumentResult(storage, documentId);
        storageWarning("external", documentId, result.warnings, result.errors);
        if (!result.file) {
          if (!isActive) {
            stores.delete(documentId);
            recoverableClaims.delete(documentId);
            const previousCount = summaries.length;
            summaries = summaries.filter(({ id }) => id !== documentId);
            if (summaries.length !== previousCount) callbacks.onDocuments?.();
            return "missing";
          }
          stores.delete(documentId);
          summaries = readRegistry(storage).documents.filter(({ id }) => id !== documentId);
          activeId = null;
          editor = null;

          let recovered = false;
          for (const summary of summaries) {
            const cached = stores.get(summary.id);
            if (cached?.dirty) {
              activate(summary.id);
              try {
                setActiveDocument(storage, summary.id);
              } catch {
                status("Diagrama aberto, mas não foi possível lembrar a seleção", true);
              }
              recovered = true;
              break;
            }
            const candidate = readDocumentResult(storage, summary.id);
            storageWarning("external", summary.id, candidate.warnings, candidate.errors);
            if (!candidate.file) continue;
            stores.set(summary.id, makeStore(summary.id, candidate.file));
            activate(summary.id);
            try {
              setActiveDocument(storage, summary.id);
            } catch {
              status("Diagrama aberto, mas não foi possível lembrar a seleção", true);
            }
            recovered = true;
            break;
          }
          if (!recovered) {
            const persisted = createDocument(createEmptyDiagramFile(), true);
            if (!persisted && !editor) {
              const replacementId = lastReservationFailure ?? uniqueInMemoryDocumentId();
              if (!replacementId) throw new Error("replacement document could not be retained");
              let claim: "reserved" | "unreserved" = "unreserved";
              try {
                if (storage.getItem(documentKey(replacementId)) !== null) claim = "reserved";
              } catch {
                // A later flush rechecks an unreserved ID before writing it.
              }
              recoverableClaims.set(replacementId, claim);
              const replacement = makeStore(replacementId, createEmptyDiagramFile(), true);
              stores.set(replacementId, replacement);
              activate(replacementId);
              status(
                "Armazenamento indisponível; o novo diagrama foi preservado para nova tentativa.",
                true,
              );
            }
          }
          callbacks.onChange?.("ui-only");
          callbacks.onDocuments?.();
          notifyDirty();
          return "missing";
        }
        if (!isActive) {
          if (store) stores.set(documentId, makeStore(documentId, result.file));
          updateSummary(documentId, result.file);
          callbacks.onDocuments?.();
          return "ignored";
        }
        const replacement = makeStore(documentId, result.file);
        stores.set(documentId, replacement);
        editor = replacement;
        updateSummary(documentId, result.file);
        callbacks.onChange?.("ui-only");
        callbacks.onDocuments?.();
        notifyDirty();
        return "reloaded";
      } catch {
        storageWarning("external", documentId, [], ["external document read failed"]);
        return isActive ? "missing" : "ignored";
      }
    },
  };
  return api;
}
