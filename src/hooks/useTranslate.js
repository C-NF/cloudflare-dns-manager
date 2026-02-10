import { useState } from 'react';
import translations from '../utils/translations.js';

const useTranslate = () => {
    const [lang, setLang] = useState(localStorage.getItem('lang') || 'zh');

    const t = (key) => translations[lang][key] || key;

    const changeLang = (l) => {
        setLang(l);
        localStorage.setItem('lang', l);
    };

    const toggleLang = () => {
        const nextLang = lang === 'zh' ? 'en' : 'zh';
        changeLang(nextLang);
    };

    return { t, lang, changeLang, toggleLang };
};

export default useTranslate;
