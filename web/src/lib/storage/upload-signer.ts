export interface CreateUploadUrlInput {
  path: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface UploadUrlSigner {
  createUploadUrl(input: CreateUploadUrlInput): Promise<string>;
}

const defaultUploadUrlSigner: UploadUrlSigner = {
  async createUploadUrl(input: CreateUploadUrlInput): Promise<string> {
    const encodedPath = encodeURIComponent(input.path);
    return `https://example-upload.local/${encodedPath}?expires=${input.expiresInSeconds}`;
  },
};

let sharedUploadUrlSigner: UploadUrlSigner = defaultUploadUrlSigner;

export function getSharedUploadUrlSigner(): UploadUrlSigner {
  return sharedUploadUrlSigner;
}

export function setSharedUploadUrlSignerForTests(signer: UploadUrlSigner): void {
  sharedUploadUrlSigner = signer;
}

export function resetSharedUploadUrlSignerForTests(): void {
  sharedUploadUrlSigner = defaultUploadUrlSigner;
}
