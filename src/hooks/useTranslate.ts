import { useState, useEffect, useCallback } from 'react';
import zhStrings from '../utils/lang/zh.js';
import langModules from '../utils/translations.js';

type Lang = 'zh' | 'en' | 'ja' | 'ko';
const langCycle: Lang[] = ['zh', 'en', 'ja', 'ko'];

// Pre-populate cache with zh (default) for instant availability
const cache: Record<string, Record<string, string>> = { zh: zhStrings };

const useTranslate = () => {
    const [lang, setLang] = useState<Lang>(
        (localStorage.getItem('lang') as Lang) || 'zh'
    );
    const [strings, setStrings] = useState<Record<string, string>>(cache[lang] || {});

    useEffect(() => {
        if (cache[lang]) { setStrings(cache[lang]); return; }
        langModules[lang]().then((mod: any) => {
            cache[lang] = mod.default;
            setStrings(mod.default);
        });
    }, [lang]);

    const t = useCallback((key: string): string => strings[key] || key, [strings]);

    const changeLang = (l: Lang) => {
        setLang(l);
        localStorage.setItem('lang', l);
    };

    const toggleLang = () => {
        const idx = langCycle.indexOf(lang);
        const next = langCycle[(idx + 1) % langCycle.length];
        changeLang(next);
    };

    return { t, lang, changeLang, toggleLang };
};

export default useTranslate;
