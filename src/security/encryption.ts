import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';

export interface EncryptionProvider {
  encryptString(value: string, context: string): Promise<Uint8Array>;
  decryptString(value: Uint8Array, context: string): Promise<string>;
}

export class ExpoAesGcmEncryption implements EncryptionProvider {
  private constructor(private readonly key: AESEncryptionKey) {}

  static async create(fieldKeyBase64: string): Promise<ExpoAesGcmEncryption> {
    const key = await AESEncryptionKey.import(fieldKeyBase64, 'base64');
    return new ExpoAesGcmEncryption(key);
  }

  async encryptString(value: string, context: string): Promise<Uint8Array> {
    const sealed = await aesEncryptAsync(new TextEncoder().encode(value), this.key, {
      additionalData: new TextEncoder().encode(context),
      nonce: { length: 12 },
      tagLength: 16,
    });
    return sealed.combined();
  }

  async decryptString(value: Uint8Array, context: string): Promise<string> {
    const sealed = AESSealedData.fromCombined(value, { ivLength: 12, tagLength: 16 });
    const plaintext = await aesDecryptAsync(sealed, this.key, {
      additionalData: new TextEncoder().encode(context),
      output: 'bytes',
    });
    return new TextDecoder().decode(plaintext);
  }
}
