
import { common as FabricProtoCommon } from 'fabric-protos';

export interface Block extends FabricProtoCommon.IBlock {
    data: any;
    header: any;
    metadata: any;
}
