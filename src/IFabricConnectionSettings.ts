import { IsBoolean, IsOptional, IsDefined, IsString } from 'class-validator';
import { Client } from 'fabric-common';

export interface IFabricConnectionSettings {
    uid?: string;
    fabricNetworkName: string;
    fabricChaincodeName: string;
    fabricConnectionSettings: string | Client | Object;
    fabricIsDiscoveryEnabled: boolean;
    fabricIsDiscoveryAsLocalhost: boolean;

    fabricIdentity: string;
    fabricIdentityMspId: string;
    fabricIdentityPrivateKey: string;
    fabricIdentityCertificate: string;

    fabricTlsIdentity?: string;
    fabricTlsIdentityMspId?: string;
    fabricTlsIdentityPrivateKey?: string;
    fabricTlsIdentityCertificate?: string;
}

export class FabricConnectionSettings implements IFabricConnectionSettings {
    @IsOptional()
    @IsString()
    uid?: string;

    @IsString()
    fabricNetworkName: string;

    @IsString()
    fabricChaincodeName: string;

    @IsDefined()
    fabricConnectionSettings: string | Client | Object;

    @IsBoolean()
    fabricIsDiscoveryEnabled: boolean;

    @IsBoolean()
    fabricIsDiscoveryAsLocalhost: boolean;

    @IsString()
    fabricIdentity: string;

    @IsString()
    fabricIdentityMspId: string;

    @IsString()
    fabricIdentityPrivateKey: string;

    @IsString()
    fabricIdentityCertificate: string;

    @IsOptional()
    @IsString()
    fabricTlsIdentity?: string;

    @IsOptional()
    @IsString()
    fabricTlsIdentityMspId?: string;

    @IsOptional()
    @IsString()
    fabricTlsIdentityPrivateKey?: string;

    @IsOptional()
    @IsString()
    fabricTlsIdentityCertificate?: string;
}
