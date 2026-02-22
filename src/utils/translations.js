// Lazy-loaded translations — only the active language is imported
const langModules = {
    zh: () => import('./lang/zh.js'),
    en: () => import('./lang/en.js'),
    ja: () => import('./lang/ja.js'),
    ko: () => import('./lang/ko.js'),
};
export default langModules;
