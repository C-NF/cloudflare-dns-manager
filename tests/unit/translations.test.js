import translations from '../../src/utils/translations';

describe('translations', () => {
    it('contains both zh and en languages', () => {
        expect(translations).toHaveProperty('zh');
        expect(translations).toHaveProperty('en');
    });

    it('zh and en have the same set of keys', () => {
        const zhKeys = Object.keys(translations.zh).sort();
        const enKeys = Object.keys(translations.en).sort();
        expect(zhKeys).toEqual(enKeys);
    });

    it('all keys in zh also exist in en', () => {
        const zhKeys = Object.keys(translations.zh);
        const enKeys = new Set(Object.keys(translations.en));
        const missingInEn = zhKeys.filter(k => !enKeys.has(k));
        expect(missingInEn).toEqual([]);
    });

    it('all keys in en also exist in zh', () => {
        const enKeys = Object.keys(translations.en);
        const zhKeys = new Set(Object.keys(translations.zh));
        const missingInZh = enKeys.filter(k => !zhKeys.has(k));
        expect(missingInZh).toEqual([]);
    });

    it('no empty string values in zh', () => {
        const emptyKeys = Object.entries(translations.zh)
            .filter(([, v]) => v === '')
            .map(([k]) => k);
        expect(emptyKeys).toEqual([]);
    });

    it('no empty string values in en', () => {
        const emptyKeys = Object.entries(translations.en)
            .filter(([, v]) => v === '')
            .map(([k]) => k);
        expect(emptyKeys).toEqual([]);
    });

    it('all values are strings', () => {
        for (const lang of ['zh', 'en']) {
            for (const [key, value] of Object.entries(translations[lang])) {
                expect(typeof value).toBe('string');
            }
        }
    });

    describe('critical keys exist', () => {
        const criticalKeys = [
            'title',
            'loginBtn',
            'dnsRecords',
            'logout',
            'save',
            'cancel',
            'addRecord',
            'confirmDelete',
            'back',
            'refresh',
            'type',
            'name',
            'content',
            'status',
            'actions',
            'hostname',
            'saasHostnames',
            'editRecord',
            'manage',
            'yourDomains',
        ];

        for (const key of criticalKeys) {
            it(`"${key}" exists in zh`, () => {
                expect(translations.zh).toHaveProperty(key);
                expect(translations.zh[key]).toBeTruthy();
            });

            it(`"${key}" exists in en`, () => {
                expect(translations.en).toHaveProperty(key);
                expect(translations.en[key]).toBeTruthy();
            });
        }
    });
});
