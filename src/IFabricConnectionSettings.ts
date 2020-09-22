export interface IFabricConnectionSettings {
    fabricNetworkName: string;
    fabricChaincodeName: string;
    fabricIsDiscoveryEnabled: boolean;
    fabricIsDiscoveryAsLocalhost: boolean;
    fabricConnectionSettingsPath: string;

    fabricIdentity: string;
    fabricIdentityMspId: string;
    fabricIdentityPrivateKey: string;
    fabricIdentityCertificate: string;

    fabricTlsIdentity?: string;
    fabricTlsIdentityMspId?: string;
    fabricTlsIdentityPrivateKey?: string;
    fabricTlsIdentityCertificate?: string;
}
