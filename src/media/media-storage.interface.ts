export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface MediaPutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface MediaStorage {
  put(input: MediaPutInput): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
