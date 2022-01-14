import { BlockData } from 'fabric-common';
import { FabricTransactionValidationCode } from './FabricTransactionValidationCode';

export interface IFabricTransaction {
    transactionEnvelope: BlockData;
    validationCode: FabricTransactionValidationCode;
}
