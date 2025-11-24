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

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the Graph client with application credentials
   */
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

  /**
   * Get the Graph client instance
   * @returns {Client} Microsoft Graph client
   */
  getClient() {
    if (!this.client) {
      this.initialize();
    }
    return this.client;
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * Check if a user exists by email
   * @param {string} email - User's email address
   * @returns {Promise<boolean>} Whether user exists
   */
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

  /**
   * Create a new user in Entra ID
   * @param {Object} userData - User data object
   * @param {string} userData.username - Username
   * @param {string} userData.email - Email address
   * @param {boolean} userData.isActive - Whether account is active
   * @param {string} password - Initial password
   * @param {boolean} forcePasswordChange - Force password change on first login
   * @returns {Promise<Object>} Created user object
   */
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

  /**
   * Get user by email address
   * @param {string} email - User's email address
   * @returns {Promise<Object|null>} User object or null
   */
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

  /**
   * Get user by Entra user ID
   * @param {string} userId - Entra user ID
   * @returns {Promise<Object|null>} User object or null
   */
  async getUserById(userId) {
    try {
      const user = await this.client.api(`/users/${userId}`).get();
      return user;
    } catch (error) {
      logger.error(`Error fetching user by ID: ${userId}`, error);
      return null;
    }
  }

  /**
   * Get user's extension attributes by user ID
   * Fetches all user properties including extension attributes
   * @param {string} userId - Entra user ID
   * @returns {Promise<Object|null>} User object with all properties or null
   */
  /**
   * Get user's extension attributes by user ID
   * For Entra External ID, we need to query schema extensions
   * @param {string} userId - Entra user ID
   * @returns {Promise<Object|null>} User object with all properties or null
   */
  async getUserExtensionAttributes(userId) {
    try {
      logger.info(`Fetching extension attributes for user: ${userId}`);

      // First, get the list of schema extensions to know what to query for
      const schemasResult = await this.client
        .api("/schemaExtensions")
        .filter(
          "id eq 'extdxhqvi1v_extensionAttribute1' or startswith(id, 'ext')"
        )
        .get();

      logger.info(
        "Available schema extensions:",
        JSON.stringify(schemasResult.value, null, 2)
      );

      // Build select query with all possible extension properties
      let selectFields = "id,mail,userPrincipalName,displayName";

      if (schemasResult.value && schemasResult.value.length > 0) {
        schemasResult.value.forEach((schema) => {
          if (schema.properties) {
            schema.properties.forEach((prop) => {
              selectFields += `,${schema.id}_${prop.name}`;
            });
          }
        });
      }

      logger.info(`Querying user with select: ${selectFields}`);

      // Fetch user with extension properties
      const user = await this.client
        .api(`/users/${userId}`)
        .select(selectFields)
        .get();

      logger.info(
        `Successfully fetched user data:`,
        JSON.stringify(user, null, 2)
      );
      return user;
    } catch (error) {
      logger.error(
        `Error fetching extension attributes for user ${userId}:`,
        error
      );
      if (error.statusCode) {
        logger.error(`Status code: ${error.statusCode}`);
      }
      if (error.body) {
        logger.error(`Error body:`, JSON.stringify(error.body, null, 2));
      }

      // Fallback: try getting user with all fields
      try {
        logger.info("Attempting fallback query with all fields...");
        const user = await this.client.api(`/users/${userId}`).get();
        return user;
      } catch (fallbackError) {
        logger.error("Fallback query also failed:", fallbackError);
        return null;
      }
    }
  }

  /**
   * Extract extension attribute 1 from user data
   * Looks for extensionAttribute1 in various naming formats
   * @param {Object} userData - User object from Graph API
   * @returns {string|null} Extension attribute value or null
   */
  extractExtensionAttribute1(userData) {
    if (!userData) {
      logger.info("No user data provided to extract extension attribute");
      return null;
    }

    logger.info("Searching for extensionAttribute1 in user data...");

    // Log all available properties for debugging
    logger.info("Available user properties:", Object.keys(userData));

    // Look for extension attribute in various possible formats
    for (const [key, value] of Object.entries(userData)) {
      const keyLower = key.toLowerCase();

      // Check for various naming patterns
      if (
        keyLower === "extensionattribute1" ||
        keyLower === "extension_attribute_1" ||
        keyLower === "extension_attribute1" ||
        keyLower.match(/^extension_[a-f0-9]{32}_extensionattribute1$/i) ||
        keyLower.includes("extensionattribute1")
      ) {
        logger.info(`✓ Found extension attribute: ${key} = ${value}`);
        return value;
      }
    }

    logger.info("Extension attribute 1 not found in user data");
    return null;
  }

  /**
   * Get user with extension attributes by email
   * Convenience method to fetch user by email and get extension attributes
   * @param {string} email - User's email address
   * @returns {Promise<Object|null>} User object with extension attributes or null
   */
  async getUserWithExtensionsByEmail(email) {
    try {
      const user = await this.getUserByEmail(email);
      if (!user || !user.id) {
        return null;
      }

      // Fetch full user data with extension attributes
      return await this.getUserExtensionAttributes(user.id);
    } catch (error) {
      logger.error(
        `Error fetching user with extensions by email: ${email}`,
        error
      );
      return null;
    }
  }

  /**
   * Update user properties
   * @param {string} userId - Entra user ID
   * @param {Object} updates - Properties to update
   * @returns {Promise<Object>} Updated user object
   */
  async updateUser(userId, updates) {
    try {
      await this.client.api(`/users/${userId}`).patch(updates);

      logger.info(`User updated in Entra: ${userId}`);
      return { success: true, message: "User updated successfully" };
    } catch (error) {
      logger.error(`Failed to update user in Entra: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Delete user from Entra ID
   * @param {string} userId - Entra user ID
   * @returns {Promise<Object>} Result object
   */
  async deleteUser(userId) {
    try {
      await this.client.api(`/users/${userId}`).delete();

      logger.info(`User deleted from Entra: ${userId}`);
      return { success: true, message: "User deleted successfully" };
    } catch (error) {
      logger.error(`Failed to delete user from Entra: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Enable or disable user account
   * @param {string} userId - Entra user ID
   * @param {boolean} enabled - Whether account should be enabled
   * @returns {Promise<Object>} Result object
   */
  async setUserAccountEnabled(userId, enabled) {
    try {
      await this.client.api(`/users/${userId}`).patch({
        accountEnabled: enabled,
      });

      logger.info(
        `User account ${enabled ? "enabled" : "disabled"}: ${userId}`
      );
      return {
        success: true,
        message: `User account ${
          enabled ? "enabled" : "disabled"
        } successfully`,
      };
    } catch (error) {
      logger.error(`Failed to update user account status: ${userId}`, error);
      throw error;
    }
  }

  /**
   * List all users with optional filtering
   * @param {Object} options - Query options
   * @param {number} options.top - Number of users to return
   * @param {string} options.filter - OData filter string
   * @param {string} options.select - Properties to select
   * @returns {Promise<Array>} Array of user objects
   */
  async listUsers(options = {}) {
    try {
      let request = this.client.api("/users");

      if (options.top) {
        request = request.top(options.top);
      }

      if (options.filter) {
        request = request.filter(options.filter);
      }

      if (options.select) {
        request = request.select(options.select);
      }

      const result = await request.get();
      return result.value || [];
    } catch (error) {
      logger.error("Error listing users from Entra", error);
      throw error;
    }
  }

  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  /**
   * Get delegated access token using ROPC flow
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<string>} Access token
   */
  async getDelegatedAccessToken(userPrincipalName, password) {
    // Extract tenant subdomain from tenantName
    // If tenantName is "devmtyfranchise.onmicrosoft.com", extract "devmtyfranchise"
    // If tenantName is already "devmtyfranchise", use as is
    let tenantSubdomain = entraConfig.tenantName;
    if (tenantSubdomain.includes(".onmicrosoft.com")) {
      tenantSubdomain = tenantSubdomain.replace(".onmicrosoft.com", "");
    }

    // For Entra External ID (CIAM), use ciamlogin.com
    // URL format: https://{tenant-subdomain}.ciamlogin.com/{tenant-id}/oauth2/v2.0/token
    const tokenEndpoint = `https://${tenantSubdomain}.ciamlogin.com/${entraConfig.tenantId}/oauth2/v2.0/token`;

    logger.info(`Token endpoint: ${tokenEndpoint}`);

    const params = new URLSearchParams({
      client_id: entraConfig.clientId,
      client_secret: entraConfig.clientSecret,
      scope:
        "https://graph.microsoft.com/Directory.AccessAsUser.All offline_access openid",
      username: userPrincipalName,
      password: password,
      grant_type: "password",
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error("Failed to get delegated access token", error);
      throw new Error(error.error_description || "Authentication failed");
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Change user password using ROPC flow (all in backend)
   * Uses the user's current password to authenticate and then changes it
   * @param {string} userPrincipalName - User's userPrincipalName
   * @param {string} currentPassword - User's current password
   * @param {string} newPassword - New password to set
   * @returns {Promise<Object>} Result object
   */
  async changeUserPasswordWithROPC(
    userPrincipalName,
    currentPassword,
    newPassword
  ) {
    if (!userPrincipalName) {
      throw new Error("userPrincipalName is required to change password");
    }

    if (!currentPassword) {
      throw new Error("Current password is required");
    }

    if (!newPassword) {
      throw new Error("New password is required");
    }

    try {
      // Step 1: Authenticate user and get delegated token
      const accessToken = await this.getDelegatedAccessToken(
        userPrincipalName,
        currentPassword
      );

      // Step 2: Create client with delegated token
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      // Step 3: Change password using Graph API
      await client.api("/me/microsoft.graph.changePassword").post({
        currentPassword,
        newPassword,
      });

      logger.info(
        `Password changed successfully for user: ${userPrincipalName}`
      );
      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (error) {
      logger.error(
        `Failed to change password for user: ${userPrincipalName}`,
        error
      );

      // Provide better error messages
      if (error.message.includes("invalid_grant")) {
        throw new Error("Current password is incorrect");
      }
      if (error.message.includes("AADSTS50126")) {
        throw new Error("Invalid username or password");
      }
      if (error.message.includes("AADSTS50076")) {
        throw new Error(
          "Multi-factor authentication is required. Please use the frontend password change flow."
        );
      }
      if (error.message.includes("AADSTS700016")) {
        throw new Error("Application not found or not configured correctly");
      }
      if (error.message.includes("AADSTS65001")) {
        throw new Error("User has not consented to the required permissions");
      }

      throw error;
    }
  }

  /**
   * Change password using a pre-obtained access token
   * Use this when frontend provides the access token
   * @param {string} accessToken - Delegated access token with Directory.AccessAsUser.All scope
   * @param {string} currentPassword - User's current password
   * @param {string} newPassword - New password to set
   * @returns {Promise<Object>} Result object
   */
  async changePasswordWithAccessToken(
    accessToken,
    currentPassword,
    newPassword
  ) {
    if (!accessToken) {
      throw new Error("Access token is required to change password");
    }

    if (!currentPassword) {
      throw new Error("Current password is required");
    }

    if (!newPassword) {
      throw new Error("New password is required to change password");
    }

    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    try {
      await client.api("/me/microsoft.graph.changePassword").post({
        currentPassword,
        newPassword,
      });

      logger.info("Password changed via delegated access token");
      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (error) {
      logger.error("Failed to change password with access token", error);
      throw error;
    }
  }

  /**
   * Admin reset user password (without knowing current password)
   * Requires User.ReadWrite.All application permission + User Administrator role
   * @param {string} userId - Entra user ID
   * @param {string} newPassword - New password to set
   * @param {boolean} forceChangeOnNextSignIn - Force password change on next sign-in
   * @returns {Promise<Object>} Result object
   */
  async adminResetUserPassword(
    userId,
    newPassword,
    forceChangeOnNextSignIn = false
  ) {
    if (!userId) {
      throw new Error("User ID is required to reset password");
    }

    if (!newPassword) {
      throw new Error("New password is required");
    }

    try {
      await this.client.api(`/users/${userId}`).patch({
        passwordProfile: {
          forceChangePasswordNextSignIn: forceChangeOnNextSignIn,
          password: newPassword,
        },
      });

      logger.info(`Password reset by admin for user: ${userId}`);
      return {
        success: true,
        message: "Password reset successfully",
      };
    } catch (error) {
      logger.error(`Failed to reset password for user: ${userId}`, error);
      throw error;
    }
  }

  // ============================================
  // USER FLOW MANAGEMENT
  // ============================================

  /**
   * Update user flow signup settings
   * @param {string} userFlowId - The user flow ID
   * @param {boolean} isSignUpAllowed - Whether signup should be allowed
   * @returns {Promise<void>}
   */
  async updateUserFlowSignupSettings(userFlowId, isSignUpAllowed) {
    try {
      const requestBody = {
        "@odata.type":
          "#microsoft.graph.externalUsersSelfServiceSignUpEventsFlow",
        onInteractiveAuthFlowStart: {
          "@odata.type":
            "#microsoft.graph.onInteractiveAuthFlowStartExternalUsersSelfServiceSignUp",
          isSignUpAllowed: isSignUpAllowed,
        },
      };

      await this.client
        .api(`/identity/authenticationEventsFlows/${userFlowId}`)
        .version("beta")
        .patch(requestBody);

      logger.info(
        `User flow ${userFlowId} updated: isSignUpAllowed = ${isSignUpAllowed}`
      );
    } catch (error) {
      logger.error("Error updating user flow signup settings", error);
      throw error;
    }
  }

  /**
   * Get user flow by ID
   * @param {string} userFlowId - The user flow ID
   * @returns {Promise<Object>} User flow object
   */
  async getUserFlow(userFlowId) {
    try {
      const userFlow = await this.client
        .api(`/identity/authenticationEventsFlows/${userFlowId}`)
        .version("beta")
        .get();

      return userFlow;
    } catch (error) {
      logger.error(`Error fetching user flow: ${userFlowId}`, error);
      throw error;
    }
  }

  /**
   * List all user flows
   * @returns {Promise<Array>} Array of user flow objects
   */
  async listUserFlows() {
    try {
      const result = await this.client
        .api("/identity/authenticationEventsFlows")
        .version("beta")
        .get();

      return result.value || [];
    } catch (error) {
      logger.error("Error listing user flows", error);
      throw error;
    }
  }

  // ============================================
  // GROUP MANAGEMENT
  // ============================================

  /**
   * Get user's group memberships
   * @param {string} userId - Entra user ID
   * @returns {Promise<Array>} Array of group objects
   */
  async getUserGroups(userId) {
    try {
      const result = await this.client.api(`/users/${userId}/memberOf`).get();

      return result.value || [];
    } catch (error) {
      logger.error(`Error fetching groups for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Add user to a group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to add
   * @returns {Promise<Object>} Result object
   */
  async addUserToGroup(groupId, userId) {
    try {
      await this.client.api(`/groups/${groupId}/members/$ref`).post({
        "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`,
      });

      logger.info(`User ${userId} added to group ${groupId}`);
      return { success: true, message: "User added to group successfully" };
    } catch (error) {
      logger.error(`Failed to add user ${userId} to group ${groupId}`, error);
      throw error;
    }
  }

  /**
   * Remove user from a group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<Object>} Result object
   */
  async removeUserFromGroup(groupId, userId) {
    try {
      await this.client
        .api(`/groups/${groupId}/members/${userId}/$ref`)
        .delete();

      logger.info(`User ${userId} removed from group ${groupId}`);
      return { success: true, message: "User removed from group successfully" };
    } catch (error) {
      logger.error(
        `Failed to remove user ${userId} from group ${groupId}`,
        error
      );
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Validate password meets Entra ID requirements
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validatePassword(password) {
    const errors = [];

    if (!password || password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (password.length > 256) {
      errors.push("Password must be no more than 256 characters long");
    }

    // Check for complexity (at least 3 of 4 categories)
    let complexity = 0;
    if (/[a-z]/.test(password)) complexity++;
    if (/[A-Z]/.test(password)) complexity++;
    if (/[0-9]/.test(password)) complexity++;
    if (/[^a-zA-Z0-9]/.test(password)) complexity++;

    if (complexity < 3) {
      errors.push(
        "Password must contain at least 3 of the following: lowercase letters, uppercase letters, numbers, special characters"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a random password that meets Entra ID requirements
   * @param {number} length - Password length (default 16)
   * @returns {string} Generated password
   */
  generatePassword(length = 16) {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    // Ensure at least one character from each category
    let password = "";
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest with random characters
    const allChars = lowercase + uppercase + numbers + special;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  /**
   * Check if Graph client is connected and working
   * @returns {Promise<boolean>} Whether connection is healthy
   */
  async healthCheck() {
    try {
      await this.client.api("/organization").get();
      return true;
    } catch (error) {
      logger.error("Graph Service health check failed", error);
      return false;
    }
  }
}

export default new GraphService();
