export const SECURITY_LEVELS = {
  S4: {
    level: 4,
    name: 'S4',
    description: 'Full Access - CEO/Owner',
    permissions: {
      viewAll: true,
      editAll: true,
      deleteAll: true,
      manageUsers: true,
      viewFinancials: true,
      viewConfidential: true,
      systemAdmin: true,
      exportData: true
    }
  },
  S3: {
    level: 3,
    name: 'S3',
    description: 'Director Level',
    permissions: {
      viewAll: true,
      editMost: true,
      deleteMost: true,
      manageTeam: true,
      viewFinancials: true,
      viewConfidential: true,
      systemAdmin: false,
      exportData: true
    }
  },
  S2: {
    level: 2,
    name: 'S2',
    description: 'Team Manager',
    permissions: {
      viewTeam: true,
      editTeam: true,
      deleteTeam: false,
      manageTeam: true,
      viewFinancials: false,
      viewConfidential: false,
      systemAdmin: false,
      exportData: false
    }
  },
  S1: {
    level: 1,
    name: 'S1',
    description: 'Employee',
    permissions: {
      viewOwn: true,
      editOwn: true,
      deleteOwn: false,
      manageTeam: false,
      viewFinancials: false,
      viewConfidential: false,
      systemAdmin: false,
      exportData: false
    }
  }
};

export const getSecurityLevel = (level) => {
  return SECURITY_LEVELS[level] || SECURITY_LEVELS.S1;
};

export const hasPermission = (userLevel, requiredLevel) => {
  const user = getSecurityLevel(userLevel);
  const required = getSecurityLevel(requiredLevel);
  return user.level >= required.level;
};

export const canAccessData = (userLevel, dataClassification) => {
  const user = getSecurityLevel(userLevel);
  
  switch (dataClassification) {
    case 'CONFIDENTIAL':
      return user.permissions.viewConfidential;
    case 'FINANCIAL':
      return user.permissions.viewFinancials;
    case 'TEAM':
      return user.permissions.viewTeam || user.permissions.viewAll;
    case 'PUBLIC':
      return true;
    default:
      return user.permissions.viewOwn;
  }
};