// Dupe Detective results page. Every number comes from results.json,
// which build_site_data.py makes from my analysis results.
document.documentElement.classList.add("js");

const kr = (n) => n.toFixed(2) + " kr";
const krSigned = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2) + " kr";
const pct = (n) => Math.round(n * 1000) / 10 + "%";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Product names start with the brand (e.g. "NYX PROFESSIONAL MAKEUP Duck Plump ..."); drop it.
function productName(p) {
  const n = p.name.trim();
  return n.toLowerCase().startsWith(p.brand.toLowerCase()) ? n.slice(p.brand.length).trim() : n;
}
const brandLabel = (b) => (b === b.toUpperCase() && b.length > 4 ? b.charAt(0) + b.slice(1).toLowerCase() : b);
const leadLabel = (l, i) => `#${i + 1} ${brandLabel(l.expensive.brand)} → ${brandLabel(l.cheaper.brand)}`;

function fill(field, text) {
  document.querySelectorAll(`[data-field="${field}"]`).forEach((el) => (el.textContent = text));
}

function renderStats(d) {
  const c = d.counts;
  const items = [
    [c.raw_products, "lip gloss pages collected"],
    [c.kept_products, "products after cleaning"],
    [c.pairs_scored.toLocaleString("en-US"), "pairs compared"],
    [c.likely_dupes, "likely dupes found"],
  ];
  document.getElementById("stats").innerHTML = items
    .map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`)
    .join("");
}

function productBlock(p) {
  return `<div class="product">
    <span class="brand">${esc(brandLabel(p.brand))}</span>
    <span class="name">${esc(productName(p))}</span>
    <span class="price">${p.price.toFixed(2)} kr</span>
    <span class="per-ml">${p.price_per_ml ? p.price_per_ml.toFixed(2) + " kr per ml" : "No size in ml on Matas"}</span>
  </div>`;
}

// Two overlapping circles: shared ingredients in the middle (counts only, no ingredient names)
function venn(l) {
  return `<div class="venn">
    <svg viewBox="0 0 120 70" aria-hidden="true">
      <circle class="c1" cx="42" cy="35" r="32"></circle>
      <circle class="c2" cx="78" cy="35" r="32"></circle>
      <text x="60" y="40" text-anchor="middle">${l.shared_ingredients}</text>
    </svg>
    <p><b>${l.shared_ingredients} shared</b> of ${l.all_different_ingredients} different ingredients<br>= ${Math.round(l.score * 100)}% in common</p>
  </div>`;
}

function renderCards(d) {
  const maxGp = Math.max(...d.top3.map((l) => l.gross_profit_expensive));
  document.getElementById("cards").innerHTML = d.top3
    .map((l, i) => `<article class="card reveal">
      <div class="card-top"><span class="rank">#${i + 1}</span><span class="badge">+${l.premium_pct}% premium</span></div>
      <span class="stamp">Dupe lead</span>
      ${productBlock(l.expensive)}
      <div class="arrow">↓ cheaper alternative</div>
      ${productBlock(l.cheaper)}
      ${venn(l)}
      <div class="gp">
        <div class="meter-label"><span>Gross profit per tube</span></div>
        <div class="gp-row"><span>Expensive</span><div class="bar"><i style="width:${(l.gross_profit_expensive / maxGp) * 100}%"></i></div><b>${kr(l.gross_profit_expensive)}</b></div>
        <div class="gp-row"><span>Cheaper</span><div class="bar cheap"><i style="width:${(l.gross_profit_cheaper / maxGp) * 100}%"></i></div><b>${kr(l.gross_profit_cheaper)}</b></div>
      </div>
      <div class="card-foot"><b>${l.tubes_needed.toFixed(2)}</b> cheaper tubes replace the gross profit of one expensive tube.</div>
    </article>`)
    .join("");
}

function renderTable(d) {
  const top = new Set(d.top3.map((l) => l.pair));
  document.getElementById("all-rows").innerHTML = d.all_likely_dupes
    .map((l) => `<tr class="${top.has(l.pair) ? "top" : ""}">
      <td><span class="pill">${Math.round(l.score * 100)}%</span></td>
      <td>${esc(brandLabel(l.expensive.brand))}<span class="sub">${esc(productName(l.expensive))} · ${l.expensive.price.toFixed(2)} kr</span></td>
      <td>${esc(brandLabel(l.cheaper.brand))}<span class="sub">${esc(productName(l.cheaper))} · ${l.cheaper.price.toFixed(2)} kr</span></td>
      <td class="num">${l.premium_pct > 0 ? "+" : ""}${l.premium_pct}%</td>
      <td class="num">${l.tubes_needed.toFixed(2)}</td>
    </tr>`)
    .join("");
}

// ---- The customer's view: savings vs Matas's gross profit ----
function setupSave(d) {
  const select = document.getElementById("save-lead");
  const n = document.getElementById("save-n");
  select.innerHTML = d.top3.map((l, i) => `<option value="${i}">${esc(leadLabel(l, i))}</option>`).join("");
  function update() {
    const l = d.top3[Number(select.value)];
    const tubes = Number(n.value);
    document.getElementById("save-n-out").textContent = tubes;
    document.getElementById("save-customer").textContent = kr((l.expensive.price - l.cheaper.price) * tubes);
    document.getElementById("save-switch").textContent = krSigned((l.gross_profit_cheaper - l.gross_profit_expensive) * tubes);
    document.getElementById("save-lost").textContent = krSigned(-l.gross_profit_expensive * tubes);
  }
  [select, n].forEach((el) => el.addEventListener("input", update));
  update();
}

// ---- Try the margins (with a sparkle at break-even) ----
function setupTry(d) {
  const select = document.getElementById("lead-select");
  const mExp = document.getElementById("m-exp");
  const mChp = document.getElementById("m-chp");
  const group = Math.round(d.group_margin * 100);
  select.innerHTML = d.top3.map((l, i) => `<option value="${i}">${esc(leadLabel(l, i))}</option>`).join("");

  function update() {
    const l = d.top3[Number(select.value)];
    const gpExp = l.expensive.price_excl_vat * (Number(mExp.value) / 100);
    const gpChp = l.cheaper.price_excl_vat * (Number(mChp.value) / 100);
    const tubes = gpExp / gpChp;
    document.getElementById("m-exp-out").textContent = mExp.value + "%";
    document.getElementById("m-chp-out").textContent = mChp.value + "%";
    document.getElementById("tubes").textContent = tubes.toFixed(2);
    document.getElementById("tube-detail").textContent =
      `Gross profit per tube: ${kr(gpExp)} (expensive) vs ${kr(gpChp)} (cheaper), prices without VAT.`;
    const whole = Math.floor(tubes);
    const part = tubes - whole;
    let html = "";
    for (let i = 0; i < Math.min(whole, 12); i++) html += '<span class="tube"></span>';
    if (part > 0.04 && whole < 12) html += `<span class="tube part" style="--fill:${Math.round(part * 100)}%"></span>`;
    document.getElementById("tube-row").innerHTML = html;
    document.getElementById("sparkle-msg").hidden = tubes > 1.0;
  }

  [select, mExp, mChp].forEach((el) => el.addEventListener("input", update));
  document.getElementById("reset").addEventListener("click", () => {
    mExp.value = group;
    mChp.value = group;
    update();
  });
  mExp.value = group;
  mChp.value = group;
  update();
}

// ---- How rare are dupes? Histogram with a movable cut-off ----
function setupHist(d) {
  const scores = d.score_distribution;
  const W = 800, H = 260, L = 44, R = 12, T = 16, B = 34;
  const BIN = 0.02, MAXX = 0.82;
  const nBins = Math.round(MAXX / BIN);
  const counts = new Array(nBins).fill(0);
  scores.forEach((s) => counts[Math.min(nBins - 1, Math.floor(s / BIN))]++);
  const maxSqrt = Math.sqrt(Math.max(...counts));
  const x = (v) => L + (v / MAXX) * (W - L - R);
  const y = (c) => H - B - (Math.sqrt(c) / maxSqrt) * (H - T - B);
  const svg = document.getElementById("hist");
  const cut = document.getElementById("cut");
  cut.value = d.cut_off;

  function draw() {
    const c = Number(cut.value);
    let s = `<line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"></line>`;
    counts.forEach((n, i) => {
      if (!n) return;
      const x0 = x(i * BIN) + 1, x1 = x((i + 1) * BIN) - 1;
      const on = i * BIN + 1e-9 >= c ? " on" : "";
      s += `<rect class="b${on}" x="${x0}" y="${y(n)}" width="${Math.max(1, x1 - x0)}" height="${Math.max(2, H - B - y(n))}"><title>${(i * BIN).toFixed(2)}–${((i + 1) * BIN).toFixed(2)}: ${n} pairs</title></rect>`;
    });
    for (let t = 0; t <= 0.8 + 1e-9; t += 0.1) s += `<text class="lbl" x="${x(t)}" y="${H - 12}" text-anchor="middle">${t.toFixed(1)}</text>`;
    s += `<text class="lbl" x="${L - 8}" y="${y(Math.max(...counts)) + 4}" text-anchor="end">${Math.max(...counts)}</text>`;
    s += `<polygon class="mine" points="${x(d.cut_off) - 6},${T - 2} ${x(d.cut_off) + 6},${T - 2} ${x(d.cut_off)},${T + 8}"><title>My cut-off: ${d.cut_off.toFixed(2)}</title></polygon>`;
    s += `<line class="cut" x1="${x(c)}" y1="${T}" x2="${x(c)}" y2="${H - B}"></line>`;
    s += `<text class="cutlbl" x="${Math.min(x(c) + 8, W - 120)}" y="${T + 34}">cut-off ${c.toFixed(2)}</text>`;
    svg.innerHTML = s;
    const above = scores.filter((v) => v >= c - 1e-9).length;
    document.getElementById("cut-out").textContent = c.toFixed(2);
    document.getElementById("cut-count").textContent = above.toLocaleString("en-US");
    document.getElementById("cut-text").textContent =
      `of ${scores.length.toLocaleString("en-US")} pairs would count as "likely dupes" (${((above / scores.length) * 100).toFixed(1)}%).`;
  }
  cut.addEventListener("input", draw);
  draw();
}

