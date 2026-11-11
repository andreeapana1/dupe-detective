// Dupe Detective results page. Every number comes from results.json,
// which build_site_data.py makes from my analysis results.

const kr = (n) => n.toFixed(2) + " kr";
const pct = (n) => Math.round(n * 1000) / 10 + "%";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Product names start with the brand (e.g. "NYX PROFESSIONAL MAKEUP Duck Plump ..."); drop it.
function productName(p) {
  const n = p.name.trim();
  return n.toLowerCase().startsWith(p.brand.toLowerCase()) ? n.slice(p.brand.length).trim() : n;
}
const brandLabel = (b) => (b === b.toUpperCase() && b.length > 4 ? b.charAt(0) + b.slice(1).toLowerCase() : b);

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

function renderCards(d) {
  const maxGp = Math.max(...d.top3.map((l) => l.gross_profit_expensive));
  document.getElementById("cards").innerHTML = d.top3
    .map((l, i) => `<article class="card">
      <div class="card-top"><span class="rank">#${i + 1}</span><span class="badge">+${l.premium_pct}% premium</span></div>
      ${productBlock(l.expensive)}
      <div class="arrow">↓ cheaper alternative</div>
      ${productBlock(l.cheaper)}
      <div class="meter">
        <div class="meter-label"><span>Ingredients in common</span><b>${Math.round(l.score * 100)}%</b></div>
        <div class="bar"><i style="width:${l.score * 100}%"></i></div>
      </div>
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

function setupTry(d) {
  const select = document.getElementById("lead-select");
  const mExp = document.getElementById("m-exp");
  const mChp = document.getElementById("m-chp");
  const group = Math.round(d.group_margin * 100);
  select.innerHTML = d.top3
    .map((l, i) => `<option value="${i}">#${i + 1} ${esc(brandLabel(l.expensive.brand))} → ${esc(brandLabel(l.cheaper.brand))}</option>`)
    .join("");

  function update() {
    const l = d.top3[Number(select.value)];
    const me = Number(mExp.value) / 100;
    const mc = Number(mChp.value) / 100;
    const gpExp = l.expensive.price_excl_vat * me;
    const gpChp = l.cheaper.price_excl_vat * mc;
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
  }

  function reset() {
    mExp.value = group;
    mChp.value = group;
    update();
  }

  [select, mExp, mChp].forEach((el) => el.addEventListener("input", update));
  document.getElementById("reset").addEventListener("click", reset);
  reset();
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
    fill("date", d.generated_on);
    renderStats(d);
    renderCards(d);
    renderTable(d);
    setupTry(d);
  })
  .catch(() => {
    document.getElementById("cards").innerHTML =
      '<p>Could not load results.json. Open this page through a web server (for example GitHub Pages), not as a file.</p>';
  });
