const fs = require('fs');

const appJs  = fs.readFileSync('app.js',  'utf8');
const hlsCss = fs.readFileSync('node_modules/highlight.js/styles/atom-one-dark.min.css', 'utf8');

const css = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d0d10;--surf:#15151a;--surf2:#1c1c23;--border:#252530;--accent:#7c6af7;--text:#dddaf0;--muted:#55526b}
html,body{height:100%;overflow:hidden;background:var(--bg);font-family:'Segoe UI',system-ui,sans-serif;color:var(--text);font-size:13px}
#titlebar{position:fixed;top:0;left:0;right:0;height:34px;background:var(--surf);border-bottom:1px solid var(--border);display:flex;align-items:center;padding-left:10px;gap:8px;z-index:9999;-webkit-app-region:drag;user-select:none}
#app-name{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;flex:1}
.tbtn{-webkit-app-region:no-drag;background:none;border:1px solid var(--border);color:var(--muted);font-size:10px;font-weight:600;padding:2px 9px;border-radius:4px;cursor:pointer;letter-spacing:.04em;transition:all .15s}
.tbtn:hover{background:var(--border);color:var(--text)}.tbtn.on{background:var(--accent);border-color:var(--accent);color:#fff}
.win-controls{display:flex;-webkit-app-region:no-drag;margin-left:6px}
.win-btn{width:44px;height:34px;background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,color .1s;flex-shrink:0}
.win-btn:hover{background:rgba(255,255,255,.08);color:var(--text)}
.win-close:hover{background:#c42b1c;color:#fff}
#viewport{position:fixed;top:34px;left:0;right:0;bottom:0;overflow:hidden;cursor:default;background-image:radial-gradient(circle,#272737 1px,transparent 1px);background-size:26px 26px}
#canvas{position:absolute;width:0;height:0}
#hint{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);font-size:10px;color:var(--muted);letter-spacing:.05em;pointer-events:none;white-space:nowrap;opacity:.7;transition:opacity .4s}
#hint.gone{opacity:0}
.card{position:absolute;width:400px;background:var(--surf);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;min-width:180px;min-height:60px;transition:box-shadow .18s}
.card:hover{box-shadow:0 12px 48px rgba(0,0,0,.75),0 0 0 1px var(--accent)}
.card-hd{display:flex;align-items:center;gap:5px;padding:6px 9px;background:var(--surf2);border-bottom:1px solid var(--border);cursor:grab;flex-shrink:0}
.card-hd:active{cursor:grabbing}
.badge{font-size:9px;font-weight:800;letter-spacing:.07em;padding:2px 6px;border-radius:3px;color:#fff;flex-shrink:0}
.card-meta{font-size:10px;color:var(--muted);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cbtn{background:none;border:none;color:var(--muted);cursor:pointer;padding:2px 5px;border-radius:3px;font-size:13px;line-height:1;transition:all .1s;-webkit-app-region:no-drag;flex-shrink:0}
.cbtn:hover{background:var(--border);color:var(--text)}.cbtn.on{color:#a78bfa}
.card-bd{overflow-y:auto;overflow-x:hidden;flex:1;user-select:text;max-height:calc(100vh - 120px)}
.card-bd pre{margin:0;padding:11px 13px;background:transparent!important;font-family:'Cascadia Code','Consolas','JetBrains Mono',monospace;font-size:12px;line-height:1.62;white-space:pre-wrap;word-break:break-all}
.card-bd .hljs{background:transparent!important;padding:0}
.card-bd textarea{width:100%;min-height:160px;background:var(--surf);border:none;color:var(--text);padding:11px 13px;resize:none;outline:none;font-family:'Cascadia Code','Consolas',monospace;font-size:12px;line-height:1.62;display:block;user-select:text}
.mdv{padding:14px 16px;line-height:1.75;font-size:13px}
.mdv h1{font-size:1.4em;color:#a78bfa;border-bottom:1px solid var(--border);padding-bottom:4px;margin:0 0 10px}
.mdv h2{font-size:1.15em;margin:14px 0 5px}.mdv h3{font-size:1em;color:var(--muted);margin:10px 0 4px}
.mdv p{margin:5px 0}.mdv a{color:#a78bfa}
.mdv code{font-family:'Cascadia Code','Consolas',monospace;font-size:.85em;background:var(--surf2);border:1px solid var(--border);border-radius:3px;padding:.1em .3em;color:#e879f9}
.mdv pre{background:var(--surf2)!important;border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin:8px 0;overflow-x:auto}
.mdv pre code{background:none;border:none;color:var(--text);padding:0}
.mdv ul,.mdv ol{padding-left:18px;margin:5px 0}.mdv li{margin:3px 0}
.mdv blockquote{border-left:3px solid var(--accent);padding:4px 10px;color:var(--muted);background:var(--surf2);border-radius:0 4px 4px 0;margin:7px 0}
.mdv table{width:100%;border-collapse:collapse;margin:7px 0;font-size:12px}
.mdv th,.mdv td{border:1px solid var(--border);padding:5px 10px}
.mdv th{background:var(--surf2);color:#a78bfa}.mdv tr:nth-child(even){background:rgba(255,255,255,.02)}
.mdv hr{border:none;border-top:1px solid var(--border);margin:12px 0}.mdv img{max-width:100%;border-radius:6px}
.mdv strong{color:var(--text)}.mdv em{color:#c4b5fd}
.mermaid-wrap{background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:14px;margin:8px 0;overflow-x:auto;text-align:center}
.mermaid-wrap svg{max-width:100%}
.mermaid-err{color:#ff5f57;font-size:11px;font-family:monospace;white-space:pre-wrap;padding:8px}
.rh{position:absolute;bottom:0;right:0;width:18px;height:18px;cursor:se-resize;opacity:0;transition:opacity .2s;background:linear-gradient(135deg,transparent 55%,var(--muted) 55%)}
.card:hover .rh{opacity:1}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--muted)}
`.trim();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MDway</title>
<style>${hlsCss}</style>
<style>${css}</style>
<!-- Hide Node globals so mermaid loads as a browser lib -->
<script>window.__nm=window.module;window.__ne=window.exports;delete window.module;delete window.exports;<\/script>
<script src="node_modules/mermaid/dist/mermaid.min.js"><\/script>
<script>window.module=window.__nm;window.exports=window.__ne;<\/script>
<script>
  if(typeof mermaid!=='undefined'){
    mermaid.initialize({startOnLoad:false,theme:'dark',securityLevel:'loose',
      fontFamily:"'Cascadia Code','Consolas',monospace",
      themeVariables:{darkMode:true,background:'#1c1c23',primaryColor:'#7c6af7',
        primaryTextColor:'#dddaf0',primaryBorderColor:'#252530',
        lineColor:'#a78bfa',secondaryColor:'#15151a',tertiaryColor:'#252530'}});
  }
<\/script>
</head>
<body>

<div id="titlebar">
  <span id="app-name">mdway</span>
  <button class="tbtn on" id="btn-pin">&#128204; pinned</button>
  <button class="tbtn" id="btn-clear">clear all</button>
  <div class="win-controls">
    <button class="win-btn" id="btn-min">&#x2015;</button>
    <button class="win-btn win-close" id="btn-close">&#x2715;</button>
  </div>
</div>

<div id="viewport"><div id="canvas"></div></div>
<div id="hint">Ctrl+V &mdash; new card &nbsp;&middot;&nbsp; drag header &mdash; move &nbsp;&middot;&nbsp; scroll &mdash; pan canvas</div>

<script>${appJs}<\/script>
</body>
</html>`;

fs.writeFileSync('index.html', html, 'utf8');
console.log('OK — ' + html.length + ' bytes');
