import puppeteer from "puppeteer-core";
const exe = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b = await puppeteer.launch({ executablePath: exe, headless: "shell", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
await p.goto("http://localhost:8099/", { waitUntil: "networkidle0" });
const info = await p.evaluate(() => {
  const a = [...document.querySelectorAll("a")].find(x => x.textContent.includes("Start with the ECG viewer"));
  if (!a) return { found: false };
  const cs = getComputedStyle(a);
  const r = a.getBoundingClientRect();
  return {
    found: true,
    text: a.textContent.trim(),
    color: cs.color,
    background: cs.backgroundColor,
    fontSize: cs.fontSize,
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    childColors: [...a.childNodes].map(n => n.nodeType === 3 ? "text:" + n.textContent.trim() : n.nodeName),
  };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
