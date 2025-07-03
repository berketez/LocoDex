import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';

interface ModelSelectorProps {
  onSelect: (model: string) => void;
}

interface ModelItem {
  label: string;
  value: string;
  description?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onSelect }) => {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const discoverModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const discoveredModels: ModelItem[] = [];
        
        // Check Ollama
        try {
          const ollamaResponse = await fetch('http://localhost:11434/api/tags');
          if (ollamaResponse.ok) {
            const ollamaData = await ollamaResponse.json();
            ollamaData.models?.forEach((model: any) => {
              discoveredModels.push({
                label: `🦙 ${model.name} (Ollama)`,
                value: model.name,
                description: `Boyut: ${(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB`
              });
            });
          }
        } catch (err) {
          console.log('Ollama bulunamadı:', err);
        }

        // Check LM Studio
        try {
          const lmstudioResponse = await fetch('http://localhost:1234/v1/models');
          if (lmstudioResponse.ok) {
            const lmstudioData = await lmstudioResponse.json();
            lmstudioData.data?.forEach((model: any) => {
              discoveredModels.push({
                label: `🎬 ${model.id} (LM Studio)`,
                value: model.id,
                description: 'LM Studio lokal model'
              });
            });
          }
        } catch (err) {
          console.log('LM Studio bulunamadı:', err);
        }

        if (discoveredModels.length === 0) {
          // Fallback to example models if no real models found
          const exampleModels: ModelItem[] = [
            {
              label: '🦙 Llama 3.2 (Örnek)',
              value: 'llama3.2',
              description: 'Önce ollama pull llama3.2 çalıştırın'
            },
            {
              label: '💻 Code Llama (Örnek)',
              value: 'codellama',
              description: 'Önce ollama pull codellama çalıştırın'
            },
            {
              label: '🌟 Mistral (Örnek)',
              value: 'mistral',
              description: 'Önce ollama pull mistral çalıştırın'
            }
          ];
          setModels(exampleModels);
          setError('Hiç model bulunamadı. Örnek modeller gösteriliyor.');
        } else {
          setModels(discoveredModels);
        }
      } catch (err) {
        setError('Model keşfi sırasında hata oluştu: ' + (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    discoverModels();
    
    // Refresh every 30 seconds
    const interval = setInterval(discoverModels, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Mevcut modeller keşfediliyor...</Text>
        </Box>
        <Text color="gray">Ollama ve LM Studio kontrol ediliyor...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="red">❌ {error}</Text>
        <Text color="yellow">⚠️  Lütfen Ollama veya LM Studio'nun çalıştığından emin olun.</Text>
      </Box>
    );
  }

  if (models.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="yellow">⚠️  Hiç model bulunamadı!</Text>
        <Text color="gray">Önce bir model indirmeniz gerekiyor:</Text>
        <Text color="cyan">  ollama pull llama2:7b</Text>
        <Text color="gray">veya LM Studio'dan bir model indirin.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan">🤖 Kullanmak istediğiniz AI modelini seçin:</Text>
      <Box marginTop={1}>
        <SelectInput
          items={models}
          onSelect={({ value }) => onSelect(value)}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">💡 İpucu: Kod geliştirme için Code Llama önerilir</Text>
      </Box>
    </Box>
  );
};

