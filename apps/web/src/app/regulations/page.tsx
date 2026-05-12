'use client';

import { useState } from 'react';
import { useObligations, useEnforcementMap, useTimelineCalendar } from '@/lib/hooks';

export default function RegulationsPage() {
  const [riskTier, setRiskTier] = useState('');
  const [role, setRole] = useState('');
  const [memberState, setMemberState] = useState('');

  const obligations = useObligations(riskTier || undefined, role || undefined);
  const map = useEnforcementMap(memberState || undefined);
  const calendar = useTimelineCalendar();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Regulations</h1>

      {/* Obligation catalog */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Obligation catalog</h2>
        <div className="flex gap-3 mb-4">
          <select
            className="border rounded px-3 py-2"
            value={riskTier}
            onChange={(e) => setRiskTier(e.target.value)}
          >
            <option value="">All risk tiers</option>
            <option value="high_risk">High risk</option>
            <option value="limited_risk">Limited risk</option>
            <option value="gpai">GPAI</option>
            <option value="gpai_systemic_risk">GPAI (systemic)</option>
          </select>
          <select
            className="border rounded px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="provider">Provider</option>
            <option value="deployer">Deployer</option>
            <option value="gpai_provider">GPAI Provider</option>
          </select>
        </div>
        {obligations.isLoading && <p className="text-gray-500">Loading obligations…</p>}
        {obligations.error && <p className="text-red-600">Failed to load obligations.</p>}
        <div className="space-y-3">
          {obligations.data?.obligations.map((o) => (
            <div key={o.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <h3 className="font-medium">{o.title}</h3>
                <span className="text-xs bg-gray-100 rounded px-2 py-1">{o.article}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{o.summary}</p>
              <div className="flex gap-2 mt-2 text-xs text-gray-500">
                <span>Risk: {o.riskTiers.join(', ')}</span>
                <span>|</span>
                <span>Applies to: {o.appliesTo.join(', ')}</span>
                <span>|</span>
                <span>Effective: {o.effectiveFrom}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Enforcement calendar */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Enforcement calendar</h2>
        {calendar.isLoading && <p className="text-gray-500">Loading calendar…</p>}
        <div className="space-y-2">
          {calendar.data?.milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-4 border rounded p-3">
              <div className="text-sm font-mono whitespace-nowrap">{m.date}</div>
              <div>
                <p className="text-sm font-medium">{m.description}</p>
                <p className="text-xs text-gray-500">Scope: {m.scope}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Enforcement authority map */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Enforcement authorities</h2>
        <div className="flex gap-3 mb-4">
          <select
            className="border rounded px-3 py-2"
            value={memberState}
            onChange={(e) => setMemberState(e.target.value)}
          >
            <option value="">All member states</option>
            <option value="EU">EU (AI Office)</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="ES">Spain</option>
            <option value="IE">Ireland</option>
            <option value="NL">Netherlands</option>
          </select>
        </div>
        {map.isLoading && <p className="text-gray-500">Loading map…</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {map.data?.authorities.map((a) => (
            <div key={a.memberState + a.systemDomain} className="border rounded-lg p-4">
              <h3 className="font-medium">{a.authorityName}</h3>
              <p className="text-sm text-gray-500">{a.memberState} — {a.systemDomain}</p>
              <a
                href={a.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline mt-1 inline-block"
              >
                Contact
              </a>
              {a.notes && <p className="text-xs text-gray-500 mt-1">{a.notes}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
