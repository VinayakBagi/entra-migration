import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import { entraConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";

class GraphService {
  constructor() {
    this.client = null;
    this.initialize();
  }

  initialize() {
    try {
      const credential = new ClientSecretCredential(
        entraConfig.tenantId,
        entraConfig.clientId,
        entraConfig.clientSecret
      );

      const authProvider = new TokenCredentialAuthenticationProvider(
        credential,
        {
          scopes: [entraConfig.graphScope],
        }
      );

      this.client = Client.initWithMiddleware({
        authProvider: authProvider,
      });

      logger.info("Graph Service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Graph Service", error);
      throw error;
    }
  }

  getClient() {
    if (!this.client) {
      this.initialize();
    }
    return this.client;
  }

  async userExists(email) {
    try {
      const users = await this.client
        .api("/users")
        .filter(
          `identities/any(id:id/issuer eq '${entraConfig.tenantName}' and id/issuerAssignedId eq '${email}')`
        )
        .get();

      return users.value && users.value.length > 0;
    } catch (error) {
      logger.error(`Error checking user existence for ${email}`, error);
      return false;
    }
  }

  async createUser(userData, password, forcePasswordChange = true) {
    try {
      const timestamp = Date.now();

      const newUser = {
        accountEnabled: userData.isActive !== false,
        displayName: userData.username,
        mailNickname: `${userData.username}_${timestamp}`,
        userPrincipalName: `${userData.username}_${timestamp}@${entraConfig.tenantName}`,
        identities: [
          {
            signInType: "emailAddress",
            issuer: entraConfig.tenantName,
            issuerAssignedId: userData.email,
          },
        ],
        passwordProfile: {
          forceChangePasswordNextSignIn: forcePasswordChange,
          password: password,
        },
      };

      const createdUser = await this.client.api("/users").post(newUser);

      logger.info(`User created in Entra: ${userData.email}`);

      return createdUser;
    } catch (error) {
      logger.error(`Failed to create user in Entra: ${userData.email}`, error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      const users = await this.client
        .api("/users")
        .filter(
          `identities/any(id:id/issuer eq '${entraConfig.tenantName}' and id/issuerAssignedId eq '${email}')`
        )
        .get();

      return users.value && users.value.length > 0 ? users.value[0] : null;
    } catch (error) {
      logger.error(`Error fetching user from Entra: ${email}`, error);
      return null;
    }
  }
}

export default new GraphService();
