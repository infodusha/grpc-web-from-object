# ⛔️ DEPRECATED
Use [from-protobuf-object](https://github.com/infodusha/from-protobuf-object) instead.

# grpc-web-from-object
fromObject method for grpc-web

In general that is opposite for 'toObject' method in protobufjs.

### Supports:
* Simple keys
* Repeated
* OneOf
* Protobuf Map
* Recursive messages
* Type validation (at runtime)
* TypeScript
* Missing keys validation

## Installation
`npm i grpc-web-from-object`

## Usage
```typescript
import { createFromObject } from 'grpc-web-from-object';
import { MyMessage } from './my-message_pb';
import { MyInnerMessage } from './my-inner-message_pb';

const fromMyMessage = createFromObject(MyMessage, {
    keyThree: createFromObject(MyInnerMessage),
});

const myMessage = fromMyMessage({
    keyOne: 1,
    keyTwo: 'foo',
    keyThree: {
        keyA: 2,
        keyB: 'bar',
    },
});
```

#### For recursive message:
```typescript
import { createFromObject, createFromObjectRecursive } from 'grpc-web-from-object';
import { MyMessage } from './my-message_pb';

const fromMyMessage = createFromObject(MyMessage, {
    message: createFromObjectRecursive(MyMessage),
});
```

## Authors
- [@infodusha](https://github.com/infodusha)
- [@Exiragor](https://github.com/Exiragor)

## Contributing
Contributions are always welcome!

## License
[Apache-2.0](https://choosealicense.com/licenses/apache-2.0/)
