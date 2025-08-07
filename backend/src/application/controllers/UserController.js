/**
 * User Controller
 * Handles HTTP requests and coordinates with use cases
 */
class UserController {
  constructor({
    createUserUseCase,
    getAllUsersUseCase,
    getUserByIdUseCase,
    updateUserUseCase,
    deleteUserUseCase,
    toggleUserStatusUseCase,
    changePasswordUseCase,
    logger,
    responseHandler
  }) {
    this.createUserUseCase = createUserUseCase;
    this.getAllUsersUseCase = getAllUsersUseCase;
    this.getUserByIdUseCase = getUserByIdUseCase;
    this.updateUserUseCase = updateUserUseCase;
    this.deleteUserUseCase = deleteUserUseCase;
    this.toggleUserStatusUseCase = toggleUserStatusUseCase;
    this.changePasswordUseCase = changePasswordUseCase;
    this.logger = logger;
    this.responseHandler = responseHandler;
  }

  async getAllUsers(req, res) {
    try {
      this.logger.info('GET /users - Request received', { 
        userId: req.user?.id,
        query: req.query 
      });

      // Extract query parameters
      const { 
        include_inactive = 'false', 
        page = 1, 
        limit = 50 
      } = req.query;

      // Execute use case
      const result = await this.getAllUsersUseCase.execute({
        includeInactive: include_inactive === 'true',
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return this.responseHandler.success(res, result, 'Users retrieved successfully');

    } catch (error) {
      this.logger.error('Error in getAllUsers', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      
      this.logger.info('GET /users/:id - Request received', { 
        requestedUserId: id,
        currentUserId: req.user?.id 
      });

      const result = await this.getUserByIdUseCase.execute(parseInt(id));
      return this.responseHandler.success(res, result, 'User retrieved successfully');

    } catch (error) {
      this.logger.error('Error in getUserById', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async createUser(req, res) {
    try {
      const { username, password, fullName, roleId } = req.body;
      
      this.logger.info('POST /users - Request received', { 
        username,
        roleId,
        createdBy: req.user?.id 
      });

      // Validate required fields
      if (!username || !password || !fullName || !roleId) {
        return this.responseHandler.error(res, 'Username, password, full name, and role are required', 400);
      }

      const result = await this.createUserUseCase.execute({
        username,
        password,
        fullName,
        roleId: parseInt(roleId)
      });

      return this.responseHandler.success(res, result, 'User created successfully', 201);

    } catch (error) {
      this.logger.error('Error in createUser', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      this.logger.info('PUT /users/:id - Request received', { 
        userId: id,
        updateData: { ...updateData, password: updateData.password ? '[HIDDEN]' : undefined },
        updatedBy: req.user?.id 
      });

      const result = await this.updateUserUseCase.execute({
        userId: parseInt(id),
        ...updateData
      });

      return this.responseHandler.success(res, result, 'User updated successfully');

    } catch (error) {
      this.logger.error('Error in updateUser', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      
      this.logger.info('DELETE /users/:id - Request received', { 
        userId: id,
        deletedBy: req.user?.id 
      });

      // Prevent self-deletion
      if (req.user.id === parseInt(id)) {
        return this.responseHandler.error(res, 'Cannot delete your own account', 400);
      }

      const result = await this.deleteUserUseCase.execute(parseInt(id));
      return this.responseHandler.success(res, result, 'User deleted successfully');

    } catch (error) {
      this.logger.error('Error in deleteUser', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      
      this.logger.info('PATCH /users/:id/toggle - Request received', { 
        userId: id,
        toggledBy: req.user?.id 
      });

      const result = await this.toggleUserStatusUseCase.execute(parseInt(id));
      return this.responseHandler.success(res, result, 'User status toggled successfully');

    } catch (error) {
      this.logger.error('Error in toggleUserStatus', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }

  async changePassword(req, res) {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      
      this.logger.info('PATCH /users/:id/password - Request received', { 
        userId: id,
        changedBy: req.user?.id 
      });

      if (!newPassword) {
        return this.responseHandler.error(res, 'New password is required', 400);
      }

      const result = await this.changePasswordUseCase.execute({
        userId: parseInt(id),
        currentPassword,
        newPassword
      });

      return this.responseHandler.success(res, result, 'Password changed successfully');

    } catch (error) {
      this.logger.error('Error in changePassword', { error: error.message, stack: error.stack });
      return this.responseHandler.error(res, 'Internal server error', 500);
    }
  }
}

module.exports = UserController;