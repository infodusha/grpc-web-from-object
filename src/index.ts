import { Message } from "google-protobuf";

type MessageInstance<T extends Message> = new () => T;

type AsObject<T extends Message> = ReturnType<T["toObject"]>;
type FromObject<T extends Message> = (data: AsObject<T>) => T;

export function createFromObject<T extends Message>(MessageType: MessageInstance<T>): FromObject<T> {
    return (data: AsObject<T>): T => {
        const instance = new MessageType();
        for (const [key, value] of Object.entries(data)) {
            const setter = getSetter(key) as keyof T;
            (instance[setter] as (value: unknown) => void)(value);
        }
        return instance;
    };
}

function getSetter(key: string): string {
    return `set${key[0].toUpperCase()}${key.slice(1)}`;
}

// function createFromObject<T extends typeof Message>(Mes: T, struct: ReturnType<T['toObject']>) {
//     return (data: ReturnType<T['toObject']>): InstanceType<T> => {
//         return new Mes();
//     };
// }


