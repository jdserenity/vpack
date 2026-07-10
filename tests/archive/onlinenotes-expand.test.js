const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isLikelyVisibleEditor,
  isBareOnlinenotesShareUrl,
  isShareUrlOnlyTextarea,
  pickPrimaryEditor,
} = require("../../extensions/archive/onlinenotes-expand/content.js");

function makeEditor(options = {}) {
  const {
    tagName = "TEXTAREA",
    width = 400,
    height = 240,
    isContentEditable = false,
    disabled = false,
    readOnly = false,
    value = "",
    style = {},
    attributes = {},
  } = options;

  return {
    tagName,
    isContentEditable,
    disabled,
    readOnly,
    value,
    _style: {
      display: "block",
      visibility: "visible",
      opacity: "1",
      pointerEvents: "auto",
      ...style,
    },
    getAttribute(key) {
      return attributes[key];
    },
    getBoundingClientRect() {
      return { width, height };
    },
  };
}

function getComputedStyleMock(el) {
  return el._style;
}

test("pickPrimaryEditor chooses the largest visible editor only", () => {
  const hiddenUtilityTextarea = makeEditor({
    width: 1400,
    height: 900,
    style: { display: "none" },
  });
  const tinyTextarea = makeEditor({ width: 90, height: 40 });
  const mainEditor = makeEditor({ width: 950, height: 700 });

  const selected = pickPrimaryEditor(
    [hiddenUtilityTextarea, tinyTextarea, mainEditor],
    getComputedStyleMock
  );
  assert.equal(selected, mainEditor);
});

test("readonly utility textarea is ignored during editor targeting", () => {
  const readonlyUtilityTextarea = makeEditor({
    width: 1300,
    height: 800,
    readOnly: true,
  });
  const editableContentArea = makeEditor({
    tagName: "DIV",
    isContentEditable: true,
    width: 1000,
    height: 700,
    attributes: { contenteditable: "true" },
  });

  assert.equal(
    isLikelyVisibleEditor(readonlyUtilityTextarea, getComputedStyleMock),
    false
  );
  const selected = pickPrimaryEditor(
    [readonlyUtilityTextarea, editableContentArea],
    getComputedStyleMock
  );
  assert.equal(selected, editableContentArea);
});

test("isBareOnlinenotesShareUrl matches single-line https note URLs only", () => {
  assert.equal(isBareOnlinenotesShareUrl("https://onlinenotes.app/abc-123_x"), true);
  assert.equal(isBareOnlinenotesShareUrl("  https://onlinenotes.app/z  "), true);
  assert.equal(isBareOnlinenotesShareUrl("https://onlinenotes.app/x\ny"), false);
  assert.equal(isBareOnlinenotesShareUrl("note\nhttps://onlinenotes.app/x"), false);
  assert.equal(isBareOnlinenotesShareUrl("https://example.com/x"), false);
});

test("isShareUrlOnlyTextarea applies only to textareas", () => {
  assert.equal(
    isShareUrlOnlyTextarea(makeEditor({ value: "https://onlinenotes.app/slug" })),
    true
  );
  assert.equal(isShareUrlOnlyTextarea(makeEditor({ value: "hello" })), false);
  assert.equal(
    isShareUrlOnlyTextarea(
      makeEditor({ tagName: "DIV", isContentEditable: true, value: "https://onlinenotes.app/x" })
    ),
    false
  );
});

test("pickPrimaryEditor ignores URL-only share textarea even if it is larger", () => {
  const shareUrlTa = makeEditor({
    width: 2000,
    height: 1200,
    value: "https://onlinenotes.app/note-id-here",
  });
  const bodyTa = makeEditor({
    width: 900,
    height: 700,
    value: "real note\nbody",
  });
  const selected = pickPrimaryEditor(
    [shareUrlTa, bodyTa],
    getComputedStyleMock
  );
  assert.equal(selected, bodyTa);
});
