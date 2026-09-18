import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { env } from "./env.js";

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "reviewerbucket",
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || "176361553288176",
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET || "Bxsu1esrcIai0g7ODWvjDXEQino",
  secure: true
});

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format?: string;
  width?: number;
  height?: number;
}

/**
 * Upload an image buffer, base64 string, or data URI to Cloudinary.
 */
export async function uploadToCloudinary(
  fileData: string,
  folder: string = "reviewer-bucket/broadcasts"
): Promise<CloudinaryUploadResult> {
  try {
    const result: UploadApiResponse = await cloudinary.uploader.upload(fileData, {
      folder,
      resource_type: "image",
      format: "webp",
      quality: "auto:good",
      fetch_format: "auto"
    });

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

/**
 * Delete an image from Cloudinary by its public ID.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.warn("Failed to delete Cloudinary asset:", publicId, err);
  }
}

export default cloudinary;
