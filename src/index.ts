import { Message } from "google-protobuf";

type FromObject<T extends Message> = (data: AsObject<T>) => T;
type MessageConstructor<T extends Message> = new () => T;

type AsObject<T extends Message> = ReturnType<T["toObject"]>;

type MessageReturnValue<T extends Message, Key extends keyof T> = T[Key] extends (...args: unknown[]) => infer R ? R : never;

type CheckMessage<T> = T extends Message | undefined ? Exclude<T, undefined> : never;

type GetMessageKeys<T extends Message> = {
    [K in keyof T]: K extends `get${string}` ? CheckMessage<MessageReturnValue<T, K>> extends never ? never : K : never
}[keyof T];

type GetKeys<T extends Message> = {
    [K in keyof T]: K extends `get${infer R}` ? CheckMessage<MessageReturnValue<T, K>> extends never ? never : R : never
}[keyof T];

type MessageToObjectKey<T extends string> = T extends `${infer R}List` ? `${Uncapitalize<R>}s` : Uncapitalize<T>;
type MessageToAsObjectKey<T extends Message, R> = R extends string ? `get${Capitalize<R>}` extends keyof T ? `get${Capitalize<R>}` : never : never;

type MessageFactories<T extends Message> = {
    [K in MessageToObjectKey<GetKeys<T>>]: FromObject<CheckMessage<MessageReturnValue<T, MessageToAsObjectKey<T, K> extends keyof T ? MessageToAsObjectKey<T, K> : never>>>
}
type EmptyFactory<T extends Message> = GetMessageKeys<T> extends never ? T : never;

export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T>>): FromObject<T>;
export function createFromObject<T extends Message>(MessageType: MessageConstructor<T>, factories: MessageFactories<T>): FromObject<T>
export function createFromObject<T extends Message>(MessageType: MessageConstructor<T> | MessageConstructor<EmptyFactory<T>>, factories?: MessageFactories<T>): FromObject<T> {
    const allFactories = factories ?? {} as MessageFactories<T>;
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        for (const [key, value] of Object.entries(data)) {
            if (typeof value !== 'object' && value !== null) {
                setValue(instance, key, value);
            } else {
                if (key in allFactories) {
                    const factoryKey = key as keyof MessageFactories<T>;
                    const childInstance = (allFactories[factoryKey] as (value: unknown) => T)(value);
                    setValue(instance, key, childInstance);
                } else {
                    throw new Error(`No factory for ${key}`);
                }
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
