function __(key, { data }) {
  const strings = data.root.locales[data.root.currentLocale];
  return strings[key];
}

export default __;
