import { SECURITY_LEVELS, hasPermission } from './SecurityLevels.js';

export class UserManager {
  constructor() {
    this.users = new Map();
    this.currentUser = null;
    this.loadUsers();
  }

  loadUsers() {
    const saved = localStorage.getItem('locodex_users');
    if (saved) {
      const userData = JSON.parse(saved);
      this.users = new Map(userData);
    }
  }

  saveUsers() {
    localStorage.setItem('locodex_users', JSON.stringify([...this.users]));
  }

  createUser(userData) {
    const { id, name, email, securityLevel = 'S1', department = '', teamId = null } = userData;
    
    if (!SECURITY_LEVELS[securityLevel]) {
      throw new Error(`Invalid security level: ${securityLevel}`);
    }

    const user = {
      id,
      name,
      email,
      securityLevel,
      department,
      teamId,
      createdAt: new Date().toISOString(),
      isActive: true,
      lastLogin: null
    };

    this.users.set(id, user);
    this.saveUsers();
    return user;
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (updates.securityLevel && !SECURITY_LEVELS[updates.securityLevel]) {
      throw new Error(`Invalid security level: ${updates.securityLevel}`);
    }

    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);
    this.saveUsers();
    return updatedUser;
  }

  setCurrentUser(userId) {
    const user = this.users.get(userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }
    
    this.currentUser = user;
    user.lastLogin = new Date().toISOString();
    this.saveUsers();
    return user;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentUserSecurityLevel() {
    return this.currentUser?.securityLevel || 'S1';
  }

  canCurrentUserAccess(requiredLevel) {
    if (!this.currentUser) return false;
    return hasPermission(this.currentUser.securityLevel, requiredLevel);
  }

  getUsersBySecurityLevel(level) {
    return Array.from(this.users.values()).filter(user => user.securityLevel === level);
  }

  getUsersByTeam(teamId) {
    return Array.from(this.users.values()).filter(user => user.teamId === teamId);
  }

  deactivateUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      user.isActive = false;
      this.saveUsers();
    }
  }

  activateUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      user.isActive = true;
      this.saveUsers();
    }
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  isInitialized() {
    return this.users.size > 0;
  }

  initializeDefaultAdmin() {
    if (!this.isInitialized()) {
      this.createUser({
        id: 'admin',
        name: 'System Administrator',
        email: 'admin@locodex.com',
        securityLevel: 'S4',
        department: 'IT',
        teamId: null
      });
    }
  }
}

export const userManager = new UserManager();