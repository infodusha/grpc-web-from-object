# grpc-web-from-object
fromObject method for grpc-web

## Usage
```typescript
import { createFromObject } from 'grpc-web-from-object';
import { MyMessage } from './my-message_pb';
import { MyInnerMessage } from './my-inner-message_pb';

const fromMyMessage = createFromObject(MyMessage);
const fromMyInnerMessage = createFromObject(MyInnerMessage);

const myMessage = fromMyMessage({
    keyOne: 1,
    keyTwo: 'foo',
    keyThree: fromMyInnerMessage({
        keyA: 2,
        keyB: 'bar',
    }),
});
```

## Authors
- [@infodusha](https://github.com/infodusha)
- [@Exiragor](https://github.com/Exiragor)

## Contributing
Contributions are always welcome!

## License
[Apache-2.0](https://choosealicense.com/licenses/apache-2.0/)
