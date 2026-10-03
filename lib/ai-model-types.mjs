export const modelTypeOf = model => {
  if (model?.modelType != null) return model.modelType;
  const roles = model?.allowedRoles || [];
  const specialized = [["decision", "decision"], ["vision", "vision"], ["image", "image_generation"], ["video", "video_generation"]]
    .filter(([role]) => roles.includes(role)).map(([, type]) => type);
  return specialized.length === 1 ? specialized[0] : specialized.length ? null : "text";
};
