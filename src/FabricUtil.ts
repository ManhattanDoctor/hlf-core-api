import * as _ from 'lodash';

export class FabricUtil {
    // --------------------------------------------------------------------------
    //
    //  Static Methods
    //
    // --------------------------------------------------------------------------

    public static fromLong(item: Long | number): number {
        return !_.isNil(item) ? parseInt(item.toString()) : null;
    }

    public static fromUintArray(item: Uint8Array, encoding: BufferEncoding = 'hex'): string {
        return !_.isNil(item) ? FabricUtil.fromUintArrayToBuffer(item).toString(encoding) : null;
    }

    public static fromUintArrayToBuffer(item: Uint8Array): Buffer {
        return !_.isNil(item) ? Buffer.from(item) : null;
    }
}
