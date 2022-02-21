import { DestroyableContainer } from '@ts-core/common';
import { Contract } from 'fabric-network';
import * as _ from 'lodash';
import { FabricApiClient } from '../FabricApiClient';

export class FabricContract extends DestroyableContainer {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _contract: Contract;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(protected name: string, protected api: FabricApiClient) {
        super();
        this._contract = api.network.getContract(name);
    }

    // --------------------------------------------------------------------------
    //
    //  Public Properties
    //
    // --------------------------------------------------------------------------

    public get contract(): Contract {
        return this._contract;
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();
        this.api = null;
        this._contract = null;
    }
}
