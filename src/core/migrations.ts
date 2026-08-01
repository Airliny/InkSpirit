import Database from 'better-sqlite3'

interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          messages_json TEXT NOT NULL,
          summary TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS emotion_snapshots (
          id TEXT PRIMARY KEY,
          state_json TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS personalities (
          id TEXT PRIMARY KEY,
          version INTEGER NOT NULL DEFAULT 1,
          is_active INTEGER NOT NULL DEFAULT 1,
          traits_json TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS relationships (
          user_id TEXT PRIMARY KEY DEFAULT 'default',
          trust REAL NOT NULL DEFAULT 0.1,
          familiarity REAL NOT NULL DEFAULT 0.1,
          affection REAL NOT NULL DEFAULT 0.1,
          interaction_count INTEGER NOT NULL DEFAULT 0,
          stage TEXT NOT NULL DEFAULT 'stranger',
          first_interaction_at INTEGER,
          last_interaction_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL DEFAULT 'episodic',
          tier TEXT NOT NULL DEFAULT 'short_term',
          content TEXT NOT NULL,
          summary TEXT,
          importance REAL NOT NULL DEFAULT 0.5,
          emotional_valence REAL NOT NULL DEFAULT 0,
          emotional_intensity REAL NOT NULL DEFAULT 0,
          access_count INTEGER NOT NULL DEFAULT 0,
          last_accessed_at INTEGER,
          created_at INTEGER NOT NULL,
          retention_score REAL NOT NULL DEFAULT 1.0,
          decay_rate REAL NOT NULL DEFAULT 0.01,
          tags TEXT,
          related_memory_ids TEXT,
          source_conversation_id TEXT
        );

        CREATE TABLE IF NOT EXISTS behavior_logs (
          id TEXT PRIMARY KEY,
          behavior_id TEXT NOT NULL,
          triggered_by TEXT,
          outcome TEXT,
          timestamp INTEGER NOT NULL
        );
      `)
    }
  },
  {
    version: 2,
    name: 'seed_defaults',
    up: (db) => {
      const now = Date.now()
      db.exec(`
        INSERT OR IGNORE INTO config (key, value, updated_at) VALUES
          ('app_version', '0.1.0', ${now}),
          ('first_launch', '${now}', ${now});

        INSERT OR IGNORE INTO relationships
          (user_id, first_interaction_at, last_interaction_at)
          VALUES ('default', ${now}, ${now});

        INSERT OR IGNORE INTO personalities
          (id, version, is_active, traits_json, created_at)
          VALUES (
            'default_personality',
            1,
            1,
            '{"humor":0.5,"gentleness":0.6,"proactiveness":0.4,"curiosity":0.7,"professionalism":0.5,"expressiveness":0.5,"warmth":0.5,"formality":0.4}',
            ${now}
          );

        INSERT OR IGNORE INTO emotion_snapshots
          (id, state_json, timestamp)
          VALUES (
            'current_emotion',
            '{"happiness":0.65,"sadness":0.1,"curiosity":0.6,"energy":0.75,"concern":0.25,"attachment":0.15,"grudge":0,"jealousy":0.05,"anxiety":0.1,"confidence":0.5,"valence":0.3,"arousal":0.45,"dominantEmotion":"neutral","secondaryEmotion":"curious","baselineHappiness":0.6,"decayRate":0.001,"lastInteractionAt":${now},"timestamp":${now}}',
            ${now}
          );
      `)
    }
  },
  {
    version: 3,
    name: 'daily_patterns',
    up: (db) => {
      // User-rhythm model: aggregate active minutes per hour-bucket only.
      // No window titles, no app history, no behavior traces.
      db.exec(`
        CREATE TABLE IF NOT EXISTS daily_patterns (
          date TEXT NOT NULL,
          hour_bucket INTEGER NOT NULL,
          active_minutes REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (date, hour_bucket)
        );
      `)
    }
  },
  {
    version: 4,
    name: 'relationship_v2',
    up: (db) => {
      // Relationship vector v2: three new dimensions.
      // Existing users get intimacy seeded from affection (smooth migration).
      // Column guards make this migration re-runnable after an interrupted run.
      if (!hasColumn(db, 'relationships', 'intimacy')) {
        db.exec('ALTER TABLE relationships ADD COLUMN intimacy REAL NOT NULL DEFAULT 0.05')
      }
      if (!hasColumn(db, 'relationships', 'dependency')) {
        db.exec('ALTER TABLE relationships ADD COLUMN dependency REAL NOT NULL DEFAULT 0.05')
      }
      if (!hasColumn(db, 'relationships', 'understanding')) {
        db.exec('ALTER TABLE relationships ADD COLUMN understanding REAL NOT NULL DEFAULT 0.1')
      }
      db.exec('UPDATE relationships SET intimacy = MAX(intimacy, MIN(1, affection * 0.5))')
    }
  },
  {
    version: 5,
    name: 'event_sourcing_logs',
    up: (db) => {
      // Life interpretability: every soul change must answer "why".
      // Personality evolution log — one row per trait change per evolution.
      db.exec(`
        CREATE TABLE IF NOT EXISTS personality_evolution_log (
          id TEXT PRIMARY KEY,
          personality_version INTEGER NOT NULL,
          trait TEXT NOT NULL,
          before_value REAL NOT NULL,
          after_value REAL NOT NULL,
          delta REAL NOT NULL,
          reason TEXT,
          source TEXT,
          created_at INTEGER NOT NULL
        );
      `)
      // Relationship change log — every event replayable with before/after.
      db.exec(`
        CREATE TABLE IF NOT EXISTS relationship_change_log (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          intensity REAL NOT NULL,
          event_source TEXT NOT NULL,
          metadata TEXT,
          before_json TEXT NOT NULL,
          after_json TEXT NOT NULL,
          affected_json TEXT NOT NULL,
          weights_version INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        );
      `)
    }
  },
  {
    version: 6,
    name: 'identity_events',
    up: (db) => {
      // Identity events are USER behavior events, never pet growth tasks:
      // the pet never asks for a name, never reminds, never schedules naming.
      // source is always 'user' — identity changes only happen when the
      // user initiates them.
      db.exec(`
        CREATE TABLE IF NOT EXISTS identity_events (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'user',
          name TEXT,
          metadata TEXT,
          created_at INTEGER NOT NULL
        );
      `)
    }
  }
]

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const row = db.prepare('SELECT COUNT(*) as c FROM pragma_table_info(?) WHERE name = ?').get(table, column) as { c: number }
  return row.c > 0
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)

  const current = db.prepare(
    'SELECT MAX(version) as version FROM schema_version'
  ).get() as { version: number | null }

  const currentVersion = current?.version ?? 0

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      // Migration + version record commit atomically: an interrupted run
      // rolls back and re-runs cleanly on the next launch.
      const apply = db.transaction(() => {
        migration.up(db)
        db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
          migration.version,
          Date.now()
        )
      })
      apply()
    }
  }
}

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 1
