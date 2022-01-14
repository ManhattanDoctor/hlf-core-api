import { ExtendedError } from '@ts-core/common/error';

export class FabricApiError extends ExtendedError<any, FabricApiErrorCode> {}

export enum FabricApiErrorCode {
    SETTINGS_INVALID = 'SETTINGS_INVALID',
    BLOCK_INVALID = 'BLOCK_INVALID'
}
