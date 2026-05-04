'use client';

import type { ClassificationPathway } from '@eu-ai-act/shared-types';
import type { IntakeTemplate, TemplateQuestion } from '@/lib/template';
import type { AnswerValue, WizardDomain, WizardState } from './wizard-state';

interface PathwayStepProps {
  pathway: ClassificationPathway;
  onChange: (p: ClassificationPathway) => void;
}

export function PathwayStep({ pathway, onChange }: PathwayStepProps) {
  const options: { value: ClassificationPathway; title: string; desc: string }[] = [
    { value: 'standard', title: 'Standard deployer / provider', desc: 'AI system deployed or placed on the EU market — Annex III screener.' },
    { value: 'gpai', title: 'GPAI model provider', desc: 'General-purpose AI model — Article 51–55 obligations.' },
  ];
  return (
    <div className="space-y-3">
      {options.map((o) => (
        <label
          key={o.value}
          className={`block cursor-pointer rounded-lg border p-4 ${
            pathway === o.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
          }`}
        >
          <input
            type="radio"
            name="pathway"
            value={o.value}
            checked={pathway === o.value}
            onChange={() => onChange(o.value)}
            className="mr-3"
          />
          <span className="font-medium">{o.title}</span>
          <p className="ml-6 mt-1 text-sm text-gray-600">{o.desc}</p>
        </label>
      ))}
    </div>
  );
}

interface SystemStepProps {
  systemId: string;
  domain: WizardDomain;
  onSystemId: (v: string) => void;
  onDomain: (v: WizardDomain) => void;
}

export function SystemStep({ systemId, domain, onSystemId, onDomain }: SystemStepProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">AI system ID (UUID)</span>
        <input
          type="text"
          value={systemId}
          onChange={(e) => onSystemId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000020"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <span className="mt-1 block text-xs text-gray-500">
          Must reference an existing row in <code>ai_systems</code>. The MVP seed data provides one per tenant.
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Domain</span>
        <select
          value={domain}
          onChange={(e) => onDomain(e.target.value as WizardDomain)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="other">Other / general</option>
          <option value="hr_tech">HR tech</option>
          <option value="fintech">Fintech</option>
          <option value="martech">Martech</option>
        </select>
      </label>
    </div>
  );
}

interface ScreenerStepProps {
  template: IntakeTemplate;
  answers: Record<string, AnswerValue>;
  onAnswer: (id: string, v: AnswerValue) => void;
}

export function ScreenerStep({ template, answers, onAnswer }: ScreenerStepProps) {
  return (
    <div className="space-y-6">
      {template.sections.map((section) => (
        <fieldset key={section.id} className="rounded-lg border border-gray-200 p-4">
          <legend className="px-2 text-sm font-semibold">{section.title}</legend>
          {section.rationale && (
            <p className="mb-3 text-xs text-gray-500">{section.rationale}</p>
          )}
          <div className="space-y-3">
            {section.questions.map((q) => (
              <QuestionInput key={q.id} q={q} value={answers[q.id]} onChange={(v) => onAnswer(q.id, v)} />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function QuestionInput({
  q,
  value,
  onChange,
}: {
  q: TemplateQuestion;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  if (q.type === 'boolean') {
    return (
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm">{q.label}</span>
        <div className="flex shrink-0 gap-2 text-xs">
          {[
            { v: true, label: 'Yes' },
            { v: false, label: 'No' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              className={`rounded border px-3 py-1 ${
                value === o.v ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (q.type === 'single_select') {
    return (
      <label className="block text-sm">
        <span>{q.label}</span>
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">—</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return null;
}
