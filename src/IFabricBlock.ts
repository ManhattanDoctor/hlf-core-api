import { Block } from './FabricApiClient';

export interface IFabricBlock extends Block {
    hash: string;
    number: number;
    createdDate: Date;
}
