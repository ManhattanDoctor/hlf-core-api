**English** · [Русский](./README.ru.md)

# @hlf-core/api

> TypeScript library for connecting to Hyperledger Fabric: client, qscc system contract, block parsing and settings

[![npm version](https://img.shields.io/npm/v/@hlf-core/api.svg)](https://www.npmjs.com/package/@hlf-core/api)
[![Docs](https://img.shields.io/badge/docs-hlf.gnosisai.ru-1f6feb)](https://hlf.gnosisai.ru/docs/packages/api)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Full documentation: https://hlf.gnosisai.ru/docs/packages/api

The low-level network layer: connecting through `fabric-network`, access to the channel and contracts, queries to the `qscc` system contract and parsing of block structures.

The package knows nothing about commands or the transport protocol — it is responsible only for the connection and for turning Fabric's raw data into something usable. [@hlf-core/transport](https://www.npmjs.com/package/@hlf-core/transport) runs on top of it.

## Table of Contents

- [Overview](#overview)
  - [Key Features](#key-features)
- [Installation](#installation)
  - [Dependencies](#dependencies)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
  - [Connection](#connection)
  - [Wallet and Identity](#wallet-and-identity)
  - [Connection Profile](#connection-profile)
  - [Working with Blocks](#working-with-blocks)
- [API Reference](#api-reference)
  - [FabricApiClient](#fabricapiclient)
  - [IFabricConnectionSettings](#ifabricconnectionsettings)
  - [FabricContractQSCC](#fabriccontractqscc)
  - [FabricContract](#fabriccontract)
  - [FabricTransactionValidationCode](#fabrictransactionvalidationcode)
  - [FabricUtil](#fabricutil)
  - [FabricConnectionFileParser](#fabricconnectionfileparser)
  - [Factories](#factories)
- [Usage Examples](#usage-examples)
- [Important Notes](#important-notes)
- [Project Structure](#project-structure)
- [Related Packages](#related-packages)

## Overview

Working with Fabric from Node.js takes a lot of setup: assemble the connection profile, put the keys into a wallet, bring up a gateway, obtain the network, channel and contract, and — to read blocks — also call the system contract and decode protobuf. `@hlf-core/api` hides all of this behind a single object with clear properties.

### Key Features

- **Connect in a single call** — `connect()` assembles the wallet, gateway, network, channel and contract from the settings
- **Network access** — `network`, `channel`, `contract`, `gateway` as properties of the client
- **qscc system contract** — chain height, block by number, hash or transaction id, transaction by id
- **Block parsing** — decoding protobuf and enriching a block with its hash, number and date
- **Working with certificates** — loading PEM from files and injecting it into the connection profile
- **Validation codes** — the complete `FabricTransactionValidationCode` set
- **Factories** — reusing clients and storing settings for multiple connections

## Installation

```bash
npm install @hlf-core/api
```

### Dependencies

```json
{
    "@ts-core/common": "~3.0.7",
    "fabric-network": "2.2.16"
}
```

The `fabric-network` version is pinned exactly — it determines compatibility with the network version.

## Quick Start

```ts
import { FabricApiClient } from '@hlf-core/api';

let api = new FabricApiClient(logger, {
    fabricNetworkName: 'mychannel',
    fabricChaincodeName: 'mychaincode',
    fabricConnectionSettings: './connection.json',
    fabricIsDiscoveryEnabled: true,
    fabricIsDiscoveryAsLocalhost: true,

    fabricIdentity: 'user',
    fabricIdentityMspId: 'Org1MSP',
    fabricIdentityPrivateKey: privateKey,
    fabricIdentityCertificate: certificate
});

await api.connect();

// chaincode call
let result = await api.contract.evaluateTransaction('myFunction', 'arg');

// reading a block
let block = await api.qsccContract.getBlock(42);
console.log(block.number, block.hash, block.date);
```

## How It Works

### Connection

`connect()` establishes the connection and returns a promise that resolves on success:

```ts
public static async createConnection(settings: IFabricConnectionSettings, wallet?: Wallet): Promise<IFabricConnection> {
    // profile: a file path or a ready object
    // wallet: created from settings if not provided
    let gateway = new Gateway();
    await gateway.connect(gatewayConfig, gatewayOptions);

    let network = await gateway.getNetwork(settings.fabricNetworkName);
    let channel = network.getChannel();
    let contract = network.getContract(settings.fabricChaincodeName);
    return { gateway, wallet, network, channel, contract };
}
```

The result is stored in the `connection` property, and its setter does all the remaining work: it disconnects the previous gateway if there was one, creates the `qscc` system contract client and resolves or rejects the connection promise.

```ts
public set connection(value: IFabricConnection) {
    if (!_.isNil(this._connection)) {
        this._connection.gateway.disconnect();
    }
    this._connection = value;
    this._isConnected = !_.isNil(this._connection);
    this._qsccContract = !_.isNil(this._connection) ? new FabricContractQSCC(this) : null;
    ...
}
```

It follows that `disconnect()` is simply assigning `connection = null`: the gateway closes, the flag is reset, qscc is cleared.

### Wallet and Identity

If a wallet is not passed explicitly, it is created in memory from the settings:

```ts
public static async createWallet(settings: IFabricConnectionSettings): Promise<Wallet> {
    let item = await Wallets.newInMemoryWallet();
    let identity: X509Identity = {
        type: 'X.509',
        mspId: settings.fabricIdentityMspId,
        credentials: {
            privateKey: settings.fabricIdentityPrivateKey,
            certificate: settings.fabricIdentityCertificate
        }
    };
    item.put(settings.fabricIdentity, identity);
    ...
}
```

Keys are never written to disk — the application stores them however it sees fit and passes them in the settings. If `fabricTlsIdentity` is present, a second identity is placed into the wallet for mutual TLS.

### Connection Profile

`fabricConnectionSettings` accepts three forms: a path to a profile file, a ready object, or a `Client` instance. A file is read and parsed on connect.

In a profile, certificates are usually specified as paths. `FabricConnectionFileParser.certsPathsToPem` substitutes the content itself for the paths so that the profile becomes self-contained:

```ts
let parser = new FabricConnectionFileParser(logger);
let profile = parser.certsPathsToPem(JSON.parse(content));
```

The `peers` and `orderers` sections are processed; if a certificate file cannot be read, a warning is emitted, but the connection is not aborted.

### Working with Blocks

A block coming from Fabric is a protobuf tree without convenient fields. `parseBlock` enriches it with three:

```ts
public static parseBlock(block: Block): IFabricBlock {
    let item: IFabricBlock = block as any;
    item.hash = FabricUtil.fromUintArray(block.header.data_hash);
    item.number = Number(block.header.number);
    item.date = FabricApiClient.getBlockDate(block);
    return item;
}
```

The date is taken from the header of the block's first transaction — the block itself does not contain it. If there is no data, the date will be `null`.

Reading historical blocks goes through the `qscc` system contract, which exists in every network: it returns protobuf, and the library decodes it with `BlockDecoder` and runs it through the same `parseBlock`.

## API Reference

### FabricApiClient

```ts
class FabricApiClient extends LoggerWrapper
```

| Method | Purpose |
|---|---|
| `connect(): Promise<void>` | connect; a repeated call returns the same promise |
| `disconnect(error?): void` | disconnect the gateway and reset state |
| `destroy(): void` | destroy the client |

| Property | Type | Purpose |
|---|---|---|
| `isConnected` | `boolean` | connection state |
| `network` | `Network` | the channel's network |
| `channel` | `Channel` | the channel |
| `contract` | `Contract` | the contract from the settings |
| `gateway` | `Gateway` | the `fabric-network` gateway |
| `qsccContract` | `FabricContractQSCC` | system contract for reading blocks |
| `connection` | `IFabricConnection` | all of the above as a single object |

Static methods:

| Method | Purpose |
|---|---|
| `parseBlock(block)` | enrich a block with its hash, number and date |
| `getBlockDate(block)` | block date from the first transaction's header |
| `createConnection(settings, wallet?)` | assemble a connection without creating a client |
| `createWallet(settings)` | in-memory wallet from the settings |

### IFabricConnectionSettings

```ts
export interface IFabricConnectionSettings {
    uid?: string;
    fabricNetworkName: string;
    fabricChaincodeName: string;
    fabricConnectionSettings: string | Client | Object;
    fabricIsDiscoveryEnabled: boolean;
    fabricIsDiscoveryAsLocalhost: boolean;

    fabricIdentity: string;
    fabricIdentityMspId: string;
    fabricIdentityPrivateKey: string;
    fabricIdentityCertificate: string;

    fabricTlsIdentity?: string;
    fabricTlsIdentityMspId?: string;
    fabricTlsIdentityPrivateKey?: string;
    fabricTlsIdentityCertificate?: string;
}
```

| Parameter | Purpose |
|---|---|
| `uid` | settings identifier, used by factories |
| `fabricNetworkName` | channel name |
| `fabricChaincodeName` | chaincode name |
| `fabricConnectionSettings` | connection profile: path, object or `Client` |
| `fabricIsDiscoveryEnabled` | use service discovery |
| `fabricIsDiscoveryAsLocalhost` | treat addresses as local — for running the network in Docker on the same machine |
| `fabricIdentity*` | identity: name, MSP, private key and certificate |
| `fabricTlsIdentity*` | a separate identity for mutual TLS |

There is also a `FabricConnectionSettings` class with `class-validator` decorators — convenient for validating settings that come from configuration.

### FabricContractQSCC

A wrapper over the `qscc` system contract, available as `api.qsccContract`.

```ts
getInfo(channel?): Promise<IFabricChannelInfo>
getBlockNumber(channel?): Promise<number>
getBlock(block: number | string, channel?): Promise<IFabricBlock>
getBlockByTransactionId(id: string, channel?): Promise<IFabricBlock>
getTransaction(id: string, channel?): Promise<IFabricTransaction>
```

| Method | What it returns |
|---|---|
| `getInfo` | chain height and the hashes of the current and previous blocks |
| `getBlockNumber` | chain height — that is, the number of blocks (see [Important Notes](#important-notes)) |
| `getBlock` | a block by number or by hash in hexadecimal form |
| `getBlockByTransactionId` | the block that the transaction landed in |
| `getTransaction` | a transaction by its id |

The channel is optional — if omitted, the channel from the client's settings is used.

```ts
export interface IFabricChannelInfo {
    height: number;
    currentBlockHash: string;
    previousBlockHash: string;
}

export interface IFabricTransaction {
    transactionEnvelope: BlockData;
    validationCode: FabricTransactionValidationCode;
}
```

### FabricContract

```ts
class FabricContract extends DestroyableContainer {
    constructor(name: string, api: FabricApiClient);
    public get contract(): Contract;
}
```

A base wrapper over a contract by name. Used to access additional chaincode in the same channel and serves as the foundation for `FabricContractQSCC`.

### FabricTransactionValidationCode

The complete set of transaction validation codes.

```ts
export enum FabricTransactionValidationCode {
    VALID = 0,
    ENDORSEMENT_POLICY_FAILURE = 10,
    MVCC_READ_CONFLICT = 11,
    PHANTOM_READ_CONFLICT = 12,
    DUPLICATE_TXID = 9,
    ...
    INVALID_OTHER_REASON = 255
}
```

A transaction lands in a block regardless of the validation result, so the presence of a transaction in a block does not yet mean it was applied — you have to look at the code. The most common in a production network are `MVCC_READ_CONFLICT` on concurrent changes to the same key and `ENDORSEMENT_POLICY_FAILURE` when signatures are insufficient.

### FabricUtil

```ts
FabricUtil.fromLong(item: Long | number): number
FabricUtil.fromUintArray(item: Uint8Array, encoding?: BufferEncoding): string
FabricUtil.fromUintArrayToBuffer(item: Uint8Array): Buffer
```

Converting protobuf types into familiar ones: `Long` to a number, a byte array to a string (hexadecimal by default) or a buffer.

### FabricConnectionFileParser

```ts
FabricConnectionFileParser.load(path: string, encoding?): string
FabricConnectionFileParser.pemToOneLine(item: string): string
FabricConnectionFileParser.isPemFormat(item: string): boolean

parser.certsPathsToPem(file: any, isNeedRemovePath?: boolean): any
```

Loading the connection profile and working with certificates: detecting the PEM format, reducing PEM to a single line, and substituting certificate contents for paths.

### Factories

```ts
class FabricApiClientFactory {
    public async get(uid: string): Promise<FabricApiClient>;
}

class FabricConnectionSettingsFactory<T extends IFabricConnectionSettings> {
    public get(uid: string): T;
    public async parse(items: Array<any>): Promise<void>;
}
```

`FabricConnectionSettingsFactory` stores settings for multiple connections and brings them into working shape: the fields with keys and certificates may be either a PEM string or a path to a file — the factory figures it out itself. Settings without a `uid` are discarded with a warning.

`FabricApiClientFactory` creates clients from those settings and reuses them: a repeated `get` with the same `uid` returns an already connected client.

## Usage Examples

### Reading Blocks by Number

```ts
let info = await api.qsccContract.getInfo();
console.log(`Chain height: ${info.height}`);

for (let number = 0; number < info.height; number++) {
    let block = await api.qsccContract.getBlock(number);
    console.log(block.number, block.date, block.hash);
}
```

### Finding a Transaction

```ts
let transaction = await api.qsccContract.getTransaction(hash);

if (transaction.validationCode !== FabricTransactionValidationCode.VALID) {
    console.log(`Transaction rejected: ${FabricTransactionValidationCode[transaction.validationCode]}`);
}

let block = await api.qsccContract.getBlockByTransactionId(hash);
console.log(`Block: ${block.number}`);
```

### Subscribing to New Blocks

```ts
await api.network.addBlockListener(async event => {
    let block = FabricApiClient.parseBlock(event.blockData as Block);
    console.log(block.number, block.date);
});
```

### Multiple Connections

```ts
let settings = new FabricConnectionSettingsFactory(logger);
await settings.parse([
    { uid: 'org1', fabricNetworkName: 'mychannel', ... },
    { uid: 'org2', fabricNetworkName: 'mychannel', ... }
]);

let factory = new FabricApiClientFactory(logger, settings);

let first = await factory.get('org1');
let second = await factory.get('org2');
```

### Connection Profile with Certificates

```ts
let parser = new FabricConnectionFileParser(logger);
let profile = parser.certsPathsToPem(JSON.parse(FabricConnectionFileParser.load('./connection.json')));

let api = new FabricApiClient(logger, { ...settings, fabricConnectionSettings: profile });
```

## Important Notes

**`getBlockNumber` returns the height, not the number of the last block.** The method returns `info.height` — the number of blocks in the chain. The number of the last block is one less, since numbering starts from zero. This is handy when iterating over blocks (`for (let i = 0; i < height; i++)`), but if you need the last block specifically, subtract one.

**There are no connection retries.** The `reconnect` method, despite its name, makes a single attempt: on an error it disconnects the client immediately. The retry logic is implemented one level up, in `@hlf-core/transport`.

**`parseBlock` mutates the object passed to it.** The method does not make a copy; it writes the fields into the original block and returns it. This is cheap, but it means the block object after the call is no longer the one that came from Fabric.

**A block's date can be `null`.** It is taken from the header of the first transaction; a block without data will have no date.

**The wallet lives in memory.** `createWallet` uses `Wallets.newInMemoryWallet()`, and the keys are never persisted. Storing and protecting secrets is the application's concern.

## Project Structure

```
src/
├── FabricApiClient.ts                    client: connection, access to network and contracts
├── FabricApiError.ts                     errors and codes
├── FabricUtil.ts                         protobuf type conversion
├── FabricTransactionValidationCode.ts    transaction validation codes
├── Block.ts                              block structure
├── IFabricBlock.ts                       block with hash, number and date
├── IFabricTransaction.ts                 transaction with validation code
├── IFabricChannelInfo.ts                 chain height and block hashes
├── IFabricConnection.ts                  gateway, wallet, network, channel, contract
├── IFabricConnectionSettings.ts          connection settings and their validation
├── public-api.ts                         package public API
├── contract/
│   ├── FabricContract.ts                 contract wrapper by name
│   └── FabricContractQSCC.ts             system contract: blocks and transactions
├── factory/
│   ├── FabricApiClientFactory.ts         client reuse
│   └── FabricConnectionSettingsFactory.ts  settings for multiple connections
└── parser/
    └── FabricConnectionFileParser.ts     connection profile and certificates
```

## Related Packages

| Package | Role |
|---|---|
| [@hlf-core/transport](https://www.npmjs.com/package/@hlf-core/transport) | transport on top of this client: commands, blocks, events |
| [@hlf-core/transport-common](https://www.npmjs.com/package/@hlf-core/transport-common) | shared transport protocol |
| [@hlf-core/common](https://www.npmjs.com/package/@hlf-core/common) | base classes of the ecosystem |

## License

ISC

## Author

**Renat Gubaev**
- Email: renat.gubaev@gmail.com
- GitHub: [@ManhattanDoctor](https://github.com/ManhattanDoctor)

## Links

- [GitHub Repository](https://github.com/ManhattanDoctor/hlf-core-api)
- [NPM Package](https://www.npmjs.com/package/@hlf-core/api)
- [Issue Tracker](https://github.com/ManhattanDoctor/hlf-core-api/issues)
- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)

## Support

If you found a bug or have a suggestion for improvement, please open an issue in [GitHub Issues](https://github.com/ManhattanDoctor/hlf-core-api/issues).
