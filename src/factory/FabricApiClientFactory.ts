import { Logger, LoggerWrapper } from '@ts-core/common/logger';
import * as _ from 'lodash';
import { FabricApiClient } from '../FabricApiClient';
import { FabricConnectionSettingsFactory } from './FabricConnectionSettingsFactory';

export class FabricApiClientFactory extends LoggerWrapper {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected items: Map<string, FabricApiClient>;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: Logger, protected settings: FabricConnectionSettingsFactory) {
        super(logger);
        this.items = new Map();
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public async get(uid: string): Promise<FabricApiClient> {
        let item = this.items.get(uid);
        if (!_.isNil(item)) {
            return item;
        }

        item = new FabricApiClient(this.logger, this.settings.get(uid));
        this.items.set(uid, item);
        await item.connect();
        return item;
    }
}
