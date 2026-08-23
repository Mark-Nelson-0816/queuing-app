import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { getPagination } from "../src/utils/pagination.js";
import {
  filterAndSortProfiles,
  filterAndSortTodayPlayers,
  filterRegistrationProfiles,
} from "../src/utils/playerManagementUi.js";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-players-comprehensive-"));
app.setPath("userData", testUserData);

const results = new Map();
const scaleResults = {};
let db;
let players;
let resetAllData;

function record(category, passed) {
  const current = results.get(category) || { passed: 0, failed: 0 };
  current[passed ? "passed" : "failed"] += 1;
  results.set(category, current);
}

function expectFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.message, expression);
}

function profileInput(overrides = {}) {
  return {
    name: "Test Player",
    level: "beginner",
    gender: "male",
    contact: "",
    preferMens: true,
    preferWomens: false,
    preferMixed: false,
    preferNoGender: false,
    rankPreference: "same_rank",
    ...overrides,
  };
}

function addProfile(overrides = {}) {
  const value = profileInput(overrides);
  return players.addPlayer(
    value.name,
    value.level,
    value.gender,
    value.contact,
    value.preferMens,
    value.preferWomens,
    value.preferMixed,
    value.preferNoGender,
    value.rankPreference,
  );
}

function updateProfile(id, overrides = {}) {
  const value = profileInput(overrides);
  return players.updatePlayerInfo(
    id,
    value.name,
    value.level,
    value.gender,
    value.contact,
    value.preferMens,
    value.preferWomens,
    value.preferMixed,
    value.preferNoGender,
    value.rankPreference,
  );
}

function currentRegistration(playerId) {
  return db.prepare(`
    SELECT *
    FROM registered_players_today
    WHERE player_id = ? AND registered_date = DATE('now', 'localtime')
    ORDER BY id DESC
    LIMIT 1
  `).get(playerId);
}

function assertDatabaseClean() {
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
}

async function test(category, name, callback) {
  resetAllData();
  try {
    await callback();
    assertDatabaseClean();
    record(category, true);
    console.log(`PASS [${category}] ${name}`);
  } catch (error) {
    record(category, false);
    console.error(`FAIL [${category}] ${name}`);
    console.error(error);
  }
}

