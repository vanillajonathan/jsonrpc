/**
 * Provides RPC functionality over WebSockets using the JSON-RPC protocol.
 *
 * @see http://www.jsonrpc.org/
 * @example
 * const socket = new WebSocket('wss://www.example.com/rpc');
 * const rpc = new JSONRPC(socket);
 * rpc.call('greet', { name: 'Alice' }).then(function(response) {
 *     console.log("Success!", response);
 * }).catch(function(error) {
 *     console.log("Failed!", error);
 * });
 */
class JSONRPC {
    /**
     * @param {WebSocket} webSocket - WebSocket instance to use for RPC.
     * @param {object} [methods={}] - Local methods that the server can invoke.
     * @throws {TypeError} - If argument is not a WebSocket.
     */
    constructor(webSocket, methods = {}) {
        if (!(webSocket instanceof WebSocket)) {
            throw new TypeError('Argument is not of type WebSocket.');
        }

        /** Local methods that the server can invoke. */
        this.methods = methods;

        this._callbackId = 0;
        this._callbacks = new Map();
        this._socket = webSocket;

        this._socket.onmessage = (message) => {
            let data;

            try {
                data = JSON.parse(message.data);
            } catch (e) {
                this._error(e, message);
                return;
            }

            if (data instanceof Array) {
                data.forEach(x => this._processMessage(x));
            } else {
                this._processMessage(data);
            }
        };
    }

    /**
     * Gets the callback function that gets called when an error occurs.
     * @type {function}
     */
    get onerror() {
        return this._onerror;
    }

    /**
     * Sets the callback function that gets called when an error occurs.
     * @type {function(error: Error)}
     * @throws {TypeError} - If callback is not a function.
     */
    set onerror(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('Callback is not a function.');
        }
        this._onerror = callback;
    }

    /**
     * Gets the callback function for error responses.
     * @type {function}
     */
    get onResponseError() {
        return this._onResponseError;
    }

    /**
     * Sets the callback function for error responses.
     * @type {function}
     * @throws {TypeError} - If callback is not a function.
     */
    set onResponseError(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('Callback is not a function.');
        }
        this._onResponseError = callback;
    }

    /**
     * Call a remote function.
     * @param {string} method - Method name to call.
     * @param {object} params - Method parameters to pass.
     * @returns {Promise}
     */
    call(method, params) {
        const message = {
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: this._callbackId
        };
        this._callbackId++;
        const promise = new Promise((resolve, reject) => {
            this._callbacks.set(message.id, { resolve, reject });
            this._socket.send(JSON.stringify(message));
        });

        return promise;
    }

    /**
     * Call a remote function as a notification without a callback.
     * @param {string} method - Method name to call.
     * @param {object} params - Method parameters to pass.
     */
    notify(method, params) {
        const message = {
            jsonrpc: '2.0',
            method: method,
            params: params
        };

        this._socket.send(JSON.stringify(message));
    }

    /**
     * @private
     */
    _error(message, data) {
        const error = new Error(message);
        error.data = data;
        if (this.onerror !== undefined) {
            this.onerror(error);
        }
    }

    /**
     * @private
     */
    _processMessage(data) {
        if (data.hasOwnProperty('result')) {
            if (this._callbacks.has(data.id)) {
                this._callbacks.get(data.id).resolve(data.result);
                this._callbacks.delete(data.id);
            } else {
                this._error(`Unknown response id: ${data.id}.`, data);
            }
        } else if (data.hasOwnProperty('method')) {
            if (this.methods.hasOwnProperty(data.method)) {
                const response = this.methods[data.method](data.params);
                if (data.id !== undefined) {
                    this._socket.send(JSON.stringify(response));
                }
            } else {
                this._error(`Server called method on client that does not exist: ${data.method}.`, data);
            }
        } else if (data.hasOwnProperty('error')) {
            if (this.onResponseError !== undefined) {
                this.onResponseError(data);
            }
            if (data.id !== undefined && this._callbacks.has(data.id)) {
                this._callbacks.get(data.id).reject(data);
                this._callbacks.delete(data.id);
            }
        } else {
            this._error('Invalid message received.', data);
        }
    }
}
