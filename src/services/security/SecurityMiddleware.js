import { userManager } from './UserManager.js';
import { canAccessData, hasPermission } from './SecurityLevels.js';

export class SecurityMiddleware {
  static checkAccess(requiredLevel) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = function(...args) {
        if (!userManager.canCurrentUserAccess(requiredLevel)) {
          throw new Error(`Access denied. Required security level: ${requiredLevel}`);
        }
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }

  static requireLogin(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args) {
      const currentUser = userManager.getCurrentUser();
      if (!currentUser) {
        throw new Error('Authentication required');
      }
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  }

  static checkDataAccess(dataClassification) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = function(...args) {
        const currentUser = userManager.getCurrentUser();
        if (!currentUser) {
          throw new Error('Authentication required');
        }
        
        if (!canAccessData(currentUser.securityLevel, dataClassification)) {
          throw new Error(`Access denied to ${dataClassification} data`);
        }
        
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }
}

export const securityCheck = {
  requireAuth: () => {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('Authentication required');
    }
    return currentUser;
  },

  requireLevel: (requiredLevel) => {
    const currentUser = securityCheck.requireAuth();
    if (!hasPermission(currentUser.securityLevel, requiredLevel)) {
      throw new Error(`Access denied. Required security level: ${requiredLevel}`);
    }
    return currentUser;
  },

  requireDataAccess: (dataClassification) => {
    const currentUser = securityCheck.requireAuth();
    if (!canAccessData(currentUser.securityLevel, dataClassification)) {
      throw new Error(`Access denied to ${dataClassification} data`);
    }
    return currentUser;
  },

  filterDataByAccess: (data, dataClassification) => {
    try {
      securityCheck.requireDataAccess(dataClassification);
      return data;
    } catch (error) {
      return null;
    }
  },

  sanitizeForUser: (data) => {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return {};

    const sanitized = { ...data };
    
    if (!canAccessData(currentUser.securityLevel, 'CONFIDENTIAL')) {
      delete sanitized.confidentialData;
      delete sanitized.secretKey;
      delete sanitized.internalNotes;
    }
    
    if (!canAccessData(currentUser.securityLevel, 'FINANCIAL')) {
      delete sanitized.salary;
      delete sanitized.budget;
      delete sanitized.costs;
      delete sanitized.revenue;
    }
    
    return sanitized;
  }
};