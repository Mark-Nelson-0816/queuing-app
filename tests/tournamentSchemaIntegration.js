import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-schema-test-"),
);
const testDatabasePath = path.join(testUserData, "badminton.db");

// Creates representative legacy Tournament rows before the additive migration.
const legacyDatabase = new Database(testDatabasePath);
legacyDatabase.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_type TEXT NOT NULL DEFAULT 'doubles',
    category TEXT NOT NULL DEFAULT 'mens',
    status TEXT NOT NULL DEFAULT 'ongoing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE tournament_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_1_id INTEGER DEFAULT NULL,
    player_2_id INTEGER DEFAULT NULL,
    team_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE tournament_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_id INTEGER NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
    team_a_id INTEGER NOT NULL REFERENCES tournament_teams(id),
    team_b_id INTEGER NOT NULL REFERENCES tournament_teams(id),
    winner_team_id INTEGER REFERENCES tournament_teams(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT INTO tournaments (match_type, category, status)
  VALUES ('singles', 'mens', 'finished');
  INSERT INTO tournament_teams (tournament_id, team_number) VALUES (1, 1), (1, 2);
  INSERT INTO tournament_rounds (tournament_id, round_number) VALUES (1, 1);
  INSERT INTO tournament_matches (
    tournament_id,
    round_id,
    team_a_id,
    team_b_id,
    winner_team_id,
    status
  ) VALUES (1, 1, 1, 2, 1, 'finished');

  INSERT INTO tournaments (match_type, category, status)
  VALUES
    ('doubles', 'mens', 'ongoing'),
    ('doubles', 'womens', 'ongoing');
`);
legacyDatabase.close();

app.setPath("userData", testUserData);

let db;

// Confirms a direct database write is rejected by a schema rule.
function assertDatabaseFailure(action, expression) {
  assert.throws(action, expression);
}

try {
  const { initDatabase } = await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const { deletePlayerProfile } = await import("../database/playerQueries.js");

  // Re-running startup initialization must remain safe and preserve legacy rows.
  initDatabase();
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM tournaments WHERE id = 1").get().count,
    1,
  );
  assert.equal(
    db.prepare("SELECT tournament_format_version FROM tournaments WHERE id = 1")
      .get().tournament_format_version,
    1,
  );
  assert.equal(
    db.prepare("SELECT configuration_id FROM tournament_matches WHERE id = 1")
      .get().configuration_id,
    null,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM tournaments WHERE status = 'ongoing'")
      .get().count,
    2,
  );

  // Conflicting legacy rows are retained; once resolved, the unique guard is added.
  db.prepare("UPDATE tournaments SET status = 'finished' WHERE id IN (2, 3)").run();
  initDatabase();

  const tournamentColumns = new Set(
    db.prepare("PRAGMA table_info(tournaments)").all().map((column) => column.name),
  );
  for (const column of [
    "name",
    "start_date",
    "end_date",
    "tournament_format_version",
  ]) {
    assert.equal(tournamentColumns.has(column), true);
  }

  const insertTournament = db.prepare(`
    INSERT INTO tournaments (
      name,
      start_date,
      end_date,
      status,
      tournament_format_version
    ) VALUES (?, ?, ?, ?, 2)
  `);

  const firstDraftId = Number(insertTournament.run(
    "City Open Draft",
    "2026-09-01",
    "2026-09-03",
    "draft",
  ).lastInsertRowid);
  const secondDraftId = Number(insertTournament.run(
    "Junior Open Draft",
    "2026-10-01",
    "2026-10-02",
    "draft",
  ).lastInsertRowid);
  assert.notEqual(firstDraftId, secondDraftId);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM tournaments WHERE status = 'draft'")
      .get().count,
    2,
  );

  assertDatabaseFailure(
    () => insertTournament.run(
      "Invalid Dates",
      "2026-12-02",
      "2026-12-01",
      "draft",
    ),
    /start date/i,
  );
  assertDatabaseFailure(
    () => insertTournament.run(
      "Invalid Status",
      "2026-12-01",
      "2026-12-02",
      "cancelled",
    ),
    /Invalid Tournament status/i,
  );

  const ongoingId = Number(insertTournament.run(
    "Active Open",
    "2026-11-01",
    "2026-11-02",
    "ongoing",
  ).lastInsertRowid);
  assert.ok(ongoingId > 0);
  assertDatabaseFailure(
    () => insertTournament.run(
      "Second Active Open",
      "2026-11-03",
      "2026-11-04",
      "ongoing",
    ),
    /one Tournament may be ongoing|UNIQUE constraint/i,
  );

  const insertConfiguration = db.prepare(`
    INSERT INTO tournament_configurations (
      tournament_id,
      division,
      match_type,
      category,
      level
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const configurationId = Number(insertConfiguration.run(
    firstDraftId,
    "adult",
    "singles",
    "mens",
    "beginner",
  ).lastInsertRowid);

  assertDatabaseFailure(
    () => insertConfiguration.run(
      firstDraftId,
      "adult",
      "singles",
      "mens",
      "beginner",
    ),
    /UNIQUE constraint/i,
  );
  assertDatabaseFailure(
    () => insertConfiguration.run(
      firstDraftId,
      "adult",
      "singles",
      "mixed",
      "beginner",
    ),
    /CHECK constraint/i,
  );
  assertDatabaseFailure(
    () => insertConfiguration.run(
      firstDraftId,
      "adult",
      "singles",
      "womens",
      "all",
    ),
    /exact level/i,
  );
  assertDatabaseFailure(
    () => insertConfiguration.run(
      firstDraftId,
      "u17",
      "singles",
      "mens",
      "beginner",
    ),
    /all player levels/i,
  );
  const minorConfigurationId = Number(insertConfiguration.run(
    firstDraftId,
    "u17",
    "singles",
    "mens",
    "all",
  ).lastInsertRowid);
  assertDatabaseFailure(
    () => insertConfiguration.run(
      firstDraftId,
      "u17",
      "singles",
      "mens",
      "all",
    ),
    /already exists|UNIQUE constraint/i,
  );

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender, prefer_no_gender)
    VALUES (?, ?, ?, 1)
  `);
  const playerIds = [
    ["Aaron Schema", "beginner", "male"],
    ["Ben Schema", "beginner", "male"],
    ["Carlo Schema", "advanced", "male"],
  ].map(([name, level, gender]) => Number(
    insertPlayer.run(name, level, gender).lastInsertRowid,
  ));

  const insertParticipant = db.prepare(`
    INSERT INTO tournament_participants (
      configuration_id,
      player_id,
      level_snapshot,
      gender_snapshot
    ) VALUES (?, ?, ?, ?)
  `);
  const participantIds = playerIds.slice(0, 2).map((playerId) => Number(
    insertParticipant.run(
      configurationId,
      playerId,
      "beginner",
      "male",
    ).lastInsertRowid,
  ));

  assertDatabaseFailure(
    () => insertParticipant.run(
      configurationId,
      playerIds[0],
      "beginner",
      "male",
    ),
    /UNIQUE constraint/i,
  );
  assertDatabaseFailure(
    () => insertParticipant.run(
      configurationId,
      playerIds[2],
      "advanced",
      "male",
    ),
    /level must match/i,
  );
  assertDatabaseFailure(
    () => insertParticipant.run(
      configurationId,
      999999,
      "beginner",
      "male",
    ),
    /FOREIGN KEY constraint/i,
  );
  const minorParticipantId = Number(insertParticipant.run(
    minorConfigurationId,
    playerIds[2],
    "advanced",
    "male",
  ).lastInsertRowid);
  assert.ok(minorParticipantId > 0);

  db.prepare("UPDATE players SET level = 'advanced' WHERE id = ?").run(playerIds[0]);
  assert.equal(
    db.prepare(`
      SELECT level_snapshot
      FROM tournament_participants
      WHERE player_id = ?
    `).get(playerIds[0]).level_snapshot,
    "beginner",
  );

  const groupId = Number(db.prepare(`
    INSERT INTO tournament_groups (configuration_id, group_number, name)
    VALUES (?, 1, 'Group A')
  `).run(configurationId).lastInsertRowid);

  const insertTeam = db.prepare(`
    INSERT INTO tournament_teams (
      tournament_id,
      configuration_id,
      group_id,
      team_number
    ) VALUES (?, ?, ?, ?)
  `);
  const teamIds = [1, 2].map((teamNumber) => Number(
    insertTeam.run(
      firstDraftId,
      configurationId,
      groupId,
      teamNumber,
    ).lastInsertRowid,
  ));
  const insertTeamPlayer = db.prepare(`
    INSERT INTO tournament_team_players (team_id, participant_id, slot)
    VALUES (?, ?, 1)
  `);
  insertTeamPlayer.run(teamIds[0], participantIds[0]);
  insertTeamPlayer.run(teamIds[1], participantIds[1]);

  const roundId = Number(db.prepare(`
    INSERT INTO tournament_rounds (
      tournament_id,
      configuration_id,
      group_id,
      round_number
    ) VALUES (?, ?, ?, 1)
  `).run(firstDraftId, configurationId, groupId).lastInsertRowid);
  db.prepare(`
    INSERT INTO tournament_matches (
      tournament_id,
      configuration_id,
      group_id,
      round_id,
      team_a_id,
      team_b_id,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, 'waiting')
  `).run(
    firstDraftId,
    configurationId,
    groupId,
    roundId,
    teamIds[0],
    teamIds[1],
  );

  assertDatabaseFailure(
    () => db.prepare(`
      INSERT INTO tournament_matches (
        tournament_id,
        configuration_id,
        group_id,
        round_id,
        team_a_id,
        team_b_id,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      firstDraftId,
      configurationId,
      groupId,
      roundId,
      teamIds[0],
      teamIds[1],
    ),
    /Invalid revised Tournament match status/i,
  );

  const retainedConfigurationId = Number(insertConfiguration.run(
    firstDraftId,
    "adult",
    "singles",
    "mens",
    "advanced",
  ).lastInsertRowid);
  insertParticipant.run(
    retainedConfigurationId,
    playerIds[2],
    "advanced",
    "male",
  );

  // Query-level and database-level protection both block participant deletion.
  const protectedDelete = deletePlayerProfile(playerIds[2]);
  assert.equal(protectedDelete.success, false);
  assert.match(protectedDelete.message, /history|Tournament/i);
  assertDatabaseFailure(
    () => db.prepare("DELETE FROM players WHERE id = ?").run(playerIds[2]),
    /Tournament history|FOREIGN KEY constraint/i,
  );

  // Deleting one configuration removes only its normalized child graph.
  db.prepare("DELETE FROM tournament_configurations WHERE id = ?")
    .run(configurationId);
  for (const [table, column] of [
    ["tournament_participants", "configuration_id"],
    ["tournament_groups", "configuration_id"],
    ["tournament_teams", "configuration_id"],
    ["tournament_rounds", "configuration_id"],
    ["tournament_matches", "configuration_id"],
  ]) {
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
        .get(configurationId).count,
      0,
    );
  }
  assert.equal(
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM tournament_configurations
      WHERE id = ?
    `).get(retainedConfigurationId).count,
    1,
  );

  const foreignKeyIssues = db.prepare("PRAGMA foreign_key_check").all();
  assert.deepEqual(foreignKeyIssues, []);

  const indexNames = new Set(
    db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
    `).all().map((index) => index.name),
  );
  for (const indexName of [
    "uq_tournaments_one_ongoing",
    "idx_tournaments_history",
    "idx_tournament_configurations_tournament_id",
    "idx_tournament_participants_player_id",
    "idx_tournament_teams_configuration_group",
    "idx_tournament_matches_configuration_group_status",
    "idx_tournament_matches_status_court",
  ]) {
    assert.equal(indexNames.has(indexName), true, `${indexName} is missing`);
  }

  // A later launch must remain idempotent after revised data has been stored.
  initDatabase();
  assert.equal(
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM tournament_configurations
      WHERE id = ?
    `).get(retainedConfigurationId).count,
    1,
  );

  console.log("Tournament schema and migration integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
