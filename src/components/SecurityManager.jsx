import React, { useState, useEffect } from 'react';
import { userManager } from '../services/security/UserManager.js';
import { SECURITY_LEVELS } from '../services/security/SecurityLevels.js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.jsx';
import { Badge } from './ui/badge.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';
import { Shield, Users, UserCheck, AlertTriangle } from 'lucide-react';

export default function SecurityManager() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    securityLevel: 'S1',
    department: '',
    teamId: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    userManager.initializeDefaultAdmin();
    loadData();
  }, []);

  const loadData = () => {
    setCurrentUser(userManager.getCurrentUser());
    setUsers(userManager.getAllUsers());
  };

  const handleLogin = (userId) => {
    try {
      userManager.setCurrentUser(userId);
      setCurrentUser(userManager.getCurrentUser());
      setSuccess('Logged in successfully');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    userManager.currentUser = null;
    setCurrentUser(null);
    setSuccess('Logged out successfully');
  };

  const handleAddUser = () => {
    try {
      if (!currentUser || !userManager.canCurrentUserAccess('S3')) {
        setError('Access denied. Only S3+ users can create users');
        return;
      }

      const userId = `user_${Date.now()}`;
      userManager.createUser({
        id: userId,
        ...newUser
      });
      
      setUsers(userManager.getAllUsers());
      setNewUser({ name: '', email: '', securityLevel: 'S1', department: '', teamId: '' });
      setShowAddUser(false);
      setSuccess('User created successfully');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateUserLevel = (userId, newLevel) => {
    try {
      if (!currentUser || !userManager.canCurrentUserAccess('S4')) {
        setError('Access denied. Only S4 users can change security levels');
        return;
      }

      userManager.updateUser(userId, { securityLevel: newLevel });
      setUsers(userManager.getAllUsers());
      setSuccess('User updated successfully');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const getSecurityBadgeColor = (level) => {
    switch (level) {
      case 'S4': return 'bg-red-500';
      case 'S3': return 'bg-orange-500';
      case 'S2': return 'bg-yellow-500';
      case 'S1': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const canViewUser = (user) => {
    if (!currentUser) return false;
    if (currentUser.securityLevel === 'S4') return true;
    if (currentUser.securityLevel === 'S3') return true;
    if (currentUser.securityLevel === 'S2') return user.teamId === currentUser.teamId;
    return user.id === currentUser.id;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="text-blue-600" />
          Security Manager
        </h1>
        <p className="text-gray-600 mt-2">
          4-Level Security System: S4 (Full Access) → S3 (Director) → S2 (Manager) → S1 (Employee)
        </p>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <UserCheck className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Current User
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentUser ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{currentUser.name}</span>
                  <Badge className={`${getSecurityBadgeColor(currentUser.securityLevel)} text-white`}>
                    {currentUser.securityLevel}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{currentUser.email}</p>
                <p className="text-sm text-gray-600">{SECURITY_LEVELS[currentUser.securityLevel]?.description}</p>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  Logout
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-4">No user logged in</p>
                <div className="space-y-2">
                  {users.map(user => (
                    <Button
                      key={user.id}
                      onClick={() => handleLogin(user.id)}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <span className="mr-2">{user.name}</span>
                      <Badge className={`${getSecurityBadgeColor(user.securityLevel)} text-white ml-auto`}>
                        {user.securityLevel}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentUser && userManager.canCurrentUserAccess('S3') && (
              <div className="mb-4">
                <Button 
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="w-full"
                >
                  {showAddUser ? 'Cancel' : 'Add New User'}
                </Button>
              </div>
            )}

            {showAddUser && (
              <div className="space-y-3 mb-4 p-4 border rounded-lg bg-gray-50">
                <Input
                  placeholder="Name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                />
                <Input
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                />
                <Select value={newUser.securityLevel} onValueChange={(value) => setNewUser({...newUser, securityLevel: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Security Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S1">S1 - Employee</SelectItem>
                    <SelectItem value="S2">S2 - Manager</SelectItem>
                    <SelectItem value="S3">S3 - Director</SelectItem>
                    {currentUser?.securityLevel === 'S4' && (
                      <SelectItem value="S4">S4 - Full Access</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Department"
                  value={newUser.department}
                  onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                />
                <Button onClick={handleAddUser} className="w-full">
                  Create User
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {users.filter(canViewUser).map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                    <div className="text-xs text-gray-500">{user.department}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getSecurityBadgeColor(user.securityLevel)} text-white`}>
                      {user.securityLevel}
                    </Badge>
                    {currentUser?.securityLevel === 'S4' && user.id !== currentUser.id && (
                      <Select
                        value={user.securityLevel}
                        onValueChange={(value) => handleUpdateUserLevel(user.id, value)}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="S1">S1</SelectItem>
                          <SelectItem value="S2">S2</SelectItem>
                          <SelectItem value="S3">S3</SelectItem>
                          <SelectItem value="S4">S4</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Security Levels Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(SECURITY_LEVELS).map(([key, level]) => (
              <div key={key} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`${getSecurityBadgeColor(key)} text-white`}>
                    {key}
                  </Badge>
                  <span className="font-medium">{level.description}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {level.permissions.viewAll && <div>✓ View all data</div>}
                  {level.permissions.viewConfidential && <div>✓ View confidential</div>}
                  {level.permissions.viewFinancials && <div>✓ View financials</div>}
                  {level.permissions.manageUsers && <div>✓ Manage users</div>}
                  {level.permissions.systemAdmin && <div>✓ System admin</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}