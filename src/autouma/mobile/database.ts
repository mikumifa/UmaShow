import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';

type SqlValue = string | number | Uint8Array | null;

class SqlStatementAdapter {
  constructor(
    private readonly database: SqlJsDatabase,
    private readonly sql: string,
  ) {}

  private rows(params: SqlValue[]) {
    const statement = this.database.prepare(this.sql);
    try {
      if (params.length) statement.bind(params);
      const rows: Array<Record<string, unknown>> = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as Record<string, unknown>);
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  all(...params: SqlValue[]) {
    return this.rows(params);
  }

  get(...params: SqlValue[]) {
    return this.rows(params)[0];
  }
}

export class ReadonlyDatabaseAdapter {
  constructor(
    private readonly database: SqlJsDatabase,
    private readonly ownsDatabase = false,
  ) {}

  prepare(sql: string) {
    return new SqlStatementAdapter(this.database, sql);
  }

  close() {
    if (this.ownsDatabase) this.database.close();
  }
}

let sqlRuntime: Promise<SqlJsStatic> | null = null;
let masterDatabase: ReadonlyDatabaseAdapter | null = null;

function assetUrl(name: string) {
  return new URL(name, window.location.href).toString();
}

export function initializeSqlRuntime() {
  if (!sqlRuntime) {
    sqlRuntime = initSqlJs({
      locateFile: (file) => assetUrl(file),
    });
  }
  return sqlRuntime;
}

export async function initializeMobileMasterDatabase() {
  if (masterDatabase) return masterDatabase;
  const [SQL, response] = await Promise.all([
    initializeSqlRuntime(),
    fetch(assetUrl('master.mdb')),
  ]);
  if (!response.ok) {
    throw new Error(`无法读取 Android 内置 master.mdb：HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  masterDatabase = new ReadonlyDatabaseAdapter(new SQL.Database(bytes));
  return masterDatabase;
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
