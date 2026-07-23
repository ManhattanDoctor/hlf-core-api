# @hlf-core/api

> TypeScript библиотека для подключения к Hyperledger Fabric: клиент, системный контракт qscc, разбор блоков и настройки

[![npm version](https://img.shields.io/npm/v/@hlf-core/api.svg)](https://www.npmjs.com/package/@hlf-core/api)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Нижний уровень работы с сетью: подключение через `fabric-network`, доступ к каналу и контрактам, запросы к системному контракту `qscc` и разбор структур блока.

Пакет не знает ни о командах, ни о протоколе транспорта — он отвечает только за соединение и за то, чтобы сырые данные Fabric стали пригодны для использования. Поверх него работает [@hlf-core/transport](https://www.npmjs.com/package/@hlf-core/transport).

## Содержание

- [Описание](#описание)
  - [Основные возможности](#основные-возможности)
- [Установка](#установка)
  - [Зависимости](#зависимости)
- [Быстрый старт](#быстрый-старт)
- [Как это работает](#как-это-работает)
  - [Подключение](#подключение)
  - [Кошелёк и идентичность](#кошелёк-и-идентичность)
  - [Профиль подключения](#профиль-подключения)
  - [Работа с блоками](#работа-с-блоками)
- [API документация](#api-документация)
  - [FabricApiClient](#fabricapiclient)
  - [IFabricConnectionSettings](#ifabricconnectionsettings)
  - [FabricContractQSCC](#fabriccontractqscc)
  - [FabricContract](#fabriccontract)
  - [FabricTransactionValidationCode](#fabrictransactionvalidationcode)
  - [FabricUtil](#fabricutil)
  - [FabricConnectionFileParser](#fabricconnectionfileparser)
  - [Фабрики](#фабрики)
- [Примеры использования](#примеры-использования)
- [Важные особенности](#важные-особенности)
- [Структура проекта](#структура-проекта)
- [Связанные пакеты](#связанные-пакеты)

## Описание

Работа с Fabric из Node.js требует много подготовки: собрать профиль подключения, положить ключи в кошелёк, поднять шлюз, получить сеть, канал и контракт, а для чтения блоков — ещё и обратиться к системному контракту и декодировать протобуф. `@hlf-core/api` прячет это за одним объектом с понятными свойствами.

### Основные возможности

- **Подключение одним вызовом** — `connect()` собирает кошелёк, шлюз, сеть, канал и контракт из настроек
- **Доступ к сети** — `network`, `channel`, `contract`, `gateway` как свойства клиента
- **Системный контракт qscc** — высота цепи, блок по номеру, хэшу или идентификатору транзакции, транзакция по идентификатору
- **Разбор блоков** — декодирование протобуфа и дополнение блока хэшем, номером и датой
- **Работа с сертификатами** — загрузка PEM из файлов и подстановка их в профиль подключения
- **Коды валидации** — полный перечень `FabricTransactionValidationCode`
- **Фабрики** — переиспользование клиентов и хранение настроек нескольких подключений

## Установка

```bash
npm install @hlf-core/api
```

### Зависимости

```json
{
    "@ts-core/common": "~3.0.7",
    "fabric-network": "2.2.16"
}
```

Версия `fabric-network` зафиксирована точно — она определяет совместимость с версией сети.

## Быстрый старт

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

// вызов chaincode
let result = await api.contract.evaluateTransaction('myFunction', 'arg');

// чтение блока
let block = await api.qsccContract.getBlock(42);
console.log(block.number, block.hash, block.date);
```

## Как это работает

### Подключение

`connect()` создаёт соединение и возвращает промис, который разрешается при успехе:

```ts
public static async createConnection(settings: IFabricConnectionSettings, wallet?: Wallet): Promise<IFabricConnection> {
    // профиль: путь к файлу либо готовый объект
    // кошелёк: создаётся из настроек, если не передан
    let gateway = new Gateway();
    await gateway.connect(gatewayConfig, gatewayOptions);

    let network = await gateway.getNetwork(settings.fabricNetworkName);
    let channel = network.getChannel();
    let contract = network.getContract(settings.fabricChaincodeName);
    return { gateway, wallet, network, channel, contract };
}
```

Результат складывается в свойство `connection`, и его сеттер выполняет всю остальную работу: отключает предыдущий шлюз, если он был, создаёт клиент системного контракта `qscc` и разрешает либо отклоняет промис подключения.

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

Отсюда следует, что `disconnect()` — это просто присвоение `connection = null`: шлюз закрывается, флаг сбрасывается, qscc обнуляется.

### Кошелёк и идентичность

Если кошелёк не передан явно, он создаётся в памяти из настроек:

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

Ключи не пишутся на диск — приложение хранит их так, как считает нужным, и передаёт в настройках. При наличии `fabricTlsIdentity` в кошелёк кладётся вторая идентичность, для взаимного TLS.

### Профиль подключения

`fabricConnectionSettings` принимает три формы: путь к файлу профиля, готовый объект или экземпляр `Client`. Файл читается и разбирается при подключении.

В профиле сертификаты обычно указаны путями. `FabricConnectionFileParser.certsPathsToPem` подставляет вместо путей само содержимое, чтобы профиль стал самодостаточным:

```ts
let parser = new FabricConnectionFileParser(logger);
let profile = parser.certsPathsToPem(JSON.parse(content));
```

Обрабатываются секции `peers` и `orderers`; если файл сертификата прочитать не удалось, выводится предупреждение, но подключение не прерывается.

### Работа с блоками

Блок, приходящий из Fabric, — это дерево протобуфа без удобных полей. `parseBlock` дополняет его тремя:

```ts
public static parseBlock(block: Block): IFabricBlock {
    let item: IFabricBlock = block as any;
    item.hash = FabricUtil.fromUintArray(block.header.data_hash);
    item.number = Number(block.header.number);
    item.date = FabricApiClient.getBlockDate(block);
    return item;
}
```

Дата берётся из заголовка первой транзакции блока — в самом блоке её нет. Если данных нет, дата будет `null`.

Чтение исторических блоков идёт через системный контракт `qscc`, который есть в любой сети: он возвращает протобуф, а библиотека декодирует его через `BlockDecoder` и прогоняет через тот же `parseBlock`.

## API документация

### FabricApiClient

```ts
class FabricApiClient extends LoggerWrapper
```

| Метод | Назначение |
|---|---|
| `connect(): Promise<void>` | подключение; повторный вызов возвращает тот же промис |
| `disconnect(error?): void` | отключение шлюза и сброс состояния |
| `destroy(): void` | уничтожение клиента |

| Свойство | Тип | Назначение |
|---|---|---|
| `isConnected` | `boolean` | состояние подключения |
| `network` | `Network` | сеть канала |
| `channel` | `Channel` | канал |
| `contract` | `Contract` | контракт из настроек |
| `gateway` | `Gateway` | шлюз `fabric-network` |
| `qsccContract` | `FabricContractQSCC` | системный контракт для чтения блоков |
| `connection` | `IFabricConnection` | всё перечисленное одним объектом |

Статические методы:

| Метод | Назначение |
|---|---|
| `parseBlock(block)` | дополнение блока хэшем, номером и датой |
| `getBlockDate(block)` | дата блока из заголовка первой транзакции |
| `createConnection(settings, wallet?)` | сборка подключения без создания клиента |
| `createWallet(settings)` | кошелёк в памяти из настроек |

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

| Параметр | Назначение |
|---|---|
| `uid` | идентификатор настроек, используется фабриками |
| `fabricNetworkName` | имя канала |
| `fabricChaincodeName` | имя chaincode |
| `fabricConnectionSettings` | профиль подключения: путь, объект или `Client` |
| `fabricIsDiscoveryEnabled` | использовать service discovery |
| `fabricIsDiscoveryAsLocalhost` | считать адреса локальными — для запуска сети в Docker на той же машине |
| `fabricIdentity*` | идентичность: имя, MSP, приватный ключ и сертификат |
| `fabricTlsIdentity*` | отдельная идентичность для взаимного TLS |

Есть и класс `FabricConnectionSettings` с декораторами `class-validator` — им удобно валидировать настройки, пришедшие из конфигурации.

### FabricContractQSCC

Обёртка над системным контрактом `qscc`, доступная как `api.qsccContract`.

```ts
getInfo(channel?): Promise<IFabricChannelInfo>
getBlockNumber(channel?): Promise<number>
getBlock(block: number | string, channel?): Promise<IFabricBlock>
getBlockByTransactionId(id: string, channel?): Promise<IFabricBlock>
getTransaction(id: string, channel?): Promise<IFabricTransaction>
```

| Метод | Что возвращает |
|---|---|
| `getInfo` | высота цепи и хэши текущего и предыдущего блоков |
| `getBlockNumber` | высота цепи — то есть количество блоков (см. [важные особенности](#важные-особенности)) |
| `getBlock` | блок по номеру либо по хэшу в шестнадцатеричном виде |
| `getBlockByTransactionId` | блок, в который попала транзакция |
| `getTransaction` | транзакция по идентификатору |

Канал можно не указывать — тогда используется канал из настроек клиента.

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

Базовая обёртка над контрактом по имени. Используется для обращения к дополнительным chaincode в том же канале и служит основой для `FabricContractQSCC`.

### FabricTransactionValidationCode

Полный перечень кодов валидации транзакции.

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

Транзакция попадает в блок независимо от результата проверки, поэтому наличие транзакции в блоке ещё не означает, что она применена — смотреть нужно на код. Самые частые в рабочей сети: `MVCC_READ_CONFLICT` при параллельных изменениях одного ключа и `ENDORSEMENT_POLICY_FAILURE` при нехватке подписей.

### FabricUtil

```ts
FabricUtil.fromLong(item: Long | number): number
FabricUtil.fromUintArray(item: Uint8Array, encoding?: BufferEncoding): string
FabricUtil.fromUintArrayToBuffer(item: Uint8Array): Buffer
```

Преобразование типов протобуфа в привычные: `Long` в число, байтовый массив в строку (по умолчанию шестнадцатеричную) или буфер.

### FabricConnectionFileParser

```ts
FabricConnectionFileParser.load(path: string, encoding?): string
FabricConnectionFileParser.pemToOneLine(item: string): string
FabricConnectionFileParser.isPemFormat(item: string): boolean

parser.certsPathsToPem(file: any, isNeedRemovePath?: boolean): any
```

Загрузка профиля подключения и работа с сертификатами: определение PEM-формата, приведение PEM к однострочному виду и подстановка содержимого сертификатов вместо путей.

### Фабрики

```ts
class FabricApiClientFactory {
    public async get(uid: string): Promise<FabricApiClient>;
}

class FabricConnectionSettingsFactory<T extends IFabricConnectionSettings> {
    public get(uid: string): T;
    public async parse(items: Array<any>): Promise<void>;
}
```

`FabricConnectionSettingsFactory` хранит настройки нескольких подключений и приводит их к рабочему виду: поля с ключами и сертификатами могут быть как PEM-строкой, так и путём к файлу — фабрика разберётся сама. Настройки без `uid` отбрасываются с предупреждением.

`FabricApiClientFactory` создаёт клиентов по этим настройкам и переиспользует их: повторный `get` с тем же `uid` вернёт уже подключённый клиент.

## Примеры использования

### Чтение блоков по номерам

```ts
let info = await api.qsccContract.getInfo();
console.log(`Высота цепи: ${info.height}`);

for (let number = 0; number < info.height; number++) {
    let block = await api.qsccContract.getBlock(number);
    console.log(block.number, block.date, block.hash);
}
```

### Поиск транзакции

```ts
let transaction = await api.qsccContract.getTransaction(hash);

if (transaction.validationCode !== FabricTransactionValidationCode.VALID) {
    console.log(`Транзакция отклонена: ${FabricTransactionValidationCode[transaction.validationCode]}`);
}

let block = await api.qsccContract.getBlockByTransactionId(hash);
console.log(`Блок: ${block.number}`);
```

### Подписка на новые блоки

```ts
await api.network.addBlockListener(async event => {
    let block = FabricApiClient.parseBlock(event.blockData as Block);
    console.log(block.number, block.date);
});
```

### Несколько подключений

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

### Профиль подключения с сертификатами

```ts
let parser = new FabricConnectionFileParser(logger);
let profile = parser.certsPathsToPem(JSON.parse(FabricConnectionFileParser.load('./connection.json')));

let api = new FabricApiClient(logger, { ...settings, fabricConnectionSettings: profile });
```

## Важные особенности

**`getBlockNumber` возвращает высоту, а не номер последнего блока.** Метод отдаёт `info.height` — количество блоков в цепи. Номер последнего блока на единицу меньше, поскольку нумерация начинается с нуля. При обходе блоков это удобно (`for (let i = 0; i < height; i++)`), но если нужен именно последний блок, вычитайте единицу.

**Повторов подключения нет.** Метод `reconnect` несмотря на название выполняет одну попытку: при ошибке он сразу отключает клиент. Логика повторов реализована уровнем выше, в `@hlf-core/transport`.

**`parseBlock` изменяет переданный объект.** Метод не создаёт копию, а дописывает поля в исходный блок и возвращает его же. Это дёшево, но означает, что объект блока после вызова уже не тот, что пришёл из Fabric.

**Дата блока может быть `null`.** Она берётся из заголовка первой транзакции; у блока без данных даты не будет.

**Кошелёк живёт в памяти.** `createWallet` использует `Wallets.newInMemoryWallet()`, ключи никуда не сохраняются. Хранение и защита секретов — забота приложения.

## Структура проекта

```
src/
├── FabricApiClient.ts                    клиент: подключение, доступ к сети и контрактам
├── FabricApiError.ts                     ошибки и коды
├── FabricUtil.ts                         преобразование типов протобуфа
├── FabricTransactionValidationCode.ts    коды валидации транзакции
├── Block.ts                              структура блока
├── IFabricBlock.ts                       блок с хэшем, номером и датой
├── IFabricTransaction.ts                 транзакция с кодом валидации
├── IFabricChannelInfo.ts                 высота цепи и хэши блоков
├── IFabricConnection.ts                  шлюз, кошелёк, сеть, канал, контракт
├── IFabricConnectionSettings.ts          настройки подключения и их валидация
├── public-api.ts                         публичный API пакета
├── contract/
│   ├── FabricContract.ts                 обёртка контракта по имени
│   └── FabricContractQSCC.ts             системный контракт: блоки и транзакции
├── factory/
│   ├── FabricApiClientFactory.ts         переиспользование клиентов
│   └── FabricConnectionSettingsFactory.ts  настройки нескольких подключений
└── parser/
    └── FabricConnectionFileParser.ts     профиль подключения и сертификаты
```

## Связанные пакеты

| Пакет | Роль |
|---|---|
| [@hlf-core/transport](https://www.npmjs.com/package/@hlf-core/transport) | транспорт поверх этого клиента: команды, блоки, события |
| [@hlf-core/transport-common](https://www.npmjs.com/package/@hlf-core/transport-common) | общий протокол транспорта |
| [@hlf-core/common](https://www.npmjs.com/package/@hlf-core/common) | базовые классы экосистемы |

## Лицензия

ISC

## Автор

**Ренат Губаев**
- Email: renat.gubaev@gmail.com
- GitHub: [@ManhattanDoctor](https://github.com/ManhattanDoctor)

## Ссылки

- [GitHub Repository](https://github.com/ManhattanDoctor/hlf-core-api)
- [NPM Package](https://www.npmjs.com/package/@hlf-core/api)
- [Issue Tracker](https://github.com/ManhattanDoctor/hlf-core-api/issues)
- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)

## Поддержка

Если вы нашли баг или у вас есть предложение по улучшению, пожалуйста, создайте issue в [GitHub Issues](https://github.com/ManhattanDoctor/hlf-core-api/issues).
