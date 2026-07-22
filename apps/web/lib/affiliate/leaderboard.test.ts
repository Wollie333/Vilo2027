import { describe, expect, it } from "vitest";

import { partitionRaceIds } from "./leaderboard";

// The leaderboard's candidate set is a UNION of campaign_active_listings()
// (which knows nothing about enrollment status) and the enrollment table (the
// only place a pause is recorded). Every test here exists because getting that
// union wrong silently puts a paused partner back on the public leaderboard.

const enrol = (id: string, status: string) => ({
  affiliate_id: id,
  status,
});

describe("partitionRaceIds", () => {
  it("keeps an active partner who has no score yet", () => {
    // A partner who has just joined must see themselves in the race on zero.
    const { racing, paused } = partitionRaceIds([], [enrol("a", "active")]);
    expect(racing).toEqual(["a"]);
    expect(paused).toEqual([]);
  });

  it("keeps a scorer who has no enrollment row", () => {
    // eligible_partners = 'all' campaigns can score a partner who never
    // explicitly enrolled.
    const { racing } = partitionRaceIds(["a"], []);
    expect(racing).toEqual(["a"]);
  });

  it("REMOVES a paused partner who still has a score", () => {
    // The regression this whole function exists for: the scores half of the
    // union would otherwise put them straight back on the leaderboard.
    const { racing, paused } = partitionRaceIds(["a"], [enrol("a", "paused")]);
    expect(racing).toEqual([]);
    expect(paused).toEqual(["a"]);
  });

  it("removes a paused partner with no score too", () => {
    const { racing, paused } = partitionRaceIds([], [enrol("a", "paused")]);
    expect(racing).toEqual([]);
    expect(paused).toEqual(["a"]);
  });

  it("excludes withdrawn and removed partners from BOTH lists", () => {
    // Terminal states are not paused — they are gone. They must not show up in
    // the standings, and must not get a "you're paused" banner either.
    const { racing, paused } = partitionRaceIds(
      ["a", "b"],
      [enrol("a", "withdrawn"), enrol("b", "removed")],
    );
    expect(racing).toEqual([]);
    expect(paused).toEqual([]);
  });

  it("does not double-count a partner present in both halves", () => {
    const { racing } = partitionRaceIds(["a", "a"], [enrol("a", "active")]);
    expect(racing).toEqual(["a"]);
  });

  it("partitions a mixed field", () => {
    const { racing, paused } = partitionRaceIds(
      ["scorer", "pausedScorer", "gone"],
      [
        enrol("pausedScorer", "paused"),
        enrol("zeroActive", "active"),
        enrol("gone", "removed"),
      ],
    );
    expect(racing.sort()).toEqual(["scorer", "zeroActive"]);
    expect(paused).toEqual(["pausedScorer"]);
  });
});
