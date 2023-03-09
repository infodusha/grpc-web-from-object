import { Message, Map as ProtobufMap } from "google-protobuf";

export type FromObject<T extends Message> = (data: AsObject<T>) => T;

type MessageConstructor<T extends Message> = new () => T;

type AsObject<T extends Message> = ReturnType<T["toObject"]>;

type MessageFnReturnValue<T extends Message, Key extends keyof T> = T[Key] extends (...args: unknown[]) => infer R ? R : never;

type IsProtobufMap<T> = T extends ProtobufMap<unknown, infer X> ? X : T;

type IsMessageOrMessageArray<T> = T extends Array<infer R> ? IsMessageOrMessageArray<R> : T extends Message | undefined ? Exclude<T, undefined> : never;

type GetMessageKeys<T extends Message> = {
    [K in keyof T]: K extends `get${string}` ? IsMessageOrMessageArray<IsProtobufMap<MessageFnReturnValue<T, K>>> extends never ? never : K : never
}[keyof T];

type MessageToObjectKey<T extends string> = T extends `get${infer R}` ? Uncapitalize<R> : never;
type AsObjectToMessageKey<R> = R extends string ? `get${Capitalize<R>}` : never;

type MessageFactories<T extends Message> = {
    [K in MessageToObjectKey<GetMessageKeys<T>>]: FromObject<IsMessageOrMessageArray<IsProtobufMap<MessageFnReturnValue<T, AsObjectToMessageKey<K> extends keyof T ? AsObjectToMessageKey<K> : never>>>>
}

type EmptyFactory<T extends Message> = GetMessageKeys<T> extends never ? T : never;
type NonEmptyFactory<T extends Message> = GetMessageKeys<T> extends never ? never : T;

const recursiveFactories = new WeakMap<MessageConstructor<Message>, MessageFactories<Message>>();

const SETTER_PREFIX = 'set';
const GETTER_PREFIX = 'get';
const CLEAR_PREFIX = 'clear';

export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T>>): FromObject<T>;
export function createFromObject<T extends Message>(MessageType: MessageConstructor<NonEmptyFactory<T>>, factories: MessageFactories<T>): FromObject<T>
export function createFromObject<T extends Message>(MessageType: MessageConstructor<EmptyFactory<T> | NonEmptyFactory<T>>, factories?: MessageFactories<T>): FromObject<T> {
    const allFactories = factories ?? {} as MessageFactories<T>;
    const recursiveFactory = recursiveFactories.get(MessageType);
    if (recursiveFactory && Object.keys(allFactories).length > 0) {
        Object.assign(recursiveFactory, allFactories);
        recursiveFactories.delete(MessageType);
    }
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        validateMissingProps(instance, data);
        for (const [prop, value] of Object.entries(filterExtraProps(instance, data))) {
            if (Array.isArray(value) && isProtobufMap(instance, prop)) {
                const mapMethod = getMethod(prop, GETTER_PREFIX);
                const map = callMethod(instance, mapMethod) as ProtobufMap<unknown, unknown>;
                for (const [k, v] of value) {
                    if(!isObject(v, prop)) {
                        map.set(k, v);
                        continue;
                    }
                    validateMissingFactory(allFactories, prop);
                    map.set(k, callMethod(allFactories, prop, v));
                }
                continue;
            }
            const result = getResult(allFactories, prop, value);
            validateType(instance, prop, value);
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

function callMethod<T extends object, R>(obj: T, key: string, value?: unknown): R {
    return (obj[key as keyof T] as (value: unknown) => R)(value);
}

function getProp(key: string, prefix = SETTER_PREFIX): string {
    const prop = key.slice(prefix.length);
    return prop.slice(0, 1).toLowerCase() + prop.slice(1);
}

function getMethod(prop: string, prefix = SETTER_PREFIX): string {
    return `${prefix}${prop[0].toUpperCase()}${prop.slice(1)}`;
}

function getInstancePropsFromKeys(keys: string[], prefix: string): string[] {
    return keys
        .filter((key) => key.startsWith(prefix))
        .map(key => getProp(key, prefix));
}

function getInstanceProps<T extends Message>(instance: T): string[] {
    const keys = Object.keys(Object.getPrototypeOf(instance));
    const setters = getInstancePropsFromKeys(keys, SETTER_PREFIX);
    const maps = getInstancePropsFromKeys(keys, CLEAR_PREFIX).filter(prop => isProtobufMap(instance, prop));
    return [...setters, ...maps];
}

function isProtobufMap<T extends Message>(instance: T, prop: string): boolean {
    return callMethod(instance, getMethod(prop, GETTER_PREFIX)) instanceof ProtobufMap;
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

function validateMissingFactory<T extends Message>(factories: MessageFactories<T>, prop: string): asserts prop is keyof MessageFactories<T> {
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

function validateType<T extends Message>(instance: T, prop: string, value: unknown): void {
    const getter = getMethod(prop, GETTER_PREFIX);
    const instanceValue = callMethod(instance, getter);
    const expectedType = instanceValue !== undefined ? typeof instanceValue : 'object';
    const actualType = typeof value;
    if (Array.isArray(instanceValue) && !Array.isArray(value)) {
        throw new Error(`Invalid type for '${prop}' (expected array, got '${actualType}')`);
    }
    if (!Array.isArray(instanceValue) && Array.isArray(value)) {
        throw new Error(`Invalid type for '${prop}' (expected '${expectedType}', got array)`);
    }
    if (expectedType !== actualType) {
        throw new Error(`Invalid type for '${prop}' (expected '${expectedType}', got '${actualType}')`);
    }
}

export function createFromObjectRecursive<T extends Message>(MessageType: MessageConstructor<NonEmptyFactory<T>>): FromObject<T> {
    const factories = {} as MessageFactories<T>;
    recursiveFactories.set(MessageType, factories);
    const propertyDescriptors = getInstanceProps(new MessageType())
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
