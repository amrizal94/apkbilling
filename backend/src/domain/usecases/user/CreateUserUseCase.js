const User = require('../../entities/User');
const bcrypt = require('bcryptjs');

/**
 * Create User Use Case
 * Contains the business logic for creating a new user
 */
class CreateUserUseCase {
  constructor({ userRepository, roleRepository, eventPublisher, logger }) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.eventPublisher = eventPublisher;
    this.logger = logger;
  }

  async execute({ username, password, fullName, roleId, isActive = true }) {
    try {
      this.logger.info('Creating user', { username, roleId });

      // Create user entity
      const user = new User({
        username,
        password,
        fullName,
        roleId,
        isActive
      });

      // Validate user data
      const validation = user.validate();
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if username already exists
      const existingUser = await this.userRepository.findByUsername(username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Verify role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // Validate password
      if (!user.isValidPassword(password)) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      user.password = hashedPassword;

      // Save user
      const savedUser = await this.userRepository.create(user);

      // Publish domain event
      await this.eventPublisher.publish(User.events.USER_CREATED, {
        userId: savedUser.id,
        username: savedUser.username,
        roleId: savedUser.roleId,
        createdAt: new Date()
      });

      this.logger.info('User created successfully', { 
        userId: savedUser.id, 
        username: savedUser.username 
      });

      return {
        success: true,
        data: savedUser,
        message: 'User created successfully'
      };

    } catch (error) {
      this.logger.error('Failed to create user', { 
        username, 
        error: error.message 
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CreateUserUseCase;