// ---- Find a dupe ----
function setupFind(d) {
  const select = document.getElementById("find-select");
  select.innerHTML = d.best_match
    .map((p, i) => `<option value="${i}">${esc(brandLabel(p.brand))}: ${esc(productName(p))}</option>`)
    .join("");
  const start = d.best_match.findIndex((p) => p.brand.toLowerCase().startsWith("nyx"));
  if (start >= 0) select.value = start;

  function update() {
    const p = d.best_match[Number(select.value)];
    const m = p.match;
    const diff = (m.price / p.price - 1) * 100;
    const priceWord = Math.abs(diff) < 0.5 ? "the same price" : diff < 0 ? `${Math.round(-diff)}% cheaper` : `${Math.round(diff)}% dearer`;
    const likely = m.score >= d.cut_off - 1e-9;
    document.getElementById("find-result").innerHTML = `
      ${productBlock({ ...p, price_per_ml: null }).replace("No size in ml on Matas", "Your pick")}
      <div class="vs">closest match<br><span class="pill">${Math.round(m.score * 100)}%</span></div>
      ${productBlock({ ...m, price_per_ml: null }).replace("No size in ml on Matas", "Another brand")}
      <p class="verdict">${likely ? "<b>Likely dupe:</b> " : "<b>Not a likely dupe:</b> "}they share ${Math.round(m.score * 100)}% of their ingredients
      ${likely ? "" : `(below my cut-off of ${d.cut_off.toFixed(2)})`}, and the match is ${priceWord}.</p>`;
  }
  select.addEventListener("input", update);
  update();
}

