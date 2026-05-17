// Page MAIN world, document_start — must stay self-contained (no imports).
// Keep bare-URL rule aligned with isBareOnlinenotesShareUrl in content.js.
(function () {
  if (window.__vpackOnNotesClip) return;
  window.__vpackOnNotesClip = 1;

  function bare(t) {
    var x = String(t || "").trim();
    if (!x || x.indexOf("\n") !== -1 || x.indexOf("\r") !== -1 || x.length > 700) return false;
    return /^https:\/\/onlinenotes\.app\/[^\s]+$/i.test(x);
  }

  function shouldBlockClipboardWrite(items) {
    return Promise.resolve(items).then(function (arr) {
      var list = [];
      try {
        list = Array.from(arr || []);
      } catch (e) {
        return false;
      }
      if (!list.length) return false;
      return Promise.all(
        list.map(function (item) {
          try {
            var types = item.types ? Array.from(item.types) : [];
            if (types.indexOf("text/plain") === -1) return null;
            return item.getType("text/plain").then(function (b) {
              return b.text();
            });
          } catch (e2) {
            return null;
          }
        })
      ).then(function (plainParts) {
        var texts = plainParts.filter(function (x) {
          return x !== null && x !== undefined;
        });
        if (!texts.length) return false;
        if (texts.length === 1) return bare(texts[0]);
        return texts.every(function (s) {
          return bare(String(s || "").trim());
        });
      });
    });
  }

  try {
    var c = navigator.clipboard;
    if (!c) return;

    if (typeof c.writeText === "function" && !c.writeText.__vpackOnNotes) {
      var origWt = c.writeText;
      c.writeText = function (txt) {
        if (bare(txt)) return Promise.resolve();
        return origWt.call(c, txt);
      };
      c.writeText.__vpackOnNotes = 1;
    }

    if (typeof c.write === "function" && !c.write.__vpackOnNotes) {
      var origW = c.write;
      c.write = function (items) {
        return shouldBlockClipboardWrite(items).then(function (blk) {
          if (blk) return Promise.resolve();
          return origW.call(c, items);
        });
      };
      c.write.__vpackOnNotes = 1;
    }
  } catch (e3) {}
})();
