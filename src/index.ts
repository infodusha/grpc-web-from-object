import { Message } from "google-protobuf";
import {Phone, PhoneShop} from "../__tests__/test-data/generated/phone-shop_pb";
type FromObject<T extends Message> = (data: AsObject<T>) => T;

type MessageInstance<T extends Message> = new () => T;

type AsObject<T extends Message> = ReturnType<T["toObject"]>;

type MessageReturnValue<T extends Message, Key extends keyof T> = T[Key] extends (...args: unknown[]) => infer R ? R : never;

type CheckMessage<T> = T extends Message | undefined ? Exclude<T, undefined> : never;

type GetMessageKeys<T extends Message> = {
    [K in keyof T]: K extends `get${string}` ? CheckMessage<MessageReturnValue<T, K>> extends never ? never : K : never
}[keyof T];

// type GetKeys<T extends Message> = {
//     [K in keyof T]: K extends `get${infer R}` ? CheckMessage<MessageReturnValue<T, K>> extends never ? never : R : never
// }[keyof T];

type MessageToObjectKey<T extends string> = T extends `${infer R}List` ? `${Uncapitalize<R>}s` : Uncapitalize<T>;

type MessageKeys<T extends Message> = MessageToObjectKey<GetMessageKeys<T>>;

type MessageFactories<T extends Message> = {
    [K in GetMessageKeys<T>]: FromObject<CheckMessage<MessageReturnValue<T, K>>>
}

type Test = MessageFactories<PhoneShop>;

// type MessageFactories<T extends Message> = {
//     [K in keyof MessageKeys<T>]: MessageFactoriesPre<T>
// }


export function createFromObject<T extends Message>(MessageType: MessageInstance<T>, factories: MessageFactories<T> = {}): FromObject<T> {
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        for (const [key, value] of Object.entries(data)) {
            const setter = getSetter(key) as keyof T;
            if (typeof value !== 'object' && value !== null) {
                (instance[setter] as (value: unknown) => void)(value);
            } else {
                if (key in factories) {
                    const factoryKey = key as keyof MessageFactories<T>;
                    const childInstance = (factories[factoryKey] as (value: unknown) => T)(value);
                    (instance[setter] as (value: unknown) => void)(childInstance);
                } else {
                    throw new Error(`No factory for ${key}`);
                }
            }
        }
        return instance;
    };
}

function getSetter(key: string): string {
    return `set${key[0].toUpperCase()}${key.slice(1)}`;
}

