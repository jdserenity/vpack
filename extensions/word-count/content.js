function getMainText() {
  const main = document.querySelector('main, article, [role="main"]');
  const root = main ? main.cloneNode(true) : document.body.cloneNode(true);

  root.querySelectorAll(
    'nav, header, footer, aside, script, style, noscript, button, select, ' +
    '[role="navigation"], [role="banner"], [role="complementary"]'
  ).forEach((el) => {
    el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      el.parentNode?.insertBefore(heading, el);
    });
    el.remove();
  });

  const raw = (root.innerText ?? root.textContent ?? "").trim();

  return raw
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "getWordCount") {
    const text = getMainText();
    const count = text.split(/\s+/).filter(Boolean).length;
    sendResponse({ count, text });
  }
});
