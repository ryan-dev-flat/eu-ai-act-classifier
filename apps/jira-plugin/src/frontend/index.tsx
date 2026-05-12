import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Badge,
  Box,
  Button,
  CodeBlock,
  Heading,
  Inline,
  List,
  ListItem,
  Lozenge,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  TextArea,
  Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import type { ClassificationSummary } from '../types';

const App: React.FC = () => {
  const [data, setData] = useState<ClassificationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [classificationId, setClassificationId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [domain, setDomain] = useState('other');
  const [pathway, setPathway] = useState<'standard' | 'gpai'>('standard');
  const [answersJson, setAnswersJson] = useState('{}');

  async function refresh() {
    setError(null);
    try {
      const result = await invoke<ClassificationSummary>('getClassificationForIssue');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function linkExisting() {
    if (!classificationId.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await invoke<ClassificationSummary>('linkClassificationToIssue', {
        classificationId: classificationId.trim(),
      });
      setData(result);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function runAssessment() {
    if (!systemId.trim()) {
      setError('System ID is required to run a new assessment.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const answers = JSON.parse(answersJson || '{}') as Record<string, unknown>;
      const result = await invoke<ClassificationSummary>('startClassification', {
        systemId: systemId.trim(),
        domain: domain.trim() || 'other',
        pathway,
        templateId: pathway === 'gpai' ? 'gpai' : 'standard-deployer',
        answers,
      });
      setData(result);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!data && !error) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner size="small" />
        <Text>Loading EU AI Act classification…</Text>
      </Inline>
    );
  }

  return (
    <Stack space="space.200">
      <Inline spread="space-between" alignBlock="center">
        <Heading as="h3">EU AI Act Classification</Heading>
        <Button appearance="subtle" onClick={() => refresh()}>
          Refresh
        </Button>
      </Inline>

      {error && <SectionMessage appearance="error" title="EU AI Act integration error"><Text>{error}</Text></SectionMessage>}
      {data?.error && <SectionMessage appearance="warning" title="Backend lookup failed"><Text>{data.error}</Text></SectionMessage>}

      {data && <SummaryCard data={data} />}

      <Inline space="space.100">
        <Button appearance="primary" onClick={() => setModalOpen(true)}>
          Perform Risk Assessment
        </Button>
      </Inline>

      <ModalTransition>
        {isModalOpen && (
          <Modal onClose={() => setModalOpen(false)} width="large" label="Perform EU AI Act risk assessment">
            <ModalHeader>
              <ModalTitle>Perform Risk Assessment</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <Stack space="space.200">
                <SectionMessage title="Assessment options">
                  <Text>Link this Jira issue to an existing classification, or run a new assessment using a known AI system ID.</Text>
                </SectionMessage>
                <Heading as="h4">Link existing classification</Heading>
                <Textfield
                  name="classificationId"
                  placeholder="Classification UUID"
                  value={classificationId}
                  onChange={(e) => setClassificationId(String(e.target.value ?? ''))}
                />
                <Heading as="h4">Run new classification</Heading>
                <Textfield
                  name="systemId"
                  placeholder="AI System UUID"
                  value={systemId}
                  onChange={(e) => setSystemId(String(e.target.value ?? ''))}
                />
                <Textfield
                  name="domain"
                  placeholder="hr_tech | fintech | martech | other"
                  value={domain}
                  onChange={(e) => setDomain(String(e.target.value ?? ''))}
                />
                <Textfield
                  name="pathway"
                  placeholder="standard or gpai"
                  value={pathway}
                  onChange={(e) => setPathway(String(e.target.value) === 'gpai' ? 'gpai' : 'standard')}
                />
                <TextArea
                  name="answersJson"
                  value={answersJson}
                  onChange={(e) => setAnswersJson(String(e.target.value ?? '{}'))}
                />
                <Text>Answers must be a JSON object keyed by questionnaire question ID.</Text>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Inline space="space.100">
                <Button appearance="subtle" onClick={() => setModalOpen(false)} isDisabled={isSubmitting}>
                  Cancel
                </Button>
                <Button appearance="default" onClick={linkExisting} isDisabled={isSubmitting || !classificationId.trim()}>
                  Link existing
                </Button>
                <Button appearance="primary" onClick={runAssessment} isDisabled={isSubmitting || !systemId.trim()}>
                  Run assessment
                </Button>
              </Inline>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </Stack>
  );
};

function SummaryCard({ data }: { data: ClassificationSummary }) {
  if (data.status === 'not_started') {
    return (
      <SectionMessage appearance="information" title="No classification linked">
        <Text>Use Perform Risk Assessment to link or create a classification for Jira issue {data.issueKey}.</Text>
      </SectionMessage>
    );
  }

  return (
    <Box padding="space.100">
      <Stack space="space.150">
        <Inline space="space.100" alignBlock="center">
          <Text>Risk tier:</Text>
          <Lozenge appearance={riskAppearance(data.riskTier)}>{data.riskTier ?? 'unknown'}</Lozenge>
          <Badge>{data.status}</Badge>
        </Inline>
        <Text>Workflow state: {data.workflowState ?? 'not started'}{data.activeTaskRole ? ` — active ${data.activeTaskRole} review` : ''}</Text>
        <Text>Classification ID: {data.classificationId}</Text>

        <Heading as="h4">Primary obligations</Heading>
        {data.obligations.length > 0 ? (
          <List type="unordered">{data.obligations.map((obligation) => <ListItem key={obligation}>{obligation}</ListItem>)}</List>
        ) : (
          <Text>No obligations recorded.</Text>
        )}

        {data.rationale && (
          <Stack space="space.100">
            <Heading as="h4">Rationale</Heading>
            <CodeBlock text={data.rationale} language="text" />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

function riskAppearance(riskTier: ClassificationSummary['riskTier']) {
  if (riskTier === 'prohibited' || riskTier === 'high_risk' || riskTier === 'gpai_systemic_risk') return 'removed';
  if (riskTier === 'limited_risk' || riskTier === 'gpai') return 'inprogress';
  return 'success';
}

ForgeReconciler.render(<App />);
