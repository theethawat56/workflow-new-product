import { validators } from '../../src/lib/line/validators';

describe('Line Validators', () => {
    test('sku_code validator', () => {
        expect(validators.sku_code('NKE-SHOE-4821')).toBe(true);
        expect(validators.sku_code('nke-12')).toBe(false); // lowercase not allowed
        expect(validators.sku_code('A1')).toBe(false); // too short
    });

    test('price validator', () => {
        expect(validators.price('1200')).toBe(true);
        expect(validators.price(1200)).toBe(true);
        expect(validators.price('abc')).toBe(false);
        expect(validators.price('-10')).toBe(false);
    });

    test('cost validator', () => {
        expect(validators.cost('1000')).toBe(true);
        expect(validators.cost('free')).toBe(false);
    });

    test('moq validator', () => {
        expect(validators.moq('10')).toBe(true);
        expect(validators.moq('0')).toBe(false); // >= 1
    });

    test('lead_time_days validator', () => {
        expect(validators.lead_time_days('5')).toBe(true);
        expect(validators.lead_time_days('0')).toBe(true); // >= 0
    });

    test('product_name validator', () => {
        expect(validators.product_name('Shoe')).toBe(true);
        expect(validators.product_name(' A ')).toBe(false); // trim length
    });

    test('brand validator', () => {
        expect(validators.brand('Nike')).toBe(true);
        expect(validators.brand(' ')).toBe(false);
    });
});