function seedProfiles(count) {
  const levels = ["beginner", "intermediate", "upper_intermediate", "advanced"];
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    const result = addProfile({
      name: `Scale ${String(index + 1).padStart(3, "0")}`,
      level: levels[Math.floor(index / Math.max(1, count / 4))] || levels[index % 4],
      gender: index % 2 === 0 ? "male" : "female",
      contact: index % 3 === 0 ? `09${String(index).padStart(9, "0")}` : "",
      preferMens: index % 2 === 0,
      preferWomens: index % 2 === 1,
      preferMixed: true,
      preferNoGender: true,
      rankPreference: index % 2 === 0 ? "same_rank" : "adjacent_rank",
    });
    assert.equal(result.success, true, result.message);
    ids.push(result.data.id);
  }
  return ids;
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  players = await import("../database/playerQueries.js");
  resetAllData = (await import("../database/resetQueries.js")).resetAllData;

  await test("Profile Read", "empty database returns an empty renderer payload", () => {
    const result = players.getPlayerManagementData();
    assert.equal(result.success, true);
    assert.deepEqual(result.data.profiles, []);
    assert.deepEqual(result.data.todayPlayers, []);
    assert.equal(result.data.summary.totalProfiles, 0);
  });

  await test("Profile Create", "all supported levels and genders map correctly", () => {
    const levels = ["Beginner", "Intermediate", "Upper Intermediate", "Advanced"];
    levels.forEach((level, levelIndex) => {
      ["Male", "Female"].forEach((gender, genderIndex) => {
        const result = addProfile({
          name: `${level} ${gender}`,
          level,
          gender,
          preferMens: genderIndex === 0,
          preferWomens: genderIndex === 1,
          preferMixed: true,
          preferNoGender: levelIndex % 2 === 0,
          rankPreference: levelIndex % 2 === 0 ? "same_rank" : "adjacent_rank",
        });
        assert.equal(result.success, true, result.message);
      });
    });
    const result = players.getPlayerManagementData().data.profiles;
    assert.equal(result.length, 8);
    assert.deepEqual(new Set(result.map((profile) => profile.level)), new Set([
      "beginner", "intermediate", "upper_intermediate", "advanced",
    ]));
    assert.deepEqual(new Set(result.map((profile) => profile.gender)), new Set(["male", "female"]));
  });

  await test("Profile Create", "optional contact and every preference field map correctly", () => {
    const created = addProfile({
      name: "Complete Profile",
      level: "upper-intermediate",
      gender: "FEMALE",
      contact: " 09171234567 ",
      preferMens: true,
      preferWomens: true,
      preferMixed: true,
      preferNoGender: true,
      rankPreference: "adjacent_rank",
    });
    assert.equal(created.success, true);
    const profile = players.getPlayerManagementData().data.profiles[0];
    assert.equal(profile.id, created.data.id);
    assert.equal(profile.level, "upper_intermediate");
    assert.equal(profile.gender, "female");
    assert.equal(profile.contactNumber, "09171234567");
    assert.equal(profile.rankPreference, "adjacent_rank");
    assert.deepEqual(
      [profile.preferMens, profile.preferWomens, profile.preferMixed, profile.preferNoGender],
      [true, true, true, true],
    );
    const blankContact = addProfile({ name: "Blank Contact", contact: null });
    assert.equal(blankContact.success, true);
    assert.equal(
      players.getPlayerManagementData().data.profiles.find((item) => item.id === blankContact.data.id).contactNumber,
      "N/A",
    );
  });

  await test("Validation", "name validation trims edges and rejects missing names", () => {
    for (const name of ["", "   ", null, undefined]) {
      expectFailure(addProfile({ name }), /name is required/i);
    }
    assert.equal(addProfile({ name: "  Maria Santos  " }).success, true);
    const validNames = [
      "Jo O'Neil",
      "Anne-Marie",
      "José Ñez",
      "Player 2",
      "A&B",
      "A",
      "L".repeat(300),
      "Multiple   Spaces",
    ];
    validNames.forEach((name, index) => {
      const result = addProfile({ name: `${index}-${name}` });
      assert.equal(result.success, true, result.message);
    });
    assert.equal(db.prepare("SELECT name FROM players ORDER BY id LIMIT 1").get().name, "Maria Santos");
  });

  await test("Validation", "level validation accepts normalized formats and rejects invalid values", () => {
    for (const [index, level] of [
      "beginner", "Beginner", " intermediate ", "Upper Intermediate",
      "upper-intermediate", "upperintermediate", "ADVANCED",
    ].entries()) {
      assert.equal(addProfile({ name: `Level ${index}`, level }).success, true);
    }
    for (const [index, level] of ["random", "", "   ", 2, null].entries()) {
      expectFailure(addProfile({ name: `Invalid Level ${index}`, level }), /valid skill level/i);
    }
  });

  await test("Validation", "gender, rank preference, and category preference validation is enforced", () => {
    assert.equal(addProfile({ name: "Normalized Gender", gender: " FEMALE " }).success, true);
    for (const [index, gender] of ["other", "", null, 1].entries()) {
      expectFailure(addProfile({ name: `Invalid Gender ${index}`, gender }), /valid gender/i);
    }
    for (const [index, rankPreference] of ["nearby", "", null, 1].entries()) {
      expectFailure(addProfile({ name: `Invalid Rank ${index}`, rankPreference }), /rank-match preference/i);
    }
    expectFailure(addProfile({
      name: "No Preferences",
      preferMens: false,
      preferWomens: false,
      preferMixed: false,
      preferNoGender: false,
    }), /at least one preferred match category/i);
  });

  await test("Duplicates", "case-insensitive trimmed duplicate names are rejected", () => {
    assert.equal(addProfile({ name: "Juan Dela Cruz" }).success, true);
    for (const name of ["Juan Dela Cruz", "juan dela cruz", "  JUAN DELA CRUZ  "]) {
      expectFailure(addProfile({ name }), /already exists/i);
    }
    assert.equal(addProfile({ name: "Juan Dela Cru" }).success, true);
    assert.equal(addProfile({ name: "Juan  Dela Cruz" }).success, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM players").get().count, 3);
  });

  await test("Profile Edit", "every editable field updates only the intended profile", () => {
    const first = addProfile({ name: "Original One" }).data.id;
    const second = addProfile({ name: "Unrelated Two", gender: "female", preferMens: false, preferWomens: true }).data.id;
    const result = updateProfile(first, {
      name: "Updated One",
      level: "advanced",
      gender: "female",
      contact: "09990000000",
      preferMens: false,
      preferWomens: true,
      preferMixed: true,
      preferNoGender: true,
      rankPreference: "adjacent_rank",
    });
    assert.equal(result.success, true);
    const rows = players.getPlayerManagementData().data.profiles;
    const updated = rows.find((profile) => profile.id === first);
    assert.equal(updated.name, "Updated One");
    assert.equal(updated.level, "advanced");
    assert.equal(updated.gender, "female");
    assert.equal(updated.contactNumber, "09990000000");
    assert.equal(updated.rankPreference, "adjacent_rank");
    assert.equal(rows.find((profile) => profile.id === second).name, "Unrelated Two");
  });

  await test("Profile Edit", "invalid, missing, nonexistent, and duplicate edit targets fail safely", () => {
    const first = addProfile({ name: "First" }).data.id;
    const second = addProfile({ name: "Second" }).data.id;
    expectFailure(updateProfile(99999, { name: "Missing" }), /not found/i);
    expectFailure(updateProfile("bad", { name: "Bad ID" }), /not found/i);
    expectFailure(updateProfile(undefined, { name: "No ID" }), /not found/i);
    expectFailure(updateProfile(second, { name: " first " }), /another player/i);
    expectFailure(updateProfile(first, { name: "", level: "random" }), /name is required/i);
    assert.equal(db.prepare("SELECT name FROM players WHERE id = ?").get(first).name, "First");
  });

  await test("Profile Edit", "registered-today rows display current profile fields after an edit", () => {
    const id = addProfile({ name: "Daily Original", level: "beginner" }).data.id;
    assert.equal(players.registerPlayer(id).success, true);
    assert.equal(updateProfile(id, {
      name: "Daily Updated",
      level: "advanced",
      gender: "female",
      preferMens: false,
      preferWomens: true,
    }).success, true);
    const daily = players.getPlayerManagementData().data.todayPlayers[0];
    assert.equal(daily.id, id);
    assert.equal(daily.name, "Daily Updated");
    assert.equal(daily.level, "advanced");
    assert.equal(daily.gender, "female");
  });

  await test("Profile Delete", "unused and completed-day-only profiles delete without affecting others", () => {
    const disposable = addProfile({ name: "Disposable" }).data.id;
    const retained = addProfile({ name: "Retained" }).data.id;
    assert.equal(players.deletePlayerProfile(disposable).success, true);
    assert.equal(db.prepare("SELECT 1 FROM players WHERE id = ?").get(disposable), undefined);
    assert.equal(db.prepare("SELECT name FROM players WHERE id = ?").get(retained).name, "Retained");

    const completed = addProfile({ name: "Old Daily" }).data.id;
    db.prepare(`
      INSERT INTO registered_players_today (player_id, status, is_done_today, registered_date)
      VALUES (?, 'done', 1, DATE('now', 'localtime', '-1 day'))
    `).run(completed);
    assert.equal(players.deletePlayerProfile(completed).success, true);
    assert.equal(db.prepare("SELECT 1 FROM registered_players_today WHERE player_id = ?").get(completed), undefined);
  });

  await test("Profile Delete", "invalid targets and active daily registrations are controlled failures", () => {
    expectFailure(players.deletePlayerProfile(9999), /not found/i);
    expectFailure(players.deletePlayerProfile("bad"), /not found/i);
    expectFailure(players.deletePlayerProfile(undefined), /not found/i);
    const id = addProfile({ name: "Active Profile" }).data.id;
    players.registerPlayer(id);
    expectFailure(players.deletePlayerProfile(id), /mark this player done/i);
    assert.ok(db.prepare("SELECT 1 FROM players WHERE id = ?").get(id));
  });

  await test("Profile Delete", "Rotation and Tournament history protect permanent profiles", () => {
    const rotationId = addProfile({ name: "Rotation History" }).data.id;
    players.registerPlayer(rotationId);
    const registrationId = currentRegistration(rotationId).id;
    const rotationMatchId = Number(db.prepare(`
      INSERT INTO rotation_matches (match_type, category, status)
      VALUES ('singles', 'no_gender', 'finished')
    `).run().lastInsertRowid);
    db.prepare(`
      INSERT INTO rotation_match_players (
        rotation_match_id, registered_player_id, player_id, team, slot
      ) VALUES (?, ?, ?, 1, 1)
    `).run(rotationMatchId, registrationId, rotationId);
    db.prepare("UPDATE registered_players_today SET status = 'done', is_done_today = 1 WHERE id = ?").run(registrationId);
    expectFailure(players.deletePlayerProfile(rotationId), /history/i);

    const tournamentId = addProfile({ name: "Tournament History", gender: "female", preferMens: false, preferWomens: true }).data.id;
    const eventId = Number(db.prepare(`
      INSERT INTO tournaments (name, start_date, end_date, tournament_format_version, status)
      VALUES ('Profile Protection', DATE('now', 'localtime'), DATE('now', 'localtime'), 2, 'draft')
    `).run().lastInsertRowid);
    const configurationId = Number(db.prepare(`
      INSERT INTO tournament_configurations (
        tournament_id, division, match_type, category, level
      ) VALUES (?, 'adult', 'singles', 'womens', 'beginner')
    `).run(eventId).lastInsertRowid);
    db.prepare(`
      INSERT INTO tournament_participants (
        configuration_id, player_id, level_snapshot, gender_snapshot
      ) VALUES (?, ?, 'beginner', 'female')
    `).run(configurationId, tournamentId);
    expectFailure(players.deletePlayerProfile(tournamentId), /history/i);
  });

  await test("Registration", "one profile registers with zero counters and complete mapped data", () => {
    const id = addProfile({
      name: "Registered One",
      level: "upper_intermediate",
      gender: "female",
      preferMens: false,
      preferWomens: true,
      preferMixed: true,
      preferNoGender: true,
      rankPreference: "adjacent_rank",
    }).data.id;
    const result = players.registerPlayer(id);
    assert.equal(result.success, true);
    assert.equal(result.data.action, "registered");
    const row = currentRegistration(id);
    assert.equal(row.match_count, 0);
    assert.equal(row.wins, 0);
    assert.equal(row.losses, 0);
    assert.equal(row.status, "available");
    assert.equal(row.is_done_today, 0);
    const daily = players.getPlayerManagementData().data.todayPlayers[0];
    assert.equal(daily.id, id);
    assert.equal(daily.registrationId, row.id);
    assert.equal(daily.preferWomens, true);
    assert.equal(daily.preferMixed, true);
    assert.equal(daily.preferNoGender, true);
  });

  await test("Registration", "duplicate and rapid sequential registration calls create one daily row", () => {
    const id = addProfile({ name: "Duplicate Daily" }).data.id;
    assert.equal(players.registerPlayer(id).success, true);
    expectFailure(players.registerPlayer(id), /already registered/i);
    expectFailure(players.registerPlayer(id), /already registered/i);
    assert.equal(db.prepare(`
      SELECT COUNT(*) AS count FROM registered_players_today
      WHERE player_id = ? AND registered_date = DATE('now', 'localtime')
    `).get(id).count, 1);
  });

  await test("Registration", "reactivation reuses one row and preserves daily counters", () => {
    const id = addProfile({ name: "Reactivate" }).data.id;
    const first = players.registerPlayer(id).data;
    db.prepare(`
      UPDATE registered_players_today
      SET match_count = 4, wins = 3, losses = 1
      WHERE id = ?
    `).run(first.registrationId);
    assert.equal(players.removeRegisteredPlayer(id).success, true);
    const second = players.registerPlayer(id);
    assert.equal(second.success, true);
    assert.equal(second.data.action, "reactivated");
    assert.equal(second.data.registrationId, first.registrationId);
    const row = currentRegistration(id);
    assert.deepEqual([row.match_count, row.wins, row.losses], [4, 3, 1]);
    assert.equal(row.is_done_today, 0);
    assert.equal(row.status, "available");
  });

  await test("Date Handling", "previous-day rows are historical and a new current-day row can be created", () => {
    const id = addProfile({ name: "Across Dates" }).data.id;
    db.prepare(`
      INSERT INTO registered_players_today (
        player_id, match_count, status, is_done_today, registered_date
      ) VALUES (?, 7, 'done', 1, DATE('now', 'localtime', '-1 day'))
    `).run(id);
    assert.equal(players.getPlayerManagementData().data.todayPlayers.length, 0);
    assert.equal(players.registerPlayer(id).success, true);
    const rows = db.prepare(`
      SELECT registered_date, match_count
      FROM registered_players_today
      WHERE player_id = ?
      ORDER BY registered_date
    `).all(id);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.match_count), [7, 0]);
    assert.equal(players.getPlayerManagementData().data.todayPlayers.length, 1);
  });

  await test("Registered Today", "retrieval returns all current statuses and excludes other dates", () => {
    const ids = ["Available", "Done", "Assigned", "Playing"].map((name) => (
      addProfile({ name }).data.id
    ));
    ids.forEach((id) => players.registerPlayer(id));
    players.removeRegisteredPlayer(ids[1]);
    const registrations = new Map(db.prepare(`
      SELECT player_id, id FROM registered_players_today
      WHERE registered_date = DATE('now', 'localtime')
    `).all().map((row) => [Number(row.player_id), Number(row.id)]));
    const waiting = Number(db.prepare(`
      INSERT INTO rotation_matches (queue_position, match_type, category, status)
      VALUES (1, 'singles', 'no_gender', 'waiting')
    `).run().lastInsertRowid);
    const playing = Number(db.prepare(`
      INSERT INTO rotation_matches (match_type, category, status)
      VALUES ('singles', 'no_gender', 'playing')
    `).run().lastInsertRowid);
    const insertParticipant = db.prepare(`
      INSERT INTO rotation_match_players (
        rotation_match_id, registered_player_id, player_id, team, slot
      ) VALUES (?, ?, ?, 1, 1)
    `);
    insertParticipant.run(waiting, registrations.get(ids[2]), ids[2]);
    insertParticipant.run(playing, registrations.get(ids[3]), ids[3]);
    const management = players.getPlayerManagementData().data;
    assert.deepEqual(
      new Map(management.todayPlayers.map((player) => [player.id, player.status])),
      new Map([[ids[0], "available"], [ids[1], "done"], [ids[2], "assigned"], [ids[3], "playing"]]),
    );
    assert.equal(players.getRegisteredPlayersToday().length, 3);
  });

  await test("Status / Done", "done transitions are idempotently guarded and preserve profiles/history", () => {
    const id = addProfile({ name: "Done Today" }).data.id;
    players.registerPlayer(id);
    assert.equal(players.removeRegisteredPlayer(id).success, true);
    expectFailure(players.removeRegisteredPlayer(id), /already marked done/i);
    const management = players.getPlayerManagementData().data;
    assert.equal(management.profiles.length, 1);
    assert.equal(management.todayPlayers[0].status, "done");
    assert.equal(management.summary.doneToday, 1);
    assert.equal(players.getRegisteredPlayersToday().length, 0);
  });

  await test("Status / Done", "assigned and playing players cannot be marked done", () => {
    const ids = [addProfile({ name: "Assigned" }).data.id, addProfile({ name: "Playing" }).data.id];
    ids.forEach((id) => players.registerPlayer(id));
    const registrations = ids.map((id) => currentRegistration(id).id);
    const insertMatch = db.prepare(`
      INSERT INTO rotation_matches (queue_position, match_type, category, status)
      VALUES (?, 'singles', 'no_gender', ?)
    `);
    const assignedMatch = Number(insertMatch.run(1, "waiting").lastInsertRowid);
    const playingMatch = Number(insertMatch.run(null, "playing").lastInsertRowid);
    const insertParticipant = db.prepare(`
      INSERT INTO rotation_match_players (
        rotation_match_id, registered_player_id, player_id, team, slot
      ) VALUES (?, ?, ?, 1, 1)
    `);
    insertParticipant.run(assignedMatch, registrations[0], ids[0]);
    insertParticipant.run(playingMatch, registrations[1], ids[1]);
    expectFailure(players.removeRegisteredPlayer(ids[0]), /waiting match/i);
    expectFailure(players.removeRegisteredPlayer(ids[1]), /active match/i);
    assert.equal(db.prepare("SELECT SUM(is_done_today) AS count FROM registered_players_today").get().count, 0);
  });

  await test("Bulk Done", "zero and already-done populations return a controlled empty summary", () => {
    assert.deepEqual(players.markAllRegisteredPlayersDone(), {
      success: true,
      data: { markedDone: 0, skipped: 0, skippedPlayers: [] },
    });
    const id = addProfile({ name: "Already Done" }).data.id;
    players.registerPlayer(id);
    players.removeRegisteredPlayer(id);
    assert.deepEqual(players.markAllRegisteredPlayersDone(), {
      success: true,
      data: { markedDone: 0, skipped: 0, skippedPlayers: [] },
    });
  });

  await test("Bulk Done", "mixed populations update eligible rows and preserve assigned/playing rows", () => {
    const ids = Array.from({ length: 6 }, (_, index) => addProfile({ name: `Bulk ${index}` }).data.id);
    ids.forEach((id) => players.registerPlayer(id));
    const registrations = new Map(ids.map((id) => [id, currentRegistration(id).id]));
    const insertMatch = db.prepare(`
      INSERT INTO rotation_matches (queue_position, match_type, category, status)
      VALUES (?, 'singles', 'no_gender', ?)
    `);
    const waiting = Number(insertMatch.run(1, "waiting").lastInsertRowid);
    const playing = Number(insertMatch.run(null, "playing").lastInsertRowid);
    const participant = db.prepare(`
      INSERT INTO rotation_match_players (
        rotation_match_id, registered_player_id, player_id, team, slot
      ) VALUES (?, ?, ?, ?, 1)
    `);
    participant.run(waiting, registrations.get(ids[2]), ids[2], 1);
    participant.run(waiting, registrations.get(ids[3]), ids[3], 2);
    participant.run(playing, registrations.get(ids[4]), ids[4], 1);
    participant.run(playing, registrations.get(ids[5]), ids[5], 2);
    const beforeMatches = db.prepare("SELECT id, status FROM rotation_matches ORDER BY id").all();
    const result = players.markAllRegisteredPlayersDone();
    assert.equal(result.success, true);
    assert.equal(result.data.markedDone, 2);
    assert.equal(result.data.skipped, 4);
    assert.deepEqual(result.data.skippedPlayers.map((item) => item.reason).sort(), [
      "assigned", "assigned", "playing", "playing",
    ]);
    assert.deepEqual(
      db.prepare("SELECT id, status FROM rotation_matches ORDER BY id").all(),
      beforeMatches,
    );
    assert.deepEqual(
      db.prepare("SELECT is_done_today FROM registered_players_today ORDER BY player_id").all().map((row) => row.is_done_today),
      [1, 1, 0, 0, 0, 0],
    );
  });

  await test("Bulk Done", "an injected database failure rolls back the whole bulk update", () => {
    const ids = Array.from({ length: 3 }, (_, index) => addProfile({ name: `Rollback ${index}` }).data.id);
    ids.forEach((id) => players.registerPlayer(id));
    db.exec(`
      CREATE TEMP TRIGGER fail_bulk_done
      BEFORE UPDATE OF is_done_today ON registered_players_today
      WHEN NEW.player_id = ${ids[1]} AND NEW.is_done_today = 1
      BEGIN
        SELECT RAISE(ABORT, 'Injected bulk failure');
      END;
    `);
    try {
      expectFailure(players.markAllRegisteredPlayersDone(), /injected bulk failure/i);
      assert.deepEqual(
        db.prepare("SELECT is_done_today FROM registered_players_today ORDER BY player_id").all().map((row) => row.is_done_today),
        [0, 0, 0],
      );
    } finally {
      db.exec("DROP TRIGGER IF EXISTS fail_bulk_done");
    }
  });

  await test("Search / Filters", "profile search is trimmed, case-insensitive, contact-aware, and pre-pagination", () => {
    const profilesData = [
      { id: 1, name: "Ana-Marie O'Neil", contactNumber: "0917-ABC", level: "beginner", gender: "female", rankPreference: "same_rank", preferMens: false, preferWomens: true, preferMixed: true, preferNoGender: false, lifetimeMatches: 0, lifetimeWins: 0, lifetimeLosses: 0 },
      { id: 2, name: "JOSE CRUZ", contactNumber: "N/A", level: "advanced", gender: "male", rankPreference: "adjacent_rank", preferMens: true, preferWomens: false, preferMixed: true, preferNoGender: true, lifetimeMatches: 4, lifetimeWins: 3, lifetimeLosses: 1 },
      ...Array.from({ length: 12 }, (_, index) => ({ id: index + 3, name: `Page Player ${index + 1}`, contactNumber: "N/A", level: "intermediate", gender: index % 2 ? "female" : "male", rankPreference: "same_rank", preferMens: true, preferWomens: true, preferMixed: false, preferNoGender: true, lifetimeMatches: index, lifetimeWins: 0, lifetimeLosses: 0 })),
    ];
    assert.deepEqual(filterAndSortProfiles(profilesData, { search: "  ana-MARIE " }).map((item) => item.id), [1]);
    assert.deepEqual(filterAndSortProfiles(profilesData, { search: "0917-abc" }).map((item) => item.id), [1]);
    assert.deepEqual(filterAndSortProfiles(profilesData, { search: "player 12" }).map((item) => item.id), [14]);
    assert.deepEqual(filterAndSortProfiles(profilesData, { search: "missing" }), []);
  });

  await test("Search / Filters", "all profile filters combine using canonical level/category values", () => {
    const source = players.getPlayerManagementData().data.profiles;
    assert.deepEqual(source, []);
    const sample = [
      { id: 1, name: "Beginner Male", contactNumber: "N/A", level: "beginner", gender: "male", rankPreference: "same_rank", preferMens: true, preferWomens: false, preferMixed: false, preferNoGender: true, lifetimeMatches: 1, lifetimeWins: 1, lifetimeLosses: 0 },
      { id: 2, name: "Upper Female", contactNumber: "N/A", level: "upper_intermediate", gender: "female", rankPreference: "adjacent_rank", preferMens: false, preferWomens: true, preferMixed: true, preferNoGender: false, lifetimeMatches: 3, lifetimeWins: 1, lifetimeLosses: 2 },
      { id: 3, name: "Advanced Male", contactNumber: "N/A", level: "advanced", gender: "male", rankPreference: "adjacent_rank", preferMens: true, preferWomens: false, preferMixed: true, preferNoGender: false, lifetimeMatches: 5, lifetimeWins: 4, lifetimeLosses: 1 },
    ];
    assert.deepEqual(filterAndSortProfiles(sample, { levelFilter: "upper_intermediate" }).map((item) => item.id), [2]);
    assert.deepEqual(filterAndSortProfiles(sample, { genderFilter: "male", rankFilter: "adjacent_rank", categoryFilter: "mixed" }).map((item) => item.id), [3]);
    assert.deepEqual(filterAndSortProfiles(sample, { categoryFilter: "womens", search: "upper" }).map((item) => item.id), [2]);
    assert.deepEqual(filterAndSortProfiles(sample, { categoryFilter: "womens", genderFilter: "male" }), []);
  });

  await test("Search / Filters", "today filters combine and sorting uses semantic levels and counters", () => {
    const sample = [
      { id: 1, name: "Zed", level: "advanced", gender: "male", status: "available", matchesToday: 4, winsToday: 3, lossesToday: 1 },
      { id: 2, name: "Anna", level: "beginner", gender: "female", status: "done", matchesToday: 1, winsToday: 0, lossesToday: 1 },
      { id: 3, name: "Mike", level: "intermediate", gender: "male", status: "available", matchesToday: 2, winsToday: 1, lossesToday: 1 },
    ];
    assert.deepEqual(filterAndSortTodayPlayers(sample, { genderFilter: "male", statusFilter: "available", sort: { field: "matches", direction: "desc" } }).map((item) => item.id), [1, 3]);
    assert.deepEqual(filterAndSortTodayPlayers(sample, { sort: { field: "level", direction: "asc" } }).map((item) => item.id), [2, 3, 1]);
    assert.deepEqual(filterAndSortTodayPlayers(sample, { search: " AN ", statusFilter: "done" }).map((item) => item.id), [2]);
  });

  await test("Pagination", "page boundaries cover 0, 1, 10, 11, 20, and large datasets without gaps", () => {
    for (const total of [0, 1, 10, 11, 20, 80, 200]) {
      const ids = Array.from({ length: total }, (_, index) => index + 1);
      const seen = [];
      const totalPages = Math.max(1, Math.ceil(total / 10));
      for (let page = 1; page <= totalPages; page += 1) {
        const bounds = getPagination(total, page, 10);
        seen.push(...ids.slice(bounds.startIndex, bounds.endIndex));
      }
      assert.deepEqual(seen, ids);
      assert.equal(new Set(seen).size, total);
    }
    assert.deepEqual(getPagination(11, 99, 10), {
      currentPage: 2, totalPages: 2, startIndex: 10, endIndex: 11,
    });
  });

  await test("Selection", "registration eligibility excludes active profiles and includes done profiles", () => {
    const profilesData = [
      { id: 1, name: "Unregistered", level: "beginner", gender: "male", todayRegistration: null },
      { id: 2, name: "Active", level: "beginner", gender: "male", todayRegistration: { isDone: false } },
      { id: 3, name: "Done", level: "advanced", gender: "female", todayRegistration: { isDone: true } },
    ];
    assert.deepEqual(filterRegistrationProfiles(profilesData).map((item) => item.id), [1, 3]);
    assert.deepEqual(filterRegistrationProfiles(profilesData, { levelFilter: "advanced", genderFilter: "female" }).map((item) => item.id), [3]);
    assert.deepEqual(filterRegistrationProfiles(profilesData, { search: "active" }), []);
  });

  await test("Selection", "a selected registration target is unusable when current filters hide it", () => {
    const profilesData = [
      { id: 1, name: "Hidden Male", level: "beginner", gender: "male", todayRegistration: null },
      { id: 2, name: "Visible Female", level: "beginner", gender: "female", todayRegistration: null },
    ];
    const selectedId = 1;
    const visible = filterRegistrationProfiles(profilesData, { genderFilter: "female" });
    assert.equal(visible.find((profile) => profile.id === selectedId), undefined);
    const source = readFileSync(new URL("../src/components/players/RegisterPlayerToday.jsx", import.meta.url), "utf8");
    assert.match(source, /const selectedPlayer = filteredProfiles\.find/);
  });

  await test("IPC Contract", "every Players preload channel has a matching main-process handler", () => {
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const mainSource = readFileSync(path.join(repositoryRoot, "electron", "main.js"), "utf8");
    const preloadSource = readFileSync(path.join(repositoryRoot, "electron", "preload.cjs"), "utf8");
    const handlers = new Set([...mainSource.matchAll(/ipcMain\.handle\(\s*["']([^"']+)["']/g)].map((match) => match[1]));
    const contracts = [
      ["addPlayer", "add-player"],
      ["getPlayerManagementData", "get-player-management-data"],
      ["registerPlayer", "register-player"],
      ["getRegisteredPlayersToday", "get-registered-players-today"],
      ["removeRegisteredPlayer", "remove-registered-player"],
      ["markAllRegisteredPlayersDone", "mark-all-registered-players-done"],
      ["updatePlayerInfo", "update-player-info"],
      ["deletePlayerProfile", "delete-players-profile"],
    ];
    for (const [method, channel] of contracts) {
      assert.equal(handlers.has(channel), true, `${channel} handler is missing`);
      assert.match(preloadSource, new RegExp(`${method}\\s*:`));
      assert.match(preloadSource, new RegExp(`ipcRenderer\\.invoke\\(["']${channel}["']`));
    }
  });

  await test("Error Handling", "malformed IDs and missing payloads return controlled results", () => {
    for (const id of [undefined, null, "", "abc", -1, 1.5]) {
      expectFailure(players.registerPlayer(id), /not found/i);
      expectFailure(players.removeRegisteredPlayer(id), /not found/i);
      expectFailure(players.deletePlayerProfile(id), /not found/i);
    }
    expectFailure(players.updatePlayerInfo(), /not found/i);
    assert.equal(players.getPlayerManagementData().success, true);
  });

  await test("Rapid Actions", "rapid duplicate profile submissions remain single-row", () => {
    const first = addProfile({ name: "Rapid Add" });
    const second = addProfile({ name: " rapid add " });
    assert.equal(first.success, true);
    expectFailure(second, /already exists/i);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM players").get().count, 1);
  });

  await test("Scale", "10 profiles load, filter, paginate, register, and retrieve completely", () => {
    const started = performance.now();
    const expectedIds = seedProfiles(10);
    expectedIds.forEach((id) => assert.equal(players.registerPlayer(id).success, true));
    const management = players.getPlayerManagementData().data;
    assert.equal(management.profiles.length, 10);
    assert.equal(management.todayPlayers.length, 10);
    assert.deepEqual(new Set(management.todayPlayers.map((player) => player.id)), new Set(expectedIds));
    scaleResults.players10Ms = Math.round((performance.now() - started) * 10) / 10;
  });

  await test("Scale", "80 selected profiles produce exactly 80 unique Registered Today rows", () => {
    const started = performance.now();
    const expectedIds = seedProfiles(80);
    const registrationResults = expectedIds.map((id) => players.registerPlayer(id));
    assert.equal(registrationResults.every((result) => result.success), true);
    const databaseRows = db.prepare(`
      SELECT player_id FROM registered_players_today
      WHERE registered_date = DATE('now', 'localtime') ORDER BY player_id
    `).all().map((row) => Number(row.player_id));
    const returnedIds = players.getPlayerManagementData().data.todayPlayers.map((player) => player.id).sort((a, b) => a - b);
    const sortedExpected = [...expectedIds].sort((a, b) => a - b);
    assert.equal(expectedIds.length, 80);
    assert.equal(registrationResults.filter((result) => result.success).length, 80);
    assert.equal(databaseRows.length, 80);
    assert.equal(returnedIds.length, 80);
    assert.deepEqual(databaseRows, sortedExpected);
    assert.deepEqual(returnedIds, sortedExpected);
    assert.equal(new Set(databaseRows).size, 80);
    scaleResults.players80Ms = Math.round((performance.now() - started) * 10) / 10;
  });

  await test("Scale", "200 profiles remain complete through load, filters, pagination, registration, and retrieval", () => {
    const started = performance.now();
    const expectedIds = seedProfiles(200);
    let management = players.getPlayerManagementData().data;
    assert.equal(management.profiles.length, 200);
    const levelCounts = management.profiles.reduce((counts, profile) => {
      counts[profile.level] = (counts[profile.level] || 0) + 1;
      return counts;
    }, {});
    assert.deepEqual(levelCounts, {
      beginner: 50,
      intermediate: 50,
      upper_intermediate: 50,
      advanced: 50,
    });
    const filtered = filterAndSortProfiles(management.profiles, {
      levelFilter: "upper_intermediate",
      genderFilter: "female",
    });
    assert.equal(filtered.length, 25);
    const pageOne = getPagination(filtered.length, 1, 10);
    const pageTwo = getPagination(filtered.length, 2, 10);
    assert.equal(new Set([
      ...filtered.slice(pageOne.startIndex, pageOne.endIndex),
      ...filtered.slice(pageTwo.startIndex, pageTwo.endIndex),
    ].map((profile) => profile.id)).size, 20);
    expectedIds.forEach((id) => assert.equal(players.registerPlayer(id).success, true));
    management = players.getPlayerManagementData().data;
    assert.equal(management.todayPlayers.length, 200);
    assert.equal(new Set(management.todayPlayers.map((player) => player.id)).size, 200);
    scaleResults.players200Ms = Math.round((performance.now() - started) * 10) / 10;
  });

  await test("Database Integrity", "required profile data, daily references, and duplicate IDs remain clean", () => {
    const ids = seedProfiles(20);
    ids.forEach((id) => players.registerPlayer(id));
    assert.equal(db.prepare(`
      SELECT COUNT(*) AS count FROM players
      WHERE name IS NULL OR TRIM(name) = '' OR level IS NULL OR gender IS NULL
    `).get().count, 0);
    assert.equal(db.prepare(`
      SELECT COUNT(*) AS count
      FROM registered_players_today AS daily
      LEFT JOIN players ON players.id = daily.player_id
      WHERE players.id IS NULL
    `).get().count, 0);
    assert.equal(db.prepare(`
      SELECT COUNT(*) AS count FROM (
        SELECT player_id, registered_date, COUNT(*) AS duplicate_count
        FROM registered_players_today
        GROUP BY player_id, registered_date
        HAVING duplicate_count > 1
      )
    `).get().count, 0);
    assert.equal(db.prepare(`
      SELECT COUNT(*) AS count FROM registered_players_today
      WHERE status NOT IN ('available', 'assigned', 'playing', 'done')
    `).get().count, 0);
  });

  const totals = [...results.values()].reduce((sum, category) => ({
    passed: sum.passed + category.passed,
    failed: sum.failed + category.failed,
  }), { passed: 0, failed: 0 });
  const sqliteVersion = db.prepare("SELECT sqlite_version() AS version").get().version;
  console.log("PLAYERS_TEST_SUMMARY", JSON.stringify({
    totals,
    categories: Object.fromEntries(results),
    scaleResults,
    environment: {
      node: process.version,
      electron: process.versions.electron,
      sqlite: sqliteVersion,
      testDatabase: path.join(testUserData, "badminton.db"),
    },
  }));

  if (totals.failed > 0) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(process.exitCode || 0);
}
