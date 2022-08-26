import { LoggerWrapper, } from '@ts-core/common';
import * as _ from 'lodash';
import { Block, IFabricBlock } from './IFabricBlock';
import { FabricUtil } from './FabricUtil';
// import { FabricContractQSCC } from './contract/FabricContractQSCC';

export class FabricApiClient2 extends LoggerWrapper {

    // --------------------------------------------------------------------------
    //
    // 	Block Static Methods
    //
    // --------------------------------------------------------------------------

    /*
    public static parseBlock(block: Block): IFabricBlock {
        let item: IFabricBlock = block as any;
        item.hash = FabricUtil.fromUintArray(block.header.data_hash);
        item.number = Number(block.header.number);
        item.createdDate = FabricApiClient2.getBlockCreatedDate(block);
        return item;
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
        let gatewayConfig: Client | Record<string, any> = null;
        if (_.isString(settings.fabricConnectionSettings)) {
            gatewayConfig = JSON.parse(FabricConnectionFileParser.load(settings.fabricConnectionSettings));
        } else {
            gatewayConfig = settings.fabricConnectionSettings as Record<string, any>;
        }

        if (_.isNil(wallet)) {
            wallet = await FabricApiClient.createWallet(settings);
        }

        let gatewayOptions: GatewayOptions = {
            wallet,
            identity: settings.fabricIdentity,
            clientTlsIdentity: settings.fabricTlsIdentity,
            discovery: { enabled: settings.fabricIsDiscoveryEnabled, asLocalhost: settings.fabricIsDiscoveryAsLocalhost }
        };

        let gateway = new Gateway();
        await gateway.connect(gatewayConfig, gatewayOptions);

        let network = await gateway.getNetwork(settings.fabricNetworkName);
        let channel = network.getChannel();
        let contract = network.getContract(settings.fabricChaincodeName);
        return { gateway, wallet, network, channel, contract };
    }

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
        if (!_.isNil(settings.fabricTlsIdentity)) {
            let tlsIdentity: X509Identity = {
                type: 'X.509',
                mspId: settings.fabricTlsIdentityMspId,
                credentials: {
                    privateKey: settings.fabricTlsIdentityPrivateKey,
                    certificate: settings.fabricTlsIdentityCertificate
                }
            };
            item.put(settings.fabricTlsIdentity, tlsIdentity);
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
    // protected _qsccContract: FabricContractQSCC;
    protected _isConnected: boolean;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger, protected settings: IFabricConnectionSettings) {
        super(logger);
        console.log("Hi am new");
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

        // this._qsccContract = !_.isNil(this._connection) ? new FabricContractQSCC(this) : null;

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
    */

}
