// geohot-blog-dark v0.1.0
const style = document.createElement("style");
style.textContent = `
  body { background: #1a1a1a !important; color: #a8a8a8 !important; }
  .site-header, .site-footer { background: #1a1a1a !important; border-color: #333 !important; }
  .site-title, .site-title:visited { color: #a8a8a8 !important; }
  .page-link { color: #a8a8a8 !important; }
  .post-title, h1, h2, h3, h4, h5, h6 { color: #c0c0c0 !important; }
  .post-meta { color: #666 !important; }
  a { color: #8a9ab8 !important; }
  a:visited { color: #9a8ab0 !important; }
  blockquote { border-left-color: #444 !important; color: #888 !important; background: #222 !important; }
  hr { border-color: #333 !important; }
  code, pre { background: #2d2d2d !important; color: #a8a8a8 !important; }
  .wrapper { background: #1a1a1a !important; }
`;
document.head.appendChild(style);
