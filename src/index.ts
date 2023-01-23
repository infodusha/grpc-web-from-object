import { Message } from "google-protobuf";

export type FromObject<T extends Message> = (data: AsObject<T>) => T;

type MessageConstructor<T extends Message> = new () => T;

type AsObject<T extends Message> = ReturnType<T["toObject"]>;

type MessageReturnValue<T extends Message, Key extends keyof T> = T[Key] extends (...args: unknown[]) => infer R ? R : never;


type IsMessage<T> = T extends Message | undefined ? Exclude<T, undefined> : never;
type IsMessageArray<T> = T extends Array<infer R> ? IsMessage<R> : never;

type GetMessageObjectKeys<T extends Message> = {
    [K in keyof T]: K extends `get${string}` ? IsMessage<MessageReturnValue<T, K>> extends never ? never : K : never
}[keyof T];
type GetMessageArrayKeys<T extends Message> = {
    [K in keyof T]: K extends `get${string}` ? IsMessageArray<MessageReturnValue<T, K>> extends never ? never : K : never
}[keyof T];
type GetMessageKeys<T extends Message> = GetMessageObjectKeys<T> | GetMessageArrayKeys<T>;

type MessageToObjectKey<T extends string> = T extends `get${infer R}` ? Uncapitalize<R> : never;
type AsObjectToMessageKey<R> = R extends string ? `get${Capitalize<R>}` : never;

type MessageObjectFactories<T extends Message> = {
    [K in MessageToObjectKey<GetMessageObjectKeys<T>>]: FromObject<IsMessage<MessageReturnValue<T, AsObjectToMessageKey<K> extends keyof T ? AsObjectToMessageKey<K> : never>>>
}

type MessageArrayFactories<T extends Message> = {
    [K in MessageToObjectKey<GetMessageArrayKeys<T>>]: FromObject<IsMessageArray<MessageReturnValue<T, AsObjectToMessageKey<K> extends keyof T ? AsObjectToMessageKey<K> : never>>>
}

type MessageFactories<T extends Message> = MessageObjectFactories<T> & MessageArrayFactories<T>;

type EmptyFactory<T extends Message> = GetMessageKeys<T> extends never ? T : never;
type NonEmptyFactory<T extends Message> = GetMessageKeys<T> extends never ? never : T;


export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T>>): FromObject<T>;
export function createFromObject<T extends Message>(MessageType: MessageConstructor<NonEmptyFactory<T>>, factories: MessageFactories<T>): FromObject<T>
export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T> | NonEmptyFactory<T>>, factories?: MessageFactories<T>): FromObject<T> {
    const allFactories = factories ?? {} as MessageFactories<T>;
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        for (const [key, value] of Object.entries(data)) {
            if (value === null) {
                throw new Error(`Null value for key ${key}`);
            }
            if (typeof value !== 'object' && !Array.isArray(value)) {
                setValue(instance, key, value);
                continue;
            }
            if (key in allFactories) {
                const factoryKey = key as keyof MessageFactories<T>;
                if (Array.isArray(value)) {
                    const childrenInstance = value.map((item) => allFactories[factoryKey](item));
                    setValue(instance, key, childrenInstance);
                } else {
                    const childInstance = (allFactories[factoryKey] as (value: unknown) => T)(value);
                    setValue(instance, key, childInstance);
                }
            } else {
                throw new Error(`No factory for ${key}`);
            }
        }
        return instance;
    };
}

 function setValue<T extends Message>(instance: T, key: string, value: unknown): void {
    const setter = getSetter(key);
    (instance[setter] as (value: unknown) => void)(value);
}

type SetterKey<T extends Message> = {
    [K in keyof T]: K extends `set${string}` ? K : never
}[keyof T];

function getSetter<T extends Message>(key: string): SetterKey<T> {
    return `set${key[0].toUpperCase()}${key.slice(1)}` as SetterKey<T>;
}
