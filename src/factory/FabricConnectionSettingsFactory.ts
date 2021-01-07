import { ILogger, LoggerWrapper } from '@ts-core/common/logger';
import * as _ from 'lodash';
import { MapCollection } from '@ts-core/common/map';
import { AbstractSettingsStorage } from '@ts-core/common/settings';
import { IFabricConnectionSettings } from '../IFabricConnectionSettings';

export class FabricConnectionSettingsFactory<T extends IFabricConnectionSettings = IFabricConnectionSettings> extends LoggerWrapper {
    // --------------------------------------------------------------------------
    //
    //  Properties
    //
    // --------------------------------------------------------------------------

    protected _items: MapCollection<T>;

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger) {
        super(logger);
        this._items = this.createCollection();
    }

    // --------------------------------------------------------------------------
    //
    //  Protected Methods
    //
    // --------------------------------------------------------------------------

    protected createCollection(): MapCollection<T> {
        return new MapCollection('uid');
    }

    protected parseItem(item: any): T {
        item.fabricIdentityPrivateKey = AbstractSettingsStorage.parsePEM(item.fabricIdentityPrivateKey);
        item.fabricIdentityCertificate = AbstractSettingsStorage.parsePEM(item.fabricIdentityCertificate);
        return item;
    }

    protected isItemValid(item: T): boolean {
        if (_.isNil(item)) {
            this.logger.warn(`Settings is nil`);
            return false;
        }
        if (_.isNil(item.uid)) {
            this.logger.warn(`Settings \"uid"\ nil`);
            return false;
        }
        return true;
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public get(uid: string): T {
        return this.items.get(uid);
    }

    public async parse(items: Array<any>): Promise<void> {
        if (_.isEmpty(items)) {
            return;
        }
        items = _.compact(items);
        for (let item of items) {
            item = this.parseItem(item);
            if (this.isItemValid(item)) {
                this.items.add(item);
            }
        }
    }

    public destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        super.destroy();

        this.items.clear();
        this._items = null;
    }

    // --------------------------------------------------------------------------
    //
    //  Public Properties
    //
    // --------------------------------------------------------------------------

    public get items(): MapCollection<T> {
        return this._items;
    }
}
