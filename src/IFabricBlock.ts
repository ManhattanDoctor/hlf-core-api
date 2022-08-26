export interface Block {
    data: any;
    header: any;
    metadata: any;
}

export interface IFabricBlock extends Block {
    hash: string;
    number: number;
    createdDate: Date;
}
