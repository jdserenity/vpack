const test = require("node:test");
const assert = require("node:assert/strict");
const {
  HIDDEN_CLASS,
  isPornCategoryLabel,
  entryIsPorn,
  hidePornResults,
  ensureHideStyle,
} = require("../extensions/clean-pirate-bay/content.js");

// Minimal DOM-ish stubs so pure logic can be tested without a browser.

function makeTextNode(text) {
  return { textContent: text, nodeType: 3 };
}

function makeEl(tag, attrs = {}, children = []) {
  const el = {
    tagName: tag.toUpperCase(),
    className: attrs.class || "",
    attributes: { ...attrs },
    children: [...children],
    style: {},
    getAttribute(name) {
      if (name === "class") return this.className;
      return this.attributes[name] ?? null;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
      if (name === "class") this.className = value;
      if (name === "id") this.id = value;
    },
    classList: {
      _owner: null,
      add(cls) {
        const owner = el;
        const parts = (owner.className || "").split(/\s+/).filter(Boolean);
        if (!parts.includes(cls)) parts.push(cls);
        owner.className = parts.join(" ");
        owner.attributes.class = owner.className;
      },
      contains(cls) {
        return (el.className || "").split(/\s+/).includes(cls);
      },
    },
    querySelector(sel) {
      return queryAll(this, sel)[0] || null;
    },
    querySelectorAll(sel) {
      return queryAll(this, sel);
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    _textContent: null,
    get textContent() {
      if (this._textContent != null) return this._textContent;
      return collectText(this);
    },
    set textContent(v) {
      this._textContent = v == null ? "" : String(v);
      this.children = [];
    },
  };
  el.classList._owner = el;
  for (const c of children) c.parentNode = el;
  return el;
}

function collectText(node) {
  if (node.nodeType === 3) return node.textContent || "";
  if (!node.children) return node.textContent || "";
  return node.children.map(collectText).join("");
}

function matchesSimple(el, sel) {
  if (!el || el.nodeType === 3) return false;
  if (sel.startsWith(".")) {
    const cls = sel.slice(1);
    return (el.className || "").split(/\s+/).includes(cls);
  }
  if (sel.includes(".")) {
    const [tag, cls] = sel.split(".");
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    return (el.className || "").split(/\s+/).includes(cls);
  }
  if (sel.endsWith("[href]")) {
    const tag = sel.replace("[href]", "");
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    return el.getAttribute("href") != null;
  }
  return el.tagName === sel.toUpperCase();
}

function queryAll(root, sel) {
  const out = [];
  function walk(node) {
    if (!node || node.nodeType === 3) return;
    if (matchesSimple(node, sel)) out.push(node);
    for (const c of node.children || []) walk(c);
  }
  for (const c of root.children || []) walk(c);
  return out;
}

function makeDoc() {
  const head = makeEl("head");
  const body = makeEl("body");
  const doc = {
    head,
    body,
    children: [head, body],
    createElement(tag) {
      return makeEl(tag);
    },
    getElementById(id) {
      const all = [];
      function walk(n) {
        if (!n || n.nodeType === 3) return;
        if (n.attributes?.id === id) all.push(n);
        for (const c of n.children || []) walk(c);
      }
      walk(head);
      walk(body);
      return all[0] || null;
    },
    querySelectorAll(sel) {
      return [...queryAll(head, sel), ...queryAll(body, sel)];
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
  };
  head.ownerDocument = doc;
  body.ownerDocument = doc;
  return doc;
}

function makeEntry(categoryHtmlParts) {
  // categoryHtmlParts: either a string label, or { links: [{href, text}], plain? }
  const type = makeEl("span", { class: "item-type" });
  if (typeof categoryHtmlParts === "string") {
    type.children = [makeTextNode(categoryHtmlParts)];
  } else if (categoryHtmlParts.links) {
    const kids = [];
    categoryHtmlParts.links.forEach((link, i) => {
      if (i > 0) kids.push(makeTextNode(" > "));
      kids.push(makeEl("a", { href: link.href }, [makeTextNode(link.text)]));
    });
    type.children = kids;
  }
  const name = makeEl("span", { class: "item-name item-title" }, [
    makeEl("a", { href: "/description.php?id=1" }, [makeTextNode(categoryHtmlParts.title || "Some Title")]),
  ]);
  return makeEl("li", { class: "list-entry" }, [type, name]);
}

test("isPornCategoryLabel matches main category Porn only", () => {
  assert.equal(isPornCategoryLabel("Porn"), true);
  assert.equal(isPornCategoryLabel("Porn > HD Movies"), true);
  assert.equal(isPornCategoryLabel("Porn > Movies"), true);
  assert.equal(isPornCategoryLabel("  porn > pictures"), true);
  assert.equal(isPornCategoryLabel("Video > Movies"), false);
  assert.equal(isPornCategoryLabel("Other > Pictures"), false);
  assert.equal(isPornCategoryLabel("Audio > Music"), false);
  assert.equal(isPornCategoryLabel(""), false);
  assert.equal(isPornCategoryLabel(null), false);
  // Title-like text must not match if it is not category-first
  assert.equal(isPornCategoryLabel("Not Porn Movie"), false);
});

test("entryIsPorn detects linked Porn > subcategory rows", () => {
  const porn = makeEntry({
    links: [
      { href: "/search.php?q=category:500", text: "Porn" },
      { href: "/search.php?q=category:505", text: "HD Movies" },
    ],
  });
  assert.equal(entryIsPorn(porn), true);

  const video = makeEntry({
    links: [
      { href: "/search.php?q=category:200", text: "Video" },
      { href: "/search.php?q=category:207", text: "HD Movies" },
    ],
  });
  assert.equal(entryIsPorn(video), false);
});

test("entryIsPorn detects plain main-category Porn text (no subcategory links)", () => {
  const plain = makeEntry("Porn");
  assert.equal(entryIsPorn(plain), true);
});

test("entryIsPorn detects top100 porn category hrefs", () => {
  const top = makeEntry({
    links: [
      { href: "/search.php?q=top100:500", text: "Porn" },
      { href: "/search.php?q=top100:501", text: "Movies" },
    ],
  });
  assert.equal(entryIsPorn(top), true);

  const recent48 = makeEntry({
    links: [
      { href: "/search.php?q=top100:48h_500", text: "Porn" },
      { href: "/search.php?q=top100:48h_505", text: "HD Movies" },
    ],
  });
  assert.equal(entryIsPorn(recent48), true);
});

test("hidePornResults adds hidden class only to porn rows", () => {
  const doc = makeDoc();
  const list = makeEl("ol", { id: "torrents" });
  const pornRow = makeEntry({
    links: [
      { href: "/search.php?q=category:500", text: "Porn" },
      { href: "/search.php?q=category:501", text: "Movies" },
    ],
    title: "Adult Title",
  });
  const videoRow = makeEntry({
    links: [
      { href: "/search.php?q=category:200", text: "Video" },
      { href: "/search.php?q=category:201", text: "Movies" },
    ],
    title: "Normal Movie",
  });
  const plainPorn = makeEntry("Porn");
  list.appendChild(pornRow);
  list.appendChild(videoRow);
  list.appendChild(plainPorn);
  doc.body.appendChild(list);

  const n = hidePornResults(doc);
  assert.equal(n, 2);
  assert.equal(pornRow.classList.contains(HIDDEN_CLASS), true);
  assert.equal(plainPorn.classList.contains(HIDDEN_CLASS), true);
  assert.equal(videoRow.classList.contains(HIDDEN_CLASS), false);
});

test("ensureHideStyle injects a CSS rule once", () => {
  const doc = makeDoc();
  const a = ensureHideStyle(doc);
  const b = ensureHideStyle(doc);
  assert.ok(a);
  assert.equal(a, b);
  assert.match(a.textContent, new RegExp(HIDDEN_CLASS));
  assert.match(a.textContent, /display:\s*none\s*!important/i);
});
