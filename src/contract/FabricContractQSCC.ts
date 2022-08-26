import { FabricApiClient } from '../FabricApiClient';
import { FabricContract } from './FabricContract';
import { IFabricChannelInfo } from '../IFabricChannelInfo';
import { IFabricBlock } from '../IFabricBlock';
import { FabricUtil } from '../FabricUtil';
import { IFabricTransaction } from '../IFabricTransaction';
import { common as FabricProtoCommon } from 'fabric-protos';
import { BlockDecoder } from 'fabric-common/index.js';
import { Channel } from 'fabric-common';
import * as _ from 'lodash';

export class FabricContractQSCC extends FabricContract {
    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(api: FabricApiClient) {
        super('qscc', api);
    }

    // --------------------------------------------------------------------------
    //
    //  Protected Methods
    //
    // --------------------------------------------------------------------------

    protected parseBlock(data: Buffer): IFabricBlock {
        return FabricApiClient.parseBlock(BlockDecoder.decode(data));
    }

    protected parseTransaction(data: Buffer): IFabricTransaction {
        return BlockDecoder.decodeTransaction(data);
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public async getInfo(channel?: Channel): Promise<IFabricChannelInfo> {
        if (_.isNil(channel)) {
            channel = this.api.channel;
        }
        let buffer = await this.contract.evaluateTransaction('GetChainInfo', channel.name);
        let item = FabricProtoCommon.BlockchainInfo.decode(buffer);
        return {
            height: FabricUtil.fromLong(item.height),
            currentBlockHash: FabricUtil.fromUintArray(item.currentBlockHash),
            previousBlockHash: FabricUtil.fromUintArray(item.previousBlockHash)
        };
    }

    public async getBlockNumber(channel?: Channel): Promise<number> {
        let info = await this.getInfo(channel);
        return info.height;
    }

    public async getBlock(block: number | string, channel?: Channel): Promise<IFabricBlock> {
        if (_.isNil(channel)) {
            channel = this.api.channel;
        }

        let item = null;
        if (_.isString(block)) {
            item = await this.contract.evaluateTransaction('GetBlockByHash', channel.name, Buffer.from(block.toString(), 'hex') as any);
        } else {
            item = await this.contract.evaluateTransaction('GetBlockByNumber', channel.name, block as any);
        }
        return this.parseBlock(item);
    }

    public async getBlockByTransactionId(id: string, channel?: Channel): Promise<IFabricBlock> {
        if (_.isNil(channel)) {
            channel = this.api.channel;
        }
        let item = await this.contract.evaluateTransaction('GetBlockByTxID', channel.name, id);
        return this.parseBlock(item);
    }

    public async getTransaction(id: string, channel?: Channel): Promise<IFabricTransaction> {
        if (_.isNil(channel)) {
            channel = this.api.channel;
        }
        let item = await this.contract.evaluateTransaction('GetTransactionByID', channel.name, id);
        return this.parseTransaction(item);
    }

    // let data = await contract.evaluateTransaction('GetTransactionByID', api.channel.name, txId);
    // let data = await contract.evaluateTransaction('GetBlockByTxID', api.channel.name, txId);
}
