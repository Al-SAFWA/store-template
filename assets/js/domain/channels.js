// @ts-check
/* Merchant contact channels: value + show/hide. Empty or hidden channels are omitted on the storefront. */

export const CHANNEL_DEFS = [
  { id: "whatsapp", kind: "phone", ar: "واتساب (زر الطلب)", fr: "WhatsApp (bouton commande)" },
  { id: "phone", kind: "phone", ar: "اتصال", fr: "Téléphone" },
  { id: "email", kind: "email", ar: "البريد", fr: "E-mail" },
  { id: "address", kind: "i18n", ar: "العنوان", fr: "Adresse" },
  { id: "instagram", kind: "url", ar: "انستغرام", fr: "Instagram" },
  { id: "facebook", kind: "url", ar: "فيسبوك", fr: "Facebook" },
  { id: "tiktok", kind: "url", ar: "تيك توك", fr: "TikTok" },
  { id: "snapchat", kind: "url", ar: "سناب شات", fr: "Snapchat" }
];

function digits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function hrefOf(value) {
  const typed = String(value || "").trim();
  if (!typed) return "";
  const withScheme = /^https?:\/\//i.test(typed) ? typed : `https://${typed}`;
  return /^https:\/\//i.test(withScheme) ? withScheme : "";
}

function socialMap(list) {
  const out = {};
  for (const entry of Array.isArray(list) ? list : []) {
    if (entry?.id) out[entry.id] = entry.href || "";
  }
  return out;
}

function firstText(...values) {
  for (const value of values) {
    if (value) return String(value);
  }
  return "";
}

function urlChannel(social, brandSocial, id) {
  const value = Object.prototype.hasOwnProperty.call(brandSocial, id)
    ? firstText(brandSocial[id])
    : firstText(social[id], brandSocial[id]);
  return { value, visible: Boolean(value) };
}

export function defaultChannels(settings = {}, brand = {}) {
  const social = socialMap(settings.social);
  const brandSocial = brand.social || {};
  return {
    whatsapp: { value: firstText(settings.whatsapp, brand.whatsapp), visible: true },
    phone: {
      value: firstText(settings.phoneDisplay, settings.phone, brand.phoneDisplay, brand.phone),
      visible: true
    },
    email: { value: firstText(settings.email, brand.email), visible: true },
    address: {
      value: {
        ar: firstText(settings.address?.ar, brand.address?.ar),
        fr: firstText(settings.address?.fr, brand.address?.fr)
      },
      visible: true
    },
    instagram: urlChannel(social, brandSocial, "instagram"),
    facebook: urlChannel(social, brandSocial, "facebook"),
    tiktok: urlChannel(social, brandSocial, "tiktok"),
    snapchat: urlChannel(social, brandSocial, "snapchat")
  };
}

export function mergeChannels(settings, brand) {
  const base = defaultChannels(settings, brand);
  const saved = settings?.channels;
  if (!saved || typeof saved !== "object") return base;
  for (const def of CHANNEL_DEFS) {
    const row = saved[def.id];
    if (!row || typeof row !== "object") continue;
    base[def.id] = {
      value: row.value != null ? row.value : base[def.id].value,
      visible: row.visible !== false
    };
  }
  return base;
}

function isFilled(def, value) {
  if (value == null || value === "") return false;
  if (def.kind === "i18n") return Boolean(value.ar || value.fr);
  return String(value).trim() !== "";
}

/** Channel row when visible and non-empty, else null. */
export function visibleChannel(settings, id) {
  const def = CHANNEL_DEFS.find((item) => item.id === id);
  const row = settings?.channels?.[id];
  if (!def || !row || row.visible === false) return null;
  if (!isFilled(def, row.value)) return null;
  return row;
}

export function whatsappDigits(settings) {
  if (settings?.channels?.whatsapp?.visible === false) return "";
  const row = visibleChannel(settings, "whatsapp");
  let wa = digits(row?.value || settings?.whatsapp);
  if (wa.length === 8) wa = `222${wa}`;
  return wa;
}

export function socialFromChannels(settings) {
  const out = [];
  for (const id of ["facebook", "instagram", "tiktok", "snapchat"]) {
    const row = visibleChannel(settings, id);
    const href = hrefOf(row?.value);
    if (!href) continue;
    out.push({ id, icon: id, href });
  }
  return out;
}

function preferLegacy(row, legacy) {
  if (legacy === undefined || legacy === null) return;
  row.value = legacy;
}

function syncVisible(settings, id, field) {
  const row = settings.channels[id];
  if (row.visible === false || row.value == null || row.value === "") return;
  settings[field] = row.value;
}

function syncWhatsapp(settings) {
  const wa = settings.channels.whatsapp;
  preferLegacy(wa, settings.whatsapp);
  if (wa.visible === false || !wa.value) return;
  let digitsOnly = digits(wa.value);
  if (digitsOnly.length === 8) digitsOnly = `222${digitsOnly}`;
  settings.whatsapp = digitsOnly;
  wa.value = digitsOnly;
}

/** Keep legacy settings.whatsapp / social / email in sync so checkout and older UI keep working. */
export function applyChannelsToSettings(settings, brand) {
  if (!settings) return settings;
  settings.channels = mergeChannels(settings, brand);
  syncWhatsapp(settings);
  preferLegacy(settings.channels.phone, settings.phoneDisplay);
  preferLegacy(settings.channels.email, settings.email);
  preferLegacy(settings.channels.address, settings.address);
  syncVisible(settings, "phone", "phoneDisplay");
  syncVisible(settings, "email", "email");
  syncVisible(settings, "address", "address");
  settings.social = socialFromChannels(settings);
  return settings;
}
