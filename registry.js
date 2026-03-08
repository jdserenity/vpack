const EXTENSIONS = [
  {
    id: "geohot-blog-dark",
    name: "Geohot Blog Dark Mode",
    description: "Dark mode for geohot.github.io/blog.",
    version: "0.1.0",
    matches: ["https://geohot.github.io/blog/*"],
    contentScript: "extensions/geohot-blog-dark/content.js",
  },
  {
    id: "hn-auto-collapse",
    name: "HN Auto Collapse",
    description: "Auto-collapses Hacker News comments, showing the first 5 top-level comments and their first reply.",
    version: "0.0.3",
    matches: ["https://news.ycombinator.com/item*"],
    contentScript: "extensions/hn-auto-collapse/content.js",
  },
  {
    id: "youtube-speed-hotkeys",
    name: "YouTube Speed Hotkeys",
    description: "Use two custom hotkeys to adjust YouTube playback speed by 0.05.",
    version: "0.1.0",
    matches: [
      "https://www.youtube.com/*",
      "https://youtube.com/*",
      "https://m.youtube.com/*",
    ],
    contentScript: "extensions/youtube-speed-hotkeys/content.js",
    settings: [
      {
        key: "hotkeyFaster",
        label: "Faster",
        defaultValue: "Command+Shift+Period",
        placeholder: "Command+Shift+Period",
      },
      {
        key: "hotkeySlower",
        label: "Slower",
        defaultValue: "Command+Shift+Comma",
        placeholder: "Command+Shift+Comma",
      },
    ],
  },
];
