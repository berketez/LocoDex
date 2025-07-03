import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import Spinner from 'ink-spinner';
import { ModelSelector } from './ModelSelector.js';
import { ChatInterface } from './ChatInterface.js';
import { StatusBar } from './StatusBar.js';

interface LocoDexCLIProps {
  options: {
    model?: string;
    interactive?: boolean;
    listModels?: boolean;
    status?: boolean;
  };
}

export const LocoDexCLI: React.FC<LocoDexCLIProps> = ({ options }) => {
  const [currentModel, setCurrentModel] = useState<string | null>(options.model || null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(!options.model);
  const [systemStatus, setSystemStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  useEffect(() => {
    // Sistem durumu kontrolü
    const checkSystem = async () => {
      try {
        // Ollama ve LM Studio kontrolü
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simüle edilmiş kontrol
        setSystemStatus('ready');
      } catch (error) {
        setSystemStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    checkSystem();
  }, []);

  const handleModelSelect = (model: string) => {
    setCurrentModel(model);
    setShowModelSelector(false);
  };

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Gradient name="rainbow">
          <BigText text="LocoDex" />
        </Gradient>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Sistem kontrol ediliyor...</Text>
        </Box>
      </Box>
    );
  }

  if (systemStatus === 'error') {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="red">❌ Sistem hatası tespit edildi!</Text>
        <Text color="yellow">⚠️  Lütfen Ollama veya LM Studio'nun çalıştığından emin olun.</Text>
        <Newline />
        <Text color="cyan">Kurulum için: locodex setup</Text>
      </Box>
    );
  }

  if (showModelSelector) {
    return (
      <Box flexDirection="column">
        <Gradient name="rainbow">
          <BigText text="LocoDex" />
        </Gradient>
        <Text color="gray">AI Destekli Yazılım Mühendisliği Platformu</Text>
        <Newline />
        <ModelSelector onSelect={handleModelSelect} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar model={currentModel} status={systemStatus} />
      <Box flexGrow={1}>
        <ChatInterface model={currentModel} />
      </Box>
    </Box>
  );
};

