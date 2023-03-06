import { createFromObject } from "../lib";
import { BookStore } from "./test-data/generated/book-store_pb";
import { expectError, expectType } from "tsd";
import {Company, Phone, PhoneShop} from "./test-data/generated/phone-shop_pb";

expectType<(data: BookStore.AsObject) => BookStore>(createFromObject(BookStore));
expectError(createFromObject(BookStore, { extra: () => BookStore }));

expectType<(data: PhoneShop.AsObject) => PhoneShop>(createFromObject(PhoneShop, {
    phone: createFromObject(Phone, {
        company: createFromObject(Company),
    }),
}));
expectError(createFromObject(PhoneShop));
expectError(createFromObject(PhoneShop, {}));
expectError(createFromObject(PhoneShop, {
    phone: createFromObject(Company),
}));
