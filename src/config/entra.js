import dotenv from "dotenv";
dotenv.config();

export const entraConfig = {
  tenantId: process.env.ENTRA_TENANT_ID,
  clientId: process.env.ENTRA_CLIENT_ID,
  clientSecret: process.env.ENTRA_CLIENT_SECRET,
  tenantName: process.env.ENTRA_TENANT_NAME,
  authority: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}`,
  graphScope: "https://graph.microsoft.com/.default",
};
