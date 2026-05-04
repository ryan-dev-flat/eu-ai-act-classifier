'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTemplate } from '@/lib/template';
import { useCreateClassification } from '@/lib/hooks';
import { initialState, toIntake, type AnswerValue, type WizardState } from './wizard-state';
import { PathwayStep, ScreenerStep, SystemStep } from './Steps';

const STEP_TITLES = ['Pathway', 'System', 'Screener', 'Review'];

export default function NewClassificationPage() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialState);
  const create = useCreateClassification();

  const template = getTemplate(state.pathway === 'gpai' ? 'gpai-v1' : 'standard-deployer-v1');
  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));
  const setAnswer = (id: string, v: AnswerValue) =>
    setState((s) => ({ ...s, answers: { ...s.answers, [id]: v } }));

  const canAdvance = (() => {
    if (state.step === 2) return /^[0-9a-f-]{36}$/i.test(state.systemId);
    return true;
  })();

  const onSubmit = async () => {
    const result = await create.mutateAsync(toIntake(state));
    router.push(`/classifications/${result.classificationId}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">New classification</h1>
      <ol className="mt-4 flex gap-2 text-xs">
        {STEP_TITLES.map((t, i) => (
          <li
            key={t}
            className={`rounded px-2 py-1 ${
              state.step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {i + 1}. {t}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {state.step === 1 && (
          <PathwayStep pathway={state.pathway} onChange={(p) => update({ pathway: p })} />
        )}
        {state.step === 2 && (
          <SystemStep
            systemId={state.systemId}
            domain={state.domain}
            onSystemId={(v) => update({ systemId: v })}
            onDomain={(v) => update({ domain: v })}
          />
        )}
        {state.step === 3 && (
          <ScreenerStep template={template} answers={state.answers} onAnswer={setAnswer} />
        )}
        {state.step === 4 && <ReviewPanel state={state} />}
      </div>

      {create.error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {create.error.message}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          disabled={state.step === 1 || create.isPending}
          onClick={() => update({ step: (state.step - 1) as WizardState['step'] })}
          className="rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          Back
        </button>
        {state.step < 4 ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => update({ step: (state.step + 1) as WizardState['step'] })}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={create.isPending}
            onClick={onSubmit}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {create.isPending ? 'Submitting…' : 'Submit classification'}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewPanel({ state }: { state: WizardState }) {
  const answered = Object.entries(state.answers);
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-1">
        <dt className="text-gray-500">Pathway</dt>
        <dd>{state.pathway}</dd>
        <dt className="text-gray-500">System ID</dt>
        <dd className="font-mono text-xs">{state.systemId}</dd>
        <dt className="text-gray-500">Domain</dt>
        <dd>{state.domain}</dd>
        <dt className="text-gray-500">Answers</dt>
        <dd>{answered.length} provided</dd>
      </dl>
      <details className="rounded border border-gray-200 p-3">
        <summary className="cursor-pointer text-xs text-gray-600">Show answers</summary>
        <ul className="mt-2 space-y-1 text-xs">
          {answered.map(([id, v]) => (
            <li key={id}>
              <span className="font-mono">{id}</span>: <span>{String(v)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
