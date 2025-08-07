const bcrypt = require('bcryptjs');
const User = require('../../entities/User');

/**
 * Update User Use Case
 * Updates user information
 */
class UpdateUserUseCase {
  constructor({ userRepository, roleRepository, eventPublisher, logger }) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.eventPublisher = eventPublisher;
    this.logger = logger;
  }

  async execute({ userId, username, fullName, roleId, isActive, password }) {
    try {
      this.logger.debug('Updating user', { userId, username });

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Get existing user
      const existingUser = await this.userRepository.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Prepare update data
      const updateData = {};

      // Validate and prepare username
      if (username !== undefined) {
        if (!username || username.length < 3 || username.length > 50) {
          throw new Error('Username must be between 3 and 50 characters');
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
        }
        
        // Check if username is taken by another user
        if (username !== existingUser.username) {
          const existingUserWithUsername = await this.userRepository.findByUsername(username);
          if (existingUserWithUsername) {
            throw new Error('Username already exists');
          }
        }
        
        updateData.username = username;
      }

      // Validate and prepare full name
      if (fullName !== undefined) {
        if (!fullName || fullName.length < 2 || fullName.length > 100) {
          throw new Error('Full name must be between 2 and 100 characters');
        }
        updateData.fullName = fullName;
      }

      // Validate and prepare role
      if (roleId !== undefined) {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
          throw new Error('Role not found');
        }
        if (!role.isActive) {
          throw new Error('Role is not active');
        }
        updateData.roleId = roleId;
      }

      // Prepare active status
      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      // Hash password if provided
      if (password !== undefined) {
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        updateData.password = await bcrypt.hash(password, 12);
      }

      // Update user
      const updatedUser = await this.userRepository.update(userId, updateData);
      
      this.logger.info('User updated successfully', { 
        userId: updatedUser.id, 
        username: updatedUser.username 
      });

      // Publish event
      await this.eventPublisher.publish('user.updated', {
        userId: updatedUser.id,
        username: updatedUser.username,
        updatedFields: Object.keys(updateData),
        updatedAt: new Date()
      });

      return updatedUser;
    } catch (error) {
      this.logger.error('UpdateUserUseCase failed', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = UpdateUserUseCase;