// ---- Can you beat ChatGPT? ----
function setupQuiz(d) {
  const box = document.getElementById("quiz");
  const labels = ["dupe", "possibly a dupe", "not a dupe"];
  let i = 0, withMe = 0, withLlm = 0, answered = 0;

  function show() {
    const q = d.quiz[i];
    box.innerHTML = `
      <div class="quiz-top"><span>Pair ${i + 1} of ${d.quiz.length}</span><span class="tally" id="quiz-tally"></span></div>
      <div class="quiz-pair">
        ${productBlock({ ...q.a, price_per_ml: null }).replace("No size in ml on Matas", "Product A")}
        <div class="vs">vs</div>
        ${productBlock({ ...q.b, price_per_ml: null }).replace("No size in ml on Matas", "Product B")}
      </div>
      <div class="choices">${labels.map((l) => `<button type="button" class="choice" data-l="${l}">${l}</button>`).join("")}</div>
      <div id="quiz-reveal"></div>`;
    box.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => answer(b.dataset.l)));
    tally();
  }

  function tally() {
    document.getElementById("quiz-tally").innerHTML =
      `You agreed with me: <b>${withMe}</b> · with ChatGPT: <b>${withLlm}</b> (of ${answered})`;
  }

  function answer(guess) {
    const q = d.quiz[i];
    answered++;
    if (guess === q.mine) withMe++;
    if (guess === q.chatgpt) withLlm++;
    box.querySelectorAll(".choice").forEach((b) => {
      b.disabled = true;
      if (b.dataset.l === guess) b.classList.add("picked");
    });
    const scoreText = q.score === null ? "no score (no ingredient list)" : `${Math.round(q.score * 100)}% in common`;
    document.getElementById("quiz-reveal").innerHTML = `
      <div class="reveal-box">
        <div class="judge ${guess === q.mine ? "match" : ""}"><span>Me (before any scores)</span><b>${esc(q.mine)}</b></div>
        <div class="judge"><span>My similarity score</span><b>${scoreText}</b></div>
        <div class="judge ${guess === q.chatgpt ? "match" : ""}"><span>ChatGPT</span><b>${esc(q.chatgpt)}</b></div>
      </div>
      <p class="llm-reason">ChatGPT: “${esc(q.chatgpt_reason)}”</p>
      ${q.chatgpt_mistake ? `<p class="llm-mistake"><b>Fact check:</b> ${esc(q.chatgpt_mistake)}</p>` : ""}
      <div class="quiz-nav">
        <span></span>
        <button type="button" class="next">${i + 1 < d.quiz.length ? "Next pair →" : "Start again ↺"}</button>
      </div>`;
    tally();
    box.querySelector(".next").addEventListener("click", () => {
      i = (i + 1) % d.quiz.length;
      if (i === 0) withMe = withLlm = answered = 0;
      show();
    });
  }
  show();
}

