// Moteur juridique : validation + construction des clauses. Aucune dépendance à l'interface.
const Engine = (() => {
  const VERSION = "ga-2024.0-draft";
  const TYPES = {
    standard: ["Licence standard", "L'artiste utilise le beat. Vous gardez vos droits et pouvez le proposer à d'autres."],
    exclusive: ["Licence exclusive", "L'artiste a l'exclusivité sur les droits définis. Ce n'est pas une cession de tous vos droits."],
    free_assignment: ["Cession gratuite de droits", "Vous donnez gratuitement certains droits précis."],
    free_authorization: ["Autorisation gratuite d'utilisation", "L'artiste peut utiliser le beat gratuitement. Aucun droit n'est cédé."],
    collaboration: ["Contrat de collaboration", "Vous et l'artiste créez ensemble : contributions, crédits, partage."],
  };
  const CREDITS = { producer: "Producer / Beatmaker", coproducer: "Co-producteur", featuring: "Featuring (Feat.)", primary: "Artiste principal / Primary Artist", collaborator: "Collaborateur principal", other: "Autre", none: "Aucun crédit particulier" };
  const MODES = { keep: ["Je garde tous mes droits", "L'artiste a seulement le droit d'utiliser le beat."], partial: ["Je cède certains droits", "Vous précisez lesquels."], all: ["Je cède tous les droits patrimoniaux concernés", "Ceux que vous listez, rien de plus."] };

  const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || "");
  function validate(d) {
    const e = [];
    for (const [k, l] of [["beatmaker", "Beatmaker"], ["artist", "Artiste"]]) {
      if (!d[k].fullName?.trim()) e.push(`${l} : nom et prénom requis.`);
      if (!emailOk(d[k].email)) e.push(`${l} : e-mail invalide.`);
      if (!d[k].country?.trim()) e.push(`${l} : pays requis.`);
    }
    if (!d.production.title?.trim()) e.push("Titre de la production requis.");
    const free = d.type === "free_assignment" || d.type === "free_authorization";
    if (free && d.paid) e.push("Ce type de contrat est gratuit : choisissez « Gratuit ».");
    if (d.paid && (!(d.price > 0) || !d.paymentDate)) e.push("Contrat payant : prix et date de paiement requis.");
    if (d.type === "free_assignment" && d.rights.mode === "keep") e.push("Une cession de droits doit céder au moins un droit.");
    if (d.type === "free_authorization" && d.rights.mode !== "keep") e.push("Une autorisation d'utilisation ne cède aucun droit.");
    if (d.rights.mode !== "keep" && !d.rights.nature.trim()) e.push("Précisez la nature des droits cédés.");
    if (!d.rights.uses.trim() || !d.rights.duration.trim() || !d.rights.territory.trim()) e.push("Précisez les utilisations autorisées, la durée et le territoire.");
    if (d.type === "collaboration" && (!d.contributions.beatmaker.trim() || !d.contributions.artist.trim())) e.push("Collaboration : décrivez la contribution de chaque partie.");
    if (d.credit.kind !== "none" && !d.credit.text.trim()) e.push("Indiquez le nom exact à afficher pour le crédit.");
    if (d.samples.status === "yes" && !d.samples.details.trim()) e.push("Précisez la provenance et le statut des autorisations des samples.");
    for (const [k, l] of [["composition", "composition"], ["master", "master"]]) {
      const list = d.split[k];
      if (list.some((s) => !s.name.trim())) e.push(`Partage ${l} : nom du bénéficiaire requis.`);
      if (list.length && Math.abs(list.reduce((a, s) => a + s.percent, 0) - 100) > 0.001) e.push(`Partage ${l} : le total doit être égal à 100 %.`);
    }
    return e;
  }

  const nm = (p) => (p.artistName ? `${p.fullName} (dit « ${p.artistName} »)` : p.fullName);
  const pct = (l) => l.map((x) => `${x.name} : ${x.percent} %`).join(" ; ");
  function build(d, number, now = new Date()) {
    const B = "le Beatmaker", A = "l'Artiste", r = d.rights, pr = d.production;
    const nature = {
      standard: `${B} concède à ${A} une licence NON EXCLUSIVE d'utilisation de la production. ${B} conserve ses droits et peut accorder d'autres licences sur la même production.`,
      exclusive: `${B} concède à ${A} une licence EXCLUSIVE, limitée aux droits, utilisations, durée et territoire définis à l'article « Droits accordés et conservés ». Cette exclusivité ne constitue pas une cession de l'ensemble des droits.` +
        (r.priorLicenses ? ` Licences déjà accordées par ${B} sur la production : ${r.priorLicenses}.` : ` ${B} déclare, à sa connaissance, ne pas avoir accordé de licence antérieure sur la production.`),
      free_assignment: r.mode === "all"
        ? `${B} cède à titre gratuit l'ensemble des droits patrimoniaux énumérés à l'article « Droits accordés et conservés ». Cette cession est limitée à ces droits.`
        : `${B} cède à titre gratuit UNIQUEMENT les droits patrimoniaux énumérés à l'article « Droits accordés et conservés ». Tout droit non cité est conservé par ${B}.`,
      free_authorization: `${B} autorise ${A}, à titre gratuit, à utiliser la production dans les conditions ci-dessous. Il s'agit d'une simple autorisation d'utilisation : aucun droit n'est cédé à ${A}.`,
      collaboration: `${B} et ${A} conviennent de collaborer sur la production. Contribution du Beatmaker : ${d.contributions.beatmaker}. Contribution de l'Artiste : ${d.contributions.artist}.`,
    }[d.type];
    const rights = [r.mode === "keep" ? `${B} conserve l'ensemble de ses droits d'auteur et droits voisins.` : `Droits cédés : ${r.nature}.`, `Utilisations autorisées : ${r.uses}.`, ...(r.reserved ? [`Droits expressément conservés : ${r.reserved}.`] : [])];
    const money = d.paid ? [`${A} verse ${d.price} ${d.currency} à ${B}, au plus tard le ${d.paymentDate}.`, ...(d.paymentMode ? [`Mode de paiement : ${d.paymentMode}.`] : []), ...(d.txRef ? [`Référence de transaction : ${d.txRef}.`] : [])] : ["Le présent accord est conclu à titre gratuit : aucune contrepartie financière n'est due."];
    const credit = d.credit.kind === "none" ? ["Aucun crédit particulier n'est requis."] : [`Type de crédit : ${CREDITS[d.credit.kind]}. Mention à afficher : « ${d.credit.text} ».`, d.credit.mandatory ? "Ce crédit est obligatoire." : "Ce crédit est souhaité mais non obligatoire.", "Un crédit artistique ne constitue ni une preuve de titularité des droits d'auteur ni un droit sur le master."];
    const split = [...(d.split.composition.length ? [`Droits de composition : ${pct(d.split.composition)}.`] : []), ...(d.split.master.length ? [`Revenus du master (enregistrement sonore) : ${pct(d.split.master)}.`] : [])];
    const samples = d.samples.status === "no" ? [`${B} déclare, à sa connaissance, que la production ne contient ni sample ni élément tiers.`]
      : d.samples.status === "yes" ? [`La production contient des samples ou éléments tiers : ${d.samples.details}.`, `${B} ne garantit aucun droit sur les éléments qu'il ne détient pas ou n'est pas autorisé à exploiter. ${A} reste responsable de l'obtention des autorisations nécessaires.`]
      : [`${B} ne sait pas si la production contient des samples ou éléments tiers et n'accorde aucune garantie à ce sujet.`];
    const gabon = /gabon/i.test(d.beatmaker.country);
    const info = [pr.genre && ` Genre : ${pr.genre}.`, pr.bpm && ` BPM : ${pr.bpm}.`, pr.key && ` Tonalité : ${pr.key}.`, pr.reference && ` Référence : ${pr.reference}.`].filter(Boolean).join("");
    const articles = [
      ["Identification des parties", [`Le Beatmaker : ${nm(d.beatmaker)}${d.beatmaker.label ? `, ${d.beatmaker.label}` : ""}, ${d.beatmaker.country}, ${d.beatmaker.email}.`, `L'Artiste : ${nm(d.artist)}${d.artist.label ? `, ${d.artist.label}` : ""}, ${d.artist.country}, ${d.artist.email}.`]],
      ["Production concernée", [`Titre : « ${pr.title} ».${info}`]],
      ["Nature de l'accord", [nature]],
      ["Droits accordés et conservés", rights],
      ["Conditions financières", money],
      ["Crédits musicaux", credit],
      split.length && ["Partage des revenus", split],
      ["Déclarations relatives aux samples et éléments tiers", samples],
      ["Durée et territoire", [`Durée : ${r.duration}. Territoire : ${r.territory}.`]],
      ["Obligations des parties", [`${B} déclare être titulaire des droits qu'il accorde, dans la limite de l'article relatif aux samples.`, `${A} respecte les conditions du présent contrat et les crédits convenus.`]],
      ["Restrictions d'utilisation", [`${A} n'utilise la production que dans le cadre défini ci-dessus. Toute utilisation, cession ou sous-licence non prévue nécessite l'accord écrit préalable de ${B}.`]],
      ["Résiliation", ["Chaque partie peut résilier le contrat en cas de manquement de l'autre partie non corrigé dans un délai raisonnable après mise en demeure écrite."]],
      ["Règlement des différends et droit applicable", gabon
        ? ["Le contrat est soumis au droit gabonais, notamment l'ordonnance n° 0011/PR/2024 du 26 février 2024 relative au droit d'auteur et aux droits voisins. Les parties recherchent d'abord une solution amiable ; à défaut, les juridictions gabonaises compétentes sont saisies."]
        : ["Le droit applicable et la juridiction compétente sont à convenir entre les parties : [à compléter avant signature]. Les parties recherchent d'abord une solution amiable."]],
    ].filter(Boolean).map(([title, paras]) => ({ title, paras }));
    return { title: TYPES[d.type][0], number, date: now.toLocaleDateString("fr-FR"), version: VERSION, articles, parties: { beatmaker: nm(d.beatmaker), artist: nm(d.artist) } };
  }
  return { TYPES, CREDITS, MODES, validate, build, VERSION };
})();
if (typeof module !== "undefined") module.exports = Engine;
