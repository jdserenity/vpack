const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeAdjustedPlaybackRate,
  shouldSyncTrackedRateFromVideo,
  shouldRestoreRateAfterSpaceBoost,
  setVideoPlaybackRate,
} = require("../extensions/youtube-speed-hotkeys/content.js");

test("computeAdjustedPlaybackRate clamps and rounds to hundredths", () => {
  assert.equal(computeAdjustedPlaybackRate(1, 0.05), 1.05);
  assert.equal(computeAdjustedPlaybackRate(1.05, 0.05), 1.1);
  assert.equal(computeAdjustedPlaybackRate(1.05, -0.05), 1);
  assert.equal(computeAdjustedPlaybackRate(0.03, -0.05), 0.05);
  assert.equal(computeAdjustedPlaybackRate(16, 0.05), 16);
  assert.equal(computeAdjustedPlaybackRate(1.333, 0.05), 1.38);
});

test("shouldSyncTrackedRateFromVideo ignores space boost and cooldown window", () => {
  assert.equal(
    shouldSyncTrackedRateFromVideo({ spaceHeld: true, now: 1000, ignoreUntil: 0 }),
    false
  );
  assert.equal(
    shouldSyncTrackedRateFromVideo({ spaceHeld: false, now: 100, ignoreUntil: 150 }),
    false
  );
  assert.equal(
    shouldSyncTrackedRateFromVideo({ spaceHeld: false, now: 200, ignoreUntil: 150 }),
    true
  );
});

test("shouldRestoreRateAfterSpaceBoost detects wrong snap-back", () => {
  assert.equal(shouldRestoreRateAfterSpaceBoost(1, 1.35), true);
  assert.equal(shouldRestoreRateAfterSpaceBoost(1.35, 1.35), false);
  assert.equal(shouldRestoreRateAfterSpaceBoost(2, 1.35), true);
});

test("setVideoPlaybackRate writes to the video element", () => {
  const video = { playbackRate: 1 };
  assert.equal(setVideoPlaybackRate(video, 1.2), true);
  assert.equal(video.playbackRate, 1.2);
  assert.equal(setVideoPlaybackRate(null, 1.2), false);
});
