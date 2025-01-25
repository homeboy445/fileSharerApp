const currentPassword =
  window.process?.env?.REACT_APP_ENCRYPTION_PASSWORD || "testPassword";

class CryptoHandler {
  async deriveKey(keyMaterial: CryptoKey, salt: Uint8Array) {
    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      {
        name: "AES-GCM",
        length: 256,
      },
      true, // Extractable
      ["encrypt", "decrypt"]
    );
    return key;
  }

  async importKeyFromPassword(password: string) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return keyMaterial;
  }

  async generateKeyFromPassword(password: string) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16)); // Generate a random salt
    const keyMaterial = await this.importKeyFromPassword(password);
    const key = await this.deriveKey(keyMaterial, salt);
    return key;
  }

  async encryptData(data: Uint8Array) {
    const key = await this.generateKeyFromPassword(currentPassword);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization vector
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data // ArrayBuffer to encrypt
    );
    return { iv, encryptedData };
  }

  async decryptData(iv: any, encryptedData: Uint8Array) {
    const key = await this.generateKeyFromPassword(currentPassword);
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedData // ArrayBuffer to decrypt
    );
    return decryptedData;
  }
}

// async function example() {
//   const password = "your-secure-password";
//   const originalData = new TextEncoder().encode("Hello, World!");

//   // Derive a key from the password
//   const { key, salt } = await generateKeyFromPassword(password);

//   // Encrypt the data
//   const { iv, encryptedData } = await encryptData(key, originalData.buffer);

//   console.log("Encrypted Data:", new Uint8Array(encryptedData));

//   // Derive the key again from the same password and salt for decryption
//   const keyMaterial = await importKeyFromPassword(password);
//   const derivedKey = await deriveKey(keyMaterial, salt);

//   // Decrypt the data
//   const decryptedData = await decryptData(derivedKey, iv, encryptedData);
//   const decryptedText = new TextDecoder().decode(decryptedData);

//   console.log("Decrypted Text:", decryptedText);
// }

export default new CryptoHandler();
