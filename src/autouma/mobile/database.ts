import initSqlJs, {
  Database as SqlJsDatabase,
  SqlJsStatic,
  Statement as SqlJsStatement,
} from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm';

type SqlValue = string | number | Uint8Array | null;

class SqlStatementAdapter {
  constructor(private readonly getStatement: () => SqlJsStatement) {}

  all(...params: SqlValue[]) {
    const statement = this.getStatement();
    try {
      statement.reset();
      if (params.length) statement.bind(params);
      const rows: Array<Record<string, unknown>> = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      statement.reset();
    }
  }

  get(...params: SqlValue[]) {
    const statement = this.getStatement();
    try {
      statement.reset();
      if (params.length) statement.bind(params);
      return statement.step()
        ? (statement.getAsObject() as Record<string, unknown>)
        : undefined;
    } finally {
      statement.reset();
    }
  }
}

export class ReadonlyDatabaseAdapter {
  private readonly statements = new Map<string, SqlJsStatement>();

  constructor(
    private readonly database: SqlJsDatabase,
    private readonly ownsDatabase = false,
  ) {}

  private cachedStatement(sql: string) {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.database.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }

  prepare(sql: string) {
    return new SqlStatementAdapter(() => this.cachedStatement(sql));
  }

  close() {
    if (!this.ownsDatabase) return;
    this.statements.forEach((statement) => statement.free());
    this.statements.clear();
    this.database.close();
  }
}

let sqlRuntime: Promise<SqlJsStatic> | null = null;
let masterDatabase: ReadonlyDatabaseAdapter | null = null;
let masterDatabasePromise: Promise<ReadonlyDatabaseAdapter> | null = null;

function assetUrl(name: string) {
  return new URL(name, window.location.href).toString();
}

export function initializeSqlRuntime() {
  if (!sqlRuntime) {
    const runtimePromise = sqlWasmUrl.startsWith('data:')
      ? (() => {
          const encoded = sqlWasmUrl.slice(sqlWasmUrl.indexOf(',') + 1);
          const decoded = window.atob(encoded);
          const wasmBinary = Uint8Array.from(decoded, (value) =>
            value.charCodeAt(0),
          );
          return initSqlJs({ wasmBinary });
        })()
      : initSqlJs({
          locateFile: () => assetUrl(sqlWasmUrl),
        });
    sqlRuntime = runtimePromise.catch((error) => {
      sqlRuntime = null;
      throw error;
    });
  }
  return sqlRuntime;
}

export async function initializeMobileMasterDatabase() {
  if (masterDatabase) return masterDatabase;
  if (!masterDatabasePromise) {
    masterDatabasePromise = Promise.all([
      initializeSqlRuntime(),
      fetch(assetUrl('master.mdb')),
    ])
      .then(async ([SQL, response]) => {
        if (!response.ok) {
          throw new Error(
            `无法读取 Android 内置 master.mdb：HTTP ${response.status}`,
          );
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        masterDatabase = new ReadonlyDatabaseAdapter(new SQL.Database(bytes));
        return masterDatabase;
      })
      .catch((error) => {
        masterDatabasePromise = null;
        throw error;
      });
  }
  return masterDatabasePromise;
}

export function getMobileMasterDatabase() {
  if (!masterDatabase) {
    throw new Error('Android master.mdb 尚未完成初始化');
  }
  return masterDatabase;
}

export async function openImportedDatabase(bytes: Uint8Array) {
  const SQL = await initializeSqlRuntime();
  return new ReadonlyDatabaseAdapter(new SQL.Database(bytes), true);
}

/**
 * Browser build replacement for better-sqlite3. AutoUma initializes the
 * shared read-only master database before React mounts, so every legacy
 * `new Database(masterPath)` receives a lightweight adapter over sql.js.
 */
export default function MobileBetterSqlite3() {
  return getMobileMasterDatabase();
}
