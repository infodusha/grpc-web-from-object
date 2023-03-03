import { Message } from "google-protobuf";

export type FromObject<T extends Message> = (data: AsObject<T>) => T;

type MessageConstructor<T extends Message> = new () => T;

type AsObject<T extends Message> = ReturnType<T["toObject"]>;

type MessageFnReturnValue<T extends Message, Key extends keyof T> = T[Key] extends (...args: unknown[]) => infer R ? R : never;

type IsMessageOrMessageArray<T> = T extends Array<infer R> ? IsMessageOrMessageArray<R> : T extends Message | undefined ? Exclude<T, undefined> : never;

type GetMessageKeys<T extends Message> = {
    [K in keyof T]: K extends `get${string}` ? IsMessageOrMessageArray<MessageFnReturnValue<T, K>> extends never ? never : K : never
}[keyof T];

type MessageToObjectKey<T extends string> = T extends `get${infer R}` ? Uncapitalize<R> : never;
type AsObjectToMessageKey<R> = R extends string ? `get${Capitalize<R>}` : never;

type MessageFactories<T extends Message> = {
    [K in MessageToObjectKey<GetMessageKeys<T>>]: FromObject<IsMessageOrMessageArray<MessageFnReturnValue<T, AsObjectToMessageKey<K> extends keyof T ? AsObjectToMessageKey<K> : never>>>
}

type EmptyFactory<T extends Message> = GetMessageKeys<T> extends never ? T : never;
type NonEmptyFactory<T extends Message> = GetMessageKeys<T> extends never ? never : T;


export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T>>): FromObject<T>;
export function createFromObject<T extends Message>(MessageType: MessageConstructor<NonEmptyFactory<T>>, factories: MessageFactories<T>): FromObject<T>
export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T> | NonEmptyFactory<T>>, factories?: MessageFactories<T>): FromObject<T> {
    const allFactories = factories ?? {} as MessageFactories<T>;
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        validateMissingProps(instance, data);
        for (const [key, value] of Object.entries(data)) {
            if (value === null) {
                throw new Error(`Null value for key ${key}`);
            }
            if (typeof value !== 'object') {
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
                validateMissingFactory(key, value);
                setValue(instance, key, value);
            }
        }
        return instance;
    };
}

 function setValue<T extends Message>(instance: T, key: string, value: unknown): void {
    const setter = getSetter<T>(key);
    if (setter in instance) {
        (instance[setter] as (value: unknown) => void)(value);
    }
}

type SetterKey<T extends Message> = {
    [K in keyof T]: K extends `set${string}` ? K : never
}[keyof T];

function getSetter<T extends Message>(key: string): SetterKey<T> {
    return `set${key[0].toUpperCase()}${key.slice(1)}` as SetterKey<T>;
}

function validateMissingProps<T extends Message>(instance: T, data: AsObject<T>): void {
    const dataSetters = Object.keys(data).map((key) => getSetter<T>(key));
    const instanceSetters = Object.keys(Object.getPrototypeOf(instance)).filter((key) => key.startsWith('set'));
    for (const key of instanceSetters) {
        if (!dataSetters.includes(key as SetterKey<T>) && instance['clear' + key.slice(3) as keyof T] === undefined) {
            const prop = key.slice(3, 4).toLowerCase() + key.slice(4);
            throw new Error(`Missing property '${prop}'`);
        }
    }
}

function validateMissingFactory(key: string, value: unknown): void {
    if (Array.isArray(value)) {
        for (const v of value) {
            validateMissingFactory(key, v);
        }
        return;
    }
    if (typeof value === 'object') {
        throw new Error(`Missing factory for '${key}'`);
    }
}
