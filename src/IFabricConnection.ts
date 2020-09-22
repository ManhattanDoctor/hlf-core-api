import { Network, Contract, Wallet, Gateway } from 'fabric-network';
import { Channel } from 'fabric-client';

export interface IFabricConnection {
    wallet: Wallet;
    gateway: Gateway;

    network: Network;
    channel: Channel;
    contract: Contract;
}
