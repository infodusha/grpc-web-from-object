import { createFromObject } from "../src";
import { BookStore } from "./test-data/generated/book-store_pb";
import { Company, Phone, PhoneShop } from "./test-data/generated/phone-shop_pb";
import { Forest, Info, Tree } from "./test-data/generated/forest_pb";

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
});