/**
 * S3 client interface for the content service.
 * Abstracts S3 operations for image storage and retrieval.
 */

export interface S3Client {
  /**
   * Upload an image to S3 with the given key.
   * @param key - The S3 object key (e.g., pages/{chapterId}/{pageNumber}_{classification}.{format})
   * @param data - The image data buffer
   * @param format - The image format (jpeg, png, heic)
   * @returns The S3 key of the uploaded object
   */
  uploadImage(key: string, data: Buffer, format: string): Promise<string>;

  /**
   * Delete an image from S3 by key.
   * @param key - The S3 object key to delete
   */
  deleteImage(key: string): Promise<void>;

  /**
   * Generate a pre-signed URL for reading an image.
   * @param key - The S3 object key
   * @returns A pre-signed URL valid for a limited time
   */
  getSignedUrl(key: string): Promise<string>;
}
