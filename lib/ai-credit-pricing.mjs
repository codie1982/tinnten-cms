export const isCreditRate = value => typeof value === 'string' && /^(0|[1-9]\d{0,12})(\.\d{1,6})?$/.test(value);
