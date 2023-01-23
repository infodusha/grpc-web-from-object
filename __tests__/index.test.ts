import { createFromObject } from "../src";
import { BookStore } from "./test-data/generated/book-store_pb";

describe('createFromObject', () => {
    it('Should work', () => {
        const fromExampleMessage = createFromObject(BookStore);
        const obj = {
            name: 'Harry Potter',
            shelf: 3,
        } satisfies BookStore.AsObject;
        const exampleMessage = fromExampleMessage(obj);
        expect(exampleMessage.toObject()).toEqual(obj);
    });
});