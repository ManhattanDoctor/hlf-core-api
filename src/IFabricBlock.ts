import { Block } from "./Block";

export interface IFabricBlock extends Block {
    hash: string;
    date: Date;
    number: number;
}
