import { S3Client } from "@aws-sdk/client-s3";

const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;

export const R2_CONFIG_ISSUES = [];

if (!accountId) R2_CONFIG_ISSUES.push("Missing VITE_R2_ACCOUNT_ID.");
if (!accessKeyId) R2_CONFIG_ISSUES.push("Missing VITE_R2_ACCESS_KEY_ID.");
if (!secretAccessKey) R2_CONFIG_ISSUES.push("Missing VITE_R2_SECRET_ACCESS_KEY.");
if (!bucketName) R2_CONFIG_ISSUES.push("Missing VITE_R2_BUCKET_NAME.");

export const R2_ENDPOINT = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "";
export const HAS_VALID_R2_CONFIG = R2_CONFIG_ISSUES.length === 0;

if (!HAS_VALID_R2_CONFIG) {
    console.error("R2 configuration is incomplete:", R2_CONFIG_ISSUES.join(" "));
}

export const r2Client = HAS_VALID_R2_CONFIG
    ? new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    })
    : null;

export const R2_BUCKET_NAME = bucketName;
