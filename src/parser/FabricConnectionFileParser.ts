import { ILogger, LoggerWrapper } from '@ts-core/common/logger';
import { AbstractSettingsStorage } from '@ts-core/common/settings';
import * as _ from 'lodash';
import * as fs from 'fs';

export class FabricConnectionFileParser extends LoggerWrapper {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static load(path: string, encoding: BufferEncoding = 'utf8'): string {
        return fs.readFileSync(path, { encoding });
    }

    public static pemToOneLine(item: string): string {
        item = JSON.stringify(item);
        return AbstractSettingsStorage.parsePEM(item.substr(1, item.length - 2));
    }

    public static isPemFormat(item: string) {
        return !_.isNil(item) ? item.indexOf('-----') === 0 : false;
    }

    // --------------------------------------------------------------------------
    //
    //  Constructor
    //
    // --------------------------------------------------------------------------

    constructor(logger: ILogger) {
        super(logger);
    }

    // --------------------------------------------------------------------------
    //
    //  Public Methods
    //
    // --------------------------------------------------------------------------

    public certsPathsToPem(file: any, isNeedRemovePath: boolean = true): any {
        for (let name of ['peers', 'orderers']) {
            let section = file[name];
            if (_.isNil(section)) {
                continue;
            }
            for (let key in section) {
                let item = file[name][key] as ITlsCACerts;
                if (!_.isNil(item) && !_.isNil(item.tlsCACerts)) {
                    this.setPemToCert(item.tlsCACerts, isNeedRemovePath);
                }
            }
        }
        return file;
    }

    // --------------------------------------------------------------------------
    //
    //  Protected Methods
    //
    // --------------------------------------------------------------------------

    protected setPemToCert(item: ICert, isNeedRemovePath: boolean): void {
        if (!_.isNil(item.pem) || _.isNil(item.path)) {
            return;
        }
        try {
            item.pem = FabricConnectionFileParser.pemToOneLine(FabricConnectionFileParser.load(item.path));
            if (isNeedRemovePath) {
                delete item.path;
            }
        } catch {
            this.warn(`Unable to load file from "${item.path}"`);
        }
    }
}

interface ITlsCACerts {
    tlsCACerts: ICert;
}

interface ICert {
    pem?: string;
    path?: string;
}
