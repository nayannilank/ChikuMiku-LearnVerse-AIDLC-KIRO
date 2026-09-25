/**
 * Database client interface for the auth service.
 * Abstracts database operations for testability.
 */

export interface ParentRecord {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface DBClient {
  /**
   * Check if a username already exists in the parents table.
   */
  parentUsernameExists(username: string): Promise<boolean>;

  /**
   * Insert a new parent record into the database.
   * Returns the created record.
   */
  createParent(parent: Omit<ParentRecord, 'createdAt'>): Promise<ParentRecord>;

  /**
   * Hard-deletes a parent record. Used to roll back `createParent` when the
   * subsequent Cognito account provisioning fails — without this, the row
   * stays behind, `parentUsernameExists` blocks every retry with the same
   * username, and the parent never gets a usable Cognito account (i.e. never
   * gets to log in) either.
   */
  deleteParent(parentId: string): Promise<void>;
}
