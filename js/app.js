// Interface : formulaire en étapes, historique, profil. Données stockées dans le navigateur (localStorage).
const $app = document.getElementById("app");
const store = {
  get: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const contracts = () => store.get("bl_contracts", []);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const E = Engine;
const STEPS = ["Vous", "Artiste et production", "Contrat et prix", "Droits et crédits", "Revenus et samples", "Vérification"];

let d, step = 0, errs = [];
const newData = () => ({
  type: "standard",
  beatmaker: { fullName: "", artistName: "", email: "", phone: "", country: "Gabon", label: "", ...store.get("bl_profile", {}) },
  artist: { fullName: "", artistName: "", email: "", country: "Gabon", label: "" },
  production: { title: "", genre: "", bpm: "", key: "", reference: "" },
  paid: false, price: "", currency: "FCFA", paymentDate: "", paymentMode: "", txRef: "",
  rights: { mode: "keep", nature: "", uses: "", duration: "", territory: "", reserved: "", priorLicenses: "" },
  contributions: { beatmaker: "", artist: "" },
  credit: { kind: "producer", text: "", mandatory: false },
  split: { composition: [], master: [] },
  samples: { status: "no", details: "" },
});
const g = (p) => p.split(".").reduce((a, k) => a?.[k], d);
const put = (p, v) => { const k = p.split("."); let o = d; k.slice(0, -1).forEach((x) => (o = o[x])); o[k[k.length - 1]] = v; };

const F = (l, p, t = "text", ph = "") => `<label>${l}<input type="${t}" data-p="${p}" value="${esc(g(p))}" placeholder="${esc(ph)}"></label>`;
const Opt = (p, val, title, sub = "") => { const on = String(g(p)) === String(val); return `<label class="opt${on ? " on" : ""}"><input type="radio" name="${p}" data-p="${p}" value="${val}" ${on ? "checked" : ""}>${title}${sub ? `<small>${sub}</small>` : ""}</label>`; };
const Shares = (k, title) => {
  const list = d.split[k], total = list.reduce((a, s) => a + Number(s.percent || 0), 0);
  return `<div class="card"><strong>${title}</strong>${list.map((s, i) => `<div class="row">
    <input aria-label="Bénéficiaire" placeholder="Nom" data-p="split.${k}.${i}.name" value="${esc(s.name)}" style="flex:2">
    <input aria-label="Pourcentage" type="number" placeholder="%" data-p="split.${k}.${i}.percent" value="${esc(s.percent)}" style="flex:1">
    <button type="button" class="ghost" data-act="rmshare:${k}:${i}">Retirer</button></div>`).join("")}
    <div class="row"><button type="button" class="ghost" data-act="addshare:${k}">Ajouter un bénéficiaire</button>${list.length ? `<span class="${total === 100 ? "muted" : "err"}">Total : ${total} %</span>` : ""}</div></div>`;
};

function stepHtml() {
  const free = d.type === "free_assignment" || d.type === "free_authorization";
  switch (step) {
    case 0: return `${F("Nom et prénom", "beatmaker.fullName")}${F("Nom d'artiste", "beatmaker.artistName")}${F("E-mail", "beatmaker.email", "email")}${F("Téléphone (facultatif)", "beatmaker.phone", "tel")}${F("Pays", "beatmaker.country")}${F("Label ou structure (facultatif)", "beatmaker.label")}<p class="muted">Ces informations sont enregistrées dans votre navigateur pour vos prochains contrats.</p>`;
    case 1: return `<h2>L'artiste</h2>${F("Nom et prénom", "artist.fullName")}${F("Nom d'artiste", "artist.artistName")}${F("E-mail", "artist.email", "email")}${F("Pays", "artist.country")}${F("Label ou structure (facultatif)", "artist.label")}
      <h2>La production</h2>${F("Titre", "production.title")}${F("Genre (facultatif)", "production.genre")}${F("BPM (facultatif)", "production.bpm")}${F("Tonalité (facultatif)", "production.key")}${F("Référence (facultatif)", "production.reference")}`;
    case 2: return `<h2>Quel contrat ?</h2>${Object.entries(E.TYPES).map(([v, [t, s]]) => Opt("type", v, t, s)).join("")}
      ${d.type === "collaboration" ? `${F("Votre contribution", "contributions.beatmaker")}${F("Contribution de l'artiste", "contributions.artist")}` : ""}
      <h2>Prix</h2>${free ? `<p class="muted">Ce contrat est gratuit.</p>` : `${Opt("paid", false, "Gratuit")}${Opt("paid", true, "Payant")}
      ${d.paid ? `${F("Prix convenu", "price", "number")}<label>Devise<select data-p="currency">${["FCFA", "EUR", "USD"].map((c) => `<option ${c === d.currency ? "selected" : ""}>${c}</option>`).join("")}</select></label>${F("Date du paiement", "paymentDate", "date")}${F("Mode de paiement (facultatif)", "paymentMode")}${F("Référence de transaction (facultatif)", "txRef")}` : ""}`}`;
    case 3: return `<h2>Vos droits</h2>${Object.entries(E.MODES).filter(([v]) => d.type === "free_authorization" ? v === "keep" : d.type === "free_assignment" ? v !== "keep" : true).map(([v, [t, s]]) => Opt("rights.mode", v, t, s)).join("")}
      ${d.rights.mode !== "keep" ? F("Nature des droits cédés", "rights.nature", "text", "ex. reproduction et représentation") : ""}
      ${F("Utilisations autorisées", "rights.uses", "text", "ex. streaming, concerts, clips")}${F("Durée", "rights.duration", "text", "ex. 5 ans, ou illimitée")}${F("Territoire", "rights.territory", "text", "ex. monde entier")}${F("Droits que vous conservez (facultatif)", "rights.reserved")}
      ${d.type === "exclusive" ? F("Licences déjà accordées (facultatif)", "rights.priorLicenses") : ""}
      <h2>Comment souhaitez-vous être crédité ?</h2>${Object.entries(E.CREDITS).map(([v, t]) => Opt("credit.kind", v, t)).join("")}
      ${d.credit.kind !== "none" ? `${F("Nom exact à afficher", "credit.text", "text", "ex. Produced by JNL")}<label><input type="checkbox" data-p="credit.mandatory" ${d.credit.mandatory ? "checked" : ""}>Crédit obligatoire</label>` : ""}
      <p class="muted">Un crédit ne vous donne pas la propriété des droits d'auteur ni du master.</p>`;
    case 4: return `<h2>Partage des revenus (facultatif)</h2><p class="muted">Laissez vide s'il n'y a aucun partage particulier. Composition et master sont deux choses différentes.</p>
      ${Shares("composition", "Droits de composition")}${Shares("master", "Revenus du master (enregistrement sonore)")}
      <h2>Samples et éléments tiers</h2>${Opt("samples.status", "no", "Non")}${Opt("samples.status", "yes", "Oui")}${Opt("samples.status", "unknown", "Je ne sais pas")}
      ${d.samples.status === "yes" ? F("Provenance et statut des autorisations", "samples.details") : ""}`;
    default: return `<h2>Vérifiez avant de générer</h2><div class="card">
      <p><strong>${esc(E.TYPES[d.type][0])}</strong></p><p>Beatmaker : ${esc(d.beatmaker.fullName)} · Artiste : ${esc(d.artist.fullName)}</p><p>Production : ${esc(d.production.title)}</p>
      <p>${d.paid ? `${esc(d.price)} ${esc(d.currency)}, le ${esc(d.paymentDate)}` : "Gratuit"}</p>
      <p>Droits : ${esc(E.MODES[d.rights.mode][0])} · ${esc(d.rights.uses)} · ${esc(d.rights.duration)} · ${esc(d.rights.territory)}</p>
      <p>Crédit : ${d.credit.kind === "none" ? "aucun" : esc(d.credit.text)}</p><p>Samples : ${{ no: "non", yes: "oui", unknown: "je ne sais pas" }[d.samples.status]}</p></div>
      <p class="muted">Le document est un modèle à faire valider. Les parties doivent vérifier ces informations avant de signer.</p>
      ${errs.map((m) => `<p class="err">${esc(m)}</p>`).join("")}<button data-act="submit">Générer le contrat</button>`;
  }
}
let lastPct = 0;
const wizard = (dir = "") => {
  const to = ((step + 1) / STEPS.length) * 100, from = dir ? lastPct : to; lastPct = to;
  return `<div class="stepwrap ${dir}"><h1>${STEPS[step]}</h1><div class="bar"><i style="--from:${from}%;--to:${to}%"></i></div><p class="muted">Étape ${step + 1} sur ${STEPS.length}</p>${stepHtml()}
  <div class="row" style="margin-top:24px">${step > 0 ? `<button class="ghost" data-act="prev">Retour</button>` : ""}${step < STEPS.length - 1 ? `<button data-act="next">Continuer</button>` : ""}</div></div>`;
};
function toast(m) { const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

function sheet(c) {
  const doc = c.doc;
  return `<div class="sheet"><h1>${esc(doc.title)}</h1><p class="muted">Contrat n° ${esc(doc.number)} — créé le ${esc(doc.date)}</p>
    <div class="warn">${doc.validated ? "" : "MODÈLE À FAIRE VALIDER PAR UN JURISTE. "}Ce document n'est pas juridiquement garanti. Les parties doivent vérifier toutes les informations avant de signer.</div>
    ${doc.articles.map((a, i) => `<h2>Article ${i + 1} — ${esc(a.title)}</h2>${a.paras.map((p) => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <div class="sign"><div>Le Beatmaker : ${esc(doc.parties.beatmaker)}<br>Date et signature :</div><div>L'Artiste : ${esc(doc.parties.artist)}<br>Date et signature :</div></div></div>`;
}
const listHtml = (q = "") => {
  const s = q.trim().toLowerCase();
  const l = contracts().filter((c) => !s || [c.artistName, c.title, c.number].some((x) => x.toLowerCase().includes(s)));
  return l.length ? l.map((c) => `<div class="card"><strong>${esc(c.title)}</strong> — ${esc(c.artistName)}
    <div class="muted">${esc(E.TYPES[c.type][0])} · ${esc(c.number)} · ${esc(c.doc.date)}</div>
    <div class="row"><a class="btn ghost" href="#/contract/${c.id}">Consulter</a><a class="btn" href="#/contract/${c.id}?print">Télécharger le PDF</a><button class="ghost" data-act="dup:${c.id}">Dupliquer</button></div></div>`).join("")
    : `<p class="muted">Aucun contrat trouvé. <a href="#/new">Créer un contrat</a></p>`;
};

function route() {
  const [path, query] = (location.hash.slice(2) || "").split("?");
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#/" + path));
  window.scrollTo(0, 0);
  $app.classList.remove("in"); void $app.offsetWidth; $app.classList.add("in");
  if (path === "new") { d = d && step > 0 && d._draft ? d : newData(); d._draft = true; step = 0; errs = []; $app.innerHTML = wizard(); }
  else if (path === "contracts") $app.innerHTML = `<h1>Mes contrats</h1><input id="q" type="search" placeholder="Rechercher : artiste, titre ou numéro"><div id="list">${listHtml()}</div>`;
  else if (path.startsWith("contract/")) {
    const c = contracts().find((x) => x.id === path.split("/")[1]);
    if (!c) { $app.innerHTML = `<p>Contrat introuvable. <a href="#/contracts">Retour</a></p>`; return; }
    $app.innerHTML = `${sheet(c)}<div class="row noprint"><button data-act="print">Télécharger le PDF</button><button class="ghost" data-act="dup:${c.id}">Dupliquer</button><a class="btn ghost" href="#/contracts">Retour</a></div><p class="muted noprint">Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF ».</p>`;
    if (query === "print") setTimeout(() => window.print(), 300);
  }
  else if (path === "profile") { d = { beatmaker: { fullName: "", artistName: "", email: "", phone: "", country: "Gabon", label: "", ...store.get("bl_profile", {}) } };
    $app.innerHTML = `<h1>Mes informations</h1><p class="muted">Préremplies à chaque nouveau contrat.</p>${["fullName:Nom et prénom", "artistName:Nom d'artiste", "email:E-mail", "phone:Téléphone", "country:Pays", "label:Label ou structure"].map((x) => F(x.split(":")[1], "beatmaker." + x.split(":")[0])).join("")}<button data-act="saveprofile">Enregistrer</button> <span id="ok" class="muted"></span>`; }
  else if (path === "settings") $app.innerHTML = `<h1>Paramètres</h1><h2>Thème</h2><div class="row">${["light", "dark"].map((t) => `<button class="ghost ${document.documentElement.dataset.theme === t ? "on" : ""}" data-act="theme:${t}">${{ light: "Clair", dark: "Sombre" }[t]}</button>`).join("")}</div>
    <h2>Sauvegarde</h2><p class="muted">Vos contrats sont stockés dans ce navigateur uniquement. Exportez-les régulièrement.</p><div class="row"><button data-act="export">Exporter mes contrats</button><label class="btn ghost" style="margin:0">Importer<input type="file" id="imp" accept=".json" hidden></label></div>`;
  else $app.innerHTML = `<h1>Vos accords musicaux, par écrit, en quelques minutes.</h1><p class="muted lead">Répondez à quelques questions simples. Vous obtenez un contrat PDF professionnel, prêt à être signé par le beatmaker et l'artiste.</p>
    <div class="row"><a class="btn" href="#/new">Créer un contrat</a><a class="btn ghost" href="#/contracts">Mes contrats (${contracts().length})</a></div>
    <h2>Comment ça marche</h2><ol class="steps"><li><strong>Répondez aux questions</strong><span>Beatmaker, artiste, production, droits et crédits.</span></li><li><strong>Vérifiez le récapitulatif</strong><span>Vous pouvez revenir modifier chaque réponse.</span></li><li><strong>Téléchargez le PDF</strong><span>Prêt à être signé par les deux parties.</span></li></ol>
    <h2>Cinq contrats au choix</h2><div class="card types">${Object.values(E.TYPES).map(([t, x]) => `<p><strong>${t}</strong><br><span>${x}</span></p>`).join("")}</div>
    <div class="warn">Les modèles de contrats doivent être validés par un juriste avant tout usage public. Les documents ne sont pas juridiquement garantis.</div>`;
}

function submit() {
  const nums = (l) => l.map((s) => ({ name: s.name, percent: Number(s.percent) }));
  const data = { ...d, price: d.paid ? Number(d.price) : undefined, paymentDate: d.paid ? d.paymentDate : "", split: { composition: nums(d.split.composition), master: nums(d.split.master) } };
  delete data._draft;
  errs = E.validate(data);
  if (errs.length) { $app.innerHTML = wizard(); return; }
  save(data);
  store.set("bl_profile", data.beatmaker);
  d = null;
}
function save(data, msg = "Contrat créé") {
  const number = `BL-${new Date().getFullYear()}-${Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  const c = { id: crypto.randomUUID(), number, type: data.type, artistName: data.artist.artistName || data.artist.fullName, title: data.production.title, data, doc: E.build(data, number) };
  store.set("bl_contracts", [c, ...contracts()]);
  location.hash = `#/contract/${c.id}`; toast(msg);
}

$app.addEventListener("input", (e) => {
  const t = e.target, p = t.dataset.p;
  if (p && t.type !== "radio" && t.type !== "checkbox") put(p, t.value);
});
$app.addEventListener("change", (e) => {
  const t = e.target, p = t.dataset.p;
  if (t.id === "q") return;
  if (t.id === "imp") { t.files[0]?.text().then((x) => { const l = JSON.parse(x); if (Array.isArray(l)) { store.set("bl_contracts", l); toast("Contrats importés"); } }); return; }
  if (!p) return;
  let v = t.type === "checkbox" ? t.checked : t.value;
  if (p === "paid") v = v === "true";
  put(p, v);
  if (p === "type") { if (v === "free_authorization") { d.rights.mode = "keep"; d.paid = false; } if (v === "free_assignment") { if (d.rights.mode === "keep") d.rights.mode = "partial"; d.paid = false; } }
  if (p !== "currency" && t.type !== "text" && t.type !== "number") $app.innerHTML = wizard();
});
$app.addEventListener("keyup", (e) => { if (e.target.id === "q") document.getElementById("list").innerHTML = listHtml(e.target.value); });
$app.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]")?.dataset.act; if (!a) return;
  const [act, x, y] = a.split(":");
  if (act === "next") { step++; $app.innerHTML = wizard("fwd"); window.scrollTo(0, 0); }
  else if (act === "prev") { step--; $app.innerHTML = wizard("back"); window.scrollTo(0, 0); }
  else if (act === "addshare") { d.split[x].push({ name: "", percent: "" }); $app.innerHTML = wizard(); }
  else if (act === "rmshare") { d.split[x].splice(Number(y), 1); $app.innerHTML = wizard(); }
  else if (act === "submit") submit();
  else if (act === "print") window.print();
  else if (act === "dup") { const c = contracts().find((z) => z.id === x); if (c) save(c.data, "Contrat dupliqué"); }
  else if (act === "saveprofile") { store.set("bl_profile", d.beatmaker); toast("Informations enregistrées"); }
  else if (act === "theme") { document.documentElement.dataset.theme = x; store.set("bl_theme", x); document.querySelectorAll("[data-act^=theme]").forEach((b) => b.classList.toggle("on", b.dataset.act === a)); }
  else if (act === "export") { const l = document.createElement("a"); l.href = URL.createObjectURL(new Blob([JSON.stringify(contracts())], { type: "application/json" })); l.download = "beatlicense-sauvegarde.json"; l.click(); toast("Sauvegarde exportée"); }
});
document.documentElement.dataset.theme = store.get("bl_theme", "light") === "dark" ? "dark" : "light";
window.addEventListener("hashchange", route);
route();
