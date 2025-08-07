import React, { useState, useEffect } from 'react';
import { Badge } from '@mui/material';
import { NotificationsActive, Notifications } from '@mui/icons-material';

export default function BellNotification({ notificationCount = 0, onClick = () => {} }) {
  const hasNotifications = notificationCount > 0;

  return (
    <Badge 
      badgeContent={notificationCount > 0 ? notificationCount : 0} 
      color="error"
      overlap="rectangular"
    >
      {hasNotifications ? (
        <NotificationsActive 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.87)',
            fontSize: '1.3rem',
          }} 
        />
      ) : (
        <Notifications 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '1.3rem',
          }} 
        />
      )}
    </Badge>
  );
}