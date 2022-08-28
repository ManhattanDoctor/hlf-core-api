import { Block } from "./Block";

export interface IFabricBlock extends Block {
    hash: string;
    number: number;
    createdDate: Date;
}
