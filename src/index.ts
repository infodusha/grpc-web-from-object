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

const SETTER_PREFIX = 'set';
const CLEAR_PREFIX = 'clear';

export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T>>): FromObject<T>;
export function createFromObject<T extends Message>(MessageType: MessageConstructor<NonEmptyFactory<T>>, factories: MessageFactories<T>): FromObject<T>
export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T> | NonEmptyFactory<T>>, factories?: MessageFactories<T>): FromObject<T> {
    const allFactories = factories ?? {};
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        validateMissingProps(instance, data);
        const usedData = filterExtraProps(instance, data);
        for (const [key, value] of Object.entries(usedData)) {
            if (value === null) {
                throw new Error(`Null value for key '${key}'`);
            }
            if (typeof value !== 'object') {
                setValue(instance, key, value);
                continue;
            }
            if (key in allFactories) {
                if (Array.isArray(value)) {
                    const childrenInstance = value.map((child) => callMethod(allFactories, key, child));
                    setValue(instance, key, childrenInstance);
                } else {
                    const childInstance = callMethod(allFactories, key, value);
                    setValue(instance, key, childInstance);
                }
            } else {
                validateMissingFactory(instance, key, value);
                setValue(instance, key, value);
            }
        }
        return instance;
    };
}

function callMethod<T extends object, R>(obj: T, key: string, value: unknown): R {
    return (obj[key as keyof T] as (value: unknown) => R)(value);
}

 function setValue<T extends Message>(instance: T, key: string, value: unknown): void {
    const setter = getMethod(key);
    callMethod<T, void>(instance, setter, value);
}

function getProp(key: string, prefix = SETTER_PREFIX): string {
    const prop = key.slice(prefix.length);
    return prop.slice(0, 1).toLowerCase() + prop.slice(1);
}

function getMethod(prop: string, prefix = SETTER_PREFIX): string {
    return `${prefix}${prop[0].toUpperCase()}${prop.slice(1)}`;
}

function checkIfProp(key: string, prefix = SETTER_PREFIX): boolean {
    return key.startsWith(prefix);
}

function getInstanceProps<T extends Message>(instance: T): string[] {
    return Object.keys(Object.getPrototypeOf(instance))
        .filter((key) => checkIfProp(key))
        .map(key => getProp(key));
}

function isOptional<T extends Message>(instance: T, prop: string): boolean {
    const clearMethod = getMethod(prop, CLEAR_PREFIX);
    return clearMethod in instance;
}

function validateMissingProps<T extends Message>(instance: T, data: AsObject<T>): void {
    const instanceProps = getInstanceProps(instance);
    const dataProps = Object.keys(data);
    for (const prop of instanceProps) {
        if (!dataProps.includes(prop) && !isOptional(instance, prop)) {
            throw new Error(`Missing property '${prop}'`);
        }
    }
}

function filterExtraProps<T extends Message>(instance: T, data: AsObject<T>): AsObject<T> {
    const instanceProps = getInstanceProps(instance);
    return Object.fromEntries(Object.entries(data).filter(([key]) => instanceProps.includes(key))) as AsObject<T>;
}

function validateMissingFactory<T extends Message>(instance: T, key: string, value: unknown): void {
    if (Array.isArray(value)) {
        for (const v of value) {
            validateMissingFactory(instance, key, v);
        }
        return;
    }
    if (typeof value === 'object') {
        throw new Error(`Missing factory for '${key}'`);
    }
}
