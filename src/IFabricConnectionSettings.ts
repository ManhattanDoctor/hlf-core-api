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
