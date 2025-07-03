import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  model: string | null;
  status: 'checking' | 'ready' | 'error';
}

export const StatusBar: React.FC<StatusBarProps> = ({ model, status }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'checking': return '🔄';
      case 'ready': return '✅';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'checking': return 'Kontrol ediliyor...';
      case 'ready': return 'Hazır';
      case 'error': return 'Hata';
      default: return 'Bilinmiyor';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking': return 'yellow';
      case 'ready': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Box 
      borderStyle="single" 
      borderColor="gray" 
      paddingX={1} 
      justifyContent="space-between"
      marginBottom={1}
    >
      <Box>
        <Text color="cyan">🚀 LocoDex CLI</Text>
        {model && (
          <>
            <Text color="gray"> | </Text>
            <Text color="blue">🤖 {model}</Text>
          </>
        )}
      </Box>
      
      <Box>
        <Text color={getStatusColor()}>
          {getStatusIcon()} {getStatusText()}
        </Text>
      </Box>
    </Box>
  );
};