// ---- Gentle fade-in when sections scroll into view ----
function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("seen"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("seen");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach((e) => io.observe(e));
}

fetch("results.json")
  .then((r) => r.json())
  .then((d) => {
    fill("cutoff", d.cut_off.toFixed(2));
    fill("group-margin", pct(d.group_margin));
    fill("pairs", d.counts.pairs_scored.toLocaleString("en-US"));
    fill("scraper", `${d.counts.scraper_fields_right} of ${d.counts.scraper_fields_checked}`);
    fill("raw", d.counts.raw_products);
    fill("kept", d.counts.kept_products);
    fill("llm", `${d.counts.me_vs_llm_agree} of ${d.counts.pairs_judged}`);
    fill("matchable", d.best_match.length);
    fill("date", d.generated_on);
    renderStats(d);
    renderCards(d);
    renderTable(d);
    setupSave(d);
    setupTry(d);
    setupHist(d);
    setupFind(d);
    setupQuiz(d);
    setupReveal();
  })
  .catch((err) => {
    document.querySelectorAll(".reveal").forEach((e) => e.classList.add("seen"));
    document.getElementById("cards").innerHTML =
      '<p>Could not load results.json. Open this page through a web server (for example GitHub Pages), not as a file.</p>';
    console.error(err);
  });
