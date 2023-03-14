import { createFromObject, createFromObjectRecursive } from "../src";
import { BookStore } from "./test-data/generated/book-store_pb";
import { Company, Phone, PhoneShop } from "./test-data/generated/phone-shop_pb";
import { Forest, Info, Tree } from "./test-data/generated/forest_pb";
import { Universe } from "./test-data/generated/universe_pb";
import { MixedSpice, Spices } from "./test-data/generated/spices_pb";
import {Ads, Newspaper} from "./test-data/generated/newspaper_pb";

describe('createFromObject', () => {
    it('Should work with easy structure', () => {
        const fromBookStore = createFromObject(BookStore);
        const obj = {
            name: 'Harry Potter',
            shelf: 3,
        } satisfies BookStore.AsObject;
        const bookStore = fromBookStore(obj);
        expect(bookStore.toObject()).toEqual(obj);
    });

    it('Should work with nested structure', () => {
        const fromPhoneShop = createFromObject(PhoneShop, {
            phone: createFromObject(Phone, {
                company: createFromObject(Company),
            }),
        });
        const obj = {
            id: 1,
            phone: {
                model: 'iPhone 11',
                diagonal: 6.1,
                price: 999,
                company: {
                    name: 'Apple',
                    country: 'USA',
                },
            },
        } satisfies PhoneShop.AsObject;
        const phoneShop = fromPhoneShop(obj);
        expect(phoneShop.toObject()).toEqual(obj);
    });

    it('Should ignore extra params', () => {
        const fromUniverse = createFromObject(Universe);
        const planetsList = ['Earth', 'Mars', 'Venus'];
        const obj = {
            planetsList,
            extra: 'data',
        } as Universe.AsObject;
        const universe = fromUniverse(obj);
        expect(universe.toObject()).toEqual({ planetsList } satisfies Universe.AsObject);
    });

    it('Should ignore extra factory params', () => {
        const fromUniverse = createFromObject(Universe);
        const planetsList = ['Earth', 'Mars', 'Venus'];
        const obj = {
            planetsList,
            more: {
                nested: 'data',
            },
        } as Universe.AsObject;
        const universe = fromUniverse(obj);
        expect(universe.toObject()).toEqual({ planetsList } satisfies Universe.AsObject);
    });

    it('Should throw when lack of params', () => {
        const fromBookStore = createFromObject(BookStore);
        const obj = {
            name: 'Esperanto',
        } as BookStore.AsObject;
        expect(() => fromBookStore(obj)).toThrowError(`Missing property 'shelf'`);
    });

    it('Should throw when missing factory', () => {
        // @ts-expect-error eslint-disable-line @typescript-eslint/ban-ts-comment
        const fromPhoneShop = createFromObject(PhoneShop, {});
        const obj = {
            id: 1,
            phone: {
                model: 'iPhone 14',
                diagonal: 6.5,
                price: 1028,
            },
        } satisfies PhoneShop.AsObject;
        expect(() => fromPhoneShop(obj)).toThrowError(`Missing factory for 'phone'`);
    });

    it('Should not throw when lack of array params', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {} as Universe.AsObject;
        expect(() => fromUniverse(obj)).not.toThrowError(`Missing property 'planetsList'`);
        expect(() => fromUniverse(obj)).not.toThrow();
    });

    it('Should throw when null value', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {
            planetsList: null,
        } as unknown as Universe.AsObject;
        expect(() => fromUniverse(obj)).toThrowError(`Null value for key 'planetsList'`);
    });

    it('Should not throw when extra null value', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {
            planetsList: ['Saturn'],
            extra: null,
        } as Universe.AsObject;
        expect(() => fromUniverse(obj)).not.toThrowError(`Null value for key 'extra'`);
        expect(() => fromUniverse(obj)).not.toThrow();
    });
});

describe('Oneof rule', () => {
    it('Should work with oneof rule', () => {
        const fromNewspaper = createFromObject(Newspaper, {
            adsByPageMap: createFromObject(Ads),
        });
        const objNews = {
            id: 1,
            name: 'The New York Times',
            isAds: true,
            isNews: true,
            contentByPageMap: [],
            adsByPageMap: [],
        } satisfies Newspaper.AsObject;
        const objAds = {
            id: 2,
            name: 'RBK',
            isNews: true,
            isAds: true,
            contentByPageMap: [],
            adsByPageMap: [],
        } satisfies Newspaper.AsObject;
        const newspaperNews = fromNewspaper(objNews);
        const newspaperAds = fromNewspaper(objAds);
        expect(newspaperNews.toObject()).toEqual({ ...objNews, isAds: false });
        expect(newspaperAds.toObject()).toEqual({ ...objAds, isNews: false });
    });
});

