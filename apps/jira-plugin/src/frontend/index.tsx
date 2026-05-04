import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Button, Stack } from '@forge/react';
import { invoke } from '@forge/bridge';

interface ClassificationStatus {
  issueKey: string;
  status: 'not_started' | 'in_review' | 'approved' | 'rejected';
  riskTier: string | null;
}

const App: React.FC = () => {
  const [data, setData] = useState<ClassificationStatus | null>(null);

  useEffect(() => {
    invoke<ClassificationStatus>('getClassificationForIssue').then(setData);
  }, []);

  if (!data) return <Text>Loading…</Text>;

  return (
    <Stack space="space.100">
      <Text>EU AI Act classification status: {data.status}</Text>
      {data.riskTier && <Text>Risk tier: {data.riskTier}</Text>}
      <Button appearance="primary" onClick={() => invoke('startClassification')}>
        Start classification
      </Button>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
