// YouTube Transcript Copy v0.3.1
// Scrapes YouTube's own transcript panel from the DOM. The previous
// approaches (POSTing to /youtubei/v1/get_transcript and fetching
// /api/timedtext baseUrls) are both blocked as of late 2025 — they now
// require a BotGuard-issued PoToken / attestation challenge that we
// cannot generate from a content script. Driving the real UI is the
// only reliable path left.
(() => {
  if (window.__vpackYoutubeTranscriptCopyLoaded) return;
  window.__vpackYoutubeTranscriptCopyLoaded = true;

  const LOG_PREFIX = "[VPack][YT Transcript]";
  let logSeq = 0;
  const scriptBootAt = Date.now();
  const PANEL_SELECTOR =
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';
  const SEGMENT_SELECTOR = "ytd-transcript-segment-renderer";
  const DESCRIPTION_EXPAND_SELECTORS = [
    "#description-inline-expander #expand",
    "ytd-watch-metadata #description-inline-expander #expand",
    "ytd-watch-metadata ytd-text-inline-expander #expand",
  ];
  const DESCRIPTION_COLLAPSE_SELECTORS = [
    "#description-inline-expander #collapse",
    "#description-inline-expander #less",
    "ytd-watch-metadata #description-inline-expander #collapse",
    "ytd-watch-metadata #description-inline-expander #less",
    "ytd-watch-metadata ytd-text-inline-expander #collapse",
    "ytd-watch-metadata ytd-text-inline-expander #less",
  ];

  log("script boot", {
    href: location.href,
    userAgent: navigator.userAgent,
    readyState: document.readyState,
  });

  window.addEventListener("error", (event) => {
    logError("window error event", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    logError("window unhandledrejection", event.reason || event);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    log("runtime message observed", {
      action: message?.action || "",
      accepted: message?.action === "getYoutubeTranscript",
      href: location.href,
    });
    if (message.action !== "getYoutubeTranscript") return;

    log("message received", { action: message.action, url: location.href });
    getYoutubeTranscriptText()
      .then((transcript) => {
        log("transcript success", {
          chars: transcript.length,
          lines: transcript ? transcript.split("\n").length : 0,
        });
        sendResponse({ ok: true, transcript });
      })
      .catch((error) => {
        logError("transcript failure", error);
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get transcript.",
        });
      });

    return true;
  });

  async function getYoutubeTranscriptText() {
    log("starting transcript extraction");
    if (!isWatchPage()) {
      logWarn("not on watch page", { pathname: location.pathname });
      throw new Error("Open a YouTube watch page first.");
    }

    const scrollLock = beginViewportTopLock();
    const wasPanelVisibleAtStart = isTranscriptPanelVisible();
    const wasDescriptionExpandedAtStart = isDescriptionExpanded();
    let openedPanelByUs = false;
    let expandedDescriptionByUs = false;
    log("panel visibility at start", { wasPanelVisibleAtStart });
    log("description state at start", { wasDescriptionExpandedAtStart });

    try {
      if (!wasPanelVisibleAtStart) {
        const openResult = await openTranscriptPanel();
        openedPanelByUs = openResult.opened;
        expandedDescriptionByUs = openResult.expandedDescriptionByUs;
        log("attempted to open transcript panel", openResult);
        if (!openResult.opened) throw new Error("This video does not have a transcript.");
      }

      const panel = document.querySelector(PANEL_SELECTOR);
      log("panel lookup after open flow", {
        found: Boolean(panel),
        selector: PANEL_SELECTOR,
      });
      if (!panel) throw new Error("Could not open the transcript panel.");

      const segments = await waitForSegments(panel, 8000);
      log("waitForSegments result", { found: segments ? segments.length : 0 });
      if (!segments || !segments.length) {
        throw new Error("Transcript did not load.");
      }

      await loadAllSegments(panel);

      const allSegments = Array.from(panel.querySelectorAll(SEGMENT_SELECTOR));
      log("segment count after loadAllSegments", { count: allSegments.length });
      const transcript = segmentsToText(allSegments);

      if (!transcript) throw new Error("Transcript was empty.");
      return transcript;
    } finally {
      if (openedPanelByUs) {
        log("cleanup: closing transcript panel opened by script");
        closeTranscriptPanel();
      }
      if (expandedDescriptionByUs && !wasDescriptionExpandedAtStart) {
        log("cleanup: collapsing description expanded by script");
        collapseDescriptionIfExpanded();
      }
      // Let post-click layout settle, then restore exact viewport.
      await sleep(50);
      scrollLock.release("final cleanup");
    }
  }

  function isWatchPage() {
    const value = location.pathname === "/watch";
    log("isWatchPage check", { pathname: location.pathname, isWatchPage: value });
    return value;
  }

  function isTranscriptPanelVisible() {
    const panel = document.querySelector(PANEL_SELECTOR);
    if (!panel) {
      log("isTranscriptPanelVisible: panel not found");
      return false;
    }
    const visibility = panel.getAttribute("visibility") || "";
    const visible = visibility.includes("VISIBLE") || visibility.includes("EXPANDED");
    log("isTranscriptPanelVisible: evaluated", { visibility, visible });
    return visible;
  }

  async function openTranscriptPanel() {
    let expandedDescriptionByUs = false;
    log("openTranscriptPanel: step 1 direct trigger");
    if (clickShowTranscriptTrigger()) {
      const directPanel = await waitForTranscriptPanel(4500);
      log("openTranscriptPanel: direct trigger result", { opened: Boolean(directPanel) });
      if (directPanel) return { opened: true, expandedDescriptionByUs };
    }

    log("openTranscriptPanel: step 2 expand description");
    expandedDescriptionByUs = expandDescriptionIfCollapsed() || expandedDescriptionByUs;
    if (clickShowTranscriptTrigger()) {
      const expandedPanel = await waitForTranscriptPanel(4500);
      log("openTranscriptPanel: expanded description result", {
        opened: Boolean(expandedPanel),
      });
      if (expandedPanel) return { opened: true, expandedDescriptionByUs };
    }

    log("openTranscriptPanel: step 3 open actions menu");
    const menuOpened = await openDescriptionActionsMenu();
    log("openTranscriptPanel: menu opened", { menuOpened });
    if (!menuOpened) return { opened: false, expandedDescriptionByUs };

    const menuItemClicked = clickShowTranscriptMenuItem();
    log("openTranscriptPanel: transcript menu item clicked", { menuItemClicked });
    if (!menuItemClicked) return { opened: false, expandedDescriptionByUs };

    const menuPanel = await waitForTranscriptPanel(5000);
    log("openTranscriptPanel: menu route result", { opened: Boolean(menuPanel) });
    return { opened: Boolean(menuPanel), expandedDescriptionByUs };
  }

  function clickShowTranscriptTrigger() {
    const inline = document.querySelector(
      "ytd-video-description-transcript-section-renderer button"
    );
    log("clickShowTranscriptTrigger: inline button present", {
      found: Boolean(inline),
      visible: isElementVisible(inline),
    });
    if (isElementVisible(inline)) {
      log("clickShowTranscriptTrigger: inline transcript button");
      inline.click();
      return true;
    }

    const candidates = Array.from(
      document.querySelectorAll("button, [role='button']")
    );
    log("clickShowTranscriptTrigger: scanning generic candidates", {
      candidateCount: candidates.length,
    });
    const trigger = candidates.find((el) => {
      if (!isElementVisible(el)) return false;
      const label = getElementLabel(el);
      return /show\s+transcript/i.test(label);
    });

    if (!trigger) {
      logWarn("clickShowTranscriptTrigger: no matching trigger found");
      return false;
    }
    log("clickShowTranscriptTrigger: generic transcript trigger", {
      tagName: trigger.tagName,
      label: getElementLabel(trigger),
    });
    trigger.click();
    return true;
  }

  function expandDescriptionIfCollapsed() {
    if (isDescriptionExpanded()) {
      log("expandDescriptionIfCollapsed: already expanded");
      return false;
    }

    for (const selector of DESCRIPTION_EXPAND_SELECTORS) {
      const button = document.querySelector(selector);
      log("expandDescriptionIfCollapsed: candidate evaluated", {
        selector,
        found: Boolean(button),
        visible: isElementVisible(button),
      });
      if (!isElementVisible(button)) continue;
      log("expandDescriptionIfCollapsed: clicked expand", { selector });
      button.click();
      return true;
    }

    log("expandDescriptionIfCollapsed: no visible expand button");
    return false;
  }

  function collapseDescriptionIfExpanded() {
    if (!isDescriptionExpanded()) {
      log("collapseDescriptionIfExpanded: description already collapsed");
      return false;
    }

    for (const selector of DESCRIPTION_COLLAPSE_SELECTORS) {
      const button = document.querySelector(selector);
      log("collapseDescriptionIfExpanded: candidate evaluated", {
        selector,
        found: Boolean(button),
        visible: isElementVisible(button),
      });
      if (!isElementVisible(button)) continue;
      log("collapseDescriptionIfExpanded: clicked collapse", { selector });
      button.click();
      return true;
    }

    const fallback = findVisibleButtonByLabel(/show\s+less|collapse|\bless\b/i);
    if (fallback) {
      log("collapseDescriptionIfExpanded: clicked fallback label button", {
        tagName: fallback.tagName,
        label: getElementLabel(fallback),
      });
      fallback.click();
      return true;
    }

    logWarn("collapseDescriptionIfExpanded: no visible collapse button");
    return false;
  }

  function isDescriptionExpanded() {
    const expandedNode = document.querySelector(
      "ytd-watch-metadata ytd-text-inline-expander[is-expanded]"
    );
    if (expandedNode) {
      log("isDescriptionExpanded: true via [is-expanded]");
      return true;
    }

    for (const selector of DESCRIPTION_COLLAPSE_SELECTORS) {
      const button = document.querySelector(selector);
      if (isElementVisible(button)) {
        log("isDescriptionExpanded: true via collapse button", { selector });
        return true;
      }
    }

    const lessButton = findVisibleButtonByLabel(/show\s+less|\bless\b/i);
    if (lessButton) {
      log("isDescriptionExpanded: true via less button label", {
        label: getElementLabel(lessButton),
      });
      return true;
    }
    log("isDescriptionExpanded: false");
    return false;
  }

  async function openDescriptionActionsMenu() {
    const selectorCandidates = [
      "#description-inline-expander #menu button",
      "ytd-watch-metadata #menu button",
      "ytd-watch-metadata ytd-menu-renderer button",
    ];
    for (const selector of selectorCandidates) {
      const button = document.querySelector(selector);
      log("openDescriptionActionsMenu: selector candidate evaluated", {
        selector,
        found: Boolean(button),
        visible: isElementVisible(button),
      });
      if (isElementVisible(button)) {
        log("openDescriptionActionsMenu: clicked selector candidate", { selector });
        button.click();
        await sleep(180);
        return true;
      }
    }

    const buttons = Array.from(
      document.querySelectorAll("ytd-watch-metadata button, #description button")
    );
    log("openDescriptionActionsMenu: fallback button scan", {
      buttonCount: buttons.length,
    });
    const menuButton = buttons.find((button) => {
      if (!isElementVisible(button)) return false;
      const label = getElementLabel(button);
      return /more\s+actions|actions\s+menu|\bmore\b/i.test(label);
    });

    if (!menuButton) {
      logWarn("openDescriptionActionsMenu: no menu button found");
      return false;
    }
    log("openDescriptionActionsMenu: clicked labeled menu button");
    menuButton.click();
    await sleep(180);
    return true;
  }

  function clickShowTranscriptMenuItem() {
    const items = Array.from(
      document.querySelectorAll(
        "ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item, [role='menuitem']"
      )
    );
    log("clickShowTranscriptMenuItem: menu item scan", {
      itemCount: items.length,
    });

    const item = items.find((el) => {
      if (!isElementVisible(el)) return false;
      return /transcript/i.test(getElementLabel(el));
    });
    if (!item) {
      logWarn("clickShowTranscriptMenuItem: transcript menu item not found");
      return false;
    }

    const clickable = item.querySelector("button") || item;
    log("clickShowTranscriptMenuItem: clicked transcript menu item", {
      tagName: clickable.tagName,
      label: getElementLabel(clickable),
    });
    clickable.click();
    return true;
  }

  function getElementLabel(el) {
    if (!el || typeof el !== "object") return "";
    return (
      el.getAttribute?.("aria-label") ||
      el.getAttribute?.("title") ||
      el.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function findVisibleButtonByLabel(regex) {
    const candidates = Array.from(
      document.querySelectorAll("button, [role='button'], yt-button-shape button")
    );
    for (const candidate of candidates) {
      if (!isElementVisible(candidate)) continue;
      const label = getElementLabel(candidate);
      if (regex.test(label)) return candidate;
    }
    return null;
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return Boolean(el.offsetParent || el.getClientRects().length);
  }

  function waitForTranscriptPanel(timeoutMs) {
    log("waitForTranscriptPanel: waiting", { timeoutMs });
    return waitFor(
      () => (isTranscriptPanelVisible() ? document.querySelector(PANEL_SELECTOR) : null),
      timeoutMs
    );
  }

  function closeTranscriptPanel() {
    const panel = document.querySelector(PANEL_SELECTOR);
    if (!panel) {
      logWarn("closeTranscriptPanel: panel not found");
      return;
    }
    const closeButton =
      panel.querySelector('button[aria-label="Close transcript"]') ||
      panel.querySelector('button[aria-label="Close"]') ||
      panel.querySelector(
        'ytd-engagement-panel-title-header-renderer yt-button-shape button'
      );
    if (closeButton) {
      log("closeTranscriptPanel: clicked close");
      closeButton.click();
    } else {
      logWarn("closeTranscriptPanel: no close button found");
    }
  }

  function waitForSegments(panel, timeoutMs) {
    log("waitForSegments: waiting", { timeoutMs });
    return waitFor(() => {
      const found = panel.querySelectorAll(SEGMENT_SELECTOR);
      return found.length ? Array.from(found) : null;
    }, timeoutMs);
  }

  // Long videos virtualize the segment list. Scroll the container
  // until the segment count stabilizes so we capture every line.
  async function loadAllSegments(panel) {
    const container =
      panel.querySelector("#segments-container") ||
      panel.querySelector("ytd-transcript-segment-list-renderer");
    if (!container) {
      logWarn("loadAllSegments: no container found");
      return;
    }

    let lastCount = -1;
    for (let i = 0; i < 40; i++) {
      const count = panel.querySelectorAll(SEGMENT_SELECTOR).length;
      log("loadAllSegments: iteration", {
        iteration: i,
        count,
        lastCount,
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      });
      if (count === lastCount) {
        log("loadAllSegments: segment count stabilized", { iteration: i, count });
        break;
      }
      lastCount = count;
      container.scrollTop = container.scrollHeight;
      await sleep(150);
    }
    log("loadAllSegments: reset scroll to top");
    container.scrollTop = 0;
  }

  function segmentsToText(segments) {
    const lines = [];
    log("segmentsToText: start", { segmentCount: segments.length });
    for (const segment of segments) {
      const textEl =
        segment.querySelector(".segment-text") ||
        segment.querySelector("yt-formatted-string.segment-text") ||
        segment.querySelector("yt-formatted-string");
      const raw = textEl?.textContent ?? segment.textContent ?? "";
      const cleaned = raw.replace(/\s+/g, " ").trim();
      if (!cleaned) {
        log("segmentsToText: skipped empty cleaned line");
        continue;
      }
      if (lines[lines.length - 1] === cleaned) {
        log("segmentsToText: skipped adjacent duplicate", { line: cleaned.slice(0, 80) });
        continue;
      }
      lines.push(cleaned);
    }
    log("segmentsToText: built transcript lines", { lines: lines.length });
    return lines.join("\n").trim();
  }

  function waitFor(predicate, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      let attempts = 0;
      const tick = () => {
        attempts += 1;
        let result = null;
        try {
          result = predicate();
        } catch (error) {
          logWarn("waitFor: predicate threw", {
            attempts,
            error: error instanceof Error ? error.message : String(error),
          });
          result = null;
        }
        if (result) {
          log("waitFor: resolved with result", {
            attempts,
            elapsedMs: Date.now() - start,
          });
          resolve(result);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          logWarn("waitFor: timed out", {
            attempts,
            elapsedMs: Date.now() - start,
            timeoutMs,
          });
          resolve(null);
          return;
        }
        log("waitFor: tick without result", {
          attempts,
          elapsedMs: Date.now() - start,
          timeoutMs,
        });
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function forceViewportTop(reason) {
    const beforeX = window.scrollX;
    const beforeY = window.scrollY;
    if (beforeX !== 0 || beforeY !== 0) {
      log("forceViewportTop: scrolling to top", {
        reason,
        beforeX,
        beforeY,
      });
    }
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  function beginViewportTopLock() {
    log("beginViewportTopLock");
    let active = true;
    let userOverride = false;
    let rafId = 0;
    let intervalId = 0;
    let postIntervalId = 0;

    const onScroll = () => {
      if (!active) return;
      forceViewportTop("scroll event");
    };

    const isScrollKey = (event) => {
      const key = event?.key || "";
      return (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "PageUp" ||
        key === "PageDown" ||
        key === "Home" ||
        key === "End" ||
        key === " " ||
        key === "Spacebar"
      );
    };

    const removePrimaryScrollListeners = () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
    };

    const removeUserIntentListeners = () => {
      window.removeEventListener("wheel", onUserWheel, { capture: true });
      window.removeEventListener("touchmove", onUserTouchMove, { capture: true });
      window.removeEventListener("keydown", onUserKeydown, { capture: true });
    };

    const stopActiveLock = (reason) => {
      if (!active) return;
      active = false;
      removePrimaryScrollListeners();
      log("beginViewportTopLock: stopped", { reason, userOverride });
    };

    const stopPostLock = (reason) => {
      if (postIntervalId) {
        window.clearInterval(postIntervalId);
        postIntervalId = 0;
      }
      removeUserIntentListeners();
      log("beginViewportTopLock: post lock stopped", { reason, userOverride });
    };

    const onUserWheel = () => {
      userOverride = true;
      stopActiveLock("manual wheel");
      stopPostLock("manual wheel");
    };

    const onUserTouchMove = () => {
      userOverride = true;
      stopActiveLock("manual touchmove");
      stopPostLock("manual touchmove");
    };

    const onUserKeydown = (event) => {
      if (!isScrollKey(event)) return;
      userOverride = true;
      stopActiveLock("manual key scroll");
      stopPostLock("manual key scroll");
    };

    const rafTick = () => {
      if (!active) return;
      forceViewportTop("raf tick");
      rafId = window.requestAnimationFrame(rafTick);
    };

    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("wheel", onUserWheel, { capture: true, passive: true });
    window.addEventListener("touchmove", onUserTouchMove, { capture: true, passive: true });
    window.addEventListener("keydown", onUserKeydown, { capture: true });

    forceViewportTop("begin lock");
    rafId = window.requestAnimationFrame(rafTick);
    intervalId = window.setInterval(() => {
      forceViewportTop("lock tick");
    }, 25);

    return {
      release(reason) {
        stopActiveLock(`${reason} release`);
        if (userOverride) {
          log("beginViewportTopLock: release skipped post-lock due to user override");
          stopPostLock("release after user override");
          return;
        }
        forceViewportTop(`${reason} immediate`);

        // Keep forcing top while the transcript panel is visible, then do
        // a few extra "scroll up" pulses after it hides.
        let postTicks = 0;
        let postHiddenTicks = 0;
        let panelHasHidden = false;
        postIntervalId = window.setInterval(() => {
          if (userOverride) {
            stopPostLock("user override during post lock");
            return;
          }

          const stillVisible = isTranscriptPanelVisible();
          if (!stillVisible) {
            if (!panelHasHidden) {
              panelHasHidden = true;
              log("beginViewportTopLock: panel hidden, entering extra top pulses");
            }
            postHiddenTicks += 1;
            forceViewportTop(`${reason} post hidden pulse ${postHiddenTicks}`);
            if (postHiddenTicks >= 20) {
              stopPostLock("post hidden extra pulses completed");
            }
            return;
          }

          postTicks += 1;
          forceViewportTop(`${reason} post lock ${postTicks}`);
          if (postTicks >= 60) {
            stopPostLock("post lock timeout");
            log("beginViewportTopLock: post lock timeout", { postTicks });
          }
        }, 80);
      },
    };
  }

  function log(_message, _details) {}

  function logWarn(_message, _details) {}

  function logError(_message, _error) {}
})();
