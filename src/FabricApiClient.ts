import { PromiseHandler } from '@ts-core/common/promise';
import { Network, Contract, Wallet, Gateway, InMemoryWallet, X509WalletMixin } from 'fabric-network';
import { Channel, Block } from 'fabric-client';
import * as _ from 'lodash';
import { ExtendedError } from '@ts-core/common/error';
import { ObservableData } from '@ts-core/common/observer';
import { Subject } from 'rxjs';
import { LoadableEvent } from '@ts-core/common/Loadable';
import { IFabricChannelInfo } from './IFabricChannelInfo';
import { LoggerWrapper, ILogger } from '@ts-core/common/logger';
import { IFabricBlock } from './IFabricBlock';
import { IFabricTransaction } from './IFabricTransaction';
import { IFabricConnectionSettings } from './IFabricConnectionSettings';
import { IFabricConnection } from './IFabricConnection';

export class FabricApiClient extends LoggerWrapper {
    // --------------------------------------------------------------------------
    //
    // 	Block Static Methods
    //
    // --------------------------------------------------------------------------

    public static parseBlock(block: Block): void {
        let item: IFabricBlock = block as any;
        item.hash = block.header.data_hash.toString('hex');
        item.number = Number(block.header.number);
        item.createdDate = FabricApiClient.getBlockCreatedDate(block);
    }

    public static getBlockCreatedDate(block: Block): Date {
        if (_.isNil(block.data) || _.isEmpty(block.data.data)) {
            return null;
        }
        for (let data of block.data.data) {
            if (_.isNil(data) || _.isNil(data.payload) || _.isNil(data.payload.header) || _.isNil(data.payload.header.channel_header)) {
                continue;
            }
            return new Date(data.payload.header.channel_header.timestamp);
        }
        return null;
    }

    // --------------------------------------------------------------------------
    //
    // 	Connection Static Methods
    //
    // --------------------------------------------------------------------------

    public static async createConnection(settings: IFabricConnectionSettings, wallet?: Wallet): Promise<IFabricConnection> {
        let gateway = new Gateway();
        if (_.isNil(wallet)) {
            wallet = await FabricApiClient.createWallet(settings);
        }

        await gateway.connect(settings.fabricConnectionSettingsPath, {
            wallet,
            identity: settings.fabricIdentity,
            clientTlsIdentity: settings.fabricTlsIdentity,
            discovery: { enabled: settings.fabricIsDiscoveryEnabled, asLocalhost: settings.fabricIsDiscoveryAsLocalhost }
        });

        let network = await gateway.getNetwork(settings.fabricNetworkName);
        return { gateway, wallet, network, channel: network.getChannel(), contract: network.getContract(settings.fabricChaincodeName) };
    }

    public static async createWallet(settings: IFabricConnectionSettings): Promise<Wallet> {
        let item = new InMemoryWallet();
        await item.import(
            settings.fabricIdentity,
            X509WalletMixin.createIdentity(settings.fabricIdentityMspId, settings.fabricIdentityCertificate, settings.fabricIdentityPrivateKey)
        );
        if (!_.isNil(settings.fabricTlsIdentity)) {
            await item.import(
                settings.fabricTlsIdentity,
                X509WalletMixin.createIdentity(settings.fabricTlsIdentityMspId, settings.fabricTlsIdentityCertificate, settings.fabricTlsIdentityPrivateKey)
            );
        }
        return item;
    }

    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected observer: Subject<ObservableData<LoadableEvent, any>>;
    protected connectionPromise: PromiseHandler<void, ExtendedError>;

