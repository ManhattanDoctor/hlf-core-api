import { BlockData } from 'fabric-client';
import { FabricTransactionValidationCode } from './FabricTransactionValidationCode';

export interface IFabricTransaction {
    transactionEnvelope: BlockData;
    validationCode: FabricTransactionValidationCode;
}
