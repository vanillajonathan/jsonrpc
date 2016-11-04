# jsonrpc.js
Provides RPC functionality over WebSockets using the JSON-RPC protocol.

## Example
```javascript
const socket = new WebSocket('wss://www.example.com/rpc');
const rpc = new JSONRPC(socket);
// ...
rpc.call('greet', { name: 'Alice' }).then(function(response) {
    console.log("Success!", response);
}).catch(function(error) {
    console.log("Failed!", error);
});
```

Send a RPC notification (does not get a response).
```javascript
rpc.notify('greet', { name: 'Alice' });
```

Error listeners
```javascript
rpc.onerror = (error) => console.error(error);
rpc.onResponseError = (error) => console.warn(error);
```
