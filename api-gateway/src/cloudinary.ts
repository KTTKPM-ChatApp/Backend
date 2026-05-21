import crypto from 'crypto';
import { config } from './config';

interface CloudinarySignParams {
  publicId?: string;
  folder?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: string;
}

export function generateCloudinarySignature(
  params: CloudinarySignParams = {}
) {
  const timestamp = Math.round(Date.now() / 1000);

  const signParams: Record<string, string | number> = {
    timestamp,
  };

  if (params.publicId) signParams.public_id = params.publicId;
  if (params.folder) signParams.folder = params.folder;
  if (params.transformation) signParams.transformation = params.transformation;

  const sortedKeys = Object.keys(signParams).sort();
  const paramString = sortedKeys.map((key) => `${key}=${signParams[key]}`).join('&');
  const stringToSign = paramString + config.cloudinary.apiSecret;

  const signature = crypto
    .createHash('sha1')
    .update(stringToSign)
    .digest('hex');

  const resourceType = params.resourceType || 'auto';

  return {
    signature,
    timestamp,
    apiKey: config.cloudinary.apiKey,
    cloudName: config.cloudinary.cloudName,
    folder: params.folder || null,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`,
    resourceType,
  };
}
