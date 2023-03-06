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

const recursiveFactories = new WeakMap<MessageConstructor<Message>, MessageFactories<Message>>();

const SETTER_PREFIX = 'set';
const CLEAR_PREFIX = 'clear';

export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T>>): FromObject<T>;
export function createFromObject<T extends Message>(MessageType: MessageConstructor<NonEmptyFactory<T>>, factories: MessageFactories<T>): FromObject<T>
export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T> | NonEmptyFactory<T>>, factories?: MessageFactories<T>): FromObject<T> {
    const allFactories = factories ?? {} as MessageFactories<T>;
    const recursiveFactory = recursiveFactories.get(MessageType);
    if (recursiveFactory) {
        Object.assign(recursiveFactory, allFactories);
        recursiveFactories.delete(MessageType);
    }
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        validateMissingProps(instance, data);
        for (const [prop, value] of Object.entries(filterExtraProps(instance, data))) {
            const result = getResult(allFactories, prop, value);
            const setter = getMethod(prop);
            callMethod(instance, setter, result);
        }
        return instance;
    };
}

function getResult<T extends Message>(factories: MessageFactories<T>, prop: string, value: unknown): unknown {
    if (Array.isArray(value)) {
        if (value.length === 0 || !isArrayOfObjects(value, prop)) {
            return value;
        }
        validateMissingFactory(factories, prop);
        return value.map((child) => callMethod(factories, prop, child));
    }
    if (isObject(value, prop)) {
        validateMissingFactory(factories, prop);
        return callMethod(factories, prop, value);
    }
    return value;
}

function callMethod<T extends object, R>(obj: T, key: string, value: unknown): R {
    return (obj[key as keyof T] as (value: unknown) => R)(value);
}

function getProp(key: string, prefix = SETTER_PREFIX): string {
    const prop = key.slice(prefix.length);
    return prop.slice(0, 1).toLowerCase() + prop.slice(1);
}

function getMethod(prop: string, prefix = SETTER_PREFIX): string {
    return `${prefix}${prop[0].toUpperCase()}${prop.slice(1)}`;
}

function getInstanceProps<T extends Message>(instance: T): string[] {
    return Object.keys(Object.getPrototypeOf(instance))
        .filter((key) => key.startsWith(SETTER_PREFIX))
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

function validateMissingFactory<T extends Message>(factories: MessageFactories<T>, prop: string): void {
    if (!(prop in factories)) {
        throw new Error(`Missing factory for '${prop}'`);
    }
}

function isObject(value: unknown, prop: string): boolean {
    if (value === null) {
        throw new Error(`Null value for key '${prop}'`);
    }
    return typeof value === 'object';
}

function isArrayOfObjects(arr: unknown[], prop: string): boolean {
    if (arr.every((item) => isObject(item, prop))) {
        return true;
    }
    if (arr.every((item) => !isObject(item, prop))) {
        return false;
    }
    throw new Error(`Mixed array for '${prop}'`);
}


export function createFromObjectRecursive<T extends Message>(MessageType: MessageConstructor<NonEmptyFactory<T>>): FromObject<T> {
    const factories = {} as MessageFactories<T>;
    recursiveFactories.set(MessageType, factories);
    const propertyDescriptors = Object.keys(MessageType.prototype)
        .filter((key) => key.startsWith(SETTER_PREFIX))
        .map(key => getProp(key) as keyof MessageFactories<T>)
        .reduce<PropertyDescriptorMap>((acc, prop) => ({
            ...acc,
            [prop]: {
                get() {
                    validateMissingFactory(factories, prop);
                    return factories[prop];
                },
            },
        }), {});

    const dynamicFactories = Object.defineProperties({}, propertyDescriptors) as MessageFactories<T>;
    return createFromObject(MessageType, dynamicFactories);
}
