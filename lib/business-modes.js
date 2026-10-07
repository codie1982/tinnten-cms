import businessModeContract from '../contracts/business-modes.v2.json' with { type: 'json' };

export const BUSINESS_MODE_CONTRACT_VERSION = businessModeContract.version;
export const CANONICAL_BUSINESS_MODES = Object.freeze([
  ...businessModeContract.canonicalOrder,
]);
export const BUSINESS_MODE_DEFINITIONS = Object.freeze(
  businessModeContract.modes.map((mode) => Object.freeze({ ...mode })),
);

const aliases = businessModeContract.legacy.aliases;
const expansions = businessModeContract.legacy.expansions;

export const normalizeBusinessMode = (value) => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const normalized = aliases[raw] || raw;
  return CANONICAL_BUSINESS_MODES.includes(normalized) ? normalized : null;
};

export const normalizeBusinessModes = (values, fallback = null) => {
  const expand = (value) => {
    if (value === 'service') return expansions.service;
    const normalized = normalizeBusinessMode(value);
    return normalized ? [normalized] : [];
  };
  const normalized = (Array.isArray(values) ? values : []).flatMap(expand);
  const source = normalized.length > 0 ? normalized : expand(fallback);
  return CANONICAL_BUSINESS_MODES.filter((mode) => source.includes(mode));
};

export const selectPrimaryBusinessMode = (values) =>
  CANONICAL_BUSINESS_MODES.find((mode) => values.includes(mode)) || null;

export const businessModeHasCapability = (mode, capability) =>
  BUSINESS_MODE_DEFINITIONS.find((definition) => definition.id === normalizeBusinessMode(mode))
    ?.capabilities.includes(capability) === true;

const variantForMode = (mode) => mode === 'ecommerce'
  ? 'primary'
  : mode === 'standard'
    ? 'outline'
    : 'secondary';

const metaFromDefinitions = (definitions) => Object.fromEntries(
  definitions.map((mode) => [
    mode.id ?? mode.value,
    {
      label: mode.label ?? mode.defaultLabel,
      variant: variantForMode(mode.id ?? mode.value),
      catalogType: mode.catalogType,
      capabilities: mode.capabilities ?? [],
    },
  ]),
);

export const businessModeMetaFromContract = metaFromDefinitions(
  BUSINESS_MODE_DEFINITIONS,
);

/** Backend sözleşmesi sürüm/anahtar olarak CMS kopyasıyla uyuşmuyorsa fallback kullanılır. */
export const isBusinessModeContractCompatible = (payload) =>
  payload?.contractVersion === BUSINESS_MODE_CONTRACT_VERSION &&
  Array.isArray(payload?.items) &&
  payload.items.length === CANONICAL_BUSINESS_MODES.length &&
  CANONICAL_BUSINESS_MODES.every(
    (mode) => payload.items.some((item) => item?.value === mode),
  );

export const businessModeMetaForPayload = (payload) =>
  isBusinessModeContractCompatible(payload)
    ? metaFromDefinitions(payload.items)
    : businessModeMetaFromContract;

export const businessModeOptionsForPayload = (payload) => {
  const meta = businessModeMetaForPayload(payload);
  return CANONICAL_BUSINESS_MODES.map((value) => ({
    value,
    label: meta[value]?.label ?? value,
  }));
};