    protected _connection: IFabricConnection;
    protected _isConnected: boolean;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, protected settings: IFabricConnectionSettings) {
        super(logger);
    }

    // --------------------------------------------------------------------------
    //
    // 	Public Connect
    //
    // --------------------------------------------------------------------------

    public async connect(): Promise<void> {
        if (_.isNil(this.settings)) {
            throw new ExtendedError(`Unable to connect: settings is nil`);
        }
        if (!_.isNil(this.connectionPromise)) {
            return this.connectionPromise.promise;
        }
        this.connectionPromise = PromiseHandler.create();
        this.reconnect();
        return this.connectionPromise.promise;
    }

    public disconnect(error?: ExtendedError): void {
        if (!_.isNil(this.connectionPromise)) {
            this.connectionPromise.reject(error);
            this.connectionPromise = null;
        }
        this.connection = null;
    }

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();

        this.disconnect();

        this.observer.complete();
        this.observer = null;
    }

    protected async reconnect(): Promise<void> {
        this.debug(`Connecting to Fabric "${this.settings.fabricIdentity}:${this.settings.fabricNetworkName}:${this.settings.fabricChaincodeName}"`);

        try {
            this.connection = await FabricApiClient.createConnection(this.settings);
        } catch (error) {
            this.connectErrorHandler(ExtendedError.create(error, ExtendedError.DEFAULT_ERROR_CODE));
        }
    }

    // --------------------------------------------------------------------------
    //
    //  Event Handlers
    //
    // --------------------------------------------------------------------------

    protected connectCompleteHandler(): void {
        if (!_.isNil(this.connectionPromise)) {
            this.connectionPromise.resolve();
        }
    }

    protected connectErrorHandler(error?: ExtendedError): void {
        this.disconnect(error);
    }

    // --------------------------------------------------------------------------
    //
    // 	Public Methods
    //
    // --------------------------------------------------------------------------

    public async getInfo(channel?: Channel): Promise<IFabricChannelInfo> {
        if (_.isNil(channel)) {
            channel = this.channel;
        }

        let item = await channel.queryInfo();
        return {
            height: item.height.toNumber(),
            currentBlockHash: item.currentBlockHash.toString('hex'),
            previousBlockHash: item.previousBlockHash.toString('hex')
        };
    }

    public async getBlockNumber(channel?: Channel): Promise<number> {
        let info = await this.getInfo(channel);
        return info.height;
    }

    public async getBlock(block: number | string, channel?: Channel): Promise<IFabricBlock> {
        if (_.isNil(channel)) {
            channel = this.channel;
        }

        let item: Block = null;
        if (_.isString(block)) {
            item = await channel.queryBlockByHash(Buffer.from(block, 'hex'));
        } else if (_.isNumber(block)) {
            item = await channel.queryBlock(block);
        } else {
            throw new ExtendedError(`Invalid block: value must be string or number`);
        }
        FabricApiClient.parseBlock(item);
        return item as IFabricBlock;
    }

    public async getBlockByTxID(id: string, channel?: Channel): Promise<IFabricBlock> {
        if (_.isNil(channel)) {
            channel = this.channel;
        }
        let item = await channel.queryBlockByTxID(id);
        FabricApiClient.parseBlock(item);
        return item as IFabricBlock;
    }

    public async getTransaction(id: string, channel?: Channel): Promise<IFabricTransaction> {
        if (_.isNil(channel)) {
            channel = this.channel;
        }
        return channel.queryTransaction(id);
    }

    // --------------------------------------------------------------------------
    //
    //  Public Properties
    //
    // --------------------------------------------------------------------------

    public get connection(): IFabricConnection {
        return this._connection;
    }

    public set connection(value: IFabricConnection) {
        if (value === this._connection) {
            return;
        }
        if (!_.isNil(this._connection)) {
            this._connection.gateway.disconnect();
        }

        this._connection = value;
        this._isConnected = !_.isNil(this._connection);

        if (this._isConnected) {
            this.connectCompleteHandler();
        } else {
            this.connectErrorHandler();
        }
    }

    public get isConnected(): boolean {
        return this._isConnected;
    }

    public get network(): Network {
        return !_.isNil(this.connection) ? this.connection.network : null;
    }

    public get channel(): Channel {
        return !_.isNil(this.connection) ? this.connection.channel : null;
    }

    public get contract(): Contract {
        return !_.isNil(this.connection) ? this.connection.contract : null;
    }

    public get gateway(): Gateway {
        return !_.isNil(this.connection) ? this.connection.gateway : null;
    }
}
