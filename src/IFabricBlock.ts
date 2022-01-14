import { BlockData } from 'fabric-common';

export interface IFabricBlock extends BlockData {
    hash: string;
    number: number;
    createdDate: Date;
}
