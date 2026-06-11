import { readFileSync } from "node:fs";
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID!;
const bucket = process.env.R2_VIDEOS_BUCKET ?? "tivieo-videos";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const { rules } = JSON.parse(
  readFileSync("docs/r2-videos-cors.json", "utf8"),
) as {
  rules: {
    allowed: { origins: string[]; methods: string[]; headers: string[] };
    exposeHeaders?: string[];
    maxAgeSeconds?: number;
  }[];
};

await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: rules.map((r) => ({
        AllowedOrigins: r.allowed.origins,
        AllowedMethods: r.allowed.methods,
        AllowedHeaders: r.allowed.headers,
        ExposeHeaders: r.exposeHeaders,
        MaxAgeSeconds: r.maxAgeSeconds,
      })),
    },
  }),
);

const current = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log("CORS applied to", bucket);
console.log(JSON.stringify(current.CORSRules, null, 2));