describe('Validation', () => {
    it('Should validate simple type', () => {
        const fromBookStore = createFromObject(BookStore);
        const obj = {
            name: 'Harry Potter',
            shelf: 'second',
        } as unknown as BookStore.AsObject;
        expect(() => fromBookStore(obj)).toThrowError(`Invalid type for 'shelf' (expected 'number', got 'string')`);
    });

    it('Should validate nested structure', () => {
        const fromPhoneShop = createFromObject(PhoneShop, {
            phone: createFromObject(Phone, {
                company: createFromObject(Company),
            }),
        });
        const obj = {
            id: 1,
            phone: 123,
        } as unknown as PhoneShop.AsObject;
        expect(() => fromPhoneShop(obj)).toThrowError(`Invalid type for 'phone' (expected 'object', got 'number')`);
    });

    it('Should not throw on undefined objects', () => {
        const fromPhoneShop = createFromObject(PhoneShop, {
            phone: createFromObject(Phone, {
                company: createFromObject(Company),
            }),
        });
        const obj = {
            id: 1,
            phone: undefined,
        } satisfies PhoneShop.AsObject;
        expect(() => fromPhoneShop(obj)).not.toThrow();
    });

    it('Should validate simple array', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {
            planetsList: true,
        } as unknown as Universe.AsObject;
        expect(() => fromUniverse(obj)).toThrowError(`Invalid type for 'planetsList' (expected array, got 'boolean')`);
    });

    it('Should validate simple false array', () => {
        const fromBookStore = createFromObject(BookStore);
        const obj = {
            name: 'Gary Garrison',
            shelf: [4, 2],
        } as unknown as BookStore.AsObject;
        expect(() => fromBookStore(obj)).toThrowError(`Invalid type for 'shelf' (expected 'number', got array)`);
    });
});

describe('Repeated rule', () => {
    it('Should work with simple array', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {
            planetsList: ['Earth', 'Mars', 'Venus'],
        } satisfies Universe.AsObject;
        const universe = fromUniverse(obj);
        expect(universe.toObject()).toEqual(obj);
    });

    it('Should work with empty array', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {
            planetsList: [],
        } satisfies Universe.AsObject;
        const universe = fromUniverse(obj);
        expect(universe.toObject()).toEqual(obj);
    });


    it('Should work with array structure', () => {
        const fromForest = createFromObject(Forest, {
            treesList: createFromObject(Tree),
            info: createFromObject(Info),
        });
        const obj = {
            treesList: [
                { age: 1, height: 10 },
                { age: 5, height: 42 },
            ],
            info: {
                name: 'Forest',
                numberOfTrees: 4000,
            },
        } satisfies Forest.AsObject;
        const forest = fromForest(obj);
        expect(forest.toObject()).toEqual(obj);
    });

    it('Should throw when null in array', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {
            planetsList: [null],
        } as unknown as Universe.AsObject;
        expect(() => fromUniverse(obj)).toThrowError(`Null value for key 'planetsList'`);
    });

    it('Should throw when mixed array', () => {
        const fromUniverse = createFromObject(Universe);
        const obj = {
            planetsList: ['Saturn', {}],
        } as Universe.AsObject;
        expect(() => fromUniverse(obj)).toThrowError(`Mixed array for 'planetsList'`);
    });
});

describe('Recursive messages', () => {
    it('Should work with recursive', () => {
        const fromSpices = createFromObject(Spices, {
            mixed: createFromObject(MixedSpice, {
                spicesList: createFromObjectRecursive(Spices),
            }),
        });
        const obj = {
            name: 'Pork',
            mixed: {
                spicesList: [
                    { name: 'Pepper' },
                    {
                        name: 'Salt',
                        mixed: {
                            spicesList: [{
                                name: 'Dark',
                                mixed: { spicesList: [{ name: 'Void' }] },
                            }],
                        },
                    },
                ],
            },
        } satisfies Spices.AsObject;
        const spices = fromSpices(obj);
        expect(spices.toObject()).toEqual(obj);
    });

    it('Should throw when createFromRecursiveObject used outside', () => {
        const fromPhoneShop = createFromObjectRecursive(PhoneShop);
        const obj = {
            id: 1,
            phone: {
                model: 'iPhone 14 Pro Max',
                diagonal: 6.9,
                price: 1999,
            },
        } satisfies PhoneShop.AsObject;
        expect(() => fromPhoneShop(obj)).toThrowError(`Missing factory for 'phone'`);
    });
});

describe('Map rule', () => {
    it('Should work with simple map', () => {
        const fromNewspaper = createFromObject(Newspaper, {
            adsByPageMap: createFromObject(Ads),
        });
        const obj = {
            id: 1,
            name: 'The New York Times',
            isAds: false,
            isNews: true,
            contentByPageMap: [
                [1, 'fist page'],
                [2, 'second page'],
            ],
            adsByPageMap: [],
        } satisfies Newspaper.AsObject;

        const newspaper = fromNewspaper(obj);
        expect(newspaper.toObject()).toEqual(obj);
    });

    it('Should work with nested type', () => {
        const fromNewspaper = createFromObject(Newspaper, {
            adsByPageMap: createFromObject(Ads),
        });
        const obj = {
            id: 1,
            name: 'The New York Times',
            isAds: false,
            isNews: true,
            contentByPageMap: [],
            adsByPageMap: [
                [1, { data: 'Google' }],
                [2, { data: 'Facebook' }],
            ],
        } satisfies Newspaper.AsObject;

        const newspaper = fromNewspaper(obj);
        expect(newspaper.toObject()).toEqual(obj);
    });
});