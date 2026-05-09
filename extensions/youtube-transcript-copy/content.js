// YouTube Transcript Copy v0.2.0
// Tries YouTube's internal transcript endpoint first, then falls back to timedtext tracks.
(() => {
  if (window.__vpackYoutubeTranscriptCopyLoaded) return;
  window.__vpackYoutubeTranscriptCopyLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "getYoutubeTranscript") return;

    getYoutubeTranscriptText()
      .then((transcript) => sendResponse({ ok: true, transcript }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Failed to get transcript.",
        });
      });

    return true;
  });

  async function getYoutubeTranscriptText() {
    const videoId = getVideoIdFromUrl(window.location.href);
    if (!videoId) {
      throw new Error("Open a YouTube watch or Shorts page first.");
    }

    const innertubeTranscript = await tryGetTranscriptViaInnertube(videoId);
    if (innertubeTranscript) return innertubeTranscript;

    const timedtextTranscript = await tryGetTranscriptViaTimedtext(videoId);
    if (timedtextTranscript) return timedtextTranscript;

    throw new Error("No transcript is available for this video.");
  }

  async function tryGetTranscriptViaInnertube(videoId) {
    const currentHtml = document.documentElement?.innerHTML || "";
    const sources = [currentHtml];

    const watchHtml = await tryFetchWatchPageHtml(videoId);
    if (watchHtml && watchHtml !== currentHtml) sources.push(watchHtml);

    for (const html of sources) {
      const metadata = extractInnertubeMetadata(html);
      if (!metadata) continue;

      const transcript = await fetchTranscriptFromInnertube(metadata);
      if (transcript) return transcript;
    }

    return "";
  }

  async function tryGetTranscriptViaTimedtext(videoId) {
    const currentHtml = document.documentElement?.innerHTML || "";
    const sources = [currentHtml];

    const watchHtml = await tryFetchWatchPageHtml(videoId);
    if (watchHtml && watchHtml !== currentHtml) sources.push(watchHtml);

    for (const html of sources) {
      const playerResponse = tryExtractPlayerResponse(html);
      const tracks =
        playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) continue;

      const rankedTracks = pickTracksInPriorityOrder(tracks);
      for (const track of rankedTracks) {
        if (!track?.baseUrl) continue;

        const transcriptJson = await fetchTranscriptJson(track.baseUrl);
        if (transcriptJson) {
          const transcript = toTranscriptText(transcriptJson);
          if (transcript) return transcript;
        }

        const transcriptXml = await fetchTranscriptXml(track.baseUrl);
        if (transcriptXml) {
          const transcript = toTranscriptTextFromXml(transcriptXml);
          if (transcript) return transcript;
        }
      }
    }

    return "";
  }

  function extractInnertubeMetadata(html) {
    if (!html) return null;

    const apiKey = decodeEscapedInlineString(
      extractRegexGroup(html, /"INNERTUBE_API_KEY":"([^"]+)"/)
    );
    const clientName = extractRegexGroup(
      html,
      /"INNERTUBE_CONTEXT_CLIENT_NAME":(\d+)/
    );
    const clientVersion = decodeEscapedInlineString(
      extractRegexGroup(html, /"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)
    );
    const transcriptParams = decodeEscapedInlineString(
      extractRegexGroup(html, /"getTranscriptEndpoint":\{"params":"([^"]+)"\}/)
    );
    const context = extractJsonObjectAfterToken(html, '"INNERTUBE_CONTEXT":');

    if (!apiKey || !transcriptParams || !context) return null;

    return {
      apiKey,
      clientName,
      clientVersion,
      context,
      transcriptParams,
    };
  }

  async function fetchTranscriptFromInnertube(metadata) {
    const endpoint =
      `/youtubei/v1/get_transcript?prettyPrint=false&key=${encodeURIComponent(metadata.apiKey)}`;

    const headers = {
      "Content-Type": "application/json",
    };

    if (metadata.clientName) {
      headers["X-Youtube-Client-Name"] = metadata.clientName;
    }
    if (metadata.clientVersion) {
      headers["X-Youtube-Client-Version"] = metadata.clientVersion;
    }

    const visitorData = metadata.context?.client?.visitorData;
    if (typeof visitorData === "string" && visitorData) {
      headers["X-Goog-Visitor-Id"] = visitorData;
    }

    const paramsCandidates = uniqueValues([
      metadata.transcriptParams,
      safeDecodeURIComponent(metadata.transcriptParams),
    ]);

    for (const params of paramsCandidates) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            context: metadata.context,
            params,
          }),
        });
        if (!response.ok) continue;

        const payload = await response.json();
        const transcript = toTranscriptTextFromInnertube(payload);
        if (transcript) return transcript;
      } catch {
        // Try next variant.
      }
    }

    return "";
  }

  function toTranscriptTextFromInnertube(payload) {
    const lines = [];
    collectCueLines(payload, lines);
    return lines.join("\n").trim();
  }

  function collectCueLines(node, lines) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) collectCueLines(item, lines);
      return;
    }

    if (
      node.transcriptCueRenderer &&
      typeof node.transcriptCueRenderer === "object"
    ) {
      const cueText = extractText(
        node.transcriptCueRenderer.cue || node.transcriptCueRenderer
      );
      pushLine(lines, cueText);
    }

    for (const value of Object.values(node)) {
      collectCueLines(value, lines);
    }
  }

  function extractText(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value !== "object") return "";

    if (typeof value.simpleText === "string") return value.simpleText;
    if (Array.isArray(value.runs)) {
      return value.runs
        .map((run) => (typeof run?.text === "string" ? run.text : ""))
        .join("");
    }
    if (value.cue) return extractText(value.cue);
    return "";
  }

  function tryExtractPlayerResponse(html) {
    try {
      return extractPlayerResponse(html);
    } catch {
      return null;
    }
  }

  function extractPlayerResponse(html) {
    const assignmentTokens = [
      "ytInitialPlayerResponse =",
      "var ytInitialPlayerResponse =",
      "window['ytInitialPlayerResponse'] =",
      'window["ytInitialPlayerResponse"] =',
    ];

    for (const token of assignmentTokens) {
      const tokenIndex = html.indexOf(token);
      if (tokenIndex === -1) continue;

      const objectStart = html.indexOf("{", tokenIndex);
      if (objectStart === -1) continue;

      const jsonText = sliceBalancedJsonObject(html, objectStart);
      if (!jsonText) continue;

      try {
        return JSON.parse(jsonText);
      } catch {
        // Keep searching.
      }
    }

    throw new Error("Could not read transcript metadata from YouTube.");
  }

  function pickTracksInPriorityOrder(tracks) {
    const preferredLang = normalizeLanguageCode(navigator.language || "");
    return [...tracks].sort(
      (a, b) => scoreTrack(b, preferredLang) - scoreTrack(a, preferredLang)
    );
  }

  function normalizeLanguageCode(code) {
    return String(code || "").toLowerCase();
  }

  function baseLanguage(code) {
    return normalizeLanguageCode(code).split("-")[0];
  }

  function scoreTrack(track, preferredLang) {
    const trackLang = normalizeLanguageCode(track.languageCode || "");
    const preferredBase = baseLanguage(preferredLang);
    const trackBase = baseLanguage(trackLang);

    let score = 0;
    if (track.kind !== "asr") score += 25;
    if (trackLang === preferredLang && trackLang) score += 80;
    else if (preferredBase && trackBase === preferredBase) score += 55;
    if (trackBase === "en") score += 10;
    if (track.isTranslatable) score += 1;
    return score;
  }

  async function fetchTranscriptJson(baseUrl) {
    const transcriptUrl = setQueryParam(baseUrl, "fmt", "json3");

    for (const credentials of ["include", "omit"]) {
      try {
        const response = await fetch(transcriptUrl, { credentials });
        if (!response.ok) continue;

        const bodyText = await response.text();
        if (!bodyText.trim()) continue;

        const payload = JSON.parse(bodyText);
        if (Array.isArray(payload?.events)) return payload;
      } catch {
        // Try next credentials mode.
      }
    }

    return null;
  }

  async function fetchTranscriptXml(baseUrl) {
    const xmlUrl = removeQueryParam(baseUrl, "fmt");

    for (const credentials of ["include", "omit"]) {
      try {
        const response = await fetch(xmlUrl, { credentials });
        if (!response.ok) continue;

        const bodyText = await response.text();
        if (!bodyText.trim()) continue;
        if (!bodyText.includes("<transcript")) continue;
        return bodyText;
      } catch {
        // Try next credentials mode.
      }
    }

    return "";
  }

  function toTranscriptText(transcriptJson) {
    const events = transcriptJson?.events;
    if (!Array.isArray(events)) return "";

    const lines = [];
    for (const event of events) {
      if (!Array.isArray(event?.segs)) continue;

      const line = event.segs
        .map((seg) => (typeof seg?.utf8 === "string" ? seg.utf8 : ""))
        .join("");

      pushLine(lines, line);
    }

    return lines.join("\n").trim();
  }

  function toTranscriptTextFromXml(xmlText) {
    try {
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      const nodes = Array.from(doc.getElementsByTagName("text"));
      if (!nodes.length) return "";

      const lines = [];
      for (const node of nodes) {
        pushLine(lines, node.textContent || "");
      }
      return lines.join("\n").trim();
    } catch {
      return "";
    }
  }

  function pushLine(lines, rawLine) {
    const line = String(rawLine || "").replace(/\s+/g, " ").trim();
    if (!line) return;
    if (lines[lines.length - 1] === line) return;
    lines.push(line);
  }

  function extractRegexGroup(text, regex) {
    const match = text.match(regex);
    return match ? match[1] : "";
  }

  function extractJsonObjectAfterToken(text, token) {
    const tokenIndex = text.indexOf(token);
    if (tokenIndex === -1) return null;

    const objectStart = text.indexOf("{", tokenIndex + token.length);
    if (objectStart === -1) return null;

    const jsonText = sliceBalancedJsonObject(text, objectStart);
    if (!jsonText) return null;

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }

  function sliceBalancedJsonObject(text, startIndex) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) return text.slice(startIndex, i + 1);
      }
    }

    return null;
  }

  function decodeEscapedInlineString(value) {
    return String(value || "")
      .replaceAll("\\u0026", "&")
      .replaceAll("\\u003d", "=")
      .replaceAll("\\u0025", "%")
      .replaceAll("\\/", "/");
  }

  function safeDecodeURIComponent(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return "";
    }
  }

  function uniqueValues(values) {
    return [...new Set(values.filter((value) => typeof value === "string" && value))];
  }

  async function tryFetchWatchPageHtml(videoId) {
    try {
      return await fetchWatchPageHtml(videoId);
    } catch {
      return "";
    }
  }

  async function fetchWatchPageHtml(videoId) {
    const watchUrl =
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` +
      `&hl=${encodeURIComponent(navigator.language || "en")}`;

    const response = await fetch(watchUrl, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Failed to load YouTube video metadata.");
    }
    return response.text();
  }

  function removeQueryParam(url, key) {
    const parsed = new URL(url);
    parsed.searchParams.delete(key);
    return parsed.toString();
  }

  function setQueryParam(url, key, value) {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  }

  function getVideoIdFromUrl(rawUrl) {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return null;
    }

    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const vParam = parsed.searchParams.get("v");
      if (isLikelyVideoId(vParam)) return vParam;

      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch && isLikelyVideoId(shortsMatch[1])) return shortsMatch[1];

      const embedMatch = parsed.pathname.match(/^\/embed\/([^/?#]+)/);
      if (embedMatch && isLikelyVideoId(embedMatch[1])) return embedMatch[1];
    }

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (isLikelyVideoId(id)) return id;
    }

    return null;
  }

  function isLikelyVideoId(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
  }
})